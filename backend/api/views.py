# E:\study\techfix\backend\api\views.py
import os
import json
import logging
from django.db.models import Q
from django.db import transaction
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from .models import Attendance, Technician, SpareRequest, StockOutOrder, StockReceived
from .serializers import (
    AttendanceSerializer, AttendanceCheckInSerializer,
    AttendanceCheckOutSerializer, TechnicianSerializer, SpareRequestSerializer,
    StockOutOrderSerializer, StockReceivedSerializer
)

# sheets
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from django.http import JsonResponse
from datetime import datetime


def get_google_sheets_client():
    """
    Get authenticated Google Sheets client using environment variables
    Falls back to service.json if environment variables are not set (local development)
    """
    try:
        # Try to get credentials from environment variable (for production)
        google_credentials_json = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
        
        if google_credentials_json:
            # Parse the JSON string from environment variable
            credentials_dict = json.loads(google_credentials_json)
            creds = Credentials.from_service_account_info(
                credentials_dict,
                scopes=["https://www.googleapis.com/auth/spreadsheets"]
            )
            logger.info("Using Google credentials from environment variable")
        else:
            # Fallback to service.json for local development
            creds = Credentials.from_service_account_file(
                "service.json",
                scopes=["https://www.googleapis.com/auth/spreadsheets"]
            )
            logger.info("Using Google credentials from service.json file")
        
        client = gspread.authorize(creds)
        return client
    
    except Exception as e:
        logger.error(f"Failed to authenticate with Google Sheets: {str(e)}")
        raise Exception(f"Google Sheets authentication failed: {str(e)}")

RANGE = "Sheet1!A:O"  # includes columns A to O
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
# ==================== JWT TOKEN GENERATION ====================
logger = logging.getLogger(__name__)

def get_tokens_for_user(user):
    """Generate access and refresh tokens for a user"""
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

