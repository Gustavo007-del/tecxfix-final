# Complaint stock processing rollout

This change is intentionally **off by default** (`COMPLAINT_PROCESSING_ENABLED=False`).
Do not switch it on merely because the web release succeeded. It does not
repair historical negative balances automatically.

1. Back up the production PostgreSQL database and the **Technician Stocks**
   worksheet. Confirm that the database connection is direct or session-pooled
   PostgreSQL, not transaction-pooled PgBouncer: stock writes use a PostgreSQL
   session advisory lock shared by the web app and complaint worker.
2. Apply migrations through `api.0014_remove_orphan_sales_product_id` **before**
   starting web code that writes `StockOperation`. Migration 0014 conditionally
   removes the orphan `product_id` column left by the old state-only migration.
   Inspect the schema and test this on a database copy first.
3. Keep complaint processing disabled while reconciling old `ProcessedComplaint`
   records and negative/duplicate stock rows against physical stock, complaint
   history, and Sheets revision history. In particular, do not blindly add 2 to
   Sahad's stock: the supplied sheet shows several negative rows and does not
   establish which real-world items were used or returned.
4. Start **one** dedicated worker with
   `python manage.py process_complaint_jobs`. Deploy the updated app client.
   Verify the status endpoint works before enabling the flag. Set
   `COMPLAINT_PROCESSING_ENABLED=True` only after the worker is healthy.
5. Start with a small, inspected technician/date subset via the admin API;
   confirm the returned run is `completed`, inspect `StockOperation` plans and
   compare the sheet and snapshot totals. Then process the remaining eligible
   closed complaints dated 22 March 2026 onward. The UI uses that cutoff.

An accepted HTTP 202 means **queued**, not deducted. `running` jobs left after
a worker crash are deliberately not auto-resumed. An `applying` or
`needs_review` stock operation means the Google write outcome is uncertain;
compare the saved `plan` and Sheets history before any manual resolution. Do
not clear statuses or re-run deductions just to make a job green. A failed
pre-write validation may be retried once its input/stock is corrected.

Column P retains the existing behavior pending the client's decision: a
recognized `DD-Mon-YYYY` date before the cutoff skips; blank and unrecognized
values are not treated as proof of prior deduction. Existing legacy
`ProcessedComplaint` rows, including failures, are skipped to avoid repeating
an uncertain historical write. Manual spreadsheet edits are outside the app's
lock and must be paused during processing.

To stop new complaint runs, set `COMPLAINT_PROCESSING_ENABLED=False`; the
worker can finish or be stopped after its current run. Do not rely on the flag
to roll back stock already written to Sheets. Keep the status and journal data
for reconciliation.
