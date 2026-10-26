# backend/courier_api/sheets_sync.py

import os
import json
import logging
import time
import psutil
import socket
import traceback
from datetime import datetime
import signal
from contextlib import contextmanager
from copy import deepcopy
from decimal import Decimal, InvalidOperation

import gspread
from google.oauth2.service_account import Credentials
from django.core.cache import cache
from django.contrib.auth.models import User
from .sheets_rate_limit import install_sheets_api_rate_limit
from .stock_lock import serialized_stock_write

logger = logging.getLogger(__name__)


class StockUpdateError(Exception):
    """Technician update failure; audit contains the intended write, if prepared."""

    def __init__(self, message, audit=None):
        super().__init__(message)
        self.audit = deepcopy(audit)


class StockPrewriteError(StockUpdateError):
    """No Google stock write was attempted (including a failed audit hook)."""


class StockValidationError(StockPrewriteError):
    """Invalid input, invalid sheet quantity, or insufficient net stock."""


class StockWriteUncertainError(StockUpdateError):
    """A write was attempted; reconcile the audit before considering a retry."""


def canonical_product(value):
    return str(value or "").strip().casefold()


def canonical_technician(value):
    return " ".join(str(value or "").split()).casefold()


def _stock_quantity(value):
    """Fail closed for mutations instead of silently dropping malformed stock."""
    try:
        quantity = Decimal(str(value).strip().replace(",", ""))
        if not quantity.is_finite() or quantity != quantity.to_integral_value():
            raise ValueError
        return int(quantity)
    except (InvalidOperation, ValueError, TypeError, OverflowError) as exc:
        raise StockValidationError(f"Invalid stock quantity: {value!r}") from exc


# -----------------------
# TIMEOUT CONTEXT MANAGER
# -----------------------

class TimeoutError(Exception):
    pass

@contextmanager
def timeout_context(seconds):
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Operation timed out after {seconds} seconds")
    
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)
    
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


# -----------------------
# SAFE CONVERSION HELPERS
# -----------------------

def safe_int(value):
    try:
        if value in (None, "", "#N/A"):
            return 0
        return int(float(str(value).replace(",", "")))
    except Exception:
        return 0


def safe_float(value):
    try:
        if value in (None, "", "#N/A"):
            return 0.0
        return float(str(value).replace(",", ""))
    except Exception:
        return 0.0


# -----------------------
# GOOGLE SHEETS SYNC CLASS
# -----------------------