# ==================== AUTHENTICATION ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def technician_login(request):
    """Technician login - returns JWT tokens"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'Username and password required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Check if user is a technician
    if not hasattr(user, 'technician'):
        return Response(
            {'error': 'User is not a technician'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Generate tokens
    tokens = get_tokens_for_user(user)
    
    return Response({
        'success': True,
        'message': 'Login successful',
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'user': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': 'technician'
        }
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Admin login - returns JWT tokens"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'Username and password required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Check if user is admin/staff
    if not user.is_staff:
        return Response(
            {'error': 'User is not an admin'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Generate tokens
    tokens = get_tokens_for_user(user)
    
    return Response({
        'success': True,
        'message': 'Admin login successful',
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'user': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': 'admin'
        }
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """Refresh access token using refresh token"""
    refresh = request.data.get('refresh')
    
    if not refresh:
        return Response(
            {'error': 'Refresh token required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        refresh_token = RefreshToken(refresh)
        access = str(refresh_token.access_token)
        
        return Response({
            'success': True,
            'access': access
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': 'Invalid refresh token'},
            status=status.HTTP_401_UNAUTHORIZED
        )

# ==================== TECHNICIAN ATTENDANCE ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_today(request):
    """Get today's attendance status"""
    today = timezone.now().date()
    
    try:
        attendance = Attendance.objects.get(user=request.user, date=today)
        serializer = AttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Attendance.DoesNotExist:
        return Response(
            {'message': 'No attendance record for today'},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_in(request):
    """Technician check-in with location"""
    serializer = AttendanceCheckInSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    today = timezone.now().date()
    now = timezone.now().time()
    
    latitude = serializer.validated_data['latitude']
    longitude = serializer.validated_data['longitude']
    
    # Create or get today's attendance
    attendance, created = Attendance.objects.get_or_create(
        user=request.user,
        date=today
    )
    
    if attendance.check_in_time is not None:
        return Response(
            {'error': 'Already checked in today'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Save check-in details
    attendance.check_in_time = now
    attendance.check_in_lat = latitude
    attendance.check_in_lng = longitude
    attendance.save()
    
    return Response({
        'success': True,
        'message': 'Check-in successful',
        'data': AttendanceSerializer(attendance).data
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_out(request):
    """Technician check-out with location"""
    serializer = AttendanceCheckOutSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    today = timezone.now().date()
    now = timezone.now().time()
    
    latitude = serializer.validated_data['latitude']
    longitude = serializer.validated_data['longitude']
    
    try:
        attendance = Attendance.objects.get(user=request.user, date=today)
    except Attendance.DoesNotExist:
        return Response(
            {'error': 'No check-in record found for today'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if attendance.check_in_time is None:
        return Response(
            {'error': 'You have not checked in yet'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if attendance.check_out_time is not None:
        return Response(
            {'error': 'Already checked out today'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Save check-out details
    attendance.check_out_time = now
    attendance.check_out_lat = latitude
    attendance.check_out_lng = longitude
    attendance.is_completed = True
    attendance.save()
    
    return Response({
        'success': True,
        'message': 'Check-out successful',
        'data': AttendanceSerializer(attendance).data
    }, status=status.HTTP_200_OK)

# ==================== ADMIN ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_list(request):
    """Get all attendance records (Admin only)"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Optional filtering
    date_filter = request.query_params.get('date')
    technician_name = request.query_params.get('technician')
    
    queryset = Attendance.objects.all()
    
    if date_filter:
        queryset = queryset.filter(date=date_filter)
    
    if technician_name:
        queryset = queryset.filter(
            user__first_name__icontains=technician_name
        ) | queryset.filter(
            user__username__icontains=technician_name
        )
    
    serializer = AttendanceSerializer(queryset, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard_stats(request):
    """Dashboard statistics for admin"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    today = timezone.now().date()
    
    total_technicians = Technician.objects.count()
    checked_in_today = Attendance.objects.filter(
        date=today,
        check_in_time__isnull=False
    ).count()
    completed_today = Attendance.objects.filter(
        date=today,
        is_completed=True
    ).count()
    
    return Response({
        'total_technicians': total_technicians,
        'checked_in_today': checked_in_today,
        'completed_today': completed_today,
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def technician_list(request):
    """Get all technicians (Admin only)"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    technicians = Technician.objects.all()
    serializer = TechnicianSerializer(technicians, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

# ==================== TECHNICIAN MANAGEMENT ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_technician(request):
    """Create a new technician (Admin only)"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    username = request.data.get('username')
    password = request.data.get('password')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    phone = request.data.get('phone')
    
    if not all([username, password, first_name, last_name]):
        return Response(
            {'error': 'Missing required fields'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if username exists
    if User.objects.filter(username=username).exists():
        return Response(
            {'error': 'Username already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Create user
        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create technician profile
        Technician.objects.create(user=user, phone=phone or '')
        
        return Response({
            'success': True,
            'message': 'Technician created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': phone,
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_technician(request, technician_id):
    """Update technician details (Admin only)"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        user = User.objects.get(id=technician_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'Technician not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Update user fields
    if 'first_name' in request.data:
        user.first_name = request.data['first_name']
    if 'last_name' in request.data:
        user.last_name = request.data['last_name']
    if 'password' in request.data and request.data['password']:
        user.set_password(request.data['password'])
    
    user.save()
    
    # Update technician profile
    if hasattr(user, 'technician'):
        if 'phone' in request.data:
            user.technician.phone = request.data['phone']
        user.technician.save()
    
    return Response({
        'success': True,
        'message': 'Technician updated successfully',
        'user': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': user.technician.phone if hasattr(user, 'technician') else '',
        }
    }, status=status.HTTP_200_OK)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_technician(request, technician_id):
    """Delete a technician (Admin only) with comprehensive logging"""
    logger.info(f"Delete technician request received for ID: {technician_id} by user: {request.user.id}")
    
    if not request.user.is_staff:
        logger.warning(f"Unauthorized delete attempt by user {request.user.id} (non-admin)")
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Log the raw technician_id and its type
        logger.debug(f"Raw technician_id: {technician_id}, type: {type(technician_id)}")
        
        # Convert technician_id to integer
        try:
            technician_id = int(technician_id)
            logger.debug(f"Converted technician_id: {technician_id}")
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid technician_id format: {technician_id}. Error: {str(e)}")
            return Response(
                {'error': 'Invalid technician ID format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the user to be deleted
        try:
            user_to_delete = User.objects.get(id=technician_id)
            logger.info(f"Found user to delete: {user_to_delete.username} (ID: {user_to_delete.id})")
        except User.DoesNotExist:
            logger.error(f"User with ID {technician_id} not found")
            return Response(
                {'error': 'Technician not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Prevent self-deletion
        if user_to_delete.id == request.user.id:
            logger.warning(f"User {request.user.id} attempted to delete their own account")
            return Response(
                {'error': 'You cannot delete your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check for active courier transactions
        from courier_api.models import CourierTransaction
        active_transactions = CourierTransaction.objects.filter(
            Q(created_by=user_to_delete) | 
            Q(technicians=user_to_delete)
        )
        
        if active_transactions.exists():
            transaction_ids = list(active_transactions.values_list('id', flat=True))
            logger.warning(
                f"Cannot delete user {user_to_delete.id} - found {active_transactions.count()} "
                f"active transactions: {transaction_ids}"
            )
            return Response(
                {'error': 'Cannot delete technician with active courier transactions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log all related data before deletion
        logger.info(f"User to be deleted - Username: {user_to_delete.username}, "
                   f"Email: {user_to_delete.email}, "
                   f"Date Joined: {user_to_delete.date_joined}")
        
        # Delete the user
        username = user_to_delete.username
        user_to_delete.delete()
        logger.info(f"Successfully deleted user {technician_id}")
        
        return Response({
            'success': True,
            'message': f'Technician {username} deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error deleting technician {technician_id}: {str(e)}")
        return Response(
            {'error': 'An error occurred while deleting the technician'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_my_account(request):
    """Allow technician to delete their own account"""
    logger.info(f"Delete account request received from user: {request.user.id}")
    
    try:
        # Check if user is a technician
        if not hasattr(request.user, 'technician'):
            logger.warning(f"Non-technician user {request.user.id} attempted to delete account")
            return Response(
                {'error': 'Only technicians can delete their account'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_to_delete = request.user
        
        # Check for active courier transactions
        try:
            from courier_api.models import CourierTransaction
            active_transactions = CourierTransaction.objects.filter(
                Q(created_by=user_to_delete) | 
                Q(technicians=user_to_delete)
            )
            
            if active_transactions.exists():
                transaction_ids = list(active_transactions.values_list('id', flat=True))
                logger.warning(
                    f"Cannot delete user {user_to_delete.id} - found {active_transactions.count()} "
                    f"active transactions: {transaction_ids}"
                )
                return Response(
                    {'error': 'Cannot delete account with active courier transactions'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ImportError:
            # courier_api app might not exist, continue without this check
            logger.warning("courier_api app not found, skipping active transactions check")
        
        # Log user details before deletion
        logger.info(f"User to be deleted - Username: {user_to_delete.username}, "
                   f"Email: {user_to_delete.email}, "
                   f"Date Joined: {user_to_delete.date_joined}")
        
        # Delete the user (this will cascade delete related records)
        username = user_to_delete.username
        user_to_delete.delete()
        logger.info(f"Successfully deleted user account: {username}")
        
        return Response({
            'success': True,
            'message': 'Your account has been deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error deleting user account {request.user.id}: {str(e)}")
        return Response(
            {'error': 'An error occurred while deleting your account'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_profile(request):
    """Get current technician's profile information"""
    try:
        # Check if user is a technician
        if not hasattr(request.user, 'technician'):
            return Response(
                {'error': 'Technician profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        tech = user.technician
        
        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': tech.phone,
            'date_joined': user.date_joined,
            'role': 'technician'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error getting profile for user {request.user.id}: {str(e)}")
        return Response(
            {'error': 'Failed to retrieve profile information'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_technician_detail(request, technician_id):
    """Get technician details"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        user = User.objects.get(id=technician_id)
        tech = Technician.objects.get(user=user)
        
        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': tech.phone,
        }, status=status.HTTP_200_OK)
        
    except (User.DoesNotExist, Technician.DoesNotExist):
        return Response(
            {'error': 'Technician not found'},
            status=status.HTTP_404_NOT_FOUND
        )



# ==================== GOOGLE SHEETS COMPLAINTS API ====================

@api_view(['GET'])
@permission_classes([AllowAny])  # allow admin panel access from browser
def get_complaints(request):
    try:
        technician = request.GET.get('technician')
        from_date = request.GET.get('from')
        to_date = request.GET.get('to')

        if not technician or not from_date or not to_date:
            return JsonResponse({"error": "Missing parameters"}, status=400)

        # Convert input date to datetime
        from_dt = datetime.strptime(from_date, "%d-%m-%Y")
        to_dt = datetime.strptime(to_date, "%d-%m-%Y")

        # Authenticate Google Sheets
        client = get_google_sheets_client()


        # Open worksheet
        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")

        # Fetch sheet data
        rows = sheet.get_all_values()

        results = []

        # Process rows — skip header
        for row in rows[1:]:
            complaint_no = row[1]
            technician_name = row[14]
            status = row[11]
            customer_name = row[2]
            customer_phone = row[3]
            area = row[5]
            part_name = row[9]
            part_no = row[7]
            quantity = row[10]



            # Extract date from complaint_no → B column format: PCOTH/150725/01
            complaint_parts = complaint_no.split("/")
            if len(complaint_parts) >= 3:
                date_str = complaint_parts[1]  # 150725 (DDMMYY)
                try:
                    date_obj = datetime.strptime(date_str, "%d%m%y")
                except:
                    continue
            else:
                continue

            # Apply filters
            if technician_name.upper() == technician.upper() and from_dt <= date_obj <= to_dt:
                results.append({
                    "date": date_obj.strftime("%d-%m-%Y"),
                    "complaint_no": complaint_no,
                    "status": status,
                    "customer_name": customer_name,
                    "customer_phone": customer_phone,
                    "part_name": part_name,
                    "part_no": part_no,
                    "area": area,
                    "quantity": quantity
                })

        return JsonResponse(results, safe=False)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])  # Later we will change to authenticated
def update_complaint_status(request):
    try:
        complaint_no = request.data.get("complaint_no")
        new_status = request.data.get("status", "CLOSED")  # default CLOSED

        if not complaint_no:
            return JsonResponse({"error": "complaint_no required"}, status=400)

        # Authenticate Google Sheets
        client = get_google_sheets_client()


        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")

        # Find complaint number row
        cell = sheet.find(complaint_no)
        row_index = cell.row

        # Column L = index 11 → Sheet column 12
        sheet.update_cell(row_index, 12, new_status)

        return JsonResponse({
            "success": True,
            "message": f"{complaint_no} status updated to {new_status}"
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ==================== SPARE PENDING ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_spare_pending(request):
    """
    Get spare pending complaints for technician
    Returns: All items where TECHNICIAN = logged-in user AND COMPLAINT STATUS = PENDING
    """
    try:
        technician_name = request.user.first_name

        client = get_google_sheets_client()

        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        rows = sheet.get_all_values()
        
        results = []
        
        # Process rows — skip header (row 0)
        for row in rows[1:]:
            if len(row) < 15:  # Ensure row has enough columns
                continue
                
            complaint_no = row[1]       # Index 1 = Complaint No
            tech_name = row[14]         # Index 14 = TECHNICIAN
            status = row[11]            # Index 11 = COMPLAINT STATUS
            
            # Filter: Match technician AND status = PENDING
            if tech_name.strip().upper() == technician_name.upper() and status.strip().upper() == 'PENDING':
                results.append({
                    "complaint_no": row[1],          # Index 1
                    "customer_name": row[2],         # Index 2
                    "phone": row[3],                 # Index 3
                    "area": row[5],                  # Index 5
                    "brand_name": row[6],            # Index 6
                    "product_code": row[7],          # Index 7
                    "part_name": row[9],             # Index 9
                    "no_of_spares": row[10],         # Index 10
                    "status": status,                # Index 11
                    "pending_days": row[12],  # Index 12
                    "district": row[15] if len(row) > 15 else "",  # Index 15
                    "mrp": row[19],
                    "technician": tech_name
                })
        
        return JsonResponse({
            "success": True,
            "data": results,
            "count": len(results)
        })
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_spare_closed(request):
    """
    Get spare closed complaints for technician with date range filter
    Query params: from_date (DD-MM-YYYY), to_date (DD-MM-YYYY)
    """
    try:
        technician_name = request.user.first_name
        from_date_str = request.query_params.get('from_date')
        to_date_str = request.query_params.get('to_date')
        
        if not from_date_str or not to_date_str:
            return JsonResponse({"error": "from_date and to_date required (DD-MM-YYYY format)"}, status=400)
        
        # Parse dates
        from_dt = datetime.strptime(from_date_str, "%d-%m-%Y")
        to_dt = datetime.strptime(to_date_str, "%d-%m-%Y")
        
        client = get_google_sheets_client()

        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        rows = sheet.get_all_values()
        
        results = []
        
        # Process rows
        for row in rows[1:]:
            if len(row) < 15:
                continue
            
            complaint_no = row[1]       # Index 1 = Complaint No
            tech_name = row[14]         # Index 14 = TECHNICIAN
            status = row[11]            # Index 11 = COMPLAINT STATUS
            
            # Extract date from complaint_no → format: PCOTH/150725/01
            complaint_parts = complaint_no.split("/")
            if len(complaint_parts) >= 3:
                date_str = complaint_parts[1]  # 150725 (DDMMYY)
                try:
                    date_obj = datetime.strptime(date_str, "%d%m%y")
                except:
                    continue
            else:
                continue
            
            # Filter: Match technician AND status = CLOSED AND date in range
            if (tech_name.strip().upper() == technician_name.upper() and 
                status.strip().upper() == 'CLOSED' and 
                from_dt <= date_obj <= to_dt):
                
                results.append({
                    "complaint_no": row[1],          # Index 1
                    "customer_name": row[2],         # Index 2
                    "phone": row[3],                 # Index 3
                    "area": row[5],                  # Index 5
                    "brand_name": row[6],            # Index 6
                    "product_code": row[7],          # Index 7
                    "part_name": row[9],             # Index 9
                    "no_of_spares": row[10],         # Index 10
                    "status": status,                # Index 11
                    "district": row[15] if len(row) > 15 else "",  # Index 15
                    "technician": tech_name,
                    "date": date_obj.strftime("%d-%m-%Y")
                })
        
        return JsonResponse({
            "success": True,
            "data": results,
            "count": len(results)
        })
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_admin_spare_approvals(request):
    """
    Get all pending spare part requests for admin approval
    Returns: All items where COMPLAINT STATUS = PENDING
    """
    try:
        # Check if user is admin
        if not request.user.is_staff:
            return JsonResponse({"error": "Only admin users can access this endpoint"}, status=403)

        client = get_google_sheets_client()

        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        rows = sheet.get_all_values()
        
        results = []
        
        # Process rows — skip header (row 0)
        for row in rows[1:]:
            if len(row) < 15:  # Ensure row has enough columns
                continue
                
            status = row[11]  # Index 11 = COMPLAINT STATUS
            
            # Filter: Only include PENDING status
            if status.strip().upper() == 'PENDING':
                results.append({
                    "id": row[0],                   # Index 0 (Row ID)
                    "complaint_no": row[1],         # Index 1
                    "customer_name": row[2],        # Index 2
                    "phone": row[3],                # Index 3
                    "area": row[5],                 # Index 5
                    "brand_name": row[6],           # Index 6
                    "product_code": row[7],         # Index 7
                    "part_name": row[9],            # Index 9
                    "no_of_spares": row[10],        # Index 10
                    "status": status,               # Index 11
                     "pending_days": row[12], 
                    "district": row[15] if len(row) > 15 else "",  # Index 15
                    "technician": row[14] if len(row) > 14 else ""  # Index 14
                })
        
        return JsonResponse({
            "success": True,
            "data": results,
            "count": len(results)
        })
    
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_spare_status(request):
    """
    Update complaint status (PENDING/CLOSED) in the Google Sheet
    Can be called by both technicians (for requests) and admins (for approvals)
    """
    try:
        complaint_no = request.data.get("complaint_no")
        new_status = request.data.get("new_status")
        action = request.data.get("action", "").lower()
        updated_by = "admin" if request.user.is_staff else request.user.first_name
        
        if not complaint_no or not new_status:
            return JsonResponse({"success": False, "error": "complaint_no and new_status are required"}, status=400)
        
        if new_status not in ['PENDING', 'CLOSED']:
            return JsonResponse({"success": False, "error": "new_status must be PENDING or CLOSED"}, status=400)
        
        # Authenticate Google Sheets
        client = get_google_sheets_client()

        
        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        
        try:
            # Find complaint number row (column B = 2)
            cell = sheet.find(complaint_no, in_column=2)
            row_index = cell.row
            
            # Get the current row data
            row = sheet.row_values(row_index)
            if len(row) < 15:  # Ensure we have enough columns
                return JsonResponse({"success": False, "error": "Invalid row data"}, status=400)
            
            # Update the status (column L = 12)
            sheet.update_cell(row_index, 12, new_status)
            
            # If this is an admin approval, update the updated_by field (assuming it's in column M = 13)
            if request.user.is_staff and len(row) >= 13:
                sheet.update_cell(row_index, 13, f"{updated_by} ({datetime.now().strftime('%d-%m-%Y %H:%M')})")
            
            return JsonResponse({
                "success": True,
                "message": f"Successfully {action}ed {complaint_no}",
                "complaint_no": complaint_no,
                "new_status": new_status,
                "updated_by": updated_by,
                "timestamp": datetime.now().isoformat()
            })
            
        except gspread.exceptions.CellNotFound:
            return JsonResponse({"success": False, "error": f"Complaint {complaint_no} not found"}, status=404)
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def test_sheet_connection(request):
    """Test if we can connect to the sheet"""
    try:
        client = get_google_sheets_client()

        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        rows = sheet.get_all_values()
        return JsonResponse({
            "success": True,
            "message": f"Connected! Sheet has {len(rows)} rows",
            "first_row": rows[0] if rows else []
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ==================== SPARE REQUEST ENDPOINTS ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_spare_request(request):
    """
    Technician creates a spare request
    Called when technician clicks "Mark as CLOSED" on a pending spare
    """
    try:
        complaint_no = request.data.get('complaint_no')
        
        if not complaint_no:
            return Response(
                {'error': 'complaint_no is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if request already exists
        if SpareRequest.objects.filter(complaint_no=complaint_no).exists():
            return Response(
                {'error': 'Request already exists for this complaint'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all data from request
        spare_request = SpareRequest.objects.create(
            complaint_no=complaint_no,
            technician=request.user,
            customer_name=request.data.get('customer_name', ''),
            customer_phone=request.data.get('customer_phone', ''),
            area=request.data.get('area', ''),
            brand_name=request.data.get('brand_name', ''),
            product_code=request.data.get('product_code', ''),
            part_name=request.data.get('part_name', ''),
            no_of_spares=request.data.get('no_of_spares', ''),
            district=request.data.get('district', ''),
            status='PENDING'
        )
        
        serializer = SpareRequestSerializer(spare_request)
        return Response({
            'success': True,
            'message': 'Request created successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_spare_requests(request):
    """
    Get spare requests created by logged-in technician
    Shows status: PENDING/APPROVED/REJECTED
    """
    try:
        requests_qs = SpareRequest.objects.filter(technician=request.user)
        
        # Optional filtering by status
        status_filter = request.query_params.get('status')
        if status_filter:
            requests_qs = requests_qs.filter(status=status_filter)
        
        serializer = SpareRequestSerializer(requests_qs, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'count': len(serializer.data)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_spare_requests(request):
    """
    Admin endpoint: Get ALL pending spare requests from all technicians
    """
    try:
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all PENDING requests
        requests_qs = SpareRequest.objects.filter(status='PENDING')
        
        serializer = SpareRequestSerializer(requests_qs, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'count': len(serializer.data)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_spare_request(request):
    """
    Admin approves a spare request
    Updates Google Sheet (marks complaint as CLOSED)
    Updates DB request status to APPROVED
    """
    try:
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        request_id = request.data.get('request_id')
        admin_notes = request.data.get('admin_notes', '')
        
        if not request_id:
            return Response(
                {'error': 'request_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            spare_request = SpareRequest.objects.get(id=request_id)
        except SpareRequest.DoesNotExist:
            return Response(
                {'error': 'Request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update Google Sheet
        try:
            client = get_google_sheets_client()

            sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
            
            # Find and update the complaint row
            cell = sheet.find(spare_request.complaint_no, in_column=2)
            row_index = cell.row
            
            # Update status to CLOSED (column L = 12)
            sheet.update_cell(row_index, 12, 'CLOSED')
            
        except Exception as sheet_error:
            return Response(
                {'error': f'Failed to update Google Sheet: {str(sheet_error)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update DB record
        spare_request.status = 'APPROVED'
        spare_request.approved_by = request.user
        spare_request.admin_notes = admin_notes
        spare_request.reviewed_at = timezone.now()
        spare_request.save()
        
        serializer = SpareRequestSerializer(spare_request)
        return Response({
            'success': True,
            'message': 'Request approved and Google Sheet updated',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_spare_request(request):
    """
    Admin rejects a spare request
    Status updated to REJECTED in DB only (Google Sheet unchanged)
    """
    try:
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        request_id = request.data.get('request_id')
        admin_notes = request.data.get('admin_notes', '')
        
        if not request_id:
            return Response(
                {'error': 'request_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            spare_request = SpareRequest.objects.get(id=request_id)
        except SpareRequest.DoesNotExist:
            return Response(
                {'error': 'Request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update DB record only
        spare_request.status = 'REJECTED'
        spare_request.approved_by = request.user
        spare_request.admin_notes = admin_notes
        spare_request.reviewed_at = timezone.now()
        spare_request.save()
        
        serializer = SpareRequestSerializer(spare_request)
        return Response({
            'success': True,
            'message': 'Request rejected',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

 # ==================== STOCK OUT MANAGEMENT (ADMIN ONLY) ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_stock_out_items(request):
    """
    Admin only: Get all items from Google Sheet where CC REMARKS = "STOCK OUT"
    Returns items that need to be ordered
    """
    try:
        if not request.user.is_staff:
            return JsonResponse({
                "success": False,
                "error": "Only admin users can access this endpoint"
            }, status=403)

        client = get_google_sheets_client()

        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        rows = sheet.get_all_values()
        
        results = []
        
        # Process rows — skip header (row 0)
        for row in rows[1:]:
            if len(row) < 24:  # Ensure row has enough columns (column X = index 23)
                continue
            
            cc_remarks = row[23].strip().upper() if len(row) > 23 else ""  # Column X = index 23
            
            # Filter: Only include items with CC REMARKS = "STOCK OUT"
            if cc_remarks == 'STOCK OUT':
                results.append({
                    "complaint_no": row[1],          # Index 1 = B
                    "area": row[5],                  # Index 5 = F
                    "brand_name": row[6],            # Index 6 = G
                    "product_code": row[7],          # Index 7 = H
                    "part_name": row[9],             # Index 9 = J
                    "district": row[15] if len(row) > 15 else "",  # Index 15 = P
                    "mrp": row[19] if len(row) > 19 else "",       # Index 19 = T
                    "cc_remarks": row[23],           # Index 23 = X
                })
        
        return JsonResponse({
            "success": True,
            "data": results,
            "count": len(results)
        })
    
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_stock_as_ordered(request):
    """
    Admin only: Mark a stock-out item as ORDERED
    Updates Google Sheet (CC REMARKS column X to "ORDERED")
    Saves order details to database
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Starting mark_stock_as_ordered with data: {request.data}")
    
    try:
        if not request.user.is_staff:
            error_msg = "Non-admin user attempted to access mark_stock_as_ordered"
            logger.warning(error_msg)
            return Response({
                "success": False,
                "error": "Only admin users can access this endpoint"
            }, status=status.HTTP_403_FORBIDDEN)
        
        complaint_no = request.data.get("complaint_no")
        logger.info(f"Processing order for complaint: {complaint_no}")
        
        if not complaint_no:
            error_msg = "No complaint_no provided in request"
            logger.error(error_msg)
            return Response({
                "success": False,
                "error": "complaint_no is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the row data from Google Sheet first
        logger.info("Attempting to connect to Google Sheet...")
        try:
            client = get_google_sheets_client()

            sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
            
            # Find complaint number row (column B = 2)
            cell = sheet.find(complaint_no, in_column=2)
            row_index = cell.row
            
            # Get the current row data to save in DB
            row = sheet.row_values(row_index)
            
            # First save to database within a transaction
            logger.info("Starting database transaction...")
            with transaction.atomic():
                try:
                    stock_order = StockOutOrder.objects.create(
                        complaint_no=complaint_no,
                        area=row[5] if len(row) > 5 else "",
                        brand_name=row[6] if len(row) > 6 else "",
                        product_code=row[7] if len(row) > 7 else "",
                        part_name=row[9] if len(row) > 9 else "",
                        district=row[15] if len(row) > 15 else "",
                        mrp=row[19] if len(row) > 19 else "",
                        cc_remarks='ORDERED',
                        ordered_by=request.user,
                        ordered_at=timezone.now(),
                        ordered_date=timezone.now().date()
                    )
                    logger.info(f"Created StockOutOrder with ID: {stock_order.id}")
                    
                    # Then update Google Sheet
                    logger.info("Updating Google Sheet...")
                    sheet.update_cell(row_index, 24, 'ORDERED')
                    logger.info("Successfully updated Google Sheet")
                    
                except Exception as e:
                    error_msg = f"Error in transaction: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    raise
                
        except Exception as e:
            # If any error occurs, the database transaction will be rolled back automatically
            error_msg = f"Failed to process order for {complaint_no}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return Response({
                "success": False,
                "error": f"Failed to process order: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = StockOutOrderSerializer(stock_order)
        return Response({
            "success": True,
            "message": f"Successfully marked {complaint_no} as ORDERED",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_ordered_items(request):
    """
    Admin only: Get all items from Google Sheet where CC REMARKS = "ORDERED"
    Returns items that have been ordered but not yet received
    """
    try:
        if not request.user.is_staff:
            return JsonResponse({
                "success": False,
                "error": "Only admin users can access this endpoint"
            }, status=403)

        client = get_google_sheets_client()

        sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
        rows = sheet.get_all_values()
        
        results = []
        
        # Process rows — skip header (row 0)
        for row in rows[1:]:
            if len(row) < 24:  # Ensure row has enough columns
                continue
            
            cc_remarks = row[23].strip().upper() if len(row) > 23 else ""  # Column X = index 23
            
            # Filter: Only include items with CC REMARKS = "ORDERED"
            if cc_remarks == 'ORDERED':
                results.append({
                    "complaint_no": row[1],          # Index 1 = B
                    "area": row[5],                  # Index 5 = F
                    "brand_name": row[6],            # Index 6 = G
                    "product_code": row[7],          # Index 7 = H
                    "part_name": row[9],             # Index 9 = J
                    "district": row[15] if len(row) > 15 else "",  # Index 15 = P
                    "mrp": row[19] if len(row) > 19 else "",       # Index 19 = T
                    "cc_remarks": row[23],           # Index 23 = X
                })
        
        return JsonResponse({
            "success": True,
            "data": results,
            "count": len(results)
        })
    
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_stock_as_received(request):
    """
    Admin only: Mark an ordered item as RECEIVED
    Updates Google Sheet (CC REMARKS column X to "RECEIVED")
    Saves received details to database
    """
    try:
        if not request.user.is_staff:
            return Response({
                "success": False,
                "error": "Only admin users can access this endpoint"
            }, status=status.HTTP_403_FORBIDDEN)
        
        complaint_no = request.data.get("complaint_no")
        
        if not complaint_no:
            return Response({
                "success": False,
                "error": "complaint_no is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already received
        if StockReceived.objects.filter(complaint_no=complaint_no).exists():
            return Response({
                "success": False,
                "error": "This item has already been marked as received"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the original order record
        try:
            stock_order = StockOutOrder.objects.get(complaint_no=complaint_no)
        except StockOutOrder.DoesNotExist:
            stock_order = None
        
        # Update Google Sheet
        try:
            client = get_google_sheets_client()

            sheet = client.open_by_key("1H54mqxD9P2RXX3u8JDwtCg5Wokf2CHPPEjQ7mkqDZnQ").worksheet("Tracking")
            
            # Find complaint number row (column B = 2)
            cell = sheet.find(complaint_no, in_column=2)
            row_index = cell.row
            
            # Get the current row data to save in DB
            row = sheet.row_values(row_index)
            
            # Update CC REMARKS to "RECEIVED" (column X = 24)
            sheet.update_cell(row_index, 24, 'RECEIVED')
            
        except gspread.exceptions.CellNotFound:
            return Response({
                "success": False,
                "error": f"Complaint {complaint_no} not found in sheet"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as sheet_error:
            return Response({
                "success": False,
                "error": f"Failed to update Google Sheet: {str(sheet_error)}"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Save to database
        stock_received = StockReceived.objects.create(
            complaint_no=complaint_no,
            area=row[5] if len(row) > 5 else "",
            brand_name=row[6] if len(row) > 6 else "",
            product_code=row[7] if len(row) > 7 else "",
            part_name=row[9] if len(row) > 9 else "",
            district=row[15] if len(row) > 15 else "",
            mrp=row[19] if len(row) > 19 else "",
            cc_remarks='RECEIVED',
            stock_order=stock_order,
            received_by=request.user,
            received_at=timezone.now(),
            received_date=timezone.now().date()
        )
        
        serializer = StockReceivedSerializer(stock_received)
        return Response({
            "success": True,
            "message": f"Successfully marked {complaint_no} as RECEIVED",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_order_history(request):
    """
    Admin only: Get order history from database (all ordered items)
    """
    try:
        if not request.user.is_staff:
            return Response({
                "success": False,
                "error": "Only admin users can access this endpoint"
            }, status=status.HTTP_403_FORBIDDEN)
        
        orders = StockOutOrder.objects.all().order_by('-ordered_at')
        serializer = StockOutOrderSerializer(orders, many=True)
        
        return Response({
            "success": True,
            "data": serializer.data,
            "count": orders.count()
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_received_history(request):
    """
    Admin only: Get received history from database (all received items)
    """
    try:
        if not request.user.is_staff:
            return Response({
                "success": False,
                "error": "Only admin users can access this endpoint"
            }, status=status.HTTP_403_FORBIDDEN)
        
        received_items = StockReceived.objects.all().order_by('-received_at')
        serializer = StockReceivedSerializer(received_items, many=True)
        
        return Response({
            "success": True,
            "data": serializer.data,
            "count": received_items.count()
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)       




