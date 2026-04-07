# E:\study\techfix\backend\api\services\complaint_processor.py
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction, models
from ..models import ProcessedComplaint
from ..views import get_google_sheets_client
from courier_api.sheets_sync import SheetsSync

logger = logging.getLogger(__name__)

class ComplaintProcessor:
    """Service to process pending complaints and reduce technician stock"""
    
    def __init__(self):
        self.sheets_sync = SheetsSync()
        self.processed_count = 0
        self.errors = []
        self.stock_reductions = []
    
    def extract_date_from_complaint_no(self, complaint_no):
        """Extract date from complaint number format: PCOTH/DDMMYY/NN"""
        try:
            # Skip empty complaint numbers
            if not complaint_no or not complaint_no.strip():
                return None
                
            complaint_no = complaint_no.strip()
            parts = complaint_no.split("/")
            
            # Only process if it has the expected format with at least 3 parts
            if len(parts) >= 3:
                date_str = parts[1]  # DDMMYY format
                return datetime.strptime(date_str, "%d%m%y")
            else:
                # Skip invalid formats silently - don't log errors
                return None
                
        except Exception:
            # Skip any date parsing issues silently - don't log errors
            return None
    
    def get_new_pending_complaints(self, since_date=None):
        """Get new pending complaints from Tracking sheet"""
        try:
            logger.info(f"Fetching complaints from Google Sheets since {since_date}")
            client = get_google_sheets_client()
            sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
            rows = sheet.get_all_values()
            
            # Get already processed complaints
            processed_complaints = set(
                ProcessedComplaint.objects.values_list('complaint_no', flat=True)
            )
            logger.info(f"Found {len(processed_complaints)} already processed complaints")
            
            new_complaints = []
            skipped_count = 0
            
            for row in rows[1:]:  # Skip header
                if len(row) < 16:  # Need column P (index 15)
                    continue
                
                complaint_no = row[1].strip()
                technician_name = row[14].strip()
                status = row[11].strip().upper()
                product_code = row[7].strip()
                part_name = row[9].strip()
                quantity_str = row[10].strip()
                column_p_date = row[15].strip() if len(row) > 15 else ""  # Column P
                
                # Skip if already processed
                if complaint_no in processed_complaints:
                    skipped_count += 1
                    continue
                
                # Check if status is CLOSED
                if status != 'CLOSED':
                    continue
                
                # Parse date from complaint number
                complaint_date = self.extract_date_from_complaint_no(complaint_no)
                if not complaint_date:
                    # Skip silently - invalid date format or empty complaint number
                    continue
                
                # Filter by date if provided - only process from start date onwards
                if since_date and complaint_date < since_date:
                    continue
                
                # Check if column P has a date and if it's before start date
                skip_stock_reduction = False
                if column_p_date:
                    try:
                        # Parse date from column P (format: "23-Jul-2025")
                        column_p_parsed = datetime.strptime(column_p_date, "%d-%b-%Y")
                        if column_p_parsed < since_date:
                            skip_stock_reduction = True
                            logger.info(f"Skipping stock reduction for {complaint_no} - column P date {column_p_date} is before start date {since_date}")
                        else:
                            logger.info(f"Will reduce stock for {complaint_no} - column P date {column_p_date} is after start date {since_date}")
                    except ValueError:
                        # If date parsing fails, continue with normal processing
                        logger.warning(f"Invalid date format in column P: '{column_p_date}' for complaint {complaint_no}")
                
                # Parse quantity
                try:
                    quantity = int(quantity_str) if quantity_str else 0
                    if quantity <= 0:
                        continue
                except ValueError:
                    logger.warning(f"Invalid quantity '{quantity_str}' for complaint {complaint_no}")
                    continue
                
                new_complaints.append({
                    'complaint_no': complaint_no,
                    'technician_name': technician_name,
                    'product_code': product_code,
                    'part_name': part_name,
                    'quantity': quantity,
                    'complaint_date': complaint_date,
                    'row_data': row,
                    'skip_stock_reduction': skip_stock_reduction,
                    'column_p_date': column_p_date
                })
            
            logger.info(f"Found {len(new_complaints)} new pending complaints. Skipped {skipped_count} already processed.")
            return new_complaints
            
        except Exception as e:
            logger.error(f"Error fetching complaints: {e}")
            self.errors.append(f"Failed to fetch complaints: {str(e)}")
            return []
    
    def get_technician_sheet_name(self, technician_name):
        """Get technician's sheet name from TechnicianStock model"""
        try:
            from courier_api.models import TechnicianStock
            from django.contrib.auth.models import User
            from django.db.models import Q
            
            # Try to find user by username or first_name
            user = User.objects.filter(
                Q(username__iexact=technician_name) |
                Q(first_name__iexact=technician_name)
            ).first()
            
            if user:
                tech_stock = TechnicianStock.objects.filter(technician=user).first()
                if tech_stock and tech_stock.sheet_technician_name:
                    return tech_stock.sheet_technician_name
            
            # Fallback: return lowercase version
            return technician_name.lower().replace(' ', '')
            
        except Exception as e:
            logger.error(f"Error getting technician sheet name for {technician_name}: {e}")
            return technician_name.lower().replace(' ', '')
    
    def check_technician_stock(self, technician_sheet_name, product_code, required_qty):
        """Check if technician has sufficient stock"""
        try:
            tech_stock = self.sheets_sync.get_technician_stock(technician_sheet_name)
            
            for item in tech_stock:
                if item['spare_id'].strip() == product_code.strip():
                    available_qty = item['qty']
                    if available_qty >= required_qty:
                        return True, available_qty
                    else:
                        return False, available_qty
            
            return False, 0  # Item not found
            
        except Exception as e:
            logger.error(f"Error checking technician stock: {e}")
            return False, 0
    
    def reduce_technician_stock(self, technician_sheet_name, product_code, quantity):
        """Reduce stock from technician's sheet"""
        try:
            # Use negative quantity to reduce stock
            self.sheets_sync.update_technician_stock(
                technician_sheet_name, 
                product_code, 
                -quantity
            )
            return True
        except Exception as e:
            logger.error(f"Error reducing stock: {e}")
            return False
    
    def process_single_complaint(self, complaint):
        """Process a single complaint"""
        try:
            complaint_no = complaint['complaint_no']
            technician_name = complaint['technician_name']
            product_code = complaint['product_code']
            part_name = complaint['part_name']
            quantity = complaint['quantity']
            skip_stock_reduction = complaint.get('skip_stock_reduction', False)
            column_p_date = complaint.get('column_p_date', '')
            
            logger.info(f"Processing complaint {complaint_no}: {product_code} x{quantity} for {technician_name}")
            if skip_stock_reduction:
                logger.info(f"Skipping stock reduction for {complaint_no} - column P date {column_p_date} is before start date")
            
            # Get technician sheet name
            tech_sheet_name = self.get_technician_sheet_name(technician_name)
            logger.debug(f"Technician sheet name: {tech_sheet_name}")
            
            # If skipping stock reduction, mark as processed with no reduction
            if skip_stock_reduction:
                ProcessedComplaint.objects.create(
                    complaint_no=complaint_no,
                    technician_name=technician_name,
                    product_code=product_code,
                    part_name=part_name,
                    quantity_reduced=0,
                    stock_reduced=False,
                    processing_notes=f"Stock reduction skipped - column P date {column_p_date} is before start date"
                )
                self.processed_count += 1
                return True
            
            # Check stock availability
            has_stock, available_qty = self.check_technician_stock(
                tech_sheet_name, product_code, quantity
            )
            
            if not has_stock:
                error_msg = f"Insufficient stock for {product_code}. Available: {available_qty}, Required: {quantity}"
                logger.warning(f"{complaint_no}: {error_msg}")
                self.errors.append(f"{complaint_no}: {error_msg}")
                
                # Mark as processed but no stock reduction
                ProcessedComplaint.objects.create(
                    complaint_no=complaint_no,
                    technician_name=technician_name,
                    product_code=product_code,
                    part_name=part_name,
                    quantity_reduced=0,
                    stock_reduced=False,
                    processing_notes=error_msg
                )
                return False
            
            # Reduce stock
            if self.reduce_technician_stock(tech_sheet_name, product_code, quantity):
                # Record successful processing
                ProcessedComplaint.objects.create(
                    complaint_no=complaint_no,
                    technician_name=technician_name,
                    product_code=product_code,
                    part_name=part_name,
                    quantity_reduced=quantity,
                    stock_reduced=True,
                    processing_notes=f"Stock reduced by {quantity} units"
                )
                
                self.stock_reductions.append({
                    'complaint_no': complaint_no,
                    'technician': tech_sheet_name,
                    'product_code': product_code,
                    'part_name': part_name,
                    'qty_reduced': quantity,
                    'remaining_stock': available_qty - quantity
                })
                
                self.processed_count += 1
                logger.info(f"Successfully processed complaint {complaint_no} - reduced {quantity} units")
                return True
            else:
                error_msg = f"Failed to reduce stock for {product_code}"
                logger.error(f"{complaint_no}: {error_msg}")
                self.errors.append(f"{complaint_no}: {error_msg}")
                
                ProcessedComplaint.objects.create(
                    complaint_no=complaint_no,
                    technician_name=technician_name,
                    product_code=product_code,
                    part_name=part_name,
                    quantity_reduced=0,
                    stock_reduced=False,
                    processing_notes=error_msg
                )
                return False
                
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.errors.append(f"{complaint['complaint_no']}: {error_msg}")
            logger.exception(f"Error processing complaint {complaint['complaint_no']}: {e}")
            return False
    
    def process_complaints(self, since_date=None, technician_filter=None):
        """Main method to process all pending complaints"""
        logger.info(f"Starting complaint processing since {since_date}")
        
        # Reset counters
        self.processed_count = 0
        self.errors = []
        self.stock_reductions = []
        
        try:
            # Get new pending complaints
            new_complaints = self.get_new_pending_complaints(since_date)
            
            if not new_complaints:
                logger.info(f"No new pending complaints found since {since_date}")
                return self._get_result()
            
            # Filter by technician if specified
            if technician_filter:
                original_count = len(new_complaints)
                new_complaints = [
                    c for c in new_complaints 
                    if c['technician_name'].lower() == technician_filter.lower()
                ]
                logger.info(f"Filtered by technician '{technician_filter}': {original_count} -> {len(new_complaints)} complaints")
            
            logger.info(f"Found {len(new_complaints)} pending complaints to process since {since_date}")
            
            # Process each complaint
            for i, complaint in enumerate(new_complaints, 1):
                logger.info(f"Processing complaint {i}/{len(new_complaints)}: {complaint['complaint_no']}")
                self.process_single_complaint(complaint)
            
            logger.info(f"Processing complete. Processed: {self.processed_count}, Errors: {len(self.errors)}")
            return self._get_result()
            
        except Exception as e:
            logger.exception(f"Critical error in complaint processing: {e}")
            self.errors.append(f"Critical processing error: {str(e)}")
            return self._get_result()
    
    def _get_result(self):
        """Get processing result summary"""
        return {
            'success': True,
            'processed_count': self.processed_count,
            'stock_reductions': self.stock_reductions,
            'errors': self.errors,
            'message': f'Processed {self.processed_count} complaints successfully'
        }
