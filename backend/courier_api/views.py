# E:\study\techfix\backend\courier_api\views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.http import FileResponse

from .models import CourierTransaction, TechnicianStock
from .serializers import (
    CourierTransactionSerializer, CourierCreateSerializer,
    CourierReceiveSerializer, TechnicianStockSerializer
)
from .sheets_sync import SheetsSync
from .pdf_generator import generate_courier_pdf
import uuid
import logging

logger = logging.getLogger(__name__)

# Initialize sheets sync
sheets_sync = SheetsSync()

# ==================== ADMIN ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_stock(request):
    """
    Admin endpoint: Fetch all company stock from Google Sheets "Mrp List".
    Supports search, sort, filter (no DB storage)
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Get stock from Google Sheets
        stock_data = sheets_sync.get_company_stock()
        
        # Apply filters if provided
        search = request.query_params.get('search', '').lower()
        sort_by = request.query_params.get('sort_by', 'name')
        
        if search:
            stock_data = [
                s for s in stock_data
                if search in s['name'].lower() or search in s['spare_id'].lower()
            ]
        
        # Sort
        reverse = request.query_params.get('order') == 'desc'
        if sort_by in ['name', 'qty', 'mrp', 'spare_id']:
            stock_data = sorted(stock_data, key=lambda x: x.get(sort_by, ''), reverse=reverse)
        
        return Response({
            'success': True,
            'count': len(stock_data),
            'data': stock_data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching company stock: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_courier(request):
    """
    Admin endpoint: Create a new courier transaction.
    Status: 'in_transit' (not updating sheets yet)
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    serializer = CourierCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        technician_ids = serializer.validated_data['technician_ids']
        items = serializer.validated_data['items']
        notes = serializer.validated_data.get('notes', '')
        
        # Validate technicians exist
        technicians = User.objects.filter(id__in=technician_ids)
        if technicians.count() != len(technician_ids):
            return Response(
                {'error': 'One or more technicians not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate stock availability
        company_stock = sheets_sync.get_company_stock()
        
        # Calculate total qty needed (for all technicians)
        total_qty_needed = {}
        for item in items:
            spare_id = item.get('spare_id')
            qty = item.get('qty')
            total_qty_needed[spare_id] = total_qty_needed.get(spare_id, 0) + (qty * len(technician_ids))
        
        # Check stock availability
        for spare_id, total_qty in total_qty_needed.items():
            stock_item = next(
                (s for s in company_stock if s['spare_id'] == spare_id), 
                None
            )
            
            if not stock_item:
                return Response(
                    {'error': f"Spare ID '{spare_id}' not found in company stock"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if stock_item['qty'] < total_qty:
                return Response(
                    {
                        'error': f"Insufficient stock for '{spare_id}'. Available: {stock_item['qty']}, Requested: {total_qty}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Generate courier ID
        courier_id = f"COURIER-{uuid.uuid4().hex[:8].upper()}"
        
        # Create courier transaction in DB with status 'in_transit'
        courier = CourierTransaction.objects.create(
            courier_id=courier_id,
            created_by=request.user,
            items=items,
            notes=notes,
            status='in_transit'  # Changed from 'sent'
        )
        
        # Add technicians
        courier.technicians.set(technicians)
        
        # Generate PDF
        try:
            pdf_bytes = generate_courier_pdf(courier)
            pdf_filename = f"{courier_id}.pdf"
            courier.pdf_file.save(pdf_filename, ContentFile(pdf_bytes), save=True)
        except Exception as pdf_error:
            logger.warning(f"PDF generation failed: {pdf_error}")
        
        # DON'T update sheets yet - only when technician marks received
        
        # Serialize and return
        serializer = CourierTransactionSerializer(courier)
        
        return Response({
            'success': True,
            'message': 'Courier created successfully (in transit)',
            'data': serializer.data,
            'pdf_url': f"/api/courier/{courier.id}/pdf/" if courier.pdf_file else None
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating courier: {str(e)}", exc_info=True)
        return Response(
            {'error': f"Server error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def courier_list(request):
    """
    Admin endpoint: Get all courier history with optional status filter
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Filter by status if provided
        status_filter = request.query_params.get('status')
        queryset = CourierTransaction.objects.all()
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Sort by date descending
        queryset = queryset.order_by('-sent_time')
        
        serializer = CourierTransactionSerializer(queryset, many=True)
        
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching courier list: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def courier_pdf(request, courier_id):
#     """
#     Download courier PDF (accessible to admin & assigned technicians)
#     Returns PDF URL and metadata
#     """
#     try:
#         courier = CourierTransaction.objects.get(id=courier_id)
        
#         # Check permission
#         if not request.user.is_staff and request.user not in courier.technicians.all():
#             return Response(
#                 {'error': 'Access denied'},
#                 status=status.HTTP_403_FORBIDDEN
#             )
        
#         if not courier.pdf_file:
#             return Response(
#                 {'error': 'PDF not found'},
#                 status=status.HTTP_404_NOT_FOUND
#             )
        
#         # Return PDF URL and metadata for frontend to download
#         pdf_url = request.build_absolute_uri(courier.pdf_file.url)
        
#         return Response({
#             'success': True,
#             'pdf_url': pdf_url,
#             'pdf_file_name': courier.pdf_file.name,
#             'courier_id': courier.courier_id,
#             'courier_info': CourierTransactionSerializer(courier).data
#         }, status=status.HTTP_200_OK)
        
#     except CourierTransaction.DoesNotExist:
#         return Response(
#             {'error': 'Courier not found'},
#             status=status.HTTP_404_NOT_FOUND
#         )
#     except Exception as e:
#         logger.error(f"Error fetching courier PDF: {e}")
#         return Response(
#             {'error': str(e)},
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR
#         )


# ==================== TECHNICIAN ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_stock(request):
    """
    Technician endpoint: Get their personal stock from "Technician Stocks" tab.
    Filtered by technician name from TechnicianStock.sheet_id
    Supports search & sort
    """
    try:
        # Get technician's stock metadata
        tech_stock = TechnicianStock.objects.filter(technician=request.user).first()
        
        if not tech_stock or not tech_stock.sheet_technician_name:
            return Response(
                {'error': 'No stock data found for this technician'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Fetch from Google Sheets "Technician Stocks" tab
        stock_data = sheets_sync.get_technician_stock(tech_stock.sheet_technician_name)
        
        # Apply filters
        search = request.query_params.get('search', '').lower()
        sort_by = request.query_params.get('sort_by', 'name')
        
        if search:
            stock_data = [
                s for s in stock_data
                if search in s['name'].lower() or search in s['spare_id'].lower()
            ]
        
        # Sort
        reverse = request.query_params.get('order') == 'desc'
        if sort_by in ['name', 'qty', 'spare_id']:
            stock_data = sorted(stock_data, key=lambda x: x.get(sort_by, ''), reverse=reverse)
        
        return Response({
            'success': True,
            'count': len(stock_data),
            'data': stock_data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching my stock: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_couriers(request):
    """
    Technician endpoint: Get couriers assigned to them with 'in_transit' status
    """
    try:
        # Get couriers assigned to technician with status 'in_transit'
        couriers = CourierTransaction.objects.filter(
            technicians=request.user,
            status='in_transit'
        ).order_by('-sent_time')
        
        serializer = CourierTransactionSerializer(couriers, many=True)
        
        return Response({
            'success': True,
            'count': couriers.count(),
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching pending couriers: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_received(request, courier_id):
    """
    Technician endpoint: Mark selected items as received & update sheets
    Expected payload:
    {
        "received_items": [
            {"spare_id": "X", "qty": 2},
            {"spare_id": "Y", "qty": 1}
        ]
    }
    """
    try:
        courier = CourierTransaction.objects.get(id=courier_id)
        
        # Check permission
        if request.user not in courier.technicians.all():
            return Response(
                {'error': 'This courier is not assigned to you'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if courier.status == 'received':
            return Response(
                {'error': 'Courier already marked as received'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get received items from request
        received_items = request.data.get('received_items', [])
        
        if not received_items:
            return Response(
                {'error': 'No items selected for receiving'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate received items against courier items
        courier_item_map = {item['spare_id']: item for item in courier.items}
        
        for rec_item in received_items:
            spare_id = rec_item.get('spare_id')
            qty = rec_item.get('qty', 0)
            
            if spare_id not in courier_item_map:
                return Response(
                    {'error': f"Item {spare_id} not found in courier"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if qty > courier_item_map[spare_id]['qty']:
                return Response(
                    {'error': f"Quantity for {spare_id} exceeds courier quantity"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get technician's sheet name
        tech_stock = TechnicianStock.objects.filter(technician=request.user).first()
        if not tech_stock or not tech_stock.sheet_technician_name:
            return Response(
                {'error': 'Technician stock configuration not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        technician_name = tech_stock.sheet_technician_name
        
        # Update Google Sheets
        try:
            for rec_item in received_items:
                spare_id = rec_item['spare_id']
                qty = rec_item['qty']
                
                # Reduce company stock
                sheets_sync.update_company_stock(spare_id, qty)
                logger.info(f"Reduced company stock: {spare_id} by {qty}")
                
                # Add to technician stock
                sheets_sync.update_technician_stock(technician_name, spare_id, qty)
                logger.info(f"Added {qty} of {spare_id} to {technician_name}'s stock")
        
        except Exception as sheets_error:
            logger.error(f"Sheets update failed: {sheets_error}")
            return Response(
                {'error': f"Failed to update stock: {str(sheets_error)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Update courier status
        courier.status = 'received'
        courier.received_time = timezone.now()
        courier.save()
        
        serializer = CourierTransactionSerializer(courier)
        
        return Response({
            'success': True,
            'message': f'Received {len(received_items)} items successfully',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except CourierTransaction.DoesNotExist:
        return Response(
            {'error': 'Courier not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error marking courier as received: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_technicians(request):
    """
    Admin endpoint: Get all technicians (non-staff users)
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        technicians = User.objects.filter(is_staff=False).order_by('username')
        
        data = []
        for tech in technicians:
            tech_data = {
                'id': tech.id,
                'username': tech.username,
                'first_name': tech.first_name or tech.username,
                'last_name': tech.last_name or '',
                'email': tech.email,
                'full_name': f"{tech.first_name} {tech.last_name}".strip() or tech.username
            }
            data.append(tech_data)
        
        return Response({
            'success': True,
            'count': len(data),
            'data': data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error fetching technicians: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_technicians_for_courier(request):
    """
    Get all technicians (User objects) for courier assignment
    """
    if not request.user.is_staff:
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        technicians = User.objects.filter(is_staff=False).order_by('username')
        
        data = []
        for tech in technicians:
            data.append({
                'id': tech.id,
                'username': tech.username,
                'first_name': tech.first_name or tech.username,
                'last_name': tech.last_name or '',
                'email': tech.email,
            })
        
        return Response({
            'success': True,
            'count': len(data),
            'data': data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error fetching technicians: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)       

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def courier_detail(request, courier_id):
    """
    Get courier details by ID
    Accessible to admin and assigned technicians
    """
    try:
        # Try to find by courier_id string first
        courier = CourierTransaction.objects.get(courier_id=courier_id)
        
    except CourierTransaction.DoesNotExist:
        try:
            # If not found by courier_id, try by primary key
            courier = CourierTransaction.objects.get(id=courier_id)
        except (CourierTransaction.DoesNotExist, ValueError):
            return Response(
                {'error': 'Courier not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    # Check permissions
    is_assigned_technician = request.user in courier.technicians.all()
    
    if not (request.user.is_staff or is_assigned_technician):
        return Response(
            {'error': 'You do not have permission to view this courier'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    serializer = CourierTransactionSerializer(courier)
    
    return Response({
        'success': True,
        'data': serializer.data
    }, status=status.HTTP_200_OK)


# ADD this NEW function to views.py (keep pending_couriers unchanged):

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_courier_history(request):
    """
    Technician endpoint: Get ALL couriers assigned to them (complete history)
    Supports filtering by status if needed
    """
    try:
        # Get ALL couriers assigned to technician (not just in_transit)
        status_filter = request.query_params.get('status')
        
        couriers = CourierTransaction.objects.filter(
            technicians=request.user
        ).order_by('-sent_time')
        
        # Apply status filter if provided
        if status_filter:
            couriers = couriers.filter(status=status_filter)
        
        serializer = CourierTransactionSerializer(couriers, many=True)
        
        return Response({
            'success': True,
            'count': couriers.count(),
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching courier history: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def courier_pdf(request, courier_id):
    """
    Download courier PDF (accessible to admin & assigned technicians)
    
    NOTE: This endpoint is now primarily used by ADMIN users.
    Technicians generate PDFs on the frontend using React Native expo-print.
    Keeping this endpoint for backward compatibility and admin usage.
    """
    try:
        courier = CourierTransaction.objects.get(id=courier_id)
        
        # Check permission
        if not request.user.is_staff and request.user not in courier.technicians.all():
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not courier.pdf_file:
            return Response(
                {'error': 'PDF not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Return PDF URL and metadata for frontend to download
        pdf_url = request.build_absolute_uri(courier.pdf_file.url)
        
        return Response({
            'success': True,
            'pdf_url': pdf_url,
            'pdf_file_name': courier.pdf_file.name,
            'courier_id': courier.courier_id,
            'courier_info': CourierTransactionSerializer(courier).data
        }, status=status.HTTP_200_OK)
        
    except CourierTransaction.DoesNotExist:
        return Response(
            {'error': 'Courier not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error fetching courier PDF: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )        

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def register_technician_stock(request):
    """
    GET: Returns list of all users and existing technician stocks
    POST: Creates a new TechnicianStock object
    """
    # Only allow admin users
    if not request.user.is_staff:
        return Response(
            {'error': 'Only admins can register technician stock'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        # Get all users (technicians)
        users = User.objects.filter(is_staff=False).values('id', 'username', 'first_name', 'last_name')
        
        # Get existing technician stocks
        existing_stocks = TechnicianStock.objects.select_related('technician').all()
        stocks_data = [{
            'id': stock.id,
            'technician_id': stock.technician.id,
            'technician_username': stock.technician.username,
            'sheet_technician_name': stock.sheet_technician_name,
            'sheet_id': stock.sheet_id,
            'last_sync': stock.last_sync
        } for stock in existing_stocks]
        
        return Response({
            'users': list(users),
            'existing_stocks': stocks_data
        })
    
    elif request.method == 'POST':
        technician_id = request.data.get('technician_id')
        sheet_technician_name = request.data.get('sheet_technician_name')
        sheet_id = request.data.get('sheet_id')
        
        # Validation
        if not technician_id:
            return Response(
                {'error': 'Technician ID is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            technician = User.objects.get(id=technician_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'Technician not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if technician stock already exists
        if TechnicianStock.objects.filter(technician=technician).exists():
            return Response(
                {'error': 'Stock record already exists for this technician'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create TechnicianStock
        technician_stock = TechnicianStock.objects.create(
            technician=technician,
            sheet_technician_name=sheet_technician_name,
            sheet_id=sheet_id,
            last_sync=None
        )
        
        return Response({
            'message': 'Technician stock registered successfully',
            'data': {
                'id': technician_stock.id,
                'technician_id': technician.id,
                'technician_username': technician.username,
                'sheet_technician_name': technician_stock.sheet_technician_name,
                'sheet_id': technician_stock.sheet_id
            }
        }, status=status.HTTP_201_CREATED)        