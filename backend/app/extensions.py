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
_cache_initialized = False

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
        cache_client = cache
        _cache_initialized = True
        
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
