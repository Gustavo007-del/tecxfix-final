import json
import logging
import os
from decimal import Decimal, InvalidOperation

import gspread
import django
from django.db import transaction
from django.utils import timezone
from google.oauth2.service_account import Credentials

from ..models import CompanyStock, TrackingComplaint

logger = logging.getLogger(__name__)

SHEET_ID = "1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ"
TRACKING_WORKSHEET = "Tracking"
COMPANY_STOCK_WORKSHEET = "Mrp List"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Number of rows sent to the DB per INSERT ... ON CONFLICT statement.
# Keeps each round trip small without going back to one-row-at-a-time.
BULK_BATCH_SIZE = 1000

# bulk_create(update_conflicts=...) needs Django >= 4.1.
_REQUIRES_DJANGO_VERSION = (4, 1)
if django.VERSION[:2] < _REQUIRES_DJANGO_VERSION:
    raise RuntimeError(
        "sheet_snapshot_sync requires Django >= 4.1 for bulk_create(update_conflicts=...). "
        f"Installed: {django.get_version()}"
    )


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
    """Synchronize Google worksheet data into database read models.

    Uses a single bulk upsert (PostgreSQL ``INSERT ... ON CONFLICT DO UPDATE``,
    via ``bulk_create(update_conflicts=...)``) instead of one
    ``update_or_create()`` round trip per row. For a 10k-15k row sheet this
    turns ~15,000 individual queries into a handful of batched statements,
    which is what was causing the multi-hour sync.
    """

    def __init__(self, client=None):
        self.client = client

    def _client(self):
        if self.client is None:
            self.client = get_sheets_client()
        return self.client

    def sync_tracking(self):
        sheet = self._client().open_by_key(SHEET_ID).worksheet(TRACKING_WORKSHEET)
        rows = sheet.get_all_values()

        synced_at = timezone.now()
        seen_row_numbers = []
        objects = []

        for row_number, row in enumerate(rows[1:], start=2):
            complaint_no = _value(row, 1)
            if not complaint_no:
                continue

            seen_row_numbers.append(row_number)
            objects.append(
                TrackingComplaint(
                    sheet_row_number=row_number,
                    sheet_row_id=_value(row, 0),
                    complaint_no=complaint_no,
                    customer_name=_value(row, 2),
                    customer_phone=_value(row, 3),
                    area=_value(row, 5),
                    brand_name=_value(row, 6),
                    product_code=_value(row, 7),
                    part_name=_value(row, 9),
                    quantity=_value(row, 10),
                    complaint_status=_value(row, 11),
                    pending_days=_value(row, 12),
                    updated_by=_value(row, 13),
                    technician_name=_value(row, 14),
                    district=_value(row, 15),
                    sheet_column_p=_value(row, 15),
                    mrp=_value(row, 19),
                    cc_remarks=_value(row, 23),
                    synced_at=synced_at,
                )
            )

        update_fields = [
            "sheet_row_id",
            "complaint_no",
            "customer_name",
            "customer_phone",
            "area",
            "brand_name",
            "product_code",
            "part_name",
            "quantity",
            "complaint_status",
            "pending_days",
            "updated_by",
            "technician_name",
            "district",
            "sheet_column_p",
            "mrp",
            "cc_remarks",
            "synced_at",
        ]

        with transaction.atomic():
            if objects:
                TrackingComplaint.objects.bulk_create(
                    objects,
                    batch_size=BULK_BATCH_SIZE,
                    update_conflicts=True,
                    unique_fields=["sheet_row_number"],
                    update_fields=update_fields,
                )

            stale_row_numbers = list(
                TrackingComplaint.objects.exclude(sheet_row_number__in=seen_row_numbers)
                .values_list("sheet_row_number", flat=True)
            )
            stale_count = 0
            if stale_row_numbers:
                stale_count = TrackingComplaint.objects.filter(
                    sheet_row_number__in=stale_row_numbers
                ).delete()[0]

        logger.info(
            "Synchronized %s Tracking rows (removed %s stale rows)",
            len(seen_row_numbers),
            stale_count,
        )
        return len(seen_row_numbers)

    def sync_company_stock(self):
        sheet = self._client().open_by_key(SHEET_ID).worksheet(COMPANY_STOCK_WORKSHEET)
        rows = sheet.get_all_values()

        synced_at = timezone.now()

        # Use a dictionary so duplicate spare_ids in the MRP sheet
        # don't cause PostgreSQL "ON CONFLICT ... affect row a second time".
        # If the same spare_id appears more than once, the LAST row wins.
        objects_by_spare_id = {}

        for row in rows[1:]:
            spare_id = _value(row, 1)

            if not spare_id:
                continue

            objects_by_spare_id[spare_id] = CompanyStock(
                spare_id=spare_id,
                name=_value(row, 2),
                mrp=_decimal(_value(row, 3)),
                hsn=_value(row, 4),
                brand=_value(row, 5),
                quantity=_integer(_value(row, 6)),
                synced_at=synced_at,
            )

        total_valid_rows = sum(1 for row in rows[1:] if _value(row, 1))
        objects = list(objects_by_spare_id.values())
        seen_ids = list(objects_by_spare_id.keys())
        duplicate_count = total_valid_rows - len(objects)

        update_fields = ["name", "mrp", "hsn", "brand", "quantity", "synced_at"]

        with transaction.atomic():
            if objects:
                CompanyStock.objects.bulk_create(
                    objects,
                    batch_size=BULK_BATCH_SIZE,
                    update_conflicts=True,
                    unique_fields=["spare_id"],
                    update_fields=update_fields,
                )

            stale_ids = list(
                CompanyStock.objects.exclude(spare_id__in=seen_ids)
                .values_list("spare_id", flat=True)
            )
            stale_count = 0
            if stale_ids:
                stale_count = CompanyStock.objects.filter(
                    spare_id__in=stale_ids
                ).delete()[0]

        logger.info(
            "Synchronized %s unique company stock rows "
            "(%s duplicate rows removed, %s stale rows deleted)",
            len(seen_ids),
            duplicate_count,
            stale_count,
)
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