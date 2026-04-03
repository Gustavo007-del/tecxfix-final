# Database health monitoring and connection debugging utilities
import logging
import time
import psutil
import traceback
from datetime import datetime
from django.db import connection, connections
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger('api.db_health')

class DatabaseHealthMonitor:
    """
    Monitor database connections, query performance, and connection health
    for debugging timeout and connection issues
    """
    
    def __init__(self):
        self.connection_stats = {
            'total_queries': 0,
            'slow_queries': 0,
            'connection_errors': 0,
            'last_check': None
        }
    
    def check_database_health(self):
        """Comprehensive database health check with detailed timing"""
        start_time = time.time()
        logger.info("=== DATABASE HEALTH CHECK START ===")
        logger.info(f"[TIMING] DB health check started at: {time.strftime('%H:%M:%S.%f', time.gmtime())}")
        
        try:
            # Test basic connection
            logger.info("[TIMING] Testing database connection...")
            conn_start = time.time()
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                
            conn_time = time.time() - conn_start
            logger.info(f"[TIMING] Database connection established in: {conn_time:.3f}s")
            logger.info(f"Database connection test: {result}")
            
            # Get connection info
            info_start = time.time()
            db_settings = connection.settings_dict
            logger.info(f"Database engine: {db_settings.get('ENGINE', 'Unknown')}")
            logger.info(f"Database name: {db_settings.get('NAME', 'Unknown')}")
            logger.info(f"Database host: {db_settings.get('HOST', 'Unknown')}")
            logger.info(f"Database port: {db_settings.get('PORT', 'Unknown')}")
            logger.info(f"Connection max age: {db_settings.get('conn_max_age', 'Not set')}")
            info_time = time.time() - info_start
            logger.info(f"[TIMING] Connection info gathered in: {info_time:.3f}s")
            
            # Check connection pool status
            pool_start = time.time()
            if hasattr(connection, 'connection') and connection.connection:
                logger.info("Database connection is active")
            else:
                logger.warning("Database connection is not established")
            pool_time = time.time() - pool_start
            logger.info(f"[TIMING] Connection pool status checked in: {pool_time:.3f}s")
            
            # Test query performance
            self._test_query_performance()
            
            # Check for long-running connections
            self._check_connection_age()
            
            # Test cache connectivity
            cache_start = time.time()
            logger.info("[TIMING] Testing cache connectivity...")
            self._test_cache_health()
            cache_time = time.time() - cache_start
            logger.info(f"[TIMING] Cache health check completed in: {cache_time:.3f}s")
            
            duration = time.time() - start_time
            logger.info(f"=== DATABASE HEALTH CHECK COMPLETED === Duration: {duration:.2f}s")
            
            return {
                'status': 'healthy',
                'duration': duration,
                'connection_time': conn_time,
                'cache_time': cache_time,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"=== DATABASE HEALTH CHECK FAILED === Duration: {duration:.2f}s")
            logger.error(f"[TIMING] DB health check failed after: {duration:.3f}s")
            logger.error(f"Error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            self.connection_stats['connection_errors'] += 1
            
            return {
                'status': 'unhealthy',
                'error': str(e),
                'duration': duration,
                'timestamp': datetime.now().isoformat()
            }
    
    def _test_query_performance(self):
        """Test basic query performance with detailed timing"""
        try:
            # Test simple query
            logger.info("[TIMING] Testing simple query performance...")
            simple_start = time.time()
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT version()")
                version = cursor.fetchone()
            
            simple_time = time.time() - simple_start
            logger.info(f"Database version: {version[0] if version else 'Unknown'}")
            logger.info(f"[TIMING] Simple query time: {simple_time:.3f}s")
            
            if simple_time > 1.0:
                logger.warning(f"Slow simple query detected: {simple_time:.3f}s")
                self.connection_stats['slow_queries'] += 1
            
            # Test table access (safe query)
            logger.info("[TIMING] Testing table access performance...")
            table_start = time.time()
            
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    LIMIT 5
                """)
                tables = cursor.fetchall()
            
            table_time = time.time() - table_start
            logger.info(f"Accessible tables (sample): {[t[0] for t in tables]}")
            logger.info(f"[TIMING] Table query time: {table_time:.3f}s")
            
            if table_time > 2.0:
                logger.warning(f"Slow table query detected: {table_time:.3f}s")
                self.connection_stats['slow_queries'] += 1
            
            # Test connection latency
            logger.info("[TIMING] Testing connection latency...")
            latency_start = time.time()
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 as ping")
                ping_result = cursor.fetchone()
            
            latency_time = time.time() - latency_start
            logger.info(f"[TIMING] Connection latency: {latency_time:.3f}s")
            
            if latency_time > 0.5:
                logger.warning(f"High connection latency: {latency_time:.3f}s")
            
            self.connection_stats['total_queries'] += 3
            
        except Exception as e:
            logger.error(f"Query performance test failed: {e}")
            logger.error(f"[TIMING] Query performance test failed")
    
    def _check_connection_age(self):
        """Check database connection age"""
        try:
            if hasattr(connection, 'connection') and connection.connection:
                # For PostgreSQL, we can check connection age
                with connection.cursor() as cursor:
                    cursor.execute("SELECT now() - pg_postmaster_start_time()")
                    age_result = cursor.fetchone()
                    if age_result:
                        logger.info(f"Database server uptime: {age_result[0]}")
        except Exception as e:
            logger.debug(f"Connection age check failed: {e}")
    
    def _test_cache_health(self):
        """Test cache system health"""
        try:
            start_time = time.time()
            
            # Test cache set/get
            test_key = 'db_health_test'
            test_value = {'timestamp': datetime.now().isoformat()}
            
            cache.set(test_key, test_value, 60)
            cached_value = cache.get(test_key)
            
            if cached_value == test_value:
                logger.info("Cache system: HEALTHY")
            else:
                logger.warning("Cache system: INCONSISTENT")
            
            cache.delete(test_key)
            
            cache_time = time.time() - start_time
            logger.info(f"Cache test time: {cache_time:.3f}s")
            
        except Exception as e:
            logger.error(f"Cache health test failed: {e}")
    
    def log_connection_stats(self):
        """Log accumulated connection statistics"""
        logger.info("=== DATABASE CONNECTION STATS ===")
        logger.info(f"Total queries: {self.connection_stats['total_queries']}")
        logger.info(f"Slow queries: {self.connection_stats['slow_queries']}")
        logger.info(f"Connection errors: {self.connection_stats['connection_errors']}")
        logger.info(f"Last check: {self.connection_stats['last_check']}")
        self.connection_stats['last_check'] = datetime.now().isoformat()

# Global instance for monitoring
db_health_monitor = DatabaseHealthMonitor()

def log_database_queries():
    """Log all database queries for debugging"""
    from django.db import connection
    
    if hasattr(connection, 'queries') and connection.queries:
        logger.info(f"=== DATABASE QUERIES LOG ===")
        logger.info(f"Total queries in this request: {len(connection.queries)}")
        
        for i, query in enumerate(connection.queries):
            query_time = float(query.get('time', 0))
            sql = query.get('sql', '')
            
            log_level = logging.WARNING if query_time > 0.5 else logging.DEBUG
            logger.log(log_level, f"Query {i+1}: {query_time:.3f}s - {sql[:200]}...")
            
            if query_time > 1.0:
                logger.error(f"SLOW QUERY DETECTED: {query_time:.3f}s - {sql}")

class DatabaseConnectionMiddleware:
    """
    Middleware to monitor database connections and log health
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Check database health before request
        if 'health' in request.path.lower() or request.path == '/':
            db_health_monitor.check_database_health()
        
        response = self.get_response(request)
        
        # Log queries after request
        log_database_queries()
        
        return response
