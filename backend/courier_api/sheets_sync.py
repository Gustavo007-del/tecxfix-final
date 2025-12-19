# E:\study\techfix\backend\courier_api\sheets_sync.py
import gspread
from google.oauth2.service_account import Credentials
from django.conf import settings
import logging
from django.contrib.auth.models import User  
import os

logger = logging.getLogger(__name__)


def safe_int(value):
    """Safely convert value to integer, handling errors and special cases"""
    try:
        if value in (None, "", "#N/A"):
            return 0
        return int(float(str(value).replace(",", "")))
    except Exception:
        return 0


def safe_float(value):
    """Safely convert value to float, handling errors and special cases"""
    try:
        if value in (None, "", "#N/A"):
            return 0.0
        return float(str(value).replace(",", ""))
    except Exception:
        return 0.0


class SheetsSync:
    """
    Handles all Google Sheets synchronization for courier management.
    
    UPDATED Sheet Structure:
    - Single Google Sheet with 2 tabs:
    
    1. "Mrp List" Tab (Company Stock):
       Columns: [0]=S.No, [1]=Spare Code, [2]=Description, [3]=MRP, [4]=HSN, [5]=Brand, [6]=Quantity
    
    2. "Technician Stocks" Tab (All Technician Stock Combined):
       Columns: [0]=Product, [1]=Spare Code, [2]=Quantity, [3]=Technician name
    """
    
    SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
    SERVICE_ACCOUNT_FILE = "service.json"
    
    # Sheet configuration
    COMPANY_SHEET_ID = "1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ"
    COMPANY_STOCK_WORKSHEET = "Mrp List"
    TECHNICIAN_STOCK_WORKSHEET = "Technician Stocks"  # CHANGED: Now one tab with technician column
    
    def __init__(self):
        self.client = None
        self.authenticate()
    
    def authenticate(self):
        """Authenticate with Google Sheets API"""
        try:
            creds = Credentials.from_service_account_file(
                self.SERVICE_ACCOUNT_FILE,
                scopes=self.SCOPES
            )
            self.client = gspread.authorize(creds)
            logger.info("Google Sheets authentication successful")
        except Exception as e:
            logger.error(f"Google Sheets authentication failed: {e}")
            raise
    
    def get_company_stock(self):
        """
        Fetch all company stock from "Mrp List" worksheet.
        
        Expected Structure:
        Row 0 (Header): S.No | Spare Code | Description | MRP | HSN | Brand | Quantity
        Row 1+: data
        
        Column Mapping:
        [0]=S.No, [1]=Spare Code, [2]=Description, [3]=MRP, [4]=HSN, [5]=Brand, [6]=Quantity
        
        Returns: [{spare_id, name, mrp, brand, qty}, ...]
        """
        try:
            spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
            sheet = spreadsheet.worksheet(self.COMPANY_STOCK_WORKSHEET)
            
            # Get all raw values (not get_all_records)
            rows = sheet.get_all_values()
            data_rows = rows[1:]  # Skip header row
            
            stock = []
            
            for r in data_rows:
                # Skip empty rows or rows without Spare Code
                if len(r) < 7 or not r[1]:
                    continue
                
                stock.append({
                    "spare_id": r[1].strip(),       # Column B: Spare Code
                    "name": r[2].strip(),           # Column C: Description
                    "mrp": safe_float(r[3]),        # Column D: MRP
                    "hsn": r[4].strip() if len(r) > 4 else "",  # Column E: HSN
                    "brand": r[5].strip() if len(r) > 5 else "",  # Column F: Brand
                    "qty": safe_int(r[6]) if len(r) > 6 else 0    # Column G: Quantity
                })
            
            logger.info(f"Fetched {len(stock)} items from company stock (Mrp List)")
            return stock
        
        except Exception as e:
            logger.error(f"Error fetching company stock: {e}")
            raise
    
    def get_technician_stock(self, technician_name):
        """
        Fetch technician stock from "Technician Stocks" worksheet, filtered by technician name.
        
        Args:
            technician_name: The technician name to filter (e.g., "amal", "arun kakkodi")
        
        Expected Structure:
        Row 0 (Header): Product | Spare Code | Quantity | Technician name
        Row 1+: data
        
        Column Mapping:
        [0]=Product, [1]=Spare Code, [2]=Quantity, [3]=Technician name
        
        Returns: [{spare_id, name, qty}, ...]
        """
        try:
            spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
            sheet = spreadsheet.worksheet(self.TECHNICIAN_STOCK_WORKSHEET)
            
            # Get all raw values
            rows = sheet.get_all_values()
            data_rows = rows[1:]  # Skip header row
            
            stock = []
            
            for r in data_rows:
                # Skip empty rows or rows without Spare Code
                if len(r) < 4 or not r[1]:
                    continue
                
                # Filter by technician name (case-insensitive)
                if r[3].strip().lower() != technician_name.strip().lower():
                    continue
                
                stock.append({
                    "spare_id": r[1].strip(),       # Column B: Spare Code
                    "name": r[0].strip(),           # Column A: Product
                    "qty": safe_int(r[2])           # Column C: Quantity
                })
            
            logger.info(f"Fetched {len(stock)} items for technician '{technician_name}'")
            return stock
        
        except Exception as e:
            logger.error(f"Error fetching stock for technician '{technician_name}': {e}")
            raise
    
    def update_company_stock(self, spare_id, qty_to_reduce):
        """
        Reduce quantity in company stock "Mrp List" worksheet.
        
        Finds the row by Spare Code (column B) and updates Quantity (column G).
        """
        try:
            spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
            sheet = spreadsheet.worksheet(self.COMPANY_STOCK_WORKSHEET)
            
            # Find the row with matching spare_id (column B = Spare Code)
            cell = sheet.find(spare_id, in_column=2)  # Column 2 = B (Spare Code)
            if not cell:
                raise Exception(f"Spare Code {spare_id} not found in company stock")
            
            row_idx = cell.row
            
            # Get current quantity (column G = 7)
            current_qty_cell = sheet.cell(row_idx, 7)
            current_qty = safe_int(current_qty_cell.value)
            
            # Validate sufficient stock
            new_qty = current_qty - qty_to_reduce
            if new_qty < 0:
                raise Exception(f"Insufficient stock for {spare_id}. Available: {current_qty}, Requested: {qty_to_reduce}")
            
            # Update quantity in sheet
            sheet.update_cell(row_idx, 7, new_qty)
            logger.info(f"Updated company stock: {spare_id} - reduced by {qty_to_reduce} (was {current_qty}, now {new_qty})")
            
            return True
        
        except Exception as e:
            logger.error(f"Error updating company stock: {e}")
            raise
    
    def update_technician_stock(self, technician_name, spare_id, qty_to_add):
        """
        Increase quantity in "Technician Stocks" worksheet for a specific technician.
        
        Finds row by Spare Code (column B) AND Technician name (column D).
        Updates Quantity (column C).
        If row doesn't exist, creates new row.
        
        FIX: Properly adds new rows with all required columns
        """
        try:
            spreadsheet = self.client.open_by_key(self.COMPANY_SHEET_ID)
            sheet = spreadsheet.worksheet(self.TECHNICIAN_STOCK_WORKSHEET)
            
            # Get all rows and find matching spare_id + technician_name
            rows = sheet.get_all_values()
            data_rows = rows[1:]  # Skip header
            
            found_row_idx = None
            for idx, r in enumerate(data_rows):
                if (len(r) >= 4 and 
                    r[1].strip() == spare_id and 
                    r[3].strip().lower() == technician_name.strip().lower()):
                    found_row_idx = idx + 2  # +2 because data_rows is 0-indexed but sheet is 1-indexed + header
                    break
            
            if found_row_idx:
                # Row exists, update quantity (column C = 3)
                current_qty_cell = sheet.cell(found_row_idx, 3)
                current_qty = safe_int(current_qty_cell.value)
                new_qty = current_qty + qty_to_add
                
                sheet.update_cell(found_row_idx, 3, new_qty)
                logger.info(f"Updated {technician_name} stock: {spare_id} - added {qty_to_add} (was {current_qty}, now {new_qty})")
            
            else:
                # Row doesn't exist, fetch item from company stock and add new row
                company_stock = self.get_company_stock()
                item = next((s for s in company_stock if s['spare_id'] == spare_id), None)
                
                if item:
                    # FIX: Format for Technician Stocks sheet: [Product, Spare Code, Quantity, Technician name]
                    # Make sure all 4 columns are provided
                    new_row = [
                        item['name'],           # Column A: Product
                        spare_id,               # Column B: Spare Code
                        qty_to_add,             # Column C: Quantity
                        technician_name         # Column D: Technician name
                    ]
                    
                    # Append row to sheet
                    sheet.append_row(new_row, value_input_option='USER_ENTERED')
                    logger.info(f"Added new item to {technician_name} stock: {spare_id} ({item['name']}) - Qty: {qty_to_add}")
                    logger.debug(f"New row data: {new_row}")
                else:
                    logger.warning(f"Item {spare_id} not found in company stock, cannot add to {technician_name}")
            
            return True
        
        except Exception as e:
            logger.error(f"Error updating {technician_name} stock: {e}")
            raise
    
    def sync_courier_to_sheets(self, items, technician_ids):
        """
        Sync courier items to Google Sheets for multiple technicians.
        Creates separate rows for each technician.
        
        Args:
            items: List of items [{spare_id, qty, name, ...}, ...]
            technician_ids: List of technician user IDs [1, 2, 3, ...]
        """
        try:
            from .models import TechnicianStock
            
            # Get technician names for each ID
            tech_mapping = {}
            for tech_id in technician_ids:
                tech_stock = TechnicianStock.objects.filter(technician_id=tech_id).first()
                if tech_stock and tech_stock.sheet_technician_name:
                    # Use the actual sheet name from TechnicianStock
                    tech_mapping[tech_id] = tech_stock.sheet_technician_name
                else:
                    # Fallback to username
                    try:
                        user = User.objects.get(id=tech_id)
                        tech_mapping[tech_id] = user.username
                        logger.warning(
                            f"Using username fallback for technician {tech_id}: {user.username}"
                        )
                    except User.DoesNotExist:
                        logger.warning(f"No user found for technician ID {tech_id}")
                        continue
            
            if not tech_mapping:
                raise Exception("No valid technicians found for courier")
            
            logger.info(f"Processing courier for technicians: {tech_mapping}")
            
            # Process each item
            for item in items:
                spare_id = item['spare_id']
                qty = item['qty']
                
                # Step 1: Reduce company stock ONCE (total qty for all technicians)
                total_qty = qty * len(tech_mapping)  # Total quantity needed
                self.update_company_stock(spare_id, total_qty)
                logger.info(f"Reduced company stock: {spare_id} by {total_qty} (for {len(tech_mapping)} technicians)")
                
                # Step 2: Add stock for EACH technician separately
                for tech_id, technician_name in tech_mapping.items():
                    self.update_technician_stock(technician_name, spare_id, qty)
                    logger.info(f"Added {qty} of {spare_id} to {technician_name}'s stock")
            
            logger.info("Courier sync to sheets completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error syncing courier to sheets: {e}")
            raise