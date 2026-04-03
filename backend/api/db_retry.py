# Database retry utility for handling connection timeouts
import time
import logging
from functools import wraps
from django.db import OperationalError
from psycopg2 import OperationalError as Psycopg2OperationalError

logger = logging.getLogger('api.db_retry')

def database_retry(max_attempts=3, delay=1):
    """
    Decorator to retry database operations on connection timeouts
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except OperationalError as e:
                    last_exception = e
                    if 'timeout' in str(e).lower() or 'connection' in str(e).lower():
                        if attempt < max_attempts - 1:
                            logger.warning(f"Database connection timeout (attempt {attempt + 1}/{max_attempts}), retrying in {delay}s...")
                            time.sleep(delay)
                            continue
                    else:
                        # Re-raise non-timeout errors immediately
                        raise
                except Psycopg2OperationalError as e:
                    last_exception = e
                    if 'timeout' in str(e).lower() or 'connection' in str(e).lower():
                        if attempt < max_attempts - 1:
                            logger.warning(f"PostgreSQL connection timeout (attempt {attempt + 1}/{max_attempts}), retrying in {delay}s...")
                            time.sleep(delay)
                            continue
                    else:
                        # Re-raise non-timeout errors immediately
                        raise
            
            # All attempts failed
            logger.error(f"Database operation failed after {max_attempts} attempts: {last_exception}")
            raise last_exception
            
        return wrapper
    return decorator
