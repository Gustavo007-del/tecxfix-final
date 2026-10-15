"""Shared Google Sheets API pacing for the service account used by this app."""

import time
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import SheetsApiRateLimitState


# The Google per-user quota is 60 requests/minute. Keep app traffic at 40/minute
# to leave 20 requests/minute of headroom for other clients using this account.
SHEETS_API_MAX_REQUESTS_PER_MINUTE = 40


def wait_for_sheets_api_slot():
    """Reserve a shared slot so separate Render workers pace as one client."""
    now = timezone.now()
    with transaction.atomic():
        SheetsApiRateLimitState.objects.get_or_create(
            pk=1,
            defaults={'next_allowed_at': now},
        )
        state = SheetsApiRateLimitState.objects.select_for_update().get(pk=1)
        slot = max(now, state.next_allowed_at)
        state.next_allowed_at = slot + timedelta(
            seconds=60 / SHEETS_API_MAX_REQUESTS_PER_MINUTE
        )
        state.save(update_fields=['next_allowed_at'])

    delay = (slot - timezone.now()).total_seconds()
    if delay > 0:
        time.sleep(delay)


def install_sheets_api_rate_limit(client):
    """Pace gspread API requests for an authenticated client; safe to call once."""
    http_client = client.http_client
    if getattr(http_client, '_techfix_rate_limited', False):
        return client

    original_request = http_client.request

    def rate_limited_request(*args, **kwargs):
        wait_for_sheets_api_slot()
        return original_request(*args, **kwargs)

    http_client.request = rate_limited_request
    http_client._techfix_rate_limited = True
    return client