class SheetsSync:
    """
    Handles all Google Sheets synchronization for courier management.
    Uses ENV-based Google Service Account authentication (Render-safe).
    """

    SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

    # ---- SHEET CONFIG ----
    COMPANY_SHEET_ID = "1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ"
    COMPANY_STOCK_WORKSHEET = "Mrp List"
    TECHNICIAN_STOCK_WORKSHEET = "Technician Stocks"

    def __init__(self):
        # IMPORTANT: Do NOT authenticate here
        self.client = None
        # In-memory cache of the "Technician Stocks" sheet for the lifetime of
        # this SheetsSync instance (i.e. for one processing run/request).
        # Without this, get_technician_stock() re-downloads the whole sheet
        # from Google on every single call, which is what was causing the
        # worker timeout when processing many complaints in one request.
        self._tech_stock_cache = None
        self._tech_stock_sheet = None

    # -----------------------
    # AUTHENTICATION (ENV BASED)
    # -----------------------

    def authenticate(self):
        """
        Authenticate lazily using GOOGLE_SERVICE_ACCOUNT_JSON env variable.
        Enhanced with detailed logging for connection debugging.
        """
        if self.client:
            logger.debug("Google Sheets client already authenticated")
            return

        start_time = time.time()
        logger.info("=== GOOGLE SHEETS AUTHENTICATION START ===")
        logger.info(f"[TIMING] Sheets authentication started at: {time.strftime('%H:%M:%S.%f', time.gmtime())}")
        
        try:
            # Check environment variable
            env_start = time.time()
            service_account_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
            env_time = time.time() - env_start
            logger.info(f"[TIMING] Environment variable check completed in: {env_time:.3f}s")
            logger.info(f"Service account JSON env var check: {'SET' if service_account_json else 'NOT_SET'}")

            if not service_account_json:
                logger.error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set")
                raise Exception(
                    "GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set"
                )

            # Parse JSON
            logger.info("[TIMING] Parsing service account JSON...")
            parse_start = time.time()
            try:
                service_account_info = json.loads(service_account_json)
                logger.info(f"Service account JSON parsed successfully. Keys: {list(service_account_info.keys())}")
                if 'client_email' in service_account_info:
                    logger.info(f"Client email: {service_account_info['client_email']}")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse service account JSON: {e}")
                raise
            parse_time = time.time() - parse_start
            logger.info(f"[TIMING] JSON parsing completed in: {parse_time:.3f}s")

            # Test network connectivity
            logger.info("[TIMING] Testing network connectivity...")
            net_start = time.time()
            try:
                # Test DNS resolution
                dns_start = time.time()
                socket.gethostbyname('www.googleapis.com')
                dns_time = time.time() - dns_start
                logger.info(f"[TIMING] DNS resolution completed in: {dns_time:.3f}s")
                logger.info("DNS resolution for www.googleapis.com: OK")
                
                # Test HTTP connection to Google APIs
                http_start = time.time()
                test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                test_socket.settimeout(10)
                result = test_socket.connect_ex(('www.googleapis.com', 443))
                test_socket.close()
                http_time = time.time() - http_start
                
                if result == 0:
                    logger.info(f"[TIMING] HTTP connection test completed in: {http_time:.3f}s")
                    logger.info("HTTP connection to www.googleapis.com:443: OK")
                else:
                    logger.warning(f"HTTP connection to www.googleapis.com:443 failed with code {result}")
            except Exception as net_error:
                logger.error(f"Network connectivity test failed: {net_error}")
            net_time = time.time() - net_start
            logger.info(f"[TIMING] Network connectivity test completed in: {net_time:.3f}s")
            
            # Create credentials
            logger.info("[TIMING] Creating Google credentials...")
            creds_start = time.time()
            creds = Credentials.from_service_account_info(
                service_account_info,
                scopes=self.SCOPES
            )
            creds_time = time.time() - creds_start
            logger.info(f"[TIMING] Credentials creation completed in: {creds_time:.3f}s")
            logger.info(f"Credentials created. Scopes: {self.SCOPES}")
            logger.info(f"Token valid: {creds.valid if hasattr(creds, 'valid') else 'Unknown'}")

            # Authorize client
            logger.info("[TIMING] Authorizing gspread client...")
            auth_start = time.time()
            self.client = gspread.authorize(creds)
            self.client.set_timeout(30)
            # gspread routes Sheets API calls through this HTTP client. The
            # database-backed slot schedule is shared by web workers and the
            # backfill process, keeping app traffic to 40 requests/min and
            # reserving headroom under Google's 60/user/minute quota.
            install_sheets_api_rate_limit(self.client)
            auth_time = time.time() - auth_start
            logger.info(f"[TIMING] Gspread authorization completed in: {auth_time:.3f}s")
            
            duration = time.time() - start_time
            logger.info(f"=== GOOGLE SHEETS AUTHENTICATION SUCCESS === Duration: {duration:.2f}s")
            
            # Test the connection
            logger.info("[TIMING] Testing Google Sheets connection...")
            test_start = time.time()
            try:
                # Try to open the spreadsheet to verify connection
                test_spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
                test_time = time.time() - test_start
                logger.info(f"[TIMING] Connection test completed in: {test_time:.3f}s")
                logger.info(f"Successfully connected to spreadsheet: {test_spreadsheet.title}")
            except Exception as test_error:
                test_time = time.time() - test_start
                logger.error(f"[TIMING] Connection test failed after: {test_time:.3f}s")
                logger.warning(f"Connection test failed: {test_error}")

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"=== GOOGLE SHEETS AUTHENTICATION FAILED === Duration: {duration:.2f}s")
            logger.error(f"[TIMING] Authentication failed after: {duration:.3f}s")
            logger.error(f"Error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    # -----------------------
    # COMPANY STOCK
    # -----------------------

    def get_company_stock(self):
        start_time = time.time()
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024
        
        logger.info(f"=== GET COMPANY STOCK START === Memory: {memory_before:.1f}MB")
        
        cache_key = "company_stock_data"
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            duration = time.time() - start_time
            logger.info(f"Returning cached company stock data ({len(cached_data)} items) - "
                       f"Duration: {duration:.2f}s - Memory: {memory_before:.1f}MB")
            return cached_data
        
        logger.info(f"Fetching company stock from Google Sheets - Memory: {memory_before:.1f}MB")
        
        try:
            self.authenticate()
            logger.info("Authentication completed, opening spreadsheet...")

            with timeout_context(15):  # 15 second timeout for opening spreadsheet
                spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
            logger.info(f"Spreadsheet opened: {spreadsheet.title}")
            
            with timeout_context(10):  # 10 second timeout for accessing worksheet
                sheet = spreadsheet.worksheet(self.COMPANY_STOCK_WORKSHEET)
            logger.info(f"Worksheet accessed: {self.COMPANY_STOCK_WORKSHEET}")

            logger.info("Fetching all values from worksheet...")
            try:
                with timeout_context(20):  # 20 second timeout for sheets API
                    rows = sheet.get_all_values()
            except TimeoutError:
                logger.error("Google Sheets API call timed out after 20 seconds")
                raise Exception("Google Sheets API timeout - please try again")
            
            data_rows = rows[1:]
            
            logger.info(f"Retrieved {len(data_rows)} rows from Google Sheets")
            logger.info(f"Header row: {rows[0] if rows else 'No headers'}")

            stock = []
            processed_count = 0
            skipped_count = 0

            for idx, r in enumerate(data_rows):
                if len(r) < 7 or not r[1]:
                    skipped_count += 1
                    if skipped_count <= 5:  # Log first 5 skipped rows
                        logger.debug(f"Skipped row {idx+2}: {r}")
                    continue

                processed_count += 1
                stock.append({
                    "spare_id": r[1].strip(),
                    "name": r[2].strip(),
                    "mrp": safe_float(r[3]),
                    "hsn": r[4].strip() if len(r) > 4 else "",
                    "brand": r[5].strip() if len(r) > 5 else "",
                    "qty": safe_int(r[6]) if len(r) > 6 else 0,
                })

            logger.info(f"Processed {processed_count} valid items, skipped {skipped_count} invalid rows")

            # Cache for 24 hours (86400 seconds)
            cache.set(cache_key, stock, 86400)
            logger.info(f"Company stock cached for 24 hours")
            
            duration = time.time() - start_time
            memory_after = process.memory_info().rss / 1024 / 1024
            memory_delta = memory_after - memory_before
            
            logger.info(f"=== GET COMPANY STOCK SUCCESS === "
                       f"Items: {len(stock)} - Duration: {duration:.2f}s - "
                       f"Memory: {memory_before:.1f}MB → {memory_after:.1f}MB (Δ{memory_delta:+.1f}MB)")
            return stock
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"=== GET COMPANY STOCK FAILED === Duration: {duration:.2f}s")
            logger.error(f"Error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    # -----------------------
    # TECHNICIAN STOCK
    # -----------------------

    def _get_tech_stock_sheet(self):
        if self._tech_stock_sheet is None:
            self.authenticate()
            spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
            self._tech_stock_sheet = spreadsheet.worksheet(self.TECHNICIAN_STOCK_WORKSHEET)
        return self._tech_stock_sheet

    def _get_tech_stock_sheet_rows(self, force_refresh=False):
        """
        Fetch the "Technician Stocks" worksheet ONCE and cache the raw rows
        on this instance. Every complaint used to trigger its own full-sheet
        fetch (~1s+ round trip to Google), so 69 complaints meant 69+ sequential
        network calls in a single request - easily blowing past gunicorn's
        worker timeout. Now we fetch it once per run and reuse it.
        """
        if self._tech_stock_cache is not None and not force_refresh:
            return self._tech_stock_cache

        # A failed refresh must not leave an older snapshot available for reuse.
        self._tech_stock_cache = None
        sheet = self._get_tech_stock_sheet()
        rows = sheet.get_all_values()
        self._tech_stock_cache = rows[1:]
        logger.info(f"Fetched and cached {len(self._tech_stock_cache)} rows from technician stock sheet")
        return self._tech_stock_cache

    def get_technician_stock(self, technician_name):
        start_time = time.time()
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024
        
        logger.info(f"Fetching technician stock for '{technician_name}' - Memory: {memory_before:.1f}MB")

        data_rows = self._get_tech_stock_sheet_rows()

        stock_by_spare_id = {}
        technician_key = canonical_technician(technician_name)

        for r in data_rows:
            if len(r) < 4 or not canonical_product(r[1]):
                continue

            if canonical_technician(r[3]) != technician_key:
                continue

            spare_id = r[1].strip()
            key = canonical_product(spare_id)
            if key in stock_by_spare_id:
                stock_by_spare_id[key]["qty"] += safe_int(r[2])
                if r[0].strip():
                    stock_by_spare_id[key]["name"] = r[0].strip()
            else:
                stock_by_spare_id[key] = {
                    "spare_id": spare_id,
                    "name": r[0].strip(),
                    "qty": safe_int(r[2]),
                }

        stock = list(stock_by_spare_id.values())

        duration = time.time() - start_time
        memory_after = process.memory_info().rss / 1024 / 1024
        memory_delta = memory_after - memory_before
        
        logger.info(
            f"Fetched {len(stock)} items for technician '{technician_name}' - "
            f"Duration: {duration:.2f}s - "
            f"Memory: {memory_before:.1f}MB → {memory_after:.1f}MB (Δ{memory_delta:+.1f}MB)"
        )
        return stock

    # -----------------------
    # UPDATE COMPANY STOCK
    # -----------------------

    @serialized_stock_write
    def update_company_stock(self, spare_id, qty_to_reduce):
        start_time = time.time()
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024
        
        logger.info(f"Updating company stock: {spare_id} -{qty_to_reduce} - Memory: {memory_before:.1f}MB")
        self.authenticate()

        spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
        sheet = spreadsheet.worksheet(self.COMPANY_STOCK_WORKSHEET)

        cell = sheet.find(spare_id, in_column=2)
        if not cell:
            raise Exception(f"Spare Code {spare_id} not found")

        row_idx = cell.row
        current_qty = safe_int(sheet.cell(row_idx, 7).value)

        new_qty = current_qty - qty_to_reduce
        if new_qty < 0:
            raise Exception(
                f"Insufficient stock for {spare_id} (Available: {current_qty})"
            )

        sheet.update_cell(row_idx, 7, new_qty)

        # Invalidate cache after updating stock
        cache.delete("company_stock_data")
        
        duration = time.time() - start_time
        memory_after = process.memory_info().rss / 1024 / 1024
        memory_delta = memory_after - memory_before
        
        logger.info(
            f"Company stock updated: {spare_id} {current_qty} → {new_qty} - "
            f"Duration: {duration:.2f}s - "
            f"Memory: {memory_before:.1f}MB → {memory_after:.1f}MB (Δ{memory_delta:+.1f}MB)"
        )
        return True

    # -----------------------
    # UPDATE TECHNICIAN STOCK
    # -----------------------

    @serialized_stock_write
    def update_technician_stock(self, technician_name, spare_id, qty_to_add, *, before_write=None):
        """Apply a signed integer delta using fresh rows and return True.

        The caller must hold its global stock-operation gate throughout this
        call; the decorator also acquires that same reentrant gate. No automatic
        retries are performed here. An optional
        before_write(audit) callback must durably journal the JSON-serializable
        plan before returning; raising aborts the write. It receives a detached
        copy, so changing it cannot alter the write. Audit rows contain physical
        row numbers, original row values, and before/after quantities, including
        unchanged negative rows; totals describe net stock. For an append the
        row number is unknown until Google assigns it.

        StockPrewriteError (including StockValidationError) means no stock write
        was attempted. StockWriteUncertainError means the write may have applied:
        inspect its .audit and reconcile, never blindly retry. Process death
        after the hook also requires reconciliation of the parent's journal.
        Errors after the Google write are also uncertain to the caller until
        its journal commits completion.
        A zero delta is a no-op and does not invoke the hook.
        """
        audit = None
        try:
            product_key = canonical_product(spare_id)
            technician_key = canonical_technician(technician_name)
            if not product_key or not technician_key:
                raise StockValidationError("Technician and spare ID must be nonempty")
            qty_to_add = _stock_quantity(qty_to_add)
            if qty_to_add == 0:
                return True

            data_rows = self._get_tech_stock_sheet_rows(force_refresh=True)
            sheet = self._get_tech_stock_sheet()
            matches = []
            for idx, row in enumerate(data_rows, start=2):
                if (len(row) >= 4 and canonical_product(row[1]) == product_key
                        and canonical_technician(row[3]) == technician_key):
                    quantity = _stock_quantity(row[2])
                    matches.append({"row": idx, "values": list(row),
                                    "before": quantity, "after": quantity})

            total_before = sum(row["before"] for row in matches)
            if qty_to_add < 0 and (not matches or total_before < -qty_to_add):
                raise StockValidationError(
                    f"Insufficient stock for {spare_id} (Available: {total_before})"
                )

            append_values = None
            part_name = next((row["values"][0].strip() for row in reversed(matches)
                              if row["values"][0].strip()), "")
            if qty_to_add < 0:
                remaining = -qty_to_add
                for row in matches:
                    deduction = min(max(row["before"], 0), remaining)
                    row["after"] -= deduction
                    remaining -= deduction
            elif matches:
                matches[0]["after"] += qty_to_add
            else:
                item = next((item for item in self.get_company_stock()
                             if canonical_product(item["spare_id"]) == product_key), None)
                if item is None:
                    raise StockValidationError(f"Spare {spare_id} not found in company stock")
                part_name = item["name"]
                append_values = [part_name, str(spare_id).strip(), qty_to_add,
                                 " ".join(str(technician_name).split())]

            updates = [{"range": f'C{row["row"]}', "values": [[row["after"]]]}
                       for row in matches if row["before"] != row["after"]]
            # Prepare the success cache before the write, without mutating the
            # fetched rows. An append needs a fresh read for its actual position.
            success_cache = deepcopy(data_rows) if append_values is None else None
            if success_cache is not None:
                for row in matches:
                    if row["before"] != row["after"]:
                        success_cache[row["row"] - 2][2] = str(row["after"])
            audit = {
                "spreadsheet_id": self.COMPANY_SHEET_ID,
                "worksheet": self.TECHNICIAN_STOCK_WORKSHEET,
                "technician": technician_key, "spare_id": product_key,
                "delta": qty_to_add, "total_before": total_before,
                "total_after": total_before + qty_to_add,
                "rows": matches, "updates": updates, "append_values": append_values,
            }
            if before_write is not None:
                before_write(deepcopy(audit))
        except StockPrewriteError:
            self._tech_stock_cache = None
            raise
        except Exception as exc:
            self._tech_stock_cache = None
            raise StockPrewriteError("Technician stock update failed before write", audit) from exc

        # Any failure once the write is invoked is conservatively uncertain,
        # even if it appears to be a transport timeout or server rejection.
        self._tech_stock_cache = None
        try:
            if append_values is not None:
                sheet.append_row(append_values, value_input_option="RAW", table_range="A:D")
            else:
                sheet.batch_update(updates, value_input_option="RAW")
        except Exception as exc:
            raise StockWriteUncertainError(
                "Technician stock write outcome is uncertain; reconcile before retrying", audit
            ) from exc
        self._tech_stock_cache = success_cache

        # Use the observed net balance for deductions so a stale snapshot or
        # duplicate sheet rows cannot make the local total drift further.
        try:
            from api.services.sheet_snapshot_sync import update_technician_stock_snapshot
            snapshot_kwargs = {"quantity": audit["total_after"]} if qty_to_add < 0 else {"delta": qty_to_add}
            update_technician_stock_snapshot(
                technician_name=" ".join(str(technician_name).split()),
                spare_id=str(spare_id).strip(), name=part_name, **snapshot_kwargs,
            )
        except Exception as exc:
            self._tech_stock_cache = None
            raise StockWriteUncertainError(
                "Sheet stock write succeeded but snapshot update failed; reconcile before retrying", audit
            ) from exc

        return True

    @serialized_stock_write
    def append_courier_technician_stock(self, technician_name, spare_id, qty, item_name, sent_date):
        """Append a courier stock row, writing only A:D and F so column E is preserved."""
        sheet = self._get_tech_stock_sheet()
        self._tech_stock_cache = None

        # Append exactly A:D; the append response identifies the row used.
        result = sheet.append_row(
            [item_name, spare_id, qty, technician_name],
            value_input_option="USER_ENTERED",
            table_range="A:D",
        )
        updated_range = result.get("updates", {}).get("updatedRange", "")
        try:
            import re
            match = re.search(r"![A-Z]+(\d+):", updated_range)
            if not match:
                raise ValueError(f"Could not determine appended sheet row from {updated_range!r}")
            row_number = int(match.group(1))
        except Exception:
            # Do not guess a row and risk writing into an existing technician's data.
            raise RuntimeError("Courier row was appended but its row number could not be confirmed")

        sheet.update_cell(row_number, 6, sent_date)
        self._tech_stock_cache = None

        try:
            from api.services.sheet_snapshot_sync import update_technician_stock_snapshot
            update_technician_stock_snapshot(
                technician_name=technician_name,
                spare_id=spare_id,
                delta=qty,
                name=item_name,
            )
        except Exception:
            logger.exception("Failed updating technician stock snapshot for courier row %s / %s", technician_name, spare_id)
        return True

    # -----------------------
    # COURIER → SHEETS SYNC
    # -----------------------

    @serialized_stock_write
    def sync_courier_to_sheets(self, items, technician_ids, sent_date=None):
        from .models import TechnicianStock

        self.authenticate()

        tech_mapping = {}

        for tech_id in technician_ids:
            tech_stock = TechnicianStock.objects.filter(
                technician_id=tech_id
            ).first()

            if tech_stock and tech_stock.sheet_technician_name:
                tech_mapping[tech_id] = tech_stock.sheet_technician_name
            else:
                try:
                    user = User.objects.get(id=tech_id)
                    tech_mapping[tech_id] = user.username
                except User.DoesNotExist:
                    continue

        if not tech_mapping:
            raise Exception("No valid technicians found")

        sent_date = sent_date or datetime.now().date().isoformat()
        from django.db.models import F
        for item in items:
            spare_id = item["spare_id"]
            qty = item["qty"]

            total_qty = qty * len(tech_mapping)
            self.update_company_stock(spare_id, total_qty)
            try:
                from api.models import CompanyStock
                CompanyStock.objects.filter(spare_id=spare_id).update(
                    quantity=F('quantity') - total_qty
                )
            except Exception:
                logger.exception("Company stock snapshot update failed for %s", spare_id)

            for tech_name in tech_mapping.values():
                self.append_courier_technician_stock(
                    tech_name, spare_id, qty, item.get("name", ""), sent_date
                )

        logger.info("Courier sync completed successfully")
        return True

    @serialized_stock_write
    def backfill_courier_technician_rows(self, items, technician_ids, sent_date):
        """Append one historical courier's technician rows in two batched writes.

        This intentionally skips company stock: historical backfill is for
        making sent courier items visible in technician stock, and the company
        sheet is not authoritative for this repair. Column E is never written.
        """
        from .models import TechnicianStock

        self.authenticate()
        tech_mapping = {}
        for tech_id in technician_ids:
            tech_stock = TechnicianStock.objects.filter(technician_id=tech_id).first()
            if tech_stock and tech_stock.sheet_technician_name:
                tech_mapping[tech_id] = tech_stock.sheet_technician_name
            else:
                try:
                    user = User.objects.get(id=tech_id)
                    tech_mapping[tech_id] = user.username
                except User.DoesNotExist:
                    continue

        if not tech_mapping:
            raise Exception("No valid technicians found")

        rows = []
        snapshot_updates = []
        for item in items:
            spare_id = str(item.get('spare_id', '')).strip()
            qty = item.get('qty', 0)
            item_name = item.get('name', '')
            for tech_name in tech_mapping.values():
                rows.append([item_name, spare_id, qty, tech_name])
                snapshot_updates.append((tech_name, spare_id, qty, item_name))

        if not rows:
            raise Exception("Courier has no technician stock rows to append")

        sheet = self._get_tech_stock_sheet()
        self._tech_stock_cache = None
        result = sheet.append_rows(
            rows,
            value_input_option='USER_ENTERED',
            table_range='A:D',
        )
        updated_range = result.get('updates', {}).get('updatedRange', '')
        import re
        match = re.search(r'![A-Z]+(\d+):[A-Z]+(\d+)', updated_range)
        if not match:
            raise RuntimeError(
                "Technician rows were appended but their row range could not be confirmed; "
                "inspect the sheet before retrying"
            )
        first_row, last_row = map(int, match.groups())
        if last_row - first_row + 1 != len(rows):
            raise RuntimeError(
                "Appended row count does not match the courier; inspect the sheet before retrying"
            )

        # One batched values write updates F while preserving existing E values.
        sheet.batch_update(
            [{
                'range': f'F{first_row}:F{last_row}',
                'values': [[sent_date] for _ in rows],
            }],
            value_input_option='USER_ENTERED',
        )

        for tech_name, spare_id, qty, item_name in snapshot_updates:
            try:
                from api.services.sheet_snapshot_sync import update_technician_stock_snapshot
                update_technician_stock_snapshot(
                    technician_name=tech_name,
                    spare_id=spare_id,
                    delta=qty,
                    name=item_name,
                )
            except Exception:
                logger.exception(
                    "Failed updating technician snapshot for courier row %s / %s",
                    tech_name,
                    spare_id,
                )

        logger.info("Backfilled %s technician rows for courier", len(rows))
        return len(rows)
