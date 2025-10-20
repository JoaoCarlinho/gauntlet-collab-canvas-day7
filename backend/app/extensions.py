from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_migrate import Migrate
from flask_caching import Cache
import os

db = SQLAlchemy()
socketio = SocketIO()
cors = CORS()
migrate = Migrate()

# Initialize Flask-Caching for Railway-compatible caching
# Using SimpleCache (in-memory) as primary, with diskcache fallback
cache = Cache()

# Cache client for compatibility with existing code
cache_client = None

def init_cache(app):
    """Initialize cache with Railway-compatible configuration."""
    global cache_client
    
    try:
        # Configure Flask-Caching with SimpleCache (in-memory)
        cache_config = {
            'CACHE_TYPE': 'SimpleCache',
            'CACHE_DEFAULT_TIMEOUT': 300,  # 5 minutes default
            'CACHE_THRESHOLD': 1000,  # Max number of items
        }
        
        # Try to use diskcache if available for persistence
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
        
        cache.init_app(app, config=cache_config)
        cache_client = cache
        
        # Test cache functionality
        cache.set('test_key', 'test_value', timeout=10)
        test_result = cache.get('test_key')
        if test_result == 'test_value':
            print("Cache initialization successful")
        else:
            print("Cache test failed, but continuing")
            
    except Exception as e:
        print(f"Cache initialization failed: {e}")
        print("Continuing without cache - some features may be limited")
        cache_client = None
