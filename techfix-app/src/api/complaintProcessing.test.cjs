const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Load the dependency-free ES module without changing the Expo package type.
const modulePromise = import(`data:text/javascript;base64,${fs.readFileSync(path.join(__dirname, 'complaintProcessing.js')).toString('base64')}`);
const endpoints = { PROCESS_COMPLAINTS: '/complaints/process/', COMPLAINT_PROCESSING_STATUS: '/complaints/processing-status/' };
const job = (status = 'queued', extra = {}) => ({ id: 12, status, completed_count: 0, total_count: 10, ...extra });
const response = (run) => ({ data: { success: true, run } });
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function fixture(initial = null) {
  const { createComplaintProcessing } = await modulePromise;
  const calls = { get: [], post: [] };
  const timers = new Map();
  let timerId = 0;
  const api = {
    get: async (...args) => { calls.get.push(args); return api.status(); },
    post: async (...args) => { calls.post.push(args); return api.enqueue(); },
    status: () => response(initial),
    enqueue: () => ({ status: 202, data: { success: false, accepted: true, run: job() } }),
  };
  const controller = createComplaintProcessing(api, endpoints, {
    setTimeout(fn, delay) { assert.equal(delay, 3000); timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  const unsubscribe = controller.subscribe(() => {});
  await settle();
  return { controller, api, calls, timers, unsubscribe };
}

test('mount resumes active run; polls by id; completion stops polling', async () => {
  const f = await fixture(job('running'));
  assert.deepEqual(f.calls.get[0], [endpoints.COMPLAINT_PROCESSING_STATUS, { params: {} }]);
  assert.equal(f.controller.canSubmit(), false);
  assert.equal(f.timers.size, 1);
  f.api.status = () => response(job('completed', { completed_count: 10, result: { success: true } }));
  const poll = f.timers.values().next().value;
  f.timers.clear();
  poll();
  await settle();
  assert.deepEqual(f.calls.get[1][1].params, { run_id: 12 });
  assert.equal(f.timers.size, 0);
  assert.equal(f.controller.canSubmit(), true);
  f.unsubscribe();
});

test('202 is acceptance only; duplicate taps enqueue once and POST disables auth replay', async () => {
  const f = await fixture();
  const pending = deferred();
  f.api.enqueue = () => pending.promise;
  const submission = f.controller.submit();
  await f.controller.submit();
  assert.equal(f.calls.post.length, 1);
  assert.equal(f.controller.canSubmit(), false);
  assert.deepEqual(f.calls.post[0], [endpoints.PROCESS_COMPLAINTS,
    { since_date: '2026-03-22', technician_filter: null }, { _retry: true }]);
  pending.resolve({ status: 202, data: { success: false, accepted: true, already_running: true, run: job() } });
  await submission;
  assert.equal(f.controller.getState().run.status, 'queued');
  assert.match(f.controller.getState().message, /existing job/);
  assert.equal(f.controller.canSubmit(), false);
  assert.equal(f.timers.size, 1);
  f.unsubscribe();
  assert.equal(f.timers.size, 0);
});

test('timeout recovers latest job via GET without replaying POST', async () => {
  const f = await fixture();
  f.api.enqueue = () => { throw new Error('timeout'); };
  f.api.status = () => response(job('running'));
  await f.controller.submit();
  assert.equal(f.calls.post.length, 1);
  assert.deepEqual(f.calls.get.at(-1)[1].params, {});
  assert.equal(f.controller.getState().unknown, false);
  assert.equal(f.controller.canSubmit(), false);
  assert.equal(f.timers.size, 1);
  f.unsubscribe();
});

test('uncertain POST stays blocked for null or previous terminal run; check progress can recover', async () => {
  const previous = job('completed', { id: 11, result: { success: true } });
  const f = await fixture(previous);
  f.api.enqueue = () => { throw new Error('timeout'); };
  await f.controller.submit();
  assert.equal(f.controller.getState().unknown, true);
  assert.equal(f.controller.canSubmit(), false);
  f.api.status = () => response(null);
  await f.controller.checkStatus();
  assert.equal(f.controller.getState().unknown, true);
  f.api.status = () => response(job('needs_review'));
  await f.controller.checkStatus();
  assert.equal(f.controller.getState().unknown, false);
  assert.equal(f.controller.getState().run.status, 'needs_review');
  assert.equal(f.calls.post.length, 1);
  f.unsubscribe();
});

test('GET failure preserves last known progress and exposes GET recovery', async () => {
  const f = await fixture(job('running', { completed_count: 3 }));
  f.api.status = () => { throw new Error('offline'); };
  await f.controller.checkStatus();
  assert.equal(f.controller.getState().run.completed_count, 3);
  assert.equal(f.controller.getState().unknown, true);
  assert.equal(f.controller.canSubmit(), false);
  assert.equal(f.timers.size, 0);
  f.api.status = () => response(job('running', { completed_count: 5 }));
  await f.controller.checkStatus();
  assert.equal(f.controller.getState().unknown, false);
  assert.equal(f.timers.size, 1);
  f.unsubscribe();
});

test('no overlapping GETs; unmount during request leaves no timer or updates', async () => {
  const f = await fixture(job('running'));
  const pending = deferred();
  f.api.status = () => pending.promise;
  const check = f.controller.checkStatus();
  await f.controller.checkStatus();
  assert.equal(f.calls.get.length, 2);
  f.unsubscribe();
  pending.resolve(response(job('running')));
  await check;
  assert.equal(f.timers.size, 0);
});

test('remount fetches latest rather than a previously completed run', async () => {
  const f = await fixture(job('completed'));
  f.unsubscribe();
  f.api.status = () => response(job('running', { id: 13 }));
  const stop = f.controller.subscribe(() => {});
  await settle();
  assert.deepEqual(f.calls.get.at(-1)[1].params, {});
  assert.equal(f.controller.getState().run.id, 13);
  assert.equal(f.controller.canSubmit(), false);
  stop();
});

test('unmount during POST preserves guard and resumes progress on remount', async () => {
  const f = await fixture();
  const pending = deferred();
  f.api.enqueue = () => pending.promise;
  const submission = f.controller.submit();
  f.unsubscribe();
  const stop = f.controller.subscribe(() => {});
  await f.controller.submit();
  assert.equal(f.calls.post.length, 1);
  assert.equal(f.calls.get.length, 1);
  pending.resolve({ status: 202, data: { accepted: true, run: job() } });
  await submission;
  assert.equal(f.timers.size, 1);
  stop();
});

test('old/malformed status endpoint cannot enable submission', async () => {
  const f = await fixture();
  for (const data of [{ success: true }, { success: true, run: { id: 12, status: 'mystery' } }, { success: false, run: null }]) {
    f.api.status = () => ({ data });
    await f.controller.checkStatus();
    assert.equal(f.controller.getState().unknown, true);
    assert.equal(f.controller.canSubmit(), false);
  }
  f.unsubscribe();
});

test('terminal run in 202 requires GET confirmation before success', async () => {
  const f = await fixture();
  const pending = deferred();
  f.api.enqueue = () => ({ status: 202, data: { accepted: true, run: job('completed') } });
  f.api.status = () => pending.promise;
  const submission = f.controller.submit();
  await settle();
  assert.equal(f.controller.getState().unknown, true);
  assert.equal(f.controller.canSubmit(), false);
  pending.resolve(response(job('completed', { result: { success: true } })));
  await submission;
  assert.equal(f.controller.getState().unknown, false);
  assert.equal(f.controller.canSubmit(), true);
  f.unsubscribe();
});

test('explicit rejection shows error and recovers through GET without POST replay', async () => {
  const f = await fixture();
  f.api.enqueue = () => { throw { response: { status: 403, data: { error: 'Not permitted' } } }; };
  await f.controller.submit();
  assert.equal(f.calls.post.length, 1);
  assert.equal(f.controller.getState().submissionError, 'Not permitted');
  assert.equal(f.controller.canSubmit(), true);
  f.unsubscribe();
});

test('server failure message remains visible but cannot authorize another POST', async () => {
  const f = await fixture();
  f.api.enqueue = () => { throw { response: { status: 503, data: { error: 'Processing is paused' } } }; };
  await f.controller.submit();
  assert.equal(f.controller.getState().submissionError, 'Processing is paused');
  assert.equal(f.controller.getState().unknown, true);
  assert.equal(f.controller.canSubmit(), false);
  assert.equal(f.calls.post.length, 1);
  f.unsubscribe();
});

test('summaries distinguish success, errors, review, failure and missing results', async () => {
  const { complaintRunSummary } = await modulePromise;
  assert.match(complaintRunSummary(job('queued')), /^Queued/);
  assert.match(complaintRunSummary(job('completed', { result: { success: true } })), /^Completed successfully/);
  assert.match(complaintRunSummary(job('completed', { result: { success: true, errors: ['bad item'] } })), /^Completed with errors/);
  assert.match(complaintRunSummary(job('completed', { result: { success: false } })), /^Completed with errors/);
  assert.match(complaintRunSummary(job('completed', { result: { success: true, review_required_count: 2 } })), /^Review required/);
  assert.match(complaintRunSummary(job('needs_review')), /^Review required/);
  assert.match(complaintRunSummary(job('failed', { error: 'Worker failed' })), /Processing failed[\s\S]*Worker failed/);
  assert.match(complaintRunSummary(job('completed')), /^Completed; result unavailable/);
});
