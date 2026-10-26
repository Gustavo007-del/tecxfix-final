"""Complaint deductions from the local Tracking snapshot, with a write journal."""
import logging
from datetime import datetime

from django.contrib.auth.models import User
from django.db.models import Q

from api.models import ProcessedComplaint, TrackingComplaint
from courier_api.models import TechnicianStock
from courier_api.sheets_sync import SheetsSync
from .stock_operations import canonical, deduct_once, validate_product, StockReviewRequired

logger = logging.getLogger(__name__)


class ComplaintProcessor:
    def __init__(self):
        self.sheets_sync = SheetsSync()
        self.processed_count = 0
        self.skipped_count = 0
        self.review_required_count = 0
        self.errors = []
        self.stock_reductions = []

    def extract_date_from_complaint_no(self, complaint_no):
        try:
            return datetime.strptime(complaint_no.strip().split('/')[1], '%d%m%y')
        except (ValueError, IndexError, AttributeError):
            return None

    def get_new_pending_complaints(self, since_date=None, technician_filter=None):
        # Old failed records may hide external deductions: never auto-replay.
        legacy = {canonical(value) for value in
                  ProcessedComplaint.objects.values_list('complaint_no', flat=True)}
        grouped = {}
        invalid = set()
        rows = TrackingComplaint.objects.filter(complaint_status__iexact='CLOSED')
        for row in rows:
            reference = row.complaint_no.strip()
            if technician_filter and canonical(row.technician_name) != canonical(technician_filter):
                continue
            if canonical(reference) in legacy:
                self.skipped_count += 1
                continue
            complaint_date = self.extract_date_from_complaint_no(reference)
            if not complaint_date:
                self.errors.append(f'{reference}: Invalid complaint date')
                continue
            if since_date and complaint_date.date() < since_date:
                continue
            key = (canonical(reference), canonical(row.product_code))
            try:
                product_code = validate_product(row.product_code)
                quantity = int(row.quantity.strip())
                if quantity <= 0:
                    raise ValueError('Quantity must be a positive whole number')
                if not row.technician_name.strip():
                    raise ValueError('Technician is missing')
                # Preserve Column P eligibility pending the client's decision.
                skip = False
                if row.sheet_column_p.strip():
                    try:
                        p_date = datetime.strptime(row.sheet_column_p.strip(), '%d-%b-%Y').date()
                        skip = bool(since_date and p_date < since_date)
                    except ValueError:
                        logger.warning('Unrecognised Column P date for %s; retaining legacy eligibility', reference)
                if skip:
                    self.skipped_count += 1
                    continue
                if key in grouped:
                    raise ValueError('Repeated complaint/product rows require review before deduction')
                grouped[key] = dict(
                    complaint_no=reference, technician_name=row.technician_name.strip(),
                    product_code=product_code, quantity=quantity, part_name=row.part_name,
                )
            except (TypeError, ValueError) as error:
                invalid.add(key)
                self.errors.append(f'{reference} / {row.product_code}: {error}')
        return [complaint for key, complaint in grouped.items() if key not in invalid]

    def get_technician_sheet_name(self, technician_name):
        name = ' '.join(technician_name.split())
        matches = list(User.objects.filter(Q(username__iexact=name) | Q(first_name__iexact=name)))
        if len(matches) > 1:
            raise ValueError(f'Ambiguous technician mapping: {name}')
        if matches:
            mapping = TechnicianStock.objects.filter(technician=matches[0]).first()
            if mapping and mapping.sheet_technician_name:
                return ' '.join(mapping.sheet_technician_name.split())
        # Preserve spaces; stock writer verifies the name exists in Sheets.
        return name

    def process_single_complaint(self, complaint):
        reference = complaint['complaint_no']
        try:
            if ProcessedComplaint.objects.filter(complaint_no__iexact=reference).exists():
                self.skipped_count += 1
                return True
            operation, changed = deduct_once(
                self.sheets_sync, source='complaint', reference=reference,
                technician_name=self.get_technician_sheet_name(complaint['technician_name']),
                product_code=complaint['product_code'], quantity=complaint['quantity'],
            )
            if changed:
                self.processed_count += 1
                self.stock_reductions.append(dict(
                    complaint_no=reference, technician=operation.technician_name,
                    product_code=operation.product_code, quantity_reduced=operation.quantity,
                    audit_id=operation.pk,
                ))
            else:
                self.skipped_count += 1
            return True
        except StockReviewRequired as error:
            self.review_required_count += 1
            self.errors.append(f'{reference}: {error}')
        except Exception as error:
            logger.exception('Complaint processing failed for %s', reference)
            self.errors.append(f'{reference}: {error}')
        return False

    def process_complaints(self, since_date=None, technician_filter=None, progress=None):
        complaints = self.get_new_pending_complaints(since_date, technician_filter)
        if progress:
            progress(0, len(complaints), self._get_result())
        for index, complaint in enumerate(complaints, 1):
            self.process_single_complaint(complaint)
            if progress:
                progress(index, len(complaints), self._get_result())
        return self._get_result()

    def _get_result(self):
        return dict(
            success=not self.errors, processed_count=self.processed_count,
            skipped_count=self.skipped_count, review_required_count=self.review_required_count,
            stock_reductions=self.stock_reductions, errors=self.errors,
            message=f'{self.processed_count} stock deductions completed; {len(self.errors)} issues',
        )
