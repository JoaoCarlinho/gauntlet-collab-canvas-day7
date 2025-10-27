from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_migrate import Migrate
from flask_caching import Cache
import os
import time

db = SQLAlchemy()
socketio = SocketIO()
cors = CORS()
migrate = Migrate()

# Initialize Flask-Caching for Railway-compatible caching
# Using SimpleCache (in-memory) as primary, with diskcache fallback
cache = Cache()

# Cache client for compatibility with existing code
cache_client = None
_cache_initialized = False


class CacheWrapper:
    """Wrapper to provide Redis-like interface for Flask-Caching SimpleCache."""

    def __init__(self, cache_instance):
        self.cache = cache_instance
        self._key_tracker = {}  # Track keys for pattern matching

    def get(self, key):
        """Get value from cache."""
        try:
            value = self.cache.get(key)
            return value.encode('utf-8') if isinstance(value, str) else value
        except:
            return None

    def set(self, key, value, ex=None):
        """Set value in cache with optional expiration."""
        try:
            timeout = ex if ex else 300
            # Decode bytes if needed
            if isinstance(value, bytes):
                value = value.decode('utf-8')
            self.cache.set(key, value, timeout=timeout)
            self._key_tracker[key] = time.time() + timeout
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    def setex(self, key, time_seconds, value):
        """Set value with expiration (Redis-compatible)."""
        return self.set(key, value, ex=time_seconds)

    def delete(self, key):
        """Delete key from cache."""
        try:
            self.cache.delete(key)
            if key in self._key_tracker:
                del self._key_tracker[key]
            return True
        except:
            return False

    def incr(self, key):
        """Increment value in cache."""
        try:
            current = self.cache.get(key)
            if current is None:
                current = 0
            else:
                current = int(current)
            new_value = current + 1
            # Keep existing timeout if key exists
            self.cache.set(key, str(new_value))
            return new_value
        except Exception as e:
            print(f"Cache incr error: {e}")
            return 1

    def keys(self, pattern='*'):
        """Get keys matching pattern (simplified)."""
        try:
            # Clean up expired keys
            current_time = time.time()
            expired = [k for k, exp_time in self._key_tracker.items() if exp_time < current_time]
            for k in expired:
                del self._key_tracker[k]

            # Match pattern (simple implementation)
            if pattern == '*':
                return list(self._key_tracker.keys())
            elif pattern.endswith('*'):
                prefix = pattern[:-1]
                return [k for k in self._key_tracker.keys() if k.startswith(prefix)]
            else:
                # Exact match
                return [pattern] if pattern in self._key_tracker else []
        except Exception as e:
            print(f"Cache keys error: {e}")
            return []

def init_cache(app):
    """Initialize cache with Railway-compatible configuration."""
    global cache_client, _cache_initialized
    
    # Prevent duplicate initialization
    if _cache_initialized:
        return
    
    try:
        # Configure Flask-Caching with SimpleCache (in-memory)
        cache_config = {
            'CACHE_TYPE': 'SimpleCache',
            'CACHE_DEFAULT_TIMEOUT': 300,  # 5 minutes default
            'CACHE_THRESHOLD': 1000,  # Max number of items
        }
        
        # In production, avoid diskcache backend to prevent import errors
        env = os.environ.get('FLASK_ENV', 'production')
        if env != 'production':
            try:
                import diskcache
                cache_config.update({
                    'CACHE_TYPE': 'diskcache',
                    'CACHE_DIR': '/tmp/collabcanvas_cache',
                    'CACHE_DEFAULT_TIMEOUT': 300,
                })
                print("Using diskcache for persistent caching")
            except ImportError:
                print("Using SimpleCache for in-memory caching")
        else:
            print("Production environment: forcing SimpleCache to avoid diskcache import issues")
        
        cache.init_app(app, config=cache_config)

        # Wrap cache with Redis-compatible interface
        cache_client = CacheWrapper(cache)
        _cache_initialized = True

        # Test cache functionality
        cache_client.set('test_key', 'test_value', ex=10)
        test_result = cache_client.get('test_key')
        if test_result:
            print("Cache initialization successful with Redis-compatible wrapper")
        else:
            print("Cache test failed, but continuing")
            
    except Exception as e:
        print(f"Cache initialization failed: {e}")
        print("Continuing without cache - some features may be limited")
        cache_client = None
