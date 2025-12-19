# E:\study\techfix\backend\courier_api\models.py
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class TechnicianStock(models.Model):
    """
    Metadata for technician stock.
    Stock quantities are fetched from Google Sheet, not stored here.
    """
    technician = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='technician_stock_metadata'
    )
    sheet_technician_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Technician name as it appears in Google Sheets (e.g., 'amal', 'arun kakkodi')"
    )
    sheet_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True
    )  # Google Sheet ID for this technician
    last_sync = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Stock - {self.technician.username} ({self.sheet_technician_name})"
    
    class Meta:
        verbose_name = "Technician Stock"
        verbose_name_plural = "Technician Stocks"


class CourierTransaction(models.Model):
    """
    Stores complete courier transaction details.
    Items stored as JSON to preserve exact send details.
    """
    STATUS_CHOICES = [
        ('in_transit', 'In Transit'),  # NEW: Changed from 'sent'
        ('received', 'Received'),
    ]
    
    courier_id = models.CharField(
        max_length=50, 
        unique=True, 
        db_index=True
    )
    created_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        null=True, 
        related_name="couriers_sent"
    )
    technicians = models.ManyToManyField(
        User, 
        related_name="couriers_received"
    )
    
    sent_time = models.DateTimeField(auto_now_add=True)
    received_time = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='in_transit'  # Changed default
    )
    
    # Items stored as JSON: 
    # [{"spare_id": "X", "name": "...", "qty": 5, "mrp": 100.0, "brand": "...", "hsn": "..."}]
    items = models.JSONField(default=list)
    
    # PDF storage
    pdf_file = models.FileField(
        upload_to='couriers/', 
        null=True, 
        blank=True
    )
    
    # Optional notes
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Courier {self.courier_id} - {self.status}"
    
    class Meta:
        ordering = ['-sent_time']
        verbose_name = "Courier Transaction"
        verbose_name_plural = "Courier Transactions"
        indexes = [
            models.Index(fields=['status', '-sent_time']),
            models.Index(fields=['created_by', '-sent_time']),
        ]