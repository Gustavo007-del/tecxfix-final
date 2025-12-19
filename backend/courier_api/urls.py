# E:\study\techfix\backend\courier_api\urls.py
from django.urls import path
from . import views
from .views import health_check

urlpatterns = [
    # Company stock management
    path('company-stock/', views.company_stock, name='company_stock'),
    
    # Courier management
    path('create-courier/', views.create_courier, name='create_courier'),
    path('courier-list/', views.courier_list, name='courier_list'),
    path('courier/<str:courier_id>/', views.courier_detail, name='courier_detail'),
    path('courier/<int:courier_id>/pdf/', views.courier_pdf, name='courier_pdf'),
    
    # Technician stock
    path('my-stock/', views.my_stock, name='my_stock'),
    
    # Courier status
    path('pending-couriers/', views.pending_couriers, name='pending_couriers'),
    path('mark-received/<int:courier_id>/', views.mark_received, name='mark_received'),
    path("health/", health_check),
    
    # Technician management
    path('technicians/', views.get_technicians, name='get_technicians'),
    path('technicians-for-courier/', views.get_technicians_for_courier, name='technicians_for_courier'),
    path('my-courier-history/', views.my_courier_history, name='my_courier_history'),  # NEW endpoint
    path('register-technician-stock/', views.register_technician_stock, name='register_technician_stock'),  # NEW

]
