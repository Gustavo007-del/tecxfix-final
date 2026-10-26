"""Read-only integrity report over local DB snapshots and the operation journal."""
import json
from collections import Counter, defaultdict

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from api.models import CompanyStock, ProcessedComplaint, TechnicianStockSnapshot, TrackingComplaint
from api.services.sheet_snapshot_sync import _product_key, _technician_key


def _limited(items, limit):
    return {"count": len(items), "items": items[:limit], "truncated": len(items) > limit}


def _age(rows, now, max_age):
    stamps = [row["synced_at"] for row in rows if row["synced_at"]]
    oldest, newest = (min(stamps), max(stamps)) if stamps else (None, None)
    age = (now - oldest).total_seconds() if oldest else None
    return {
        "row_count": len(rows),
        "oldest_row_timestamp": oldest,
        "newest_row_timestamp": newest,
        "oldest_row_age_seconds": age,
        "newest_row_age_seconds": (now - newest).total_seconds() if newest else None,
        "stale_or_unknown": age is None or age > max_age,
        "clock_skew_detected": bool(newest and newest > now),
    }


def _stock_report(rows, limit, technician=False):
    grouped = defaultdict(list)
    products, technicians = defaultdict(set), defaultdict(set)
    for row in rows:
        product = _product_key(row["spare_id"])
        tech = _technician_key(row["technician_name"]) if technician else None
        grouped[(tech, product)].append(row)
        products[product].add(row["spare_id"])
        if technician:
            technicians[tech].add(row["technician_name"])
    totals, duplicates = [], []
    for (tech, product), members in sorted(grouped.items()):
        total = {
            "product_code": product,
            "net_quantity": sum(row["quantity"] for row in members),
            "row_ids": [row["id"] for row in members],
            "negative_row_count": sum(row["quantity"] < 0 for row in members),
        }
        if technician:
            total["technician"] = tech
        totals.append(total)
        if len(members) > 1:
            duplicates.append(total)
    return {
        "negative_rows": _limited([row for row in rows if row["quantity"] < 0], limit),
        "net_totals": _limited(totals, limit),
        "negative_net_totals": _limited([row for row in totals if row["net_quantity"] < 0], limit),
        "canonical_duplicate_groups": _limited(duplicates, limit),
        "case_or_whitespace_variants": {
            "product_codes": _limited([
                {"canonical": key, "variants": sorted(values)}
                for key, values in sorted(products.items()) if len(values) > 1
            ], limit),
            "technician_names": _limited([
                {"canonical": key, "variants": sorted(values)}
                for key, values in sorted(technicians.items()) if len(values) > 1
            ], limit),
        },
    }


class Command(BaseCommand):
    help = "READ ONLY DB snapshot audit: JSON findings; never refreshes or corrects stock."
    # Avoid URL checks importing unrelated services; this command only reads ORM data.
    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100,
                            help="Maximum details per section (counts include all rows).")
        parser.add_argument("--max-age-seconds", type=int, default=3600,
                            help="Snapshot age warning threshold; not a freshness guarantee.")

    def handle(self, *args, **options):
        limit, max_age = options["limit"], options["max_age_seconds"]
        if limit < 1 or max_age < 0:
            raise CommandError("--limit must be positive and --max-age-seconds nonnegative")
        started = timezone.now()
        try:
            with transaction.atomic():
                # PostgreSQL enforces read-only access and a single DB snapshot
                # across these tables. No advisory lock or rate limiter is used.
                if connection.vendor == "postgresql":
                    with connection.cursor() as cursor:
                        cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                stock = list(TechnicianStockSnapshot.objects.order_by("pk").values(
                    "id", "technician_name", "spare_id", "quantity", "synced_at"))
                company = list(CompanyStock.objects.order_by("pk").values(
                    "id", "spare_id", "quantity", "synced_at"))
                tracking = list(TrackingComplaint.objects.order_by("pk").values(
                    "id", "sheet_row_number", "complaint_no", "technician_name",
                    "product_code", "quantity", "complaint_status", "synced_at"))
                legacy = list(ProcessedComplaint.objects.order_by("pk").values(
                    "id", "complaint_no", "technician_name", "product_code",
                    "quantity_reduced", "stock_reduced", "processing_notes", "processed_date"))
                try:
                    operation_model = apps.get_model("api", "StockOperation")
                except LookupError:
                    operation_model = None
                operations = list(operation_model.objects.order_by("pk").values(
                    "id", "operation_key", "source", "reference", "technician_name",
                    "product_code", "quantity", "status", "error", "created_at", "updated_at"
                )) if operation_model else []
        except DatabaseError as exc:
            raise CommandError(
                "DB audit could not read required tables; check database access and applied migrations. "
                "No refresh, migration or correction was attempted."
            ) from exc

        tracking_by_ref = defaultdict(list)
        for row in tracking:
            tracking_by_ref[_product_key(row["complaint_no"])].append(row)
        operations_by_ref = defaultdict(list)
        for operation in operations:
            if operation["source"].casefold() == "complaint":
                operations_by_ref[_product_key(operation["reference"])].append(operation)
        ambiguous = []
        for row in legacy:
            reasons = []
            ref = _product_key(row["complaint_no"])
            linked = [op for op in operations_by_ref[ref]
                      if _product_key(op["product_code"]) == _product_key(row["product_code"])
                      and _technician_key(op["technician_name"]) == _technician_key(row["technician_name"])
                      and op["quantity"] == row["quantity_reduced"]]
            if not any(op["status"] == "complete" for op in linked):
                reasons.append("no_matching_completed_journal_operation")
            if not row["stock_reduced"]:
                reasons.append("legacy_stock_reduced_false_does_not_prove_no_sheet_write")
            if row["quantity_reduced"] <= 0:
                reasons.append("legacy_nonpositive_quantity")
            if not ref or not _product_key(row["product_code"]) or not _technician_key(row["technician_name"]):
                reasons.append("missing_identity")
            identities = {(_technician_key(item["technician_name"]), _product_key(item["product_code"]))
                          for item in tracking_by_ref[ref]}
            if len(identities) > 1:
                reasons.append("complaint_number_has_multiple_tracking_stock_identities")
            if reasons:
                ambiguous.append({**row, "reasons": reasons,
                                  "matching_operation_ids": [op["id"] for op in linked]})

        unresolved = [op for op in operations if op["status"] != "complete"]
        report = {
            "audit": "READ ONLY DB snapshot audit",
            "source": "database_snapshots_only",
            "read_only": True,
            "started_at": started,
            "finished_at": timezone.now(),
            "limits": {
                "details_per_section": limit,
                "max_age_seconds": max_age,
                "all_rows_scanned": True,
                "google_sheets_read": False,
                "google_sheets_written": False,
                "notes": [
                    "Snapshot quantities may lag Google Sheets; this is not a live balance audit.",
                    "Negative rows are DB rows. Full sync merges sheet rows, so original negative sheet rows and spelling variants may be hidden.",
                    "synced_at is a per-row refresh/write-through timestamp, not proof of the last successful full sync; empty snapshots have unknown age.",
                    "Legacy markers and journal statuses alone cannot prove what Google Sheets applied; ambiguous records require review, not automatic retry.",
                    "Company-stock duplicate net totals are diagnostic sums; its snapshot uses last-row-wins for exact duplicate sheet codes.",
                    "Detail arrays are limited after computing full counts and totals; all source rows are read into memory.",
                ],
            },
            "snapshot_age": {
                "technician_stock": _age(stock, started, max_age),
                "company_stock": _age(company, started, max_age),
                "tracking": _age(tracking, started, max_age),
            },
            "technician_stock": _stock_report(stock, limit, technician=True),
            "company_stock": _stock_report(company, limit),
            "ambiguous_legacy_complaints": _limited(ambiguous, limit),
            "stock_operations": {
                "available": operation_model is not None,
                "status_counts": dict(sorted(Counter(op["status"] for op in operations).items())),
                "pending_or_unresolved": _limited(unresolved, limit),
                "pending_definition": "Every status except complete; includes failed, applying, needs_review and unknown statuses.",
            },
        }
        self.stdout.write(json.dumps(report, cls=DjangoJSONEncoder, indent=2, sort_keys=True))
