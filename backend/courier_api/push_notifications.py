"""Small Expo Push Service client for courier delivery notifications."""

import json
import logging
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import PushDeviceToken


logger = logging.getLogger(__name__)
EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
EXPO_BATCH_SIZE = 100


def send_courier_push_notifications(courier):
    """Notify assigned technicians after the courier stock sync succeeds."""
    tokens = list(
        PushDeviceToken.objects.filter(user__couriers_received=courier)
        .values_list('token', flat=True)
        .distinct()
    )
    if not tokens:
        logger.info("No registered push devices for courier %s", courier.courier_id)
        return

    item_count = len(courier.items or [])
    body = (
        f"Courier {courier.courier_id} was sent to you. "
        f"{item_count} item{'s' if item_count != 1 else ''} added to your stock."
    )
    messages = [
        {
            'to': token,
            'title': 'New courier sent',
            'body': body,
            'sound': 'default',
            'priority': 'high',
            'channelId': 'couriers',
            'data': {
                'type': 'courier',
                'courierId': courier.courier_id,
            },
        }
        for token in tokens
    ]

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
    access_token = os.getenv('EXPO_PUSH_ACCESS_TOKEN')
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'

    for offset in range(0, len(messages), EXPO_BATCH_SIZE):
        batch = messages[offset:offset + EXPO_BATCH_SIZE]
        request = Request(
            EXPO_PUSH_URL,
            data=json.dumps(batch).encode('utf-8'),
            headers=headers,
            method='POST',
        )
        try:
            with urlopen(request, timeout=8) as response:
                result = json.loads(response.read().decode('utf-8'))
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            logger.warning(
                "Expo push request failed for courier %s: %s",
                courier.courier_id,
                error,
            )
            continue

        tickets = result.get('data', []) if isinstance(result, dict) else []
        for token, ticket in zip((message['to'] for message in batch), tickets):
            if ticket.get('status') == 'error':
                details = ticket.get('details') or {}
                if details.get('error') == 'DeviceNotRegistered':
                    PushDeviceToken.objects.filter(token=token).delete()
                logger.warning(
                    "Expo rejected courier push for %s: %s",
                    courier.courier_id,
                    ticket.get('message', 'Unknown push error'),
                )

