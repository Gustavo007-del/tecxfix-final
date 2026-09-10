import json
import logging
import os
from decimal import Decimal, InvalidOperation

import gspread
from django.db import transaction
from django.utils import timezone
from google.oauth2.service_account import Credentials

from ..models import CompanyStock, TrackingComplaint

logger = logging.getLogger(__name__)

SHEET_ID = "1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ"
TRACKING_WORKSHEET = "Tracking"
COMPANY_STOCK_WORKSHEET = "Mrp List"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_sheets_client():
    credentials_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if credentials_json:
        credentials = Credentials.from_service_account_info(
            json.loads(credentials_json), scopes=SCOPES
        )
    else:
        credentials = Credentials.from_service_account_file(
            "service.json", scopes=SCOPES
        )
    return gspread.authorize(credentials)


def _value(row, index):
    return row[index].strip() if len(row) > index and row[index] else ""


def _decimal(value):
    try:
        return Decimal(value.replace(",", "")) if value else Decimal("0")
    except (InvalidOperation, AttributeError):
        return Decimal("0")


def _integer(value):
    try:
        return int(float(value.replace(",", ""))) if value else 0
    except (ValueError, AttributeError):
        return 0


class SheetSnapshotSync:
    """Synchronize Google worksheet data into database read models."""

    def __init__(self, client=None):
        self.client = client

    def _client(self):
        if self.client is None:
            self.client = get_sheets_client()
        return self.client

    def sync_tracking(self):
        sheet = self._client().open_by_key(SHEET_ID).worksheet(TRACKING_WORKSHEET)
        rows = sheet.get_all_values()
        seen_rows = []

        with transaction.atomic():
            for row_number, row in enumerate(rows[1:], start=2):
                complaint_no = _value(row, 1)
                if not complaint_no:
                    continue

                seen_rows.append(row_number)
                TrackingComplaint.objects.update_or_create(
                    sheet_row_number=row_number,
                    defaults={
                        "sheet_row_id": _value(row, 0),
                        "complaint_no": complaint_no,
                        "customer_name": _value(row, 2),
                        "customer_phone": _value(row, 3),
                        "area": _value(row, 5),
                        "brand_name": _value(row, 6),
                        "product_code": _value(row, 7),
                        "part_name": _value(row, 9),
                        "quantity": _value(row, 10),
                        "complaint_status": _value(row, 11),
                        "pending_days": _value(row, 12),
                        "updated_by": _value(row, 13),
                        "technician_name": _value(row, 14),
                        "district": _value(row, 15),
                        "sheet_column_p": _value(row, 15),
                        "mrp": _value(row, 19),
                        "cc_remarks": _value(row, 23),
                    },
                )

            TrackingComplaint.objects.exclude(sheet_row_number__in=seen_rows).delete()

        logger.info("Synchronized %s Tracking rows", len(seen_rows))
        return len(seen_rows)

    def sync_company_stock(self):
        sheet = self._client().open_by_key(SHEET_ID).worksheet(COMPANY_STOCK_WORKSHEET)
        rows = sheet.get_all_values()
        seen_ids = []

        with transaction.atomic():
            for row in rows[1:]:
                spare_id = _value(row, 1)
                if not spare_id:
                    continue

                seen_ids.append(spare_id)
                CompanyStock.objects.update_or_create(
                    spare_id=spare_id,
                    defaults={
                        "name": _value(row, 2),
                        "mrp": _decimal(_value(row, 3)),
                        "hsn": _value(row, 4),
                        "brand": _value(row, 5),
                        "quantity": _integer(_value(row, 6)),
                    },
                )

            CompanyStock.objects.exclude(spare_id__in=seen_ids).delete()

        logger.info("Synchronized %s company stock rows", len(seen_ids))
        return len(seen_ids)

    def sync_all(self):
        started_at = timezone.now()
        tracking_count = self.sync_tracking()
        stock_count = self.sync_company_stock()
        return {
            "tracking_rows": tracking_count,
            "company_stock_rows": stock_count,
            "synced_at": started_at.isoformat(),
        }


def update_tracking_snapshot(complaint_no, **values):
    """Apply an application-owned Tracking change to every matching local row."""
    if not values:
        return 0
    return TrackingComplaint.objects.filter(complaint_no=complaint_no).update(**values)


def update_company_stock_snapshot(spare_id, quantity):
    """Apply an application-owned stock quantity change locally."""
    return CompanyStock.objects.filter(spare_id=spare_id).update(quantity=quantity)
