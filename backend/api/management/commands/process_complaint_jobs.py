import time
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from api.services.complaint_jobs import process_next_run


class Command(BaseCommand):
    help = 'Run the durable complaint queue worker; never auto-resumes crashed jobs.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')

    def handle(self, *args, **options):
        while True:
            close_old_connections()
            processed = process_next_run()
            if options['once']:
                return
            if not processed:
                time.sleep(3)
