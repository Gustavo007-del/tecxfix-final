import logging
import time
import traceback
import psutil
import os
from django.utils import timezone

logger = logging.getLogger('api.middleware')

class MemoryAndPerformanceMiddleware:
    """
    Middleware to monitor memory usage, request timing, and performance bottlenecks
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        start_time = time.time()
        process = psutil.Process(os.getpid())
        
        # Log initial memory usage
        memory_before = process.memory_info()
        initial_memory_mb = memory_before.rss / 1024 / 1024
        
        logger.info(f"REQUEST START - {request.method} {request.path} - "
                   f"Memory: {initial_memory_mb:.1f}MB - "
                   f"User: {getattr(request.user, 'username', 'anonymous')}")
        
        try:
            response = self.get_response(request)
            
            # Calculate request duration
            duration = time.time() - start_time
            
            # Log final memory usage
            memory_after = process.memory_info()
            final_memory_mb = memory_after.rss / 1024 / 1024
            memory_delta = final_memory_mb - initial_memory_mb
            
            # Log performance metrics
            log_level = logging.WARNING if duration > 10 else logging.INFO
            logger.log(log_level, 
                      f"REQUEST END - {request.method} {request.path} - "
                      f"Status: {response.status_code} - "
                      f"Duration: {duration:.2f}s - "
                      f"Memory: {initial_memory_mb:.1f}MB → {final_memory_mb:.1f}MB "
                      f"(Δ{memory_delta:+.1f}MB) - "
                      f"User: {getattr(request.user, 'username', 'anonymous')}")
            
            # Add performance headers
            response['X-Response-Time'] = f"{duration:.3f}s"
            response['X-Memory-Usage'] = f"{final_memory_mb:.1f}MB"
            
            # Alert on high memory usage
            if final_memory_mb > 500:  # 500MB threshold
                logger.warning(f"HIGH MEMORY USAGE: {final_memory_mb:.1f}MB - "
                             f"Request: {request.method} {request.path}")
            
            # Alert on slow requests
            if duration > 30:  # 30 second threshold
                logger.error(f"SLOW REQUEST: {duration:.2f}s - "
                           f"Request: {request.method} {request.path} - "
                           f"Memory: {final_memory_mb:.1f}MB")
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            memory_after = process.memory_info()
            final_memory_mb = memory_after.rss / 1024 / 1024
            
            logger.error(f"REQUEST ERROR - {request.method} {request.path} - "
                        f"Duration: {duration:.2f}s - "
                        f"Memory: {initial_memory_mb:.1f}MB → {final_memory_mb:.1f}MB - "
                        f"Error: {str(e)} - "
                        f"User: {getattr(request.user, 'username', 'anonymous')}")
            
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
