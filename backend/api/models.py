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