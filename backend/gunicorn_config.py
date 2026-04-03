# Gunicorn configuration file for optimized performance
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8000"

# Worker processes
workers = min(2, multiprocessing.cpu_count() + 1)  # Limit workers for memory efficiency
worker_class = "sync"
worker_connections = 1000

# Timeout settings
timeout = 25  # 25 seconds (less than Django's 30s)
keepalive = 2
graceful_timeout = 20

# Memory management
max_requests = 500  # Restart workers after 500 requests to prevent memory leaks
max_requests_jitter = 50  # Add randomness to prevent all workers restarting at once

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'techfix_gunicorn'

# Server mechanics
daemon = False
pidfile = '/tmp/gunicorn.pid'
user = None
group = None
tmp_upload_dir = None

# SSL (if needed)
keyfile = None
certfile = None

# Preload app for better memory management
preload_app = True

# Worker temp directory
worker_tmp_dir = '/dev/shm'

# Limit request size to prevent memory issues
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Graceful shutdown
preload_app = True
worker_exit_timeout = 10

# Environment
raw_env = [
    'DJANGO_SETTINGS_MODULE=backend.settings',
]
