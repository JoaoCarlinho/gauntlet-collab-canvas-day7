"""
Rate limiting middleware for CollabCanvas API
Provides comprehensive rate limiting to prevent abuse and DoS attacks
"""

from flask import request, jsonify, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from functools import wraps
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class RateLimitingService:
    """Service for managing rate limiting across the application."""
    
    def __init__(self, app=None, cache_client=None):
        self.app = app
        self.cache_client = cache_client
        self.limiter = None
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize rate limiting with Flask app."""
        self.app = app
        
        # Use memory-based storage for Railway compatibility
        storage_uri = "memory://"
        
        try:
            # Initialize Flask-Limiter with memory storage
            self.limiter = Limiter(
                app=app,
                key_func=self._get_rate_limit_key,
                storage_uri=storage_uri,
                default_limits=["100 per minute"],
                headers_enabled=True,
                retry_after="delta-seconds"
            )
            
            logger.info("Rate limiting initialized with memory backend")
            
        except Exception as e:
            logger.warning(f"Rate limiting initialization failed: {str(e)}")
            self.limiter = None
    
    def _get_rate_limit_key(self) -> str:
        """Get rate limiting key based on user authentication."""
        # Try to get user ID from request context
        if hasattr(g, 'current_user') and g.current_user:
            return f"user:{g.current_user.id}"
        
        # Fall back to IP address
        return get_remote_address()
    
    def _rate_limit_error_handler(self, request_limit):
        """Handle rate limit exceeded errors."""
        return jsonify({
            'error': 'Rate limit exceeded',
            'message': f'Too many requests. Limit: {request_limit.limit}',
            'retry_after': request_limit.reset_at
        }), 429
    
    def get_limiter(self) -> Limiter:
        """Get the Flask-Limiter instance."""
        return self.limiter


# Global rate limiting service instance
rate_limiting_service = RateLimitingService()


def init_rate_limiting(app):
    """Initialize rate limiting for the Flask app."""
    rate_limiting_service.init_app(app)
    return rate_limiting_service


def get_rate_limiter() -> Limiter:
    """Get the rate limiter instance."""
    return rate_limiting_service.get_limiter()


# Rate limiting decorators for different endpoint types
def api_rate_limit(limit: str):
    """Decorator for API endpoint rate limiting."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            limiter = get_rate_limiter()
            return limiter.limit(limit)(f)(*args, **kwargs)
        return decorated_function
    return decorator


def socket_rate_limit(limit: str):
    """Decorator for Socket.IO event rate limiting."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # For socket events, we'll implement custom rate limiting
            # since Flask-Limiter doesn't work directly with Socket.IO
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# Specific rate limiting configurations
class RateLimitConfig:
    """Configuration for different types of rate limits."""
    
    # API endpoint limits
    AUTH_LIMITS = {
        'login': '5 per minute',
        'register': '3 per minute',
        'refresh_token': '10 per minute',
        'get_user': '30 per minute',
        'verify': '20 per minute'
    }
    
    COLLABORATION_LIMITS = {
        'invite': '5 per minute',
        'accept_invitation': '10 per minute',
        'decline_invitation': '10 per minute',
        'presence_update': '10 per minute',
        'get_invitations': '30 per minute',
        'get_canvas_invitations': '30 per minute',
        'resend_invitation': '5 per minute',
        'get_collaborators': '30 per minute',
        'update_collaborator_permission': '10 per minute',
        'remove_collaborator': '10 per minute'
    }
    
    CANVAS_LIMITS = {
        'create': '10 per minute',
        'update': '20 per minute',
        'delete': '5 per minute',
        'list': '30 per minute',
        'get_all': '30 per minute',
        'get': '50 per minute',
        'get_objects': '50 per minute'
    }
    
    OBJECT_LIMITS = {
        'create': '50 per minute',
        'update': '100 per minute',
        'delete': '20 per minute',
        'list': '100 per minute',
        'get': '100 per minute'
    }
    
    AI_LIMITS = {
        'create_canvas': '10 per minute',  # Increased for better UX
        'health': '60 per minute',         # Increased for monitoring
        'models': '20 per minute',         # Increased for model selection
        'performance': '30 per minute'     # New endpoint for performance metrics
    }
    
    # Socket.IO event limits
    SOCKET_LIMITS = {
        'cursor_move': '100 per minute',
        'object_created': '30 per minute',
        'object_updated': '50 per minute',
        'object_deleted': '20 per minute',
        'user_online': '5 per minute',
        'user_offline': '5 per minute',
        'presence_update': '10 per minute'
    }
    
    # Global limits
    GLOBAL_LIMITS = {
        'api_requests': '100 per minute',
        'socket_events': '1000 per minute',
        'file_uploads': '10 per hour'
    }


class SocketRateLimiter:
    """Custom rate limiter for Socket.IO events using in-memory storage."""
    
    def __init__(self, cache_client=None):
        self.cache_client = cache_client
        self.rate_limits = RateLimitConfig.SOCKET_LIMITS
        self._memory_store = {}  # In-memory fallback storage
    
    def is_allowed(self, user_id: str, event_type: str) -> bool:
        """
        Check if a socket event is allowed based on rate limits.
        
        Args:
            user_id: User ID making the request
            event_type: Type of socket event
            
        Returns:
            True if event is allowed, False if rate limited
        """
        if event_type not in self.rate_limits:
            # If no specific limit, use global socket limit
            limit_str = self.rate_limits.get('socket_events', '1000 per minute')
        else:
            limit_str = self.rate_limits[event_type]
        
        # Parse limit string (e.g., "100 per minute")
        try:
            limit_parts = limit_str.split(' per ')
            limit_count = int(limit_parts[0])
            limit_period = limit_parts[1]
            
            # Convert period to seconds
            period_seconds = self._period_to_seconds(limit_period)
            
            # Create rate limit key
            key = f"socket_rate_limit:{user_id}:{event_type}"
            
            # Use cache if available, otherwise use memory store
            if self.cache_client:
                try:
                    # Check current count using cache
                    current_count = self.cache_client.get(key)
                    if current_count is None:
                        # First request in this period
                        self.cache_client.set(key, 1, timeout=period_seconds)
                        return True
                    
                    current_count = int(current_count)
                    if current_count >= limit_count:
                        # Rate limit exceeded
                        return False
                    
                    # Increment counter
                    self.cache_client.set(key, current_count + 1, timeout=period_seconds)
                    return True
                except Exception as e:
                    logger.warning(f"Cache error in socket rate limiting: {str(e)}")
                    # Fall back to memory store
            
            # Use in-memory storage as fallback
            import time
            current_time = time.time()
            
            if key not in self._memory_store:
                self._memory_store[key] = {'count': 1, 'expires': current_time + period_seconds}
                return True
            
            store_data = self._memory_store[key]
            if current_time > store_data['expires']:
                # Expired, reset counter
                self._memory_store[key] = {'count': 1, 'expires': current_time + period_seconds}
                return True
            
            if store_data['count'] >= limit_count:
                # Rate limit exceeded
                return False
            
            # Increment counter
            store_data['count'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Error checking socket rate limit: {str(e)}")
            # On error, allow the request
            return True
    
    def _period_to_seconds(self, period: str) -> int:
        """Convert period string to seconds."""
        period_map = {
            'second': 1,
            'minute': 60,
            'hour': 3600,
            'day': 86400
        }
        
        # Handle plural forms
        if period.endswith('s'):
            period = period[:-1]
        
        return period_map.get(period, 60)  # Default to 1 minute


# Global socket rate limiter instance
socket_rate_limiter = SocketRateLimiter()


def init_socket_rate_limiting(cache_client=None):
    """Initialize socket rate limiting."""
    global socket_rate_limiter
    socket_rate_limiter = SocketRateLimiter(cache_client)


def check_socket_rate_limit(user_id: str, event_type: str) -> bool:
    """Check if a socket event is allowed based on rate limits."""
    return socket_rate_limiter.is_allowed(user_id, event_type)


# Rate limiting decorators for specific endpoints
def collaboration_rate_limit(endpoint: str):
    """Rate limiting decorator for collaboration endpoints."""
    limit = RateLimitConfig.COLLABORATION_LIMITS.get(endpoint, '10 per minute')
    return api_rate_limit(limit)


def canvas_rate_limit(endpoint: str):
    """Rate limiting decorator for canvas endpoints."""
    limit = RateLimitConfig.CANVAS_LIMITS.get(endpoint, '20 per minute')
    return api_rate_limit(limit)


def object_rate_limit(endpoint: str):
    """Rate limiting decorator for object endpoints."""
    limit = RateLimitConfig.OBJECT_LIMITS.get(endpoint, '50 per minute')
    return api_rate_limit(limit)


def auth_rate_limit(endpoint: str):
    """Rate limiting decorator for authentication endpoints."""
    limit = RateLimitConfig.AUTH_LIMITS.get(endpoint, '5 per minute')
    return api_rate_limit(limit)


def ai_rate_limit(endpoint: str):
    """Rate limiting decorator for AI agent endpoints."""
    limit = RateLimitConfig.AI_LIMITS.get(endpoint, '5 per minute')
    return api_rate_limit(limit)


# Utility functions for rate limiting
def get_user_rate_limit_key(user_id: str) -> str:
    """Get rate limiting key for a specific user."""
    return f"user:{user_id}"


def get_ip_rate_limit_key() -> str:
    """Get rate limiting key for the current IP address."""
    return f"ip:{get_remote_address()}"


def is_rate_limited(user_id: Optional[str] = None) -> bool:
    """
    Check if the current request is rate limited.
    
    Args:
        user_id: Optional user ID to check
        
    Returns:
        True if rate limited, False otherwise
    """
    limiter = get_rate_limiter()
    
    if user_id:
        key = get_user_rate_limit_key(user_id)
    else:
        key = get_ip_rate_limit_key()
    
    # This is a simplified check - in practice, you'd use the limiter's
    # internal methods to check if a request would be rate limited
    return False  # Placeholder implementation


def get_rate_limit_info(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get rate limiting information for a user or IP.
    
    Args:
        user_id: Optional user ID
        
    Returns:
        Dictionary with rate limit information
    """
    return {
        'user_id': user_id,
        'ip_address': get_remote_address(),
        'limits': RateLimitConfig.GLOBAL_LIMITS,
        'collaboration_limits': RateLimitConfig.COLLABORATION_LIMITS,
        'canvas_limits': RateLimitConfig.CANVAS_LIMITS,
        'object_limits': RateLimitConfig.OBJECT_LIMITS,
        'socket_limits': RateLimitConfig.SOCKET_LIMITS
    }
