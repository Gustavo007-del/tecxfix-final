import logging
from datetime import datetime
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import TechnicianTrackingSession, TechnicianLocation
from .serializers import (
    TechnicianTrackingSessionSerializer,
    LocationUpdateSerializer,
    MemberSummarySerializer,
    TechnicianLocationSerializer,
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def tracking_check_in(request):
    """
    Start a new tracking session for technician
    Creates a new session and marks it as active
    """
    try:
        user = request.user
        today = timezone.now().date()
        
        # Check if active session already exists
        active_session = TechnicianTrackingSession.objects.filter(
            technician=user,
            is_active=True,
            date=today
        ).first()
        
        if active_session:
            serializer = TechnicianTrackingSessionSerializer(active_session)
            return Response({
                'success': True,
                'message': 'Active session already exists',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        # Create new session
        session = TechnicianTrackingSession.objects.create(
            technician=user,
            check_in_time=timezone.now(),
            is_active=True,
            date=today
        )
        
        serializer = TechnicianTrackingSessionSerializer(session)
        logger.info(f"Tracking session started for {user.username}")
        
        return Response({
            'success': True,
            'message': 'Tracking session started',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.exception(f"Error in tracking_check_in: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to start tracking session'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def tracking_check_out(request):
    """
    End the active tracking session
    Marks the session as inactive
    """
    try:
        user = request.user
        
        # Find active session
        active_session = TechnicianTrackingSession.objects.filter(
            technician=user,
            is_active=True
        ).first()
        
        if not active_session:
            return Response({
                'success': False,
                'error': 'No active tracking session found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # End session
        active_session.check_out_time = timezone.now()
        active_session.is_active = False
        active_session.save()
        
        serializer = TechnicianTrackingSessionSerializer(active_session)
        logger.info(f"Tracking session ended for {user.username}")
        
        return Response({
            'success': True,
            'message': 'Tracking session ended',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error in tracking_check_out: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to end tracking session'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_location(request):
    """
    Update technician location during active session
    Creates location points every 5 minutes
    """
    try:
        user = request.user
        
        # Validate input
        serializer = LocationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find active session
        active_session = TechnicianTrackingSession.objects.filter(
            technician=user,
            is_active=True
        ).first()
        
        if not active_session:
            return Response({
                'success': False,
                'error': 'No active tracking session'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Create location point
        location = TechnicianLocation.objects.create(
            session=active_session,
            latitude=serializer.validated_data['latitude'],
            longitude=serializer.validated_data['longitude'],
            accuracy=serializer.validated_data.get('accuracy'),
            timestamp=timezone.now()
        )
        
        location_serializer = TechnicianLocationSerializer(location)
        
        return Response({
            'success': True,
            'message': 'Location updated',
            'data': location_serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.exception(f"Error in update_location: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to update location'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_member_list(request):
    """
    Admin endpoint: Get all technicians/members with tracking info
    """
    try:
        if not request.user.is_staff:
            return Response({
                'success': False,
                'error': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get all technicians (users with technician profile)
        technicians = User.objects.filter(
            technician__isnull=False
        ).order_by('first_name', 'last_name')
        
        serializer = MemberSummarySerializer(technicians, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data,
            'count': technicians.count()
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error in admin_member_list: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to fetch member list'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_member_locations(request, member_id):
    """
    Admin endpoint: Get all location points for a member on a specific date
    Returns ALL 5-minute points
    """
    try:
        if not request.user.is_staff:
            return Response({
                'success': False,
                'error': 'Admin access required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get date from query params
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({
                'success': False,
                'error': 'Date parameter required (YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get member
        try:
            member = User.objects.get(id=member_id)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Member not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get session for that date
        session = TechnicianTrackingSession.objects.filter(
            technician=member,
            date=query_date
        ).first()
        
        if not session:
            return Response({
                'success': True,
                'message': 'No tracking session found for this date',
                'data': {
                    'session': None,
                    'locations': [],
                    'member': {
                        'id': member.id,
                        'username': member.username,
                        'full_name': member.get_full_name(),
                    }
                }
            }, status=status.HTTP_200_OK)
        
        # Get ALL location points
        locations = session.locations.all().order_by('timestamp')
        location_serializer = TechnicianLocationSerializer(locations, many=True)
        
        return Response({
            'success': True,
            'data': {
                'session': {
                    'id': session.id,
                    'check_in_time': session.check_in_time,
                    'check_out_time': session.check_out_time,
                    'is_active': session.is_active,
                    'date': session.date,
                },
                'locations': location_serializer.data,
                'member': {
                    'id': member.id,
                    'username': member.username,
                    'full_name': member.get_full_name(),
                }
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error in admin_member_locations: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to fetch member locations'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_active_session(request):
    """
    Get current user's active tracking session
    """
    try:
        user = request.user
        
        active_session = TechnicianTrackingSession.objects.filter(
            technician=user,
            is_active=True
        ).first()
        
        if not active_session:
            return Response({
                'success': True,
                'message': 'No active session',
                'data': None
            }, status=status.HTTP_200_OK)
        
        serializer = TechnicianTrackingSessionSerializer(active_session)
        
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error in get_active_session: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to fetch active session'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)