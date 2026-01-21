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
