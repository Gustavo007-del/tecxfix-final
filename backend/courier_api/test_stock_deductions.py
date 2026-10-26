"""Offline stock safety tests: no credentials, network, database, or real sheets."""
from copy import deepcopy
import json
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from .sheets_sync import (
    SheetsSync, StockPrewriteError, StockValidationError, StockWriteUncertainError,
)


class TechnicianStockDeductionTests(SimpleTestCase):
    def setUp(self):
        self.rows = [
            ["Name", "Code", "Qty", "Tech", "Formula", "Date"],
            ["Part", " AbC ", "3", " Alice  Smith ", "=E1", "2026-01-01"],
            ["Debt", "abc", "-2", "ALICE\tSMITH", "keep", "2026-01-02"],
            ["Other tech", "abc", "99", "Bob", "untouched", "date"],
            ["Recent part", "ABC", "5", "alice smith", "=E3", "2026-01-03"],
            ["Other product", "xyz", "7", "Alice Smith", "keep", "date"],
            [],
            ["Blank code", "   ", "100", "Alice Smith"],
        ]
        self.sheet = Mock()
        self.sheet.get_all_values.side_effect = lambda: deepcopy(self.rows)
        self.sheet.batch_update.side_effect = self.apply_batch
        self.sync = SheetsSync()
        self.sync.client = Mock()
        self.sync.client.open_by_key.return_value.worksheet.return_value = self.sheet
        self.sync.authenticate = Mock()
        self.sync.get_company_stock = Mock(return_value=[{"spare_id": " ABC ", "name": "Part"}])
        self.snapshot = self.enterContext(patch(
            "api.services.sheet_snapshot_sync.update_technician_stock_snapshot"
        ))
        self.lock = self.enterContext(patch("courier_api.stock_lock.stock_write_lock"))
        self.enterContext(patch("socket.socket", side_effect=AssertionError("Network forbidden")))
        self.enterContext(patch("gspread.authorize", side_effect=AssertionError("Authentication forbidden")))

    def apply_batch(self, updates, **kwargs):
        for update in updates:
            row_number = int(update["range"][1:])
            self.rows[row_number - 1][2] = str(update["values"][0][0])
        return {"totalUpdatedCells": len(updates)}

    def deduct(self, quantity=4, **kwargs):
        return self.sync.update_technician_stock("alice smith", "abc", -quantity, **kwargs)

    def assert_no_write(self):
        self.sheet.batch_update.assert_not_called()
        self.sheet.append_row.assert_not_called()
        self.sheet.update_cell.assert_not_called()
        self.snapshot.assert_not_called()

    def test_aggregation_includes_all_rows_and_negative_stock(self):
        stock = self.sync.get_technician_stock(" ALICE\nSMITH ")
        self.assertEqual([(item["spare_id"], item["qty"]) for item in stock], [("AbC", 6), ("xyz", 7)])
        self.assertEqual(stock[0]["name"], "Recent part")

    def test_unicode_casefold_is_shared_by_reads_and_mutations(self):
        self.rows = [self.rows[0], ["Part", "Straße", "4", " Weiß\tMan "]]
        self.assertEqual(self.sync.get_technician_stock("WEISS MAN")[0]["qty"], 4)
        self.sync.update_technician_stock("WEISS MAN", " STRASSE ", -2)
        self.assertEqual(self.rows[1][2], "2")

    def test_deduction_batches_only_positive_quantity_cells_preserving_rows(self):
        original = deepcopy(self.rows)
        self.assertIs(self.deduct(), True)
        self.sheet.batch_update.assert_called_once_with([
            {"range": "C2", "values": [[0]]},
            {"range": "C5", "values": [[4]]},
        ], value_input_option="RAW")
        original[1][2] = "0"
        original[4][2] = "4"
        self.assertEqual(self.rows, original)
        self.sheet.append_row.assert_not_called()
        self.sheet.cell.assert_not_called()
        self.snapshot.assert_called_once_with(
            technician_name="alice smith", spare_id="abc", name="Recent part", quantity=2,
        )

    def test_net_stock_not_sum_of_positive_rows_controls_availability(self):
        with self.assertRaises(StockValidationError):
            self.deduct(7)  # Positive rows total 8, but net stock is only 6.
        self.assert_no_write()

    def test_exact_net_deduction_keeps_existing_negative_rows(self):
        self.deduct(6)
        self.assertEqual([self.rows[i][2] for i in (1, 2, 4)], ["0", "-2", "2"])
        self.assertEqual(self.sync.get_technician_stock("alice smith")[0]["qty"], 0)

    def test_missing_stock_never_appends_a_negative_row(self):
        with self.assertRaises(StockValidationError):
            self.sync.update_technician_stock("unknown", "abc", -1)
        self.assert_no_write()
        self.sync.get_company_stock.assert_not_called()

    def test_zero_and_negative_net_stock_reject_deductions(self):
        for balance in ("0", "-1"):
            with self.subTest(balance=balance):
                self.rows = [self.rows[0], ["Part", "abc", balance, "alice smith"]]
                with self.assertRaises(StockValidationError):
                    self.deduct(1)
        self.assert_no_write()

    def test_mutations_refresh_even_after_success_and_reuse_worksheet(self):
        self.sync.get_technician_stock("alice smith")
        self.rows[1][2] = "1"
        self.deduct(1)
        self.rows[4][2] = "9"  # An external change between operations.
        self.deduct(2)
        self.assertEqual(self.rows[4][2], "7")
        self.assertEqual(self.sheet.get_all_values.call_count, 3)
        self.sync.client.open_by_key.assert_called_once()
        self.sync.client.open_by_key.return_value.worksheet.assert_called_once()
        self.assertEqual(self.sync.get_technician_stock("alice smith")[0]["qty"], 5)
        self.assertEqual(self.sheet.get_all_values.call_count, 3)

    def test_stale_read_cache_cannot_authorize_deduction(self):
        self.sync.get_technician_stock("alice smith")
        self.rows[4][2] = "0"
        with self.assertRaises(StockValidationError):
            self.deduct()
        self.assert_no_write()
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_audit_precedes_write_contains_all_matching_before_after_rows(self):
        plans = []

        def before_write(plan):
            self.assert_no_write()
            json.dumps(plan)
            plans.append(deepcopy(plan))
            plan["updates"].clear()
            plan["rows"][0]["after"] = -999  # Callback cannot change the write.

        self.deduct(before_write=before_write)
        plan, = plans
        self.assertEqual((plan["total_before"], plan["total_after"], plan["delta"]), (6, 2, -4))
        self.assertEqual([(r["row"], r["before"], r["after"]) for r in plan["rows"]],
                         [(2, 3, 0), (3, -2, -2), (5, 5, 4)])
        self.assertEqual(plan["rows"][0]["values"][4:], ["=E1", "2026-01-01"])
        self.assertEqual(self.rows[1][2], "0")

    def test_callback_failure_is_prewrite_and_aborts_sheet_and_snapshot(self):
        with self.assertRaises(StockPrewriteError) as caught:
            self.deduct(before_write=Mock(side_effect=RuntimeError("journal failed")))
        self.assertEqual(caught.exception.audit["total_after"], 2)
        self.assert_no_write()
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_read_failure_is_prewrite_and_invalidates_cache(self):
        self.sync.get_technician_stock("alice smith")
        self.sheet.get_all_values.side_effect = OSError("read failed")
        hook = Mock()
        with self.assertRaises(StockPrewriteError):
            self.deduct(before_write=hook)
        hook.assert_not_called()
        self.assert_no_write()
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_write_failure_is_uncertain_without_retry_or_snapshot_update(self):
        self.sheet.batch_update.side_effect = TimeoutError("response lost")
        with self.assertRaises(StockWriteUncertainError) as caught:
            self.deduct()
        self.assertEqual(caught.exception.audit["total_after"], 2)
        self.sheet.batch_update.assert_called_once()
        self.snapshot.assert_not_called()
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_applied_write_with_lost_response_is_uncertain(self):
        def apply_then_fail(*args, **kwargs):
            self.apply_batch(*args, **kwargs)
            raise TimeoutError("response lost after apply")

        self.sheet.batch_update.side_effect = apply_then_fail
        with self.assertRaises(StockWriteUncertainError):
            self.deduct()
        self.assertEqual(self.rows[4][2], "4")
        self.assertIsNone(self.sync._tech_stock_cache)
        self.sheet.batch_update.assert_called_once()

    def test_postwrite_snapshot_failure_is_uncertain(self):
        self.snapshot.side_effect = RuntimeError("DB unavailable")
        with self.assertRaises(StockWriteUncertainError) as caught:
            self.deduct()
        self.assertEqual(caught.exception.audit["total_after"], 2)
        self.assertEqual(self.rows[4][2], "4")
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_invalid_requested_quantities_and_identifiers_do_not_write(self):
        for quantity in (True, None, "", "NaN", "Infinity", 1.5, "nonsense"):
            with self.subTest(quantity=quantity), self.assertRaises(StockValidationError):
                self.sync.update_technician_stock("alice smith", "abc", quantity)
        for tech, spare in ((" ", "abc"), ("alice", " "), (None, "abc")):
            with self.subTest(tech=tech, spare=spare), self.assertRaises(StockValidationError):
                self.sync.update_technician_stock(tech, spare, -1)
        self.assert_no_write()

    def test_invalid_matching_sheet_quantities_fail_closed(self):
        for quantity in ("", "#N/A", "bad", "NaN", "-0.5"):
            with self.subTest(quantity=quantity):
                self.rows[2][2] = quantity
                with self.assertRaises(StockValidationError):
                    self.deduct(1)
        self.assert_no_write()

    def test_zero_delta_is_noop_without_hook_or_fetch(self):
        hook = Mock()
        self.assertIs(self.sync.update_technician_stock("alice", "abc", 0, before_write=hook), True)
        hook.assert_not_called()
        self.sheet.get_all_values.assert_not_called()
        self.assert_no_write()

    def test_positive_update_preserves_separate_rows_and_uses_batch(self):
        self.sync.update_technician_stock(" ALICE\tSMITH ", " ABC ", 2)
        self.sheet.batch_update.assert_called_once_with([
            {"range": "C2", "values": [[5]]},
        ], value_input_option="RAW")
        self.assertEqual(self.rows[2][2], "-2")
        self.assertEqual(self.rows[4][2], "5")
        self.snapshot.assert_called_once_with(
            technician_name="ALICE SMITH", spare_id="ABC", name="Recent part", delta=2,
        )

    def test_positive_missing_stock_append_is_journaled_and_cache_invalidated(self):
        hook = Mock()
        self.sync.update_technician_stock("New Tech", "abc", 2, before_write=hook)
        plan = hook.call_args.args[0]
        self.assertEqual((plan["total_before"], plan["total_after"], plan["rows"]), (0, 2, []))
        self.assertEqual(plan["append_values"], ["Part", "abc", 2, "New Tech"])
        self.sheet.append_row.assert_called_once_with(
            plan["append_values"], value_input_option="RAW", table_range="A:D",
        )
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_append_failure_is_uncertain_and_does_not_update_snapshot(self):
        self.sheet.append_row.side_effect = OSError("connection lost")
        with self.assertRaises(StockWriteUncertainError):
            self.sync.update_technician_stock("New Tech", "abc", 2)
        self.sheet.append_row.assert_called_once()
        self.snapshot.assert_not_called()
        self.assertIsNone(self.sync._tech_stock_cache)

    def test_all_stock_mutators_are_wrapped_by_shared_gate(self):
        for name in ("update_company_stock", "update_technician_stock",
                     "append_courier_technician_stock", "sync_courier_to_sheets",
                     "backfill_courier_technician_rows"):
            with self.subTest(name=name):
                self.assertTrue(hasattr(getattr(SheetsSync, name), "__wrapped__"))
        self.deduct()
        self.lock.assert_called_once_with()
