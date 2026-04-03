import logging
import time
import traceback
import psutil
import os
import socket
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger('api.middleware')

class MemoryAndPerformanceMiddleware:
    """
    Enhanced middleware to monitor memory usage, request timing, network connectivity,
    and performance bottlenecks for debugging SIGKILL and timeout issues
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        overall_start = time.time()
        process = psutil.Process(os.getpid())
        
        # Log initial memory usage
        memory_before = process.memory_info()
        initial_memory_mb = memory_before.rss / 1024 / 1024
        
        # Get request details
        client_ip = self.get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')
        content_length = request.META.get('CONTENT_LENGTH', '0')
        
        logger.info(f"=== REQUEST START ===")
        logger.info(f"[TIMING] Middleware start at: {time.strftime('%H:%M:%S.%f', time.gmtime())}")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Client IP: {client_ip}")
        logger.info(f"User-Agent: {user_agent}")
        logger.info(f"Content-Length: {content_length}")
        logger.info(f"Initial Memory: {initial_memory_mb:.1f}MB")
        logger.info(f"User: {getattr(request.user, 'username', 'anonymous')}")
        logger.info(f"Process ID: {os.getpid()}")
        logger.info(f"Thread ID: {threading.get_ident()}")
        
        # Test network connectivity for external requests
        network_start = time.time()
        if 'sheets' in request.path.lower() or 'google' in request.path.lower():
            logger.info(f"[TIMING] Starting network connectivity test...")
            self.test_network_connectivity()
            network_time = time.time() - network_start
            logger.info(f"[TIMING] Network connectivity test completed in: {network_time:.3f}s")
        
        try:
            # Time the actual request processing
            request_start = time.time()
            logger.info(f"[TIMING] Passing request to Django view...")
            response = self.get_response(request)
            request_time = time.time() - request_start
            logger.info(f"[TIMING] Django view processing completed in: {request_time:.3f}s")
            
            # Calculate request duration
            duration = time.time() - overall_start
            
            # Log final memory usage
            memory_after = process.memory_info()
            final_memory_mb = memory_after.rss / 1024 / 1024
            memory_delta = final_memory_mb - initial_memory_mb
            
            # Get response details
            response_start = time.time()
            response_size = len(getattr(response, 'content', b''))
            response_processing_time = time.time() - response_start
            
            logger.info(f"=== REQUEST END ===")
            logger.info(f"[TIMING] Overall request duration: {duration:.3f}s")
            logger.info(f"[TIMING] View processing time: {request_time:.3f}s")
            logger.info(f"[TIMING] Response processing time: {response_processing_time:.3f}s")
            logger.info(f"Status: {response.status_code}")
            logger.info(f"Response Size: {response_size} bytes")
            logger.info(f"Memory: {initial_memory_mb:.1f}MB → {final_memory_mb:.1f}MB (Δ{memory_delta:+.1f}MB)")
            logger.info(f"User: {getattr(request.user, 'username', 'anonymous')}")
            
            # Determine log level based on performance (adjusted for 500MB limit)
            if duration > 30 or final_memory_mb > 500:
                log_level = logging.ERROR
            elif duration > 10 or final_memory_mb > 200:
                log_level = logging.WARNING
            else:
                log_level = logging.INFO
            
            logger.log(log_level, 
                      f"REQUEST SUMMARY - {request.method} {request.path} - "
                      f"Status: {response.status_code} - "
                      f"Duration: {duration:.2f}s - "
                      f"Memory: {initial_memory_mb:.1f}MB → {final_memory_mb:.1f}MB "
                      f"(Δ{memory_delta:+.1f}MB) - "
                      f"User: {getattr(request.user, 'username', 'anonymous')}")
            
            # Add performance headers
            header_start = time.time()
            response['X-Response-Time'] = f"{duration:.3f}s"
            response['X-Memory-Usage'] = f"{final_memory_mb:.1f}MB"
            response['X-Process-ID'] = str(os.getpid())
            header_time = time.time() - header_start
            logger.info(f"[TIMING] Header processing time: {header_time:.3f}s")
            
            # Alert on critical issues
            if final_memory_mb > 500:  # 500MB threshold
                logger.error(f"CRITICAL HIGH MEMORY USAGE: {final_memory_mb:.1f}MB - "
                             f"Request: {request.method} {request.path} - "
                             f"Process may be at risk of SIGKILL")
            
            if duration > 30:  # 30 second threshold
                logger.error(f"CRITICAL SLOW REQUEST: {duration:.2f}s - "
                           f"Request: {request.method} {request.path} - "
                           f"Memory: {final_memory_mb:.1f}MB - "
                           f"May cause timeout issues")
            
            logger.info(f"[TIMING] Middleware completed at: {time.strftime('%H:%M:%S.%f', time.gmtime())}")
            return response
            
        except Exception as e:
            duration = time.time() - overall_start
            memory_after = process.memory_info()
            final_memory_mb = memory_after.rss / 1024 / 1024
            
            logger.error(f"=== REQUEST ERROR ===")
            logger.error(f"[TIMING] Error occurred after: {duration:.3f}s")
            logger.error(f"Method: {request.method}")
            logger.error(f"Path: {request.path}")
            logger.error(f"Duration: {duration:.2f}s")
            logger.error(f"Memory: {initial_memory_mb:.1f}MB → {final_memory_mb:.1f}MB")
            logger.error(f"Error: {str(e)}")
            logger.error(f"User: {getattr(request.user, 'username', 'anonymous')}")
            logger.error(f"Process ID: {os.getpid()}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def get_client_ip(self, request):
        """Get the real client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def test_network_connectivity(self):
        """Test network connectivity for external service requests"""
        try:
            # Test DNS resolution
            socket.gethostbyname('www.googleapis.com')
            logger.info("Network test - DNS resolution: OK")
            
            # Test HTTP connection
            test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_socket.settimeout(5)
            result = test_socket.connect_ex(('www.googleapis.com', 443))
            test_socket.close()
            
            if result == 0:
                logger.info("Network test - HTTPS connection: OK")
            else:
                logger.warning(f"Network test - HTTPS connection failed: {result}")
                
        except Exception as e:
            logger.error(f"Network connectivity test failed: {e}")

# Import threading for thread ID logging
import threading
