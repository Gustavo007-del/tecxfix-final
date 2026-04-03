# Process monitoring and signal handling for debugging SIGKILL and timeout issues
import os
import sys
import signal
import logging
import time
import psutil
import traceback
import threading
from datetime import datetime

logger = logging.getLogger('django.process_monitor')

class ProcessMonitor:
    """
    Monitor process health, memory usage, and handle signals gracefully
    """
    
    def __init__(self):
        self.start_time = time.time()
        self.process = psutil.Process(os.getpid())
        self.memory_samples = []
        self.shutdown_requested = False
        self.monitoring_thread = None
        self.running = False
        
    def start_monitoring(self):
        """Start background monitoring thread"""
        if not self.running:
            self.running = True
            self.monitoring_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitoring_thread.start()
            logger.info("Process monitoring started")
    
    def stop_monitoring(self):
        """Stop background monitoring"""
        self.running = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        logger.info("Process monitoring stopped")
    
    def _monitor_loop(self):
        """Background monitoring loop"""
        while self.running:
            try:
                # Sample memory usage
                memory_info = self.process.memory_info()
                memory_mb = memory_info.rss / 1024 / 1024
                
                self.memory_samples.append({
                    'timestamp': datetime.now().isoformat(),
                    'memory_mb': memory_mb,
                    'cpu_percent': self.process.cpu_percent()
                })
                
                # Keep only last 50 samples (reduced for memory optimization)
                if len(self.memory_samples) > 50:
                    self.memory_samples = self.memory_samples[-50:]
                
                # Alert on high memory usage (adjusted for 500MB Render free tier)
                if memory_mb > 250:
                    logger.warning(f"HIGH MEMORY USAGE MONITOR: {memory_mb:.1f}MB")
                
                if memory_mb > 400:  # 400MB critical threshold for Render free tier
                    logger.error(f"CRITICAL MEMORY USAGE MONITOR: {memory_mb:.1f}MB - SIGKILL risk imminent on Render free tier")
                    self._emergency_log()
                
                # Check for zombie processes
                self._check_process_health()
                
                time.sleep(60)  # Monitor every 60 seconds (reduced frequency for memory optimization)
                
            except Exception as e:
                logger.error(f"Process monitoring error: {e}")
                time.sleep(60)
    
    def _check_process_health(self):
        """Check overall process health"""
        try:
            # Check if process is still responsive
            cpu_percent = self.process.cpu_percent()
            
            # Check for unusual CPU usage (possible infinite loop)
            if cpu_percent > 95:
                logger.warning(f"High CPU usage detected: {cpu_percent}%")
            
            # Check process age
            uptime = time.time() - self.process.create_time()
            if uptime > 3600:  # 1 hour
                logger.info(f"Process uptime: {uptime/3600:.1f} hours")
            
            # Check thread count
            thread_count = self.process.num_threads()
            if thread_count > 50:
                logger.warning(f"High thread count: {thread_count}")
                
        except Exception as e:
            logger.error(f"Process health check failed: {e}")
    
    def _emergency_log(self):
        """Emergency logging when critical issues detected"""
        logger.error("=== EMERGENCY PROCESS LOG ===")
        logger.error(f"Process ID: {os.getpid()}")
        logger.error(f"Parent Process ID: {os.getppid()}")
        logger.error(f"Memory: {self.process.memory_info().rss / 1024 / 1024:.1f}MB")
        logger.error(f"CPU: {self.process.cpu_percent()}%")
        logger.error(f"Threads: {self.process.num_threads()}")
        logger.error(f"Open file descriptors: {self.process.num_fds()}")
        logger.error(f"Uptime: {time.time() - self.start_time:.1f}s")
        logger.error(f"Python version: {sys.version}")
        logger.error(f"Command line: {' '.join(sys.argv)}")
        logger.error(f"Environment variables: {len(os.environ)}")
        logger.error(f"Traceback: {traceback.format_stack()}")
        logger.error("=== END EMERGENCY LOG ===")
    
    def get_memory_stats(self):
        """Get memory usage statistics"""
        if not self.memory_samples:
            return {}
        
        memory_values = [s['memory_mb'] for s in self.memory_samples]
        return {
            'current': memory_values[-1],
            'average': sum(memory_values) / len(memory_values),
            'min': min(memory_values),
            'max': max(memory_values),
            'samples_count': len(memory_values)
        }
    
    def handle_shutdown(self, signum, frame):
        """Handle shutdown signals"""
        logger.error(f"=== PROCESS SHUTDOWN INITIATED ===")
        logger.error(f"Signal received: {signum}")
        logger.error(f"Process uptime: {time.time() - self.start_time:.1f}s")
        logger.error(f"Memory at shutdown: {self.process.memory_info().rss / 1024 / 1024:.1f}MB")
        logger.error(f"Traceback: {traceback.format_stack()}")
        
        self.shutdown_requested = True
        self.stop_monitoring()
        
        # Give some time for cleanup
        time.sleep(2)
        
        logger.error("=== PROCESS SHUTDOWN COMPLETE ===")

# Global process monitor instance
process_monitor = ProcessMonitor()

def setup_signal_handlers():
    """Setup signal handlers for debugging"""
    logger.info("Setting up signal handlers...")
    
    # Handle common signals
    signals_to_handle = [
        signal.SIGTERM,  # Termination signal
        signal.SIGINT,   # Interrupt signal (Ctrl+C)
        signal.SIGUSR1,  # Custom signal for debugging
    ]
    
    for sig in signals_to_handle:
        try:
            signal.signal(sig, process_monitor.handle_shutdown)
            logger.info(f"Signal handler registered for {sig}")
        except (ValueError, OSError) as e:
            logger.warning(f"Could not register handler for {sig}: {e}")
    
    # Handle SIGUSR1 for manual debugging trigger
    def debug_handler(signum, frame):
        logger.info("=== MANUAL DEBUG TRIGGERED ===")
        process_monitor._emergency_log()
        logger.info("=== END MANUAL DEBUG ===")
    
    try:
        signal.signal(signal.SIGUSR1, debug_handler)
        logger.info("Debug handler registered for SIGUSR1")
    except (ValueError, OSError):
        pass

def start_process_monitoring():
    """Start process monitoring"""
    setup_signal_handlers()
    process_monitor.start_monitoring()
    logger.info("Process monitoring system initialized")

def log_system_state():
    """Log comprehensive system state"""
    logger.info("=== SYSTEM STATE LOG ===")
    
    try:
        # Process information
        logger.info(f"Process ID: {os.getpid()}")
        logger.info(f"Parent Process ID: {os.getppid()}")
        logger.info(f"Process user: {os.getuid() if hasattr(os, 'getuid') else 'Unknown'}")
        
        # Memory information
        memory_info = psutil.virtual_memory()
        logger.info(f"System memory total: {memory_info.total / 1024 / 1024 / 1024:.1f}GB")
        logger.info(f"System memory available: {memory_info.available / 1024 / 1024 / 1024:.1f}GB")
        logger.info(f"System memory percent: {memory_info.percent}%")
        
        # CPU information
        logger.info(f"CPU count: {psutil.cpu_count()}")
        logger.info(f"CPU percent: {psutil.cpu_percent()}%")
        
        # Disk information
        disk_usage = psutil.disk_usage('/')
        logger.info(f"Disk usage: {disk_usage.used / 1024 / 1024 / 1024:.1f}GB / {disk_usage.total / 1024 / 1024 / 1024:.1f}GB")
        
        # Network connections
        try:
            connections = len(psutil.net_connections())
            logger.info(f"Network connections: {connections}")
        except:
            logger.info("Network connections: Permission denied")
        
        # Python environment
        logger.info(f"Python executable: {sys.executable}")
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Python path: {sys.path[:3]}...")  # First 3 entries
        
        # Environment variables (safe ones)
        safe_env_vars = ['DEBUG', 'DATABASE_URL', 'SECRET_KEY', 'ALLOWED_HOSTS']
        for var in safe_env_vars:
            value = os.environ.get(var, 'Not set')
            if var in ['SECRET_KEY', 'DATABASE_URL']:
                value = 'SET' if value != 'Not set' else 'NOT_SET'
            logger.info(f"{var}: {value}")
        
    except Exception as e:
        logger.error(f"Error logging system state: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
    
    logger.info("=== END SYSTEM STATE LOG ===")
