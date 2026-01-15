from django.contrib import admin
from .models import TechnicianTrackingSession, TechnicianLocation


@admin.register(TechnicianTrackingSession)
class TechnicianTrackingSessionAdmin(admin.ModelAdmin):
    list_display = [
        'technician',
        'date',
        'check_in_time',
        'check_out_time',
        'is_active',
        'location_count',
    ]
    list_filter = ['is_active', 'date', 'technician']
    search_fields = ['technician__username', 'technician__first_name', 'technician__last_name']
    readonly_fields = ['created_at', 'updated_at']
    
    def location_count(self, obj):
        try:
            return obj.locations.count()
        except Exception:
            return 0
    location_count.short_description = 'Locations'


@admin.register(TechnicianLocation)
class TechnicianLocationAdmin(admin.ModelAdmin):
    list_display = [
        'session',
        'latitude',
        'longitude',
        'timestamp',
        'accuracy',
    ]
    list_filter = ['timestamp', 'session__technician']
    search_fields = ['session__technician__username']
    readonly_fields = ['created_at']