from django.urls import path
from . import views

app_name = 'technician_tracking'

urlpatterns = [
    # Technician endpoints
    path('check-in/', views.tracking_check_in, name='tracking_check_in'),
    path('check-out/', views.tracking_check_out, name='tracking_check_out'),
    path('location/', views.update_location, name='update_location'),
    path('active-session/', views.get_active_session, name='get_active_session'),
    
    # Admin endpoints
    path('admin/members/', views.admin_member_list, name='admin_member_list'),
    path('admin/member/<int:member_id>/locations/', views.admin_member_locations, name='admin_member_locations'),
]