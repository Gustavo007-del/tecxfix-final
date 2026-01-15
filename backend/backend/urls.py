# E:\study\techfix\backend\backend\urls.py
from django.contrib import admin
from django.urls import path, include
from api.views import (
    technician_login, admin_login, refresh_token,
    attendance_today, check_in, check_out,
    attendance_list, admin_dashboard_stats, technician_list, create_technician, update_technician, delete_technician,
    get_technician_detail, get_complaints, update_complaint_status,
    get_spare_pending, get_spare_closed, update_spare_status, test_sheet_connection, get_admin_spare_approvals, create_spare_request,
    get_my_spare_requests,
    get_all_spare_requests,
    approve_spare_request,
    reject_spare_request,
    get_stock_out_items,mark_stock_as_ordered,get_ordered_items,
    mark_stock_as_received, get_order_history,
    get_received_history
)

# Import the courier API URLs
from courier_api import urls as courier_urls


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    path('api/login/technician/', technician_login, name='technician_login'),
    path('api/login/admin/', admin_login, name='admin_login'),
    path('api/token/refresh/', refresh_token, name='refresh_token'),
    
    # Technician Attendance
    path('api/attendance/today/', attendance_today, name='attendance_today'),
    path('api/attendance/check-in/', check_in, name='check_in'),
    path('api/attendance/check-out/', check_out, name='check_out'),
    
    # Admin
    path('api/attendance/list/', attendance_list, name='attendance_list'),
    path('api/admin/dashboard/', admin_dashboard_stats, name='dashboard_stats'),
    path('api/technicians/', technician_list, name='technician_list'),

    # Technician Management
    path('api/technicians/create/', create_technician, name='create_technician'),
    path('api/technicians/<int:technician_id>/', get_technician_detail, name='get_technician'),
    path('api/technicians/<int:technician_id>/update/', update_technician, name='update_technician'),
    path('api/technicians/<int:technician_id>/delete/', delete_technician, name='delete_technician'),

    
    path('api/get-complaints/', get_complaints),
    path('api/update-complaint/', update_complaint_status),
    
    # Spare Pending Endpoints
    path('api/spare/pending/', get_spare_pending, name='get_spare_pending'),
    path('api/spare/closed/', get_spare_closed, name='get_spare_closed'),
    path('api/spare/update-status/', update_spare_status, name='update_spare_status'),
    path('api/admin/spare-approvals/', get_admin_spare_approvals, name='admin_spare_approvals'),

    path('api/test-sheet/', test_sheet_connection),
    # Spare Request Management (new)
    path('api/spare-request/create/', create_spare_request, name='create_spare_request'),
    path('api/spare-request/my-requests/', get_my_spare_requests, name='my_spare_requests'),
    path('api/spare-request/all-requests/', get_all_spare_requests, name='all_spare_requests'),
    path('api/spare-request/approve/', approve_spare_request, name='approve_spare_request'),
    path('api/spare-request/reject/', reject_spare_request, name='reject_spare_request'),
    path('api/', include('courier_api.urls')),

    path('api/stock-out/', get_stock_out_items, name='stock_out_items'),
    path('api/stock-out/order/', mark_stock_as_ordered, name='mark_stock_ordered'),
    path('api/stock-ordered/', get_ordered_items, name='ordered_items'),
    path('api/stock-ordered/receive/', mark_stock_as_received, name='mark_stock_received'),
    path('api/stock-out/order-history/', get_order_history, name='order_history'),
    path('api/stock-out/received-history/', get_received_history, name='received_history'),
    path('api/tracking/', include('technician_tracking.urls')),  

]
