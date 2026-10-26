import json
from datetime import timedelta
from io import StringIO
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from api.models import CompanyStock, ProcessedComplaint, StockOperation, TechnicianStockSnapshot, TrackingComplaint
from api.services.sheet_snapshot_sync import SheetSnapshotSync, update_technician_stock_snapshot
from courier_api import stock_lock


@override_settings(STOCK_ALLOW_TEST_LOCK=True)
class StockSnapshotTests(TransactionTestCase):
    def stock(self, tech="Sahad", code="ABC", quantity=4, name="Part"):
        return TechnicianStockSnapshot.objects.create(
            technician_name=tech, spare_id=code, quantity=quantity, name=name)

    def test_delta_merges_unicode_and_spacing_variants_once(self):
        first = self.stock("  SAHAD   Khan ", " Straße ", 8)
        self.stock("sahad khan", "STRASSE", -2)
        untouched = self.stock("Other", "STRASSE", 19)
        result = update_technician_stock_snapshot("Sahad Khan", "strasse", -3)
        first.refresh_from_db()
        untouched.refresh_from_db()
        self.assertEqual(result, 1)
        self.assertEqual(first.quantity, 3)
        self.assertEqual(untouched.quantity, 19)
        self.assertEqual(TechnicianStockSnapshot.objects.count(), 2)

    def test_absolute_zero_overrides_delta_and_merges(self):
        self.stock(quantity=20)
        self.stock("sahad", " abc ", 9)
        update_technician_stock_snapshot("SAHAD", "abc", delta=-2, quantity=0)
        self.assertEqual(TechnicianStockSnapshot.objects.get().quantity, 0)

    def test_absolute_fresh_total_does_not_add_stale_snapshot(self):
        self.stock(quantity=99)
        update_technician_stock_snapshot("Sahad", "ABC", quantity=7, name="Fresh")
        row = TechnicianStockSnapshot.objects.get()
        self.assertEqual((row.quantity, row.name), (7, "Fresh"))

    def test_absolute_missing_row_uses_total_and_legacy_delta_still_works(self):
        self.assertEqual(update_technician_stock_snapshot("  Sahad   Khan ", " ABC ", quantity=5), 0)
        row = TechnicianStockSnapshot.objects.get()
        self.assertEqual((row.technician_name, row.spare_id, row.quantity), ("Sahad Khan", "ABC", 5))
        update_technician_stock_snapshot("Other", "DEF", 3)
        self.assertEqual(TechnicianStockSnapshot.objects.get(spare_id="DEF").quantity, 3)

    def test_zero_delta_noop_and_invalid_absolute_does_not_modify(self):
        self.stock()
        self.assertEqual(update_technician_stock_snapshot("Sahad", "ABC", 0), 0)
        for invalid in ("1.5", "NaN", "Infinity"):
            with self.assertRaises(ValueError):
                update_technician_stock_snapshot("Sahad", "ABC", quantity=invalid)
        self.assertEqual(TechnicianStockSnapshot.objects.get().quantity, 4)

    def test_merge_rolls_back_if_duplicate_deletion_fails(self):
        self.stock(quantity=8)
        self.stock("sahad", "abc", 2)
        with patch("django.db.models.query.QuerySet.delete", side_effect=RuntimeError("delete failed")):
            with self.assertRaises(RuntimeError):
                update_technician_stock_snapshot("Sahad", "ABC", -1)
        self.assertEqual(sorted(TechnicianStockSnapshot.objects.values_list("quantity", flat=True)), [2, 8])

    def test_refresh_sums_canonical_codes_and_holds_lock_from_read_to_replace(self):
        self.stock("old", "obsolete", 100)
        client = Mock()
        worksheet = client.open_by_key.return_value.worksheet.return_value

        def read_rows():
            self.assertTrue(stock_lock._state.held)
            return [["Name", "Code", "Qty", "Tech"],
                    ["Part", " Straße ", "8", "Sahad   Khan"],
                    ["Part", "STRASSE", "-2", " SAHAD Khan "],
                    ["Other", "X", "3", "Other"]]

        worksheet.get_all_values.side_effect = read_rows

        def inspect_query(execute, sql, params, many, context):
            if sql.lstrip().upper().startswith(("INSERT", "DELETE", "UPDATE")):
                self.assertTrue(stock_lock._state.held)
            return execute(sql, params, many, context)

        with connection.execute_wrapper(inspect_query):
            self.assertEqual(SheetSnapshotSync(client).sync_technician_stock(), 2)
        self.assertEqual(TechnicianStockSnapshot.objects.get(technician_name="Sahad Khan").quantity, 6)
        self.assertFalse(TechnicianStockSnapshot.objects.filter(spare_id="obsolete").exists())
        self.assertFalse(stock_lock._state.held)
        worksheet.get_all_values.assert_called_once_with()
        self.assertEqual([call[0] for call in worksheet.method_calls], ["get_all_values"])

    def test_read_failure_keeps_previous_snapshot_and_releases_lock(self):
        self.stock(quantity=7)
        client = Mock()
        client.open_by_key.return_value.worksheet.return_value.get_all_values.side_effect = RuntimeError("offline")
        with self.assertRaises(RuntimeError):
            SheetSnapshotSync(client).sync_technician_stock()
        self.assertEqual(TechnicianStockSnapshot.objects.get().quantity, 7)
        self.assertFalse(stock_lock._state.held)

    def test_write_through_accepts_existing_stock_lock(self):
        with stock_lock.stock_write_lock():
            update_technician_stock_snapshot("Sahad", "ABC", quantity=6)
        self.assertEqual(TechnicianStockSnapshot.objects.get().quantity, 6)


class StockIntegrityAuditTests(TransactionTestCase):
    def audit(self, **options):
        output = StringIO()
        call_command("audit_stock_integrity", stdout=output, **options)
        return json.loads(output.getvalue())

    def test_audit_distinguishes_negative_rows_from_net_and_never_writes(self):
        TechnicianStockSnapshot.objects.create(technician_name="Sahad", spare_id="ABC", quantity=-2)
        TechnicianStockSnapshot.objects.create(technician_name=" SAHAD ", spare_id=" abc ", quantity=5)
        CompanyStock.objects.create(spare_id="DEF", quantity=-1)
        old = timezone.now() - timedelta(hours=2)
        TechnicianStockSnapshot.objects.update(synced_at=old)
        with patch("api.services.sheet_snapshot_sync.get_sheets_client") as client:
            with CaptureQueriesContext(connection) as queries:
                report = self.audit()
        client.assert_not_called()
        for query in queries:
            self.assertTrue(query["sql"].lstrip().upper().startswith(
                ("SELECT", "BEGIN", "COMMIT", "SAVEPOINT", "RELEASE", "SET TRANSACTION")), query["sql"])
        stock = report["technician_stock"]
        self.assertEqual(stock["negative_rows"]["count"], 1)
        self.assertEqual(stock["negative_net_totals"]["count"], 0)
        self.assertEqual(stock["net_totals"]["items"][0]["net_quantity"], 3)
        self.assertEqual(stock["case_or_whitespace_variants"]["product_codes"]["count"], 1)
        self.assertEqual(stock["case_or_whitespace_variants"]["technician_names"]["count"], 1)
        self.assertTrue(report["snapshot_age"]["technician_stock"]["stale_or_unknown"])
        self.assertGreaterEqual(report["snapshot_age"]["technician_stock"]["oldest_row_age_seconds"], 7200)
        self.assertFalse(report["limits"]["google_sheets_read"])
        self.assertEqual(report["company_stock"]["negative_net_totals"]["count"], 1)

    def test_ambiguous_legacy_markers_and_unresolved_statuses(self):
        ProcessedComplaint.objects.create(complaint_no="C1", technician_name="Sahad",
            product_code="ABC", part_name="Part", quantity_reduced=0, stock_reduced=False)
        ProcessedComplaint.objects.create(complaint_no="C2", technician_name="Sahad",
            product_code="ABC", part_name="Part", quantity_reduced=2, stock_reduced=True)
        for index, status in enumerate(("pending", "applying", "needs_review", "failed", "complete")):
            StockOperation.objects.create(operation_key=str(index), source="complaint",
                reference="C2" if status == "complete" else "C1", technician_name="sahad",
                product_code="abc", quantity=2, status=status)
        for index, product in enumerate(("ABC", "DEF"), 2):
            TrackingComplaint.objects.create(sheet_row_number=index, complaint_no="C1",
                technician_name="Sahad", product_code=product)
        report = self.audit(limit=1)
        ambiguous = report["ambiguous_legacy_complaints"]
        self.assertEqual(ambiguous["count"], 1)
        self.assertIn("complaint_number_has_multiple_tracking_stock_identities", ambiguous["items"][0]["reasons"])
        operations = report["stock_operations"]
        self.assertEqual(operations["pending_or_unresolved"]["count"], 4)
        self.assertTrue(operations["pending_or_unresolved"]["truncated"])
        self.assertEqual(operations["status_counts"]["complete"], 1)

    def test_empty_snapshot_age_is_unknown_and_bad_limits_are_rejected(self):
        report = self.audit()
        self.assertIsNone(report["snapshot_age"]["technician_stock"]["oldest_row_age_seconds"])
        self.assertTrue(report["snapshot_age"]["technician_stock"]["stale_or_unknown"])
        with self.assertRaises(CommandError):
            self.audit(limit=0)
