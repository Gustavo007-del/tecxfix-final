import time

from django.core.management.base import BaseCommand, CommandError

from api.services.sheet_snapshot_sync import SheetSnapshotSync


class Command(BaseCommand):
    help = "Synchronize Google Sheets Tracking and Mrp List worksheets into local read models."

    def handle(self, *args, **options):
        started = time.monotonic()
        try:
            result = SheetSnapshotSync().sync_all()
        except Exception as error:
            raise CommandError(str(error)) from error

        elapsed = time.monotonic() - started
        self.stdout.write(
            self.style.SUCCESS(
                "Synchronized %(tracking_rows)s Tracking rows and "
                "%(company_stock_rows)s company stock rows at %(synced_at)s "
                "(took %(elapsed).1fs)"
                % {**result, "elapsed": elapsed}
            )
        )