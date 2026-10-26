"""Database-backed queue, consumed by process_complaint_jobs command."""
from django.db import IntegrityError, transaction
from django.utils import timezone

from api.models import ComplaintProcessingRun
from .complaint_processor import ComplaintProcessor


def serialize_run(run):
    if run is None:
        return None
    return dict(id=run.pk, status=run.status, since_date=run.since_date.isoformat(),
                technician_filter=run.technician_filter, total_count=run.total_count,
                completed_count=run.completed_count, result=run.result, error=run.error,
                created_at=run.created_at.isoformat(), updated_at=run.updated_at.isoformat())


def enqueue_run(user, since_date, technician_filter=''):
    active = ComplaintProcessingRun.objects.filter(active_slot=1).first()
    if active:
        return active, False
    try:
        with transaction.atomic():
            return ComplaintProcessingRun.objects.create(
                requested_by=user, since_date=since_date, technician_filter=technician_filter,
            ), True
    except IntegrityError:
        active = ComplaintProcessingRun.objects.filter(active_slot=1).first()
        if active is None:
            raise
        return active, False


def process_next_run():
    with transaction.atomic():
        run = ComplaintProcessingRun.objects.select_for_update().filter(
            active_slot=1, status='queued',
        ).first()
        if run is None:
            return False
        run.status = 'running'
        run.started_at = timezone.now()
        run.save(update_fields=['status', 'started_at', 'updated_at'])

    def progress(completed, total, result):
        ComplaintProcessingRun.objects.filter(pk=run.pk).update(
            completed_count=completed, total_count=total, result=result, updated_at=timezone.now(),
        )

    try:
        result = ComplaintProcessor().process_complaints(
            run.since_date, run.technician_filter or None, progress=progress,
        )
        run.result = result
        run.status = ('needs_review' if result['review_required_count'] else
                      'failed' if result['errors'] else 'completed')
    except Exception as error:
        run.status = 'failed'
        run.error = str(error)[:4000]
    run.finished_at = timezone.now()
    run.active_slot = None
    run.save(update_fields=['status', 'result', 'error', 'finished_at', 'active_slot', 'updated_at'])
    return True
