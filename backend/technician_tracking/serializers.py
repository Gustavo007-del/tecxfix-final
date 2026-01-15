from rest_framework import serializers
from .models import TechnicianTrackingSession, TechnicianLocation


class TechnicianLocationSerializer(serializers.ModelSerializer):
    """Serializer for location points"""
    
    class Meta:
        model = TechnicianLocation
        fields = [
            'id',
            'latitude',
            'longitude',
            'timestamp',
            'accuracy',
        ]
        read_only_fields = ['id', 'timestamp']


class TechnicianTrackingSessionSerializer(serializers.ModelSerializer):
    """Serializer for tracking sessions"""
    technician_name = serializers.CharField(
        source='technician.get_full_name',
        read_only=True
    )
    technician_username = serializers.CharField(
        source='technician.username',
        read_only=True
    )
    locations = TechnicianLocationSerializer(many=True, read_only=True)
    location_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TechnicianTrackingSession
        fields = [
            'id',
            'technician',
            'technician_name',
            'technician_username',
            'check_in_time',
            'check_out_time',
            'is_active',
            'date',
            'locations',
            'location_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'technician_name',
            'technician_username',
            'location_count',
            'created_at',
            'updated_at',
        ]
    
    def get_location_count(self, obj):
        try:
            return obj.locations.count()
        except Exception:
            return 0


class LocationUpdateSerializer(serializers.Serializer):
    """Serializer for location updates"""
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, allow_null=True)


class MemberSummarySerializer(serializers.ModelSerializer):
    """Serializer for admin member list"""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    active_session = serializers.SerializerMethodField()
    last_location = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'active_session',
            'last_location',
        ]
    
    def get_active_session(self, obj):
        try:
            session = obj.tracking_sessions.filter(is_active=True).first()
            if session:
                return {
                    'id': session.id,
                    'check_in_time': session.check_in_time,
                    'date': session.date,
                }
            return None
        except Exception:
            return None
    
    def get_last_location(self, obj):
        try:
            last_location = TechnicianLocation.objects.filter(
                session__technician=obj
            ).order_by('-timestamp').first()
            
            if last_location:
                return {
                    'latitude': last_location.latitude,
                    'longitude': last_location.longitude,
                    'timestamp': last_location.timestamp,
                }
            return None
        except Exception:
            return None