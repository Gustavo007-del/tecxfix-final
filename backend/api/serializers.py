# E:\study\techfix\backend\api\serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Technician, Attendance, SpareRequest
from .geocoding import get_location_name
from .models import StockOutOrder, StockReceived



class TechnicianSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user.id', read_only=True)  # Use User ID, not Technician ID
    username = serializers.CharField(source='user.username')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    
    class Meta:
        model = Technician
        fields = ['id', 'username', 'first_name', 'last_name', 'phone']

class AttendanceSerializer(serializers.ModelSerializer):
    technician_name = serializers.CharField(source='user.get_full_name', read_only=True)
    technician_username = serializers.CharField(source='user.username', read_only=True)
    check_in_location_name = serializers.SerializerMethodField()
    check_out_location_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'technician_name', 'technician_username', 'date',
            'check_in_time', 'check_in_lat', 'check_in_lng', 'check_in_location_name',
            'check_out_time', 'check_out_lat', 'check_out_lng', 'check_out_location_name',
            'is_completed', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'date', 'created_at', 'updated_at']
    
    def get_check_in_location_name(self, obj):
        if obj.check_in_lat is not None and obj.check_in_lng is not None:
            return get_location_name(obj.check_in_lat, obj.check_in_lng)
        return None
    
    def get_check_out_location_name(self, obj):
        if obj.check_out_lat is not None and obj.check_out_lng is not None:
            return get_location_name(obj.check_out_lat, obj.check_out_lng)
        return None

class AttendanceCheckInSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

class AttendanceCheckOutSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

class SpareRequestSerializer(serializers.ModelSerializer):
    """Serializer for SpareRequest model"""
    technician_name = serializers.CharField(source='technician.first_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.first_name', read_only=True, allow_null=True)
    
    class Meta:
        model = SpareRequest
        fields = [
            'id',
            'complaint_no',
            'technician',
            'technician_name',
            'customer_name',
            'customer_phone',
            'area',
            'brand_name',
            'product_code',
            'part_name',
            'no_of_spares',
            'district',
            'status',
            'requested_at',
            'reviewed_at',
            'approved_by',
            'approved_by_name',
            'admin_notes',
        ]
        read_only_fields = [
            'id',
            'technician_name',
            'approved_by_name',
            'requested_at',
            'reviewed_at',
        ]

class StockOutOrderSerializer(serializers.ModelSerializer):
    """Serializer for StockOutOrder model"""
    ordered_by_name = serializers.CharField(source='ordered_by.first_name', read_only=True)
    
    class Meta:
        model = StockOutOrder
        fields = [
            'id',
            'complaint_no',
            'area',
            'brand_name',
            'product_code',
            'part_name',
            'district',
            'mrp',
            'cc_remarks',
            'ordered_by',
            'ordered_by_name',
            'ordered_at',
            'ordered_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'ordered_by_name',
            'ordered_at',
            'ordered_date',
            'created_at',
            'updated_at',
        ]


class StockReceivedSerializer(serializers.ModelSerializer):
    """Serializer for StockReceived model"""
    received_by_name = serializers.CharField(source='received_by.first_name', read_only=True)
    ordered_by_name = serializers.CharField(
        source='stock_order.ordered_by.first_name', 
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = StockReceived
        fields = [
            'id',
            'complaint_no',
            'area',
            'brand_name',
            'product_code',
            'part_name',
            'district',
            'mrp',
            'cc_remarks',
            'stock_order',
            'received_by',
            'received_by_name',
            'ordered_by_name',
            'received_at',
            'received_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'received_by_name',
            'ordered_by_name',
            'received_at',
            'received_date',
            'created_at',
            'updated_at',
        ]