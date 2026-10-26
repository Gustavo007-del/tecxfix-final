"""Deduct once, with explicit handling for an uncertain external write."""
import hashlib
import json
import re

from api.models import StockOperation
from courier_api.stock_lock import stock_write_lock


class StockReviewRequired(Exception):
    pass


def canonical(value):
    return ' '.join(str(value).split()).casefold()


def validate_product(code):
    code = str(code).strip()
    if not code or len(code) > 100 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]*', code):
        raise ValueError('Product code must contain a spare code, not a description: ' + code)
    return code.upper()


def operation_key(source, reference, product_code):
    # Do not include quantity or technician: editing them must not authorize
    # a second deduction of an already handled complaint/product.
    return hashlib.sha256(json.dumps(
        [source, canonical(reference), canonical(product_code)],
        separators=(',', ':'),
    ).encode()).hexdigest()


def deduct_once(sheets, *, source, reference, technician_name, product_code, quantity):
    product_code = validate_product(product_code)
    technician_name = ' '.join(technician_name.split())
    if not technician_name or len(technician_name) > 255 or len(reference) > 100:
        raise ValueError('Invalid technician or complaint reference')
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        raise ValueError('Quantity must be a positive whole number')
    key = operation_key(source, reference, product_code)
    with stock_write_lock():
        operation, _ = StockOperation.objects.get_or_create(
            operation_key=key,
            defaults=dict(source=source, reference=reference,
                          technician_name=technician_name, product_code=product_code,
                          quantity=quantity),
        )
        if operation.status == 'complete':
            if (operation.quantity != quantity or
                    canonical(operation.technician_name) != canonical(technician_name)):
                raise StockReviewRequired('Previously deducted item was edited; review its history')
            return operation, False
        if operation.status in ('applying', 'needs_review'):
            raise StockReviewRequired('Previous sheet update is uncertain; reconcile before retrying')
        # Another uncertain deduction on this stock item makes its balance
        # unsuitable for further automatic deductions.
        if StockOperation.objects.filter(
            technician_name__iexact=technician_name, product_code__iexact=product_code,
            status__in=['applying', 'needs_review'],
        ).exists():
            raise StockReviewRequired('This stock item has an unresolved sheet update')
        operation.technician_name = technician_name
        operation.quantity = quantity
        operation.plan = {}
        operation.error = ''
        operation.status = 'pending'
        operation.save()
        write_started = False

        def before_write(plan):
            nonlocal write_started
            operation.plan = plan
            operation.status = 'applying'
            operation.save(update_fields=['plan', 'status', 'updated_at'])
            # This save is committed before the HTTP write starts.
            write_started = True

        try:
            sheets.update_technician_stock(
                technician_name, product_code, -quantity, before_write=before_write,
            )
            if not write_started:
                raise RuntimeError('Stock writer did not record its write plan')
            operation.status = 'complete'
            operation.save(update_fields=['status', 'updated_at'])
        except Exception as error:
            operation.status = 'needs_review' if write_started else 'failed'
            operation.error = str(error)[:4000]
            operation.save(update_fields=['status', 'error', 'updated_at'])
            if write_started:
                raise StockReviewRequired(
                    'Sheet update may have completed; do not repeat without reconciliation'
                ) from error
            raise
        return operation, True
