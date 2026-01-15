from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class TechnicianTrackingSession(models.Model):
    """Track technician work sessions with location data"""
    technician = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='tracking_sessions'
    )
    check_in_time = models.DateTimeField(default=timezone.now)
    check_out_time = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    date = models.DateField(default=timezone.now)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-check_in_time']
        indexes = [
            models.Index(fields=['technician', 'date']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.technician.username} - {self.date} ({'Active' if self.is_active else 'Completed'})"


class TechnicianLocation(models.Model):
    """Store location points for tracking sessions"""
    session = models.ForeignKey(
        TechnicianTrackingSession,
        on_delete=models.CASCADE,
        related_name='locations'
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    timestamp = models.DateTimeField(default=timezone.now)
    accuracy = models.FloatField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['session', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.session.technician.username} - {self.timestamp}"