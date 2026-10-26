"""Serialize app-owned sheet writes without keeping a DB transaction open.

All production writers must use the same PostgreSQL database, with direct or
session-pooled connections (transaction pooling does not support session locks).
Manual sheet edits cannot be protected by this lock.
"""
from contextlib import contextmanager
from functools import wraps
import threading

from django.conf import settings
from django.db import connection

_state = threading.local()
_test_lock = threading.RLock()
_LOCK_ID = 824617031


class StockBusyError(Exception):
    pass


@contextmanager
def stock_write_lock():
    if getattr(_state, 'held', False):
        yield
        return
    # A surrounding atomic block defeats short rate-limiter transactions.
    if connection.in_atomic_block:
        raise RuntimeError('Stock writes must run outside database transactions')
    postgres = connection.vendor == 'postgresql'
    if not postgres and not getattr(settings, 'STOCK_ALLOW_TEST_LOCK', False):
        raise RuntimeError('Stock writes require PostgreSQL session locks')
    if postgres:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_lock(%s)', [_LOCK_ID])
            acquired = cursor.fetchone()[0]
    else:
        acquired = _test_lock.acquire(blocking=False)
    if not acquired:
        raise StockBusyError('Another stock update is running. Check its status before retrying.')
    _state.held = True
    try:
        yield
    finally:
        _state.held = False
        if postgres:
            # Do not open a new connection just to unlock: a lost session has
            # already released its lock. The journal protects uncertain writes.
            if connection.connection is not None:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_unlock(%s)', [_LOCK_ID])
        else:
            _test_lock.release()


def serialized_stock_write(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with stock_write_lock():
            return function(*args, **kwargs)
    return wrapped
