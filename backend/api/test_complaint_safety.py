from datetime import date
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from api.models import (ComplaintProcessingRun, ProcessedComplaint, StockOperation,
                        TrackingComplaint, SalesRequest, SalesRequestProduct)
from api.services.complaint_jobs import enqueue_run, process_next_run
from api.services.complaint_processor import ComplaintProcessor
from api.services.stock_operations import deduct_once, StockReviewRequired
from courier_api.stock_lock import stock_write_lock


class ComplaintSafetyTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.sheets = Mock()
        self.sheets.update_technician_stock.side_effect = self.write

    def write(self, technician, code, delta, before_write):
        before_write({'before_total': 2, 'after_total': 1,
                      'rows': [{'row': 3, 'before': 2, 'after': 1}]})
        return True

    def deduct(self, **overrides):
        params = dict(source='complaint', reference='PWCAN/171026/12',
                      technician_name='SAHAD', product_code='C611399', quantity=1)
        params.update(overrides)
        return deduct_once(self.sheets, **params)

    def row(self, **overrides):
        fields = dict(sheet_row_number=2, complaint_no='PWCAN/171026/12',
                      technician_name='SAHAD', product_code='C611399', quantity='1',
                      complaint_status='CLOSED', sheet_column_p='')
        fields.update(overrides)
        return TrackingComplaint.objects.create(**fields)

    def test_repeated_request_and_case_variants_deduct_once(self):
        first, changed = self.deduct()
        second, repeated = self.deduct(product_code='c611399', technician_name='sahad')
        self.assertTrue(changed)
        self.assertFalse(repeated)
        self.assertEqual(first.pk, second.pk)
        self.sheets.update_technician_stock.assert_called_once()

    def test_editing_successful_quantity_does_not_rededuct(self):
        self.deduct()
        with self.assertRaises(StockReviewRequired):
            self.deduct(quantity=2)
        self.sheets.update_technician_stock.assert_called_once()

    def test_timeout_after_write_is_never_automatically_retried(self):
        def uncertain(*args, **kwargs):
            self.write(*args, **kwargs)
            raise TimeoutError('response lost')
        self.sheets.update_technician_stock.side_effect = uncertain
        with self.assertRaises(StockReviewRequired):
            self.deduct()
        with self.assertRaises(StockReviewRequired):
            self.deduct()
        self.sheets.update_technician_stock.assert_called_once()
        self.assertEqual(StockOperation.objects.get().status, 'needs_review')

    def test_prewrite_failure_can_retry(self):
        self.sheets.update_technician_stock.side_effect = ValueError('Insufficient stock')
        with self.assertRaises(ValueError):
            self.deduct()
        self.assertEqual(StockOperation.objects.get().status, 'failed')
        self.sheets.update_technician_stock.side_effect = self.write
        self.assertTrue(self.deduct()[1])

    def test_crashed_applying_operation_requires_review(self):
        operation, _ = self.deduct()
        StockOperation.objects.filter(pk=operation.pk).update(status='applying')
        with self.assertRaises(StockReviewRequired):
            self.deduct()
        self.sheets.update_technician_stock.assert_called_once()

    def test_db_failure_after_sheet_write_blocks_retry(self):
        original = StockOperation.save
        def fail_completion(instance, *args, **kwargs):
            if instance.status == 'complete':
                raise RuntimeError('database disconnected after sheet write')
            return original(instance, *args, **kwargs)
        with patch.object(StockOperation, 'save', fail_completion):
            with self.assertRaises(StockReviewRequired):
                self.deduct()
        self.assertEqual(StockOperation.objects.get().status, 'needs_review')
        with self.assertRaises(StockReviewRequired):
            self.deduct()

    def test_legacy_failures_and_successes_are_preserved(self):
        self.row()
        ProcessedComplaint.objects.create(complaint_no='PWCAN/171026/12',
            technician_name='SAHAD', product_code='C611399', part_name='Item',
            quantity_reduced=0, stock_reduced=False)
        processor = ComplaintProcessor()
        processor.sheets_sync = self.sheets
        result = processor.process_complaints(date(2026, 3, 22))
        self.assertEqual(result['processed_count'], 0)
        self.assertEqual(result['skipped_count'], 1)
        self.sheets.update_technician_stock.assert_not_called()

    def test_different_parts_under_one_complaint_are_both_processed(self):
        self.row()
        self.row(sheet_row_number=3, product_code='T782299')
        processor = ComplaintProcessor()
        processor.sheets_sync = self.sheets
        result = processor.process_complaints(date(2026, 3, 22))
        self.assertEqual(result['processed_count'], 2)
        self.assertEqual(StockOperation.objects.count(), 2)

    def test_duplicate_complaint_product_lines_require_review(self):
        self.row()
        self.row(sheet_row_number=3, product_code='c611399')
        processor = ComplaintProcessor()
        self.assertEqual(processor.get_new_pending_complaints(date(2026, 3, 22)), [])
        self.assertTrue(processor.errors)

    def test_invalid_description_is_reported_before_any_sheet_call(self):
        self.row(product_code='C61PE0299 Outlet assy -SP- Size 250mm/ 10 inches=1 NO')
        processor = ComplaintProcessor()
        processor.sheets_sync = self.sheets
        result = processor.process_complaints(date(2026, 3, 22))
        self.assertFalse(result['success'])
        self.sheets.update_technician_stock.assert_not_called()

    def test_column_p_eligibility_remains_unchanged(self):
        for value, eligible in [('', True), ('24/10/26', True), ('21-Mar-2026', False),
                                ('22-Mar-2026', True)]:
            TrackingComplaint.objects.all().delete()
            self.row(sheet_column_p=value)
            with self.subTest(value=value):
                self.assertEqual(bool(ComplaintProcessor().get_new_pending_complaints(
                    date(2026, 3, 22))), eligible)

    def test_mapping_does_not_remove_name_spaces(self):
        self.assertEqual(ComplaintProcessor().get_technician_sheet_name(' JINU   P. '), 'JINU P.')

    def test_overlapping_job_requests_return_same_job(self):
        first, created = enqueue_run(self.admin, date(2026, 3, 22))
        second, created_again = enqueue_run(self.admin, date(2026, 3, 22))
        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(first.pk, second.pk)

    def test_post_returns_202_without_running_sheet_calls(self):
        with patch('api.services.complaint_jobs.ComplaintProcessor') as processor:
            response = self.client.post('/process/', {'since_date': '2026-03-22'})
            self.assertEqual(response.status_code, 202)
            self.assertTrue(response.data['accepted'])
            self.assertFalse(response.data['success'])
            processor.assert_not_called()
        self.assertEqual(self.client.get('/status/').data['run']['id'], response.data['run']['id'])

    def test_invalid_date_returns_400(self):
        self.assertEqual(self.client.post('/process/', {'since_date': 'wrong'}).status_code, 400)

    @override_settings(COMPLAINT_PROCESSING_ENABLED=False)
    def test_rollout_switch_disables_new_batches(self):
        self.assertEqual(self.client.post('/process/').status_code, 503)
        self.assertEqual(ComplaintProcessingRun.objects.count(), 0)

    def test_non_admin_cannot_start_or_read_processing(self):
        self.admin.is_staff = False
        self.admin.save()
        self.assertEqual(self.client.post('/process/').status_code, 403)
        self.assertEqual(self.client.get('/status/').status_code, 403)

    def test_worker_records_completion_and_releases_active_slot(self):
        run, _ = enqueue_run(self.admin, date(2026, 3, 22))
        self.assertTrue(process_next_run())
        run.refresh_from_db()
        self.assertEqual(run.status, 'completed')
        self.assertIsNone(run.active_slot)
        self.assertFalse(process_next_run())

    def test_worker_never_steals_crashed_running_job(self):
        run, _ = enqueue_run(self.admin, date(2026, 3, 22))
        run.status = 'running'
        run.save()
        self.assertFalse(process_next_run())
        self.assertFalse(enqueue_run(self.admin, date(2026, 3, 22))[1])

    def test_nested_stock_lock_is_reentrant(self):
        with stock_write_lock():
            with stock_write_lock():
                pass

    def test_sales_partial_failure_keeps_pending_and_retry_does_not_repeat(self):
        sale = SalesRequest.objects.create(technician=self.admin, company_name='Test', total_amount=10)
        for code in ['C611399', 'T782299']:
            SalesRequestProduct.objects.create(sales_request=sale, product_name='Part',
                                               product_code=code, quantity=1, mrp=5)
        def partial(tech, code, delta, before_write):
            if code == 'T782299':
                raise ValueError('Insufficient stock')
            return self.write(tech, code, delta, before_write)
        self.sheets.update_technician_stock.side_effect = partial
        with patch('api.views.SheetsSync', return_value=self.sheets):
            self.assertEqual(self.client.post(f'/sales/{sale.pk}/approve/').status_code, 400)
            sale.refresh_from_db()
            self.assertEqual(sale.status, 'PENDING')
            self.sheets.update_technician_stock.side_effect = self.write
            self.assertEqual(self.client.post(f'/sales/{sale.pk}/approve/').status_code, 200)
        self.assertEqual(StockOperation.objects.filter(status='complete').count(), 2)
        # First product succeeds once; second fails once then succeeds.
        self.assertEqual(self.sheets.update_technician_stock.call_count, 3)
