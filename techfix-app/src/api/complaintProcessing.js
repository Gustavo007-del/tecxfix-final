export const COMPLAINT_SINCE_DATE = '2026-03-22';
export const COMPLAINT_CUTOFF_LABEL = '22 March 2026';

export const isActiveRun = (run) => ['queued', 'running'].includes(run?.status);
const isKnownRun = (run) => run?.id != null &&
  ['queued', 'running', 'completed', 'failed', 'needs_review'].includes(run.status);

export function complaintRunSummary(run) {
  if (!run) return '';
  const progress = `${run.completed_count ?? 0} / ${run.total_count ?? 0} complaints`;
  if (isActiveRun(run)) return `${run.status === 'queued' ? 'Queued' : 'Processing'}: ${progress}`;
  const result = run.result;
  const errorCount = Array.isArray(result?.errors) ? result.errors.length : 0;
  const reviewCount = result?.review_required_count ?? 0;
  const title = run.status === 'failed' ? 'Processing failed' :
    run.status === 'needs_review' || reviewCount > 0 ? 'Review required' :
    errorCount > 0 || result?.success === false ? 'Completed with errors' :
    result?.success === true ? 'Completed successfully' : 'Completed; result unavailable';
  return [
    title,
    progress,
    result && `Processed: ${result.processed_count ?? 0}. Stock reductions: ${result.stock_reductions?.length ?? 0}. Skipped: ${result.skipped_count ?? 0}. Errors: ${errorCount}. Review required: ${reviewCount}.`,
    ...(Array.isArray(result?.errors) ? result.errors.slice(0, 5).map((error) =>
      typeof error === 'string' ? error : error?.message || error?.error || 'See complaint processing review details.') : []),
    errorCount > 5 && `${errorCount - 5} more errors.`,
    typeof run.error === 'string' && run.error,
  ].filter(Boolean).join('\n');
}

// One controller is shared by dashboard mounts: a pending POST must not be
// forgotten when navigating away. Only GET is used for recovery and polling.
export function createComplaintProcessing(client, endpoints, timers = { setTimeout, clearTimeout }) {
  let state = { run: null, submitting: false, checking: false, unknown: true, submissionError: '', message: 'Checking complaint processing status…' };
  const listeners = new Set();
  let timer = null;
  let pendingSubmission = null;

  const publish = (changes) => {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener(state));
  };
  const clearPoll = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const schedulePoll = () => {
    clearPoll();
    if (listeners.size && isActiveRun(state.run) && !state.unknown && !state.submitting) {
      timer = timers.setTimeout(() => { timer = null; checkStatus(); }, 3000);
    }
  };
  const canSubmit = () => !state.submitting && !state.checking && !state.unknown && !isActiveRun(state.run);

  async function checkStatus({ latest = false } = {}) {
    if (state.checking || state.submitting) return;
    clearPoll();
    publish({ checking: true });
    try {
      // An uncertain submission has no trustworthy id yet; ask for the latest.
      const runId = pendingSubmission || latest ? null : state.run?.id;
      const response = await client.get(endpoints.COMPLAINT_PROCESSING_STATUS, {
        params: runId == null ? {} : { run_id: runId },
      });
      const data = response.data;
      if (data?.success !== true || !Object.prototype.hasOwnProperty.call(data, 'run') ||
          (data.run !== null && !isKnownRun(data.run)) ||
          (runId != null && String(data.run?.id) !== String(runId))) {
        throw new Error('Invalid processing status');
      }
      if (pendingSubmission && (!data.run ||
          (String(data.run.id) === String(pendingSubmission.previousRunId) && !isActiveRun(data.run)))) {
        publish({ unknown: true, message: 'Submission outcome is still unknown. It may still be running. Check progress again; do not start another run.' });
      } else {
        pendingSubmission = null;
        publish({ run: data.run, unknown: false, message: '' });
      }
    } catch (_error) {
      publish({ unknown: true, message: 'Status is unavailable. Processing may still be running. Use Check progress to retry the status check.' });
    } finally {
      publish({ checking: false });
      schedulePoll();
    }
  }

  async function submit() {
    // Synchronous guard also covers multiple taps on confirmation dialogs.
    if (!canSubmit()) return;
    clearPoll();
    pendingSubmission = { previousRunId: state.run?.id ?? null };
    publish({ submitting: true, unknown: true, submissionError: '', message: 'Submitting complaint processing job…' });
    let recoverStatus = false;
    try {
      const response = await client.post(endpoints.PROCESS_COMPLAINTS, {
        since_date: COMPLAINT_SINCE_DATE,
        technician_filter: null,
      }, {
        // The shared client's 401 interceptor replays requests unless _retry
        // is set. Never automatically replay this stock-changing POST.
        _retry: true,
      });
      const data = response.data;
      if (response.status === 202 && data?.accepted === true && isKnownRun(data.run)) {
        pendingSubmission = null;
        publish({
          run: data.run,
          unknown: !isActiveRun(data.run),
          message: data.already_running ? 'An existing job is already running. Following its progress.' : 'Job accepted. Waiting for processing results.',
        });
        // Even a terminal run in an acceptance response needs GET confirmation.
        recoverStatus = !isActiveRun(data.run);
      } else {
        recoverStatus = true;
        publish({ message: 'Submission outcome is unknown. Checking progress; the job may still run.' });
      }
    } catch (error) {
      recoverStatus = true;
      if (typeof error.response?.data?.error === 'string') {
        publish({ submissionError: error.response.data.error });
      }
      // Explicit validation/auth/route rejections did not enqueue a job. Server
      // errors and transport failures can occur after enqueue and stay unknown.
      if ([400, 401, 403, 404, 405, 422].includes(error.response?.status) && !error.response?.data?.accepted) {
        pendingSubmission = null;
        publish({ submissionError: typeof error.response?.data?.error === 'string' ? error.response.data.error : 'The server rejected the processing request.' });
      }
      publish({ message: pendingSubmission ? 'Submission outcome is unknown. Checking progress; the job may still run.' : 'Request rejected. Checking current processing status.' });
    } finally {
      publish({ submitting: false });
      if (recoverStatus) await checkStatus();
      else schedulePoll();
    }
  }

  return {
    getState: () => state,
    canSubmit,
    checkStatus,
    submit,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      checkStatus({ latest: true });
      return () => {
        listeners.delete(listener);
        if (!listeners.size) clearPoll();
      };
    },
  };
}
