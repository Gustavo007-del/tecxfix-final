from django.shortcuts import render
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def privacy_policy(request):
    """
    Privacy Policy view for TECHFIX mobile app
    Renders an HTML page with privacy policy information
    """
    return render(request, 'privacy/privacy_policy.html')


@csrf_exempt
def terms_of_service(request):
    """
    Terms of Service view for TECHFIX mobile app
    Renders an HTML page with terms of service information
    """
    return render(request, 'terms/terms_of_service.html')


@csrf_exempt
def user_agreement(request):
    """
    User Agreement view for TECHFIX mobile app
    Renders an HTML page with user agreement information
    """
    return render(request, 'user/user_agreement.html')


@csrf_exempt
def account_deletion_policy(request):
    """
    Account Deletion Policy view for TECHFIX mobile app
    Renders an HTML page with account deletion policy information
    """
    return render(request, 'account/account_deletion_policy.html')
