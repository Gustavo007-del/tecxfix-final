# backend/courier_api/sheets_sync.py

import os
import json
import logging

import gspread
from google.oauth2.service_account import Credentials

from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


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
        """
        if self.client:
            return

        try:
            service_account_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")

            if not service_account_json:
                raise Exception(
                    "GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set"
                )

            service_account_info = json.loads(service_account_json)

            creds = Credentials.from_service_account_info(
                service_account_info,
                scopes=self.SCOPES
            )

            self.client = gspread.authorize(creds)
            logger.info("Google Sheets authentication successful")

        except Exception as e:
            logger.error(f"Google Sheets authentication failed: {e}")
            raise

    # -----------------------
    # COMPANY STOCK
    # -----------------------

    def get_company_stock(self):
        self.authenticate()

        spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
        sheet = spreadsheet.worksheet(self.COMPANY_STOCK_WORKSHEET)

        rows = sheet.get_all_values()
        data_rows = rows[1:]

        stock = []

        for r in data_rows:
            if len(r) < 7 or not r[1]:
                continue

            stock.append({
                "spare_id": r[1].strip(),
                "name": r[2].strip(),
                "mrp": safe_float(r[3]),
                "hsn": r[4].strip() if len(r) > 4 else "",
                "brand": r[5].strip() if len(r) > 5 else "",
                "qty": safe_int(r[6]) if len(r) > 6 else 0,
            })

        logger.info(f"Fetched {len(stock)} company stock items")
        return stock

    # -----------------------
    # TECHNICIAN STOCK
    # -----------------------

    def get_technician_stock(self, technician_name):
        self.authenticate()

        spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
        sheet = spreadsheet.worksheet(self.TECHNICIAN_STOCK_WORKSHEET)

        rows = sheet.get_all_values()
        data_rows = rows[1:]

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

        logger.info(
            f"Fetched {len(stock)} items for technician '{technician_name}'"
        )
        return stock

    # -----------------------
    # UPDATE COMPANY STOCK
    # -----------------------

    def update_company_stock(self, spare_id, qty_to_reduce):
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

        logger.info(
            f"Company stock updated: {spare_id} {current_qty} → {new_qty}"
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
