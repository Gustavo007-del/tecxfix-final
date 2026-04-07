# E:\study\techfix\backend\api\models.py
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Technician(models.Model):
    """Technician profile"""
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone = models.CharField(max_length=15, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.user.username

class Attendance(models.Model):
    """Attendance tracking with GPS"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField(auto_now_add=True)
    
    # Check-in details
    check_in_time = models.TimeField(null=True, blank=True)
    check_in_lat = models.FloatField(null=True, blank=True)
    check_in_lng = models.FloatField(null=True, blank=True)
    
    # Check-out details
    check_out_time = models.TimeField(null=True, blank=True)
    check_out_lat = models.FloatField(null=True, blank=True)
    check_out_lng = models.FloatField(null=True, blank=True)
    
    # Status
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.username} - {self.date}"
        
class SpareRequest(models.Model):
    """Track spare part status change requests from technicians"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    # Request details
    complaint_no = models.CharField(max_length=50)
    technician = models.ForeignKey(User, on_delete=models.CASCADE, related_name='spare_requests')
    
    # Complaint details (snapshot at request time)
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=15)
    area = models.CharField(max_length=100)
    brand_name = models.CharField(max_length=100)
    product_code = models.CharField(max_length=50)
    part_name = models.CharField(max_length=150)
    no_of_spares = models.CharField(max_length=20)
    district = models.CharField(max_length=100, blank=True)
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    
    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Admin action
    approved_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='approved_spare_requests'
    )
    admin_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']
        verbose_name = 'Spare Request'
        verbose_name_plural = 'Spare Requests'
    
    def __str__(self):
        return f"{self.complaint_no} - {self.technician.username} ({self.status})"

class StockOutOrder(models.Model):
    """
    Model to track stock-out items that have been ordered
    """
    complaint_no = models.CharField(max_length=100)
    area = models.CharField(max_length=200, blank=True)
    brand_name = models.CharField(max_length=200, blank=True)
    product_code = models.CharField(max_length=100, blank=True)
    part_name = models.CharField(max_length=200, blank=True)
    district = models.CharField(max_length=100, blank=True)
    mrp = models.CharField(max_length=50, blank=True)
    cc_remarks = models.CharField(max_length=100, default='ORDERED')
    
    # Tracking fields
    ordered_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        null=True,
        related_name='stock_orders'
    )
    ordered_at = models.DateTimeField(default=timezone.now)
    ordered_date = models.DateField(default=timezone.now)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-ordered_at']
        verbose_name = 'Stock Out Order'
        verbose_name_plural = 'Stock Out Orders'
    
    def __str__(self):
        return f"{self.complaint_no} - {self.part_name}"


class StockReceived(models.Model):
    """
    Model to track stock-out items that have been received
    """
    complaint_no = models.CharField(max_length=100)
    area = models.CharField(max_length=200, blank=True)
    brand_name = models.CharField(max_length=200, blank=True)
    product_code = models.CharField(max_length=100, blank=True)
    part_name = models.CharField(max_length=200, blank=True)
    district = models.CharField(max_length=100, blank=True)
    mrp = models.CharField(max_length=50, blank=True)
    cc_remarks = models.CharField(max_length=100, default='RECEIVED')
    
    # Reference to original order
    stock_order = models.ForeignKey(
        StockOutOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_record'
    )
    
    # Tracking fields
    received_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        null=True,
        related_name='stock_received'
    )
    received_at = models.DateTimeField(default=timezone.now)
    received_date = models.DateField(default=timezone.now)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-received_at']
        verbose_name = 'Stock Received'
        verbose_name_plural = 'Stock Received'
    
    def __str__(self):
        return f"{self.complaint_no} - {self.part_name} (Received)"


class ProcessedComplaint(models.Model):
    """Track complaints that have been processed for stock reduction"""
    complaint_no = models.CharField(max_length=50, unique=True, db_index=True)
    technician_name = models.CharField(max_length=100)
    product_code = models.CharField(max_length=50)
    part_name = models.CharField(max_length=200)
    quantity_reduced = models.IntegerField()
    processed_date = models.DateTimeField(auto_now_add=True)
    stock_reduced = models.BooleanField(default=True)
    processing_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-processed_date']
        indexes = [
            models.Index(fields=['complaint_no', 'processed_date'], name='proc_complaint_date_idx'),
            models.Index(fields=['technician_name', 'processed_date'], name='proc_tech_date_idx'),
            models.Index(fields=['stock_reduced'], name='proc_stock_idx'),
        ]
        verbose_name = 'Processed Complaint'
        verbose_name_plural = 'Processed Complaints'
    
    def __str__(self):
        return f"{self.complaint_no} - {self.technician_name} ({self.quantity_reduced} units)"


class SalesRequest(models.Model):
    """Track sales requests from technicians"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    TYPE_CHOICES = [
        ('DIRECT', 'Direct'),
        ('COMPLIANT', 'Compliant'),
    ]
    
    # Request details
    technician = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sales_requests')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='DIRECT')
    company_name = models.CharField(max_length=200)
    compliant_number = models.CharField(max_length=50, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    
    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Admin action
    approved_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='approved_sales_requests'
    )
    admin_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']
        verbose_name = 'Sales Request'
        verbose_name_plural = 'Sales Requests'
    
    def __str__(self):
        return f"{self.company_name} - {self.technician.username} ({self.status})"


class SalesRequestProduct(models.Model):
    """Products included in a sales request"""
    sales_request = models.ForeignKey(SalesRequest, on_delete=models.CASCADE, related_name='products')
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50)
    quantity = models.IntegerField()
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    service_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = 'Sales Request Product'
        verbose_name_plural = 'Sales Request Products'
    
    def __str__(self):
        return f"{self.product_name} x {self.quantity}"