# E:\study\techfix\backend\courier_api\serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CourierTransaction, TechnicianStock

class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']

class TechnicianStockSerializer(serializers.ModelSerializer):
    technician_info = UserSimpleSerializer(source='technician', read_only=True)
    
    class Meta:
        model = TechnicianStock
        fields = ['id', 'technician', 'technician_info', 'sheet_id', 'last_sync']

class CourierItemSerializer(serializers.Serializer):
    """Serializer for individual items in courier"""
    spare_id = serializers.CharField()
    name = serializers.CharField()
    qty = serializers.IntegerField()
    mrp = serializers.FloatField()
    brand = serializers.CharField()
    hsn = serializers.CharField(required=False, allow_blank=True)

class CourierTransactionSerializer(serializers.ModelSerializer):
    created_by_info = UserSimpleSerializer(source='created_by', read_only=True)
    technicians_info = UserSimpleSerializer(source='technicians', many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = CourierTransaction
        fields = [
            'id', 'courier_id', 'created_by', 'created_by_info',
            'technicians', 'technicians_info',
            'sent_time', 'received_time', 'status',
            'items', 'total_amount', 'pdf_file', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['courier_id', 'sent_time', 'created_at', 'updated_at', 'pdf_file']
    
    def get_total_amount(self, obj):
        """Calculate total amount from items"""
        try:
            total = sum(item['qty'] * item['mrp'] for item in obj.items)
            return total
        except (KeyError, TypeError):
            return 0

class CourierCreateSerializer(serializers.Serializer):
    """Serializer for creating courier"""
    technician_ids = serializers.ListField(child=serializers.IntegerField())
    items = CourierItemSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)

class CourierReceiveSerializer(serializers.Serializer):
    """Serializer for marking courier as received"""
    courier_id = serializers.CharField()
