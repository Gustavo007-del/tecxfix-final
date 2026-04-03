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
        """Comprehensive database health check"""
        start_time = time.time()
        logger.info("=== DATABASE HEALTH CHECK START ===")
        
        try:
            # Test basic connection
            logger.info("Testing database connection...")
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                logger.info(f"Database connection test: {result}")
            
            # Get connection info
            db_settings = connection.settings_dict
            logger.info(f"Database engine: {db_settings.get('ENGINE', 'Unknown')}")
            logger.info(f"Database name: {db_settings.get('NAME', 'Unknown')}")
            logger.info(f"Database host: {db_settings.get('HOST', 'Unknown')}")
            logger.info(f"Database port: {db_settings.get('PORT', 'Unknown')}")
            logger.info(f"Connection max age: {db_settings.get('conn_max_age', 'Not set')}")
            
            # Check connection pool status
            if hasattr(connection, 'connection') and connection.connection:
                logger.info("Database connection is active")
            else:
                logger.warning("Database connection is not established")
            
            # Test query performance
            self._test_query_performance()
            
            # Check for long-running connections
            self._check_connection_age()
            
            # Test cache connectivity
            self._test_cache_health()
            
            duration = time.time() - start_time
            logger.info(f"=== DATABASE HEALTH CHECK COMPLETED === Duration: {duration:.2f}s")
            
            return {
                'status': 'healthy',
                'duration': duration,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"=== DATABASE HEALTH CHECK FAILED === Duration: {duration:.2f}s")
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
        """Test basic query performance"""
        try:
            start_time = time.time()
            
            # Test simple query
            with connection.cursor() as cursor:
                cursor.execute("SELECT version()")
                version = cursor.fetchone()
                logger.info(f"Database version: {version[0] if version else 'Unknown'}")
            
            query_time = time.time() - start_time
            logger.info(f"Simple query time: {query_time:.3f}s")
            
            if query_time > 1.0:
                logger.warning(f"Slow simple query detected: {query_time:.3f}s")
                self.connection_stats['slow_queries'] += 1
            
            # Test table access (safe query)
            start_time = time.time()
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    LIMIT 5
                """)
                tables = cursor.fetchall()
                logger.info(f"Accessible tables (sample): {[t[0] for t in tables]}")
            
            table_query_time = time.time() - start_time
            logger.info(f"Table query time: {table_query_time:.3f}s")
            
            self.connection_stats['total_queries'] += 2
            
        except Exception as e:
            logger.error(f"Query performance test failed: {e}")
    
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
