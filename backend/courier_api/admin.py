from django.contrib import admin
from .models import CourierTransaction, TechnicianStock

@admin.register(CourierTransaction)
class CourierTransactionAdmin(admin.ModelAdmin):
    list_display = ['courier_id', 'created_by', 'status', 'sent_time', 'received_time']
    list_filter = ['status', 'sent_time']
    search_fields = ['courier_id', 'created_by__username']
    readonly_fields = ['courier_id', 'sent_time', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Courier Info', {
            'fields': ('courier_id', 'created_by', 'technicians', 'status')
        }),
        ('Items', {
            'fields': ('items', 'notes')
        }),
        ('Timestamps', {
            'fields': ('sent_time', 'received_time', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
        ('PDF', {
            'fields': ('pdf_file',),
            'classes': ('collapse',)
        }),
    )

@admin.register(TechnicianStock)
class TechnicianStockAdmin(admin.ModelAdmin):
    list_display = ['technician', 'sheet_id', 'last_sync']
    search_fields = ['technician__username']
