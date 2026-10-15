import json

from django.core.management import CommandError
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from courier_api.models import CourierTransaction
from courier_api.sheets_sync import SheetsSync


class Command(BaseCommand):
    help = (
        "Preview legacy in-transit couriers, or transfer their stock with "
        "--apply --confirm-production-backfill. Failed/in-progress records are never replayed automatically."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Write technician and company stock updates to Google Sheets.',
        )
        parser.add_argument(
            '--confirm-production-backfill',
            action='store_true',
            help='Required with --apply to confirm this live stock mutation.',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']
        confirmed = options['confirm_production_backfill']
        if confirmed and not apply_changes:
            raise CommandError('--confirm-production-backfill can only be used with --apply.')
        if apply_changes and not confirmed:
            raise CommandError('For safety, --apply also requires --confirm-production-backfill.')

        couriers = list(
            CourierTransaction.objects.filter(status='in_transit')
            .prefetch_related('technicians')
            .order_by('sent_time')
        )
        candidates = [c for c in couriers if c.stock_sync_status == 'pending']
        excluded = [
            {'courier_id': c.courier_id, 'stock_sync_status': c.stock_sync_status}
            for c in couriers if c.stock_sync_status != 'pending'
        ]
        preview = [
            {
                'courier_id': c.courier_id,
                'sent_time': c.sent_time.isoformat() if c.sent_time else None,
                'technicians': list(c.technicians.values_list('username', flat=True)),
                'items': c.items,
            }
            for c in candidates
        ]

        if not apply_changes:
            self.stdout.write(json.dumps({
                'mode': 'dry-run',
                'sheet_writes': 0,
                'candidate_count': len(candidates),
                'excluded_non_pending': excluded,
                'couriers': preview,
            }, indent=2, ensure_ascii=False))
            self.stdout.write(self.style.WARNING(
                'Review this preview before running with --apply --confirm-production-backfill.'
            ))
            return

        sync = SheetsSync()
        completed = []
        for candidate in candidates:
            # Claim in the database before the external writes. A process crash or
            # partial Google write is left in_progress and is not blindly replayed.
            with transaction.atomic():
                courier = CourierTransaction.objects.select_for_update().get(pk=candidate.pk)
                if courier.status != 'in_transit' or courier.stock_sync_status != 'pending':
                    self.stdout.write(self.style.WARNING(
                        f"Skipped {courier.courier_id}: status changed to "
                        f"{courier.status}/{courier.stock_sync_status}."
                    ))
                    continue
                courier.stock_sync_status = 'in_progress'
                courier.stock_sync_error = ''
                courier.save(update_fields=['stock_sync_status', 'stock_sync_error', 'updated_at'])

            try:
                sync.sync_courier_to_sheets(
                    candidate.items,
                    list(candidate.technicians.values_list('id', flat=True)),
                    sent_date=timezone.localtime(candidate.sent_time).date().isoformat(),
                )
            except Exception as error:
                CourierTransaction.objects.filter(pk=candidate.pk).update(
                    stock_sync_status='failed',
                    stock_sync_error=str(error)[:4000],
                )
                raise CommandError(
                    f"Stopped at {candidate.courier_id}; sync failed and was marked failed. "
                    "Inspect Google Sheets before any manual retry. "
                    f"Error: {error}"
                ) from error

            CourierTransaction.objects.filter(pk=candidate.pk).update(
                status='sent',
                received_time=timezone.now(),
                stock_sync_status='complete',
                stock_sync_error='',
            )
            completed.append(candidate.courier_id)
            self.stdout.write(f"Processed {candidate.courier_id} ({len(completed)}/{len(candidates)}).")

        self.stdout.write(self.style.SUCCESS(json.dumps({
            'mode': 'apply',
            'completed_count': len(completed),
            'completed_courier_ids': completed,
            'failed_or_interrupted_records_require_manual_reconciliation': excluded,
        }, indent=2)))
