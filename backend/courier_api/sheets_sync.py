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

import gspread
from google.oauth2.service_account import Credentials
from django.core.cache import cache
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


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

    def get_technician_stock(self, technician_name):
        start_time = time.time()
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024
        
        logger.info(f"Fetching technician stock for '{technician_name}' - Memory: {memory_before:.1f}MB")
        self.authenticate()

        spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
        sheet = spreadsheet.worksheet(self.TECHNICIAN_STOCK_WORKSHEET)

        rows = sheet.get_all_values()
        data_rows = rows[1:]
        
        logger.info(f"Retrieved {len(data_rows)} rows from technician stock sheet")

        stock = []

        for r in data_rows:
            if len(r) < 4 or not r[1]:
                continue

            if r[3].strip().lower() != technician_name.strip().lower():
                continue

            stock.append({
                "spare_id": r[1].strip(),
                "name": r[0].strip(),
                "qty": safe_int(r[2]),
            })

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

    def update_technician_stock(self, technician_name, spare_id, qty_to_add):
        self.authenticate()

        spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
        sheet = spreadsheet.worksheet(self.TECHNICIAN_STOCK_WORKSHEET)

        rows = sheet.get_all_values()
        data_rows = rows[1:]

        found_row = None

        for idx, r in enumerate(data_rows):
            if (
                len(r) >= 4 and
                r[1].strip() == spare_id and
                r[3].strip().lower() == technician_name.strip().lower()
            ):
                found_row = idx + 2
                break

        if found_row:
            current_qty = safe_int(sheet.cell(found_row, 3).value)
            sheet.update_cell(found_row, 3, current_qty + qty_to_add)
        else:
            company_stock = self.get_company_stock()
            item = next(
                (s for s in company_stock if s["spare_id"] == spare_id),
                None
            )

            if not item:
                raise Exception(f"Spare {spare_id} not found in company stock")

            sheet.append_row(
                [
                    item["name"],
                    spare_id,
                    qty_to_add,
                    technician_name,
                ],
                value_input_option="USER_ENTERED"
            )

        return True

    # -----------------------
    # COURIER → SHEETS SYNC
    # -----------------------

    def sync_courier_to_sheets(self, items, technician_ids):
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

        for item in items:
            spare_id = item["spare_id"]
            qty = item["qty"]

            total_qty = qty * len(tech_mapping)
            self.update_company_stock(spare_id, total_qty)

            for tech_name in tech_mapping.values():
                self.update_technician_stock(tech_name, spare_id, qty)

        logger.info("Courier sync completed successfully")
        return True
