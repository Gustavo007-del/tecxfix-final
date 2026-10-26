from django.urls import path
from api.views import process_pending_complaints, get_complaint_processing_status, approve_sales_request, reject_sales_request

urlpatterns = [
    path('process/', process_pending_complaints),
    path('status/', get_complaint_processing_status),
    path('sales/<int:request_id>/approve/', approve_sales_request),
    path('sales/<int:request_id>/reject/', reject_sales_request),
]
