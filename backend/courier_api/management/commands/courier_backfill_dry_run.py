import json

from django.core.management.base import BaseCommand

from courier_api.models import CourierTransaction


class Command(BaseCommand):
    help = "List legacy in-transit couriers and intended per-technician stock rows without writing to Google Sheets."

    def handle(self, *args, **options):
        records = []
        couriers = (
            CourierTransaction.objects.filter(status='in_transit')
            .prefetch_related('technicians')
            .order_by('sent_time')
        )
        for courier in couriers:
            technicians = list(courier.technicians.order_by('id').values('id', 'username', 'first_name', 'last_name'))
            records.append({
                'courier_id': courier.courier_id,
                'sent_time': courier.sent_time.isoformat() if courier.sent_time else None,
                'stock_sync_status': courier.stock_sync_status,
                'stock_sync_error': courier.stock_sync_error,
                'technicians': technicians,
                'items': courier.items,
                'review_required': True,
                'review_note': 'Database status cannot prove whether an earlier technician acceptance partially updated Google Sheets.',
            })

        self.stdout.write(json.dumps({
            'mode': 'dry-run',
            'sheet_writes': 0,
            'count': len(records),
            'couriers': records,
        }, indent=2, ensure_ascii=False))
