#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import logging
import signal
import psutil
import traceback
import time
from datetime import datetime

# Configure startup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(process)d %(thread)d %(message)s'
)
startup_logger = logging.getLogger('django.startup')

def signal_handler(signum, frame):
    """Handle signals for debugging SIGKILL/SIGTERM"""
    startup_logger.error(f"Received signal {signum} at {datetime.now()}")
    startup_logger.error(f"Traceback: {traceback.format_stack()}")
    if signum == signal.SIGTERM:
        startup_logger.error("SIGTERM received - graceful shutdown initiated")
    elif signum == signal.SIGINT:
        startup_logger.error("SIGINT received - interrupt signal")
    
# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

def log_system_info():
    """Log system information at startup"""
    try:
        process = psutil.Process()
        memory_info = process.memory_info()
        startup_logger.info(f"=== DJANGO STARTUP INITIATED ===")
        startup_logger.info(f"Process ID: {os.getpid()}")
        startup_logger.info(f"Parent Process ID: {os.getppid()}")
        startup_logger.info(f"Memory usage: {memory_info.rss / 1024 / 1024:.1f} MB")
        startup_logger.info(f"CPU count: {psutil.cpu_count()}")
        startup_logger.info(f"Working directory: {os.getcwd()}")
        startup_logger.info(f"Python executable: {sys.executable}")
        startup_logger.info(f"Django settings module: {os.environ.get('DJANGO_SETTINGS_MODULE', 'Not set')}")
        
        # Log environment variables (safe ones)
        env_vars = {
            'DEBUG': os.environ.get('DEBUG', 'Not set'),
            'DATABASE_URL': 'SET' if os.environ.get('DATABASE_URL') else 'NOT_SET',
            'SECRET_KEY': 'SET' if os.environ.get('SECRET_KEY') else 'NOT_SET',
            'GOOGLE_SERVICE_ACCOUNT_JSON': 'SET' if os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON') else 'NOT_SET',
            'ALLOWED_HOSTS': os.environ.get('ALLOWED_HOSTS', 'Not set'),
        }
        startup_logger.info(f"Environment variables: {env_vars}")
        
    except Exception as e:
        startup_logger.error(f"Error logging system info: {e}")

def main():
    """Run administrative tasks."""
    log_system_info()
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    startup_logger.info("Django settings module set")
    
    try:
        # Time the imports
        import_start = time.time()
        startup_logger.info(f"[TIMING] Starting Django imports at: {time.strftime('%H:%M:%S', time.gmtime())}")
        
        startup_logger.info("Importing Django management commands...")
        django_start = time.time()
        from django.core.management import execute_from_command_line
        django_time = time.time() - django_start
        startup_logger.info(f"[TIMING] Django core import completed in: {django_time:.3f}s")
        
        startup_logger.info("Django imported successfully")
        
        # Log the command being executed
        if len(sys.argv) > 1:
            startup_logger.info(f"Executing Django command: {' '.join(sys.argv[1:])}")
        
        import_time = time.time() - import_start
        startup_logger.info(f"[TIMING] All imports completed in: {import_time:.3f}s")
        
    except ImportError as exc:
        import_time = time.time() - import_start
        startup_logger.error(f"Django import failed after: {import_time:.3f}s")
        startup_logger.error(f"Django import failed: {exc}")
        startup_logger.error(f"Python path: {sys.path}")
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    except Exception as e:
        import_time = time.time() - import_start
        startup_logger.error(f"Unexpected error during Django startup after: {import_time:.3f}s")
        startup_logger.error(f"Unexpected error during Django startup: {e}")
        startup_logger.error(f"Traceback: {traceback.format_exc()}")
        raise
    
    try:
        # Time the command execution
        exec_start = time.time()
        startup_logger.info(f"[TIMING] Starting Django command execution at: {time.strftime('%H:%M:%S', time.gmtime())}")
        
        execute_from_command_line(sys.argv)
        
        exec_time = time.time() - exec_start
        startup_logger.info(f"[TIMING] Django command completed in: {exec_time:.3f}s")
        startup_logger.info("Django command completed successfully")
    except Exception as e:
        exec_time = time.time() - exec_start
        startup_logger.error(f"Django command failed after: {exec_time:.3f}s")
        startup_logger.error(f"Django command failed: {e}")
        startup_logger.error(f"Traceback: {traceback.format_exc()}")
        raise
    finally:
        total_time = time.time() - import_start
        startup_logger.info(f"[TIMING] Total Django process time: {total_time:.3f}s")
        startup_logger.info("=== DJANGO PROCESS ENDING ===")


if __name__ == '__main__':
    main()
