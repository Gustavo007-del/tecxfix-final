"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

Enhanced with process monitoring for debugging SIGKILL and timeout issues.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os
import logging
import sys
import traceback

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Configure startup logging for WSGI
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(process)d %(thread)d %(message)s'
)
wsgi_logger = logging.getLogger('django.wsgi')

try:
    wsgi_logger.info("=== DJANGO WSGI STARTUP INITIATED ===")
    wsgi_logger.info(f"Python executable: {sys.executable}")
    wsgi_logger.info(f"Python version: {sys.version}")
    wsgi_logger.info(f"Process ID: {os.getpid()}")
    wsgi_logger.info(f"Working directory: {os.getcwd()}")
    wsgi_logger.info(f"Django settings: {os.environ.get('DJANGO_SETTINGS_MODULE')}")
    
    # Import and start process monitoring
    try:
        from .process_monitor import start_process_monitoring, log_system_state
        wsgi_logger.info("Starting process monitoring...")
        start_process_monitoring()
        log_system_state()
        wsgi_logger.info("Process monitoring started successfully")
    except ImportError as e:
        wsgi_logger.warning(f"Process monitoring not available: {e}")
    except Exception as e:
        wsgi_logger.error(f"Process monitoring failed to start: {e}")
        wsgi_logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Get WSGI application
    wsgi_logger.info("Creating WSGI application...")
    application = get_wsgi_application()
    wsgi_logger.info("WSGI application created successfully")
    
    # Log WSGI environment variables (safe ones)
    safe_wsgi_vars = ['SERVER_NAME', 'SERVER_PORT', 'REQUEST_METHOD', 'PATH_INFO']
    wsgi_logger.info("WSGI environment variables will be logged per request")
    
    wsgi_logger.info("=== DJANGO WSGI STARTUP COMPLETED ===")
    
except Exception as e:
    wsgi_logger.error(f"=== DJANGO WSGI STARTUP FAILED ===")
    wsgi_logger.error(f"Error: {e}")
    wsgi_logger.error(f"Traceback: {traceback.format_exc()}")
    raise

# Custom WSGI middleware for additional logging
class WSGIMiddleware:
    def __init__(self, application):
        self.application = application
    
    def __call__(self, environ, start_response):
        try:
            # Log incoming request
            wsgi_logger.info(f"WSGI Request: {environ.get('REQUEST_METHOD', 'Unknown')} {environ.get('PATH_INFO', 'Unknown')}")
            wsgi_logger.info(f"WSGI Server: {environ.get('SERVER_NAME', 'Unknown')}:{environ.get('SERVER_PORT', 'Unknown')}")
            wsgi_logger.info(f"WSGI User-Agent: {environ.get('HTTP_USER_AGENT', 'Unknown')}")
            
            # Call application
            response = self.application(environ, start_response)
            
            # Log response
            wsgi_logger.info(f"WSGI Response processed")
            
            return response
            
        except Exception as e:
            wsgi_logger.error(f"WSGI Error: {e}")
            wsgi_logger.error(f"WSGI Environ: {dict(list(environ.items())[:10])}")  # First 10 items
            raise

# Wrap the application with our middleware
try:
    application = WSGIMiddleware(application)
    wsgi_logger.info("WSGI middleware applied successfully")
except Exception as e:
    wsgi_logger.error(f"Failed to apply WSGI middleware: {e}")
