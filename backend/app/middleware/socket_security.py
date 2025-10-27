"""
Socket.IO Security Middleware
Provides comprehensive security measures for Socket.IO events including authentication,
authorization, rate limiting, and input validation.
"""

import functools
import time
from typing import Dict, Any, Optional, Callable
from flask_socketio import emit
from flask import request
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService, CanvasNotFoundError
from app.extensions import cache_client
from app.schemas.socket_validation_schemas import validate_socket_event_data, get_socket_event_schema
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService
from app.utils.logger import SmartLogger


# Initialize logger
security_logger = SmartLogger('socket_security', 'INFO')

# Use cache_client as redis_client (they're the same)
redis_client = cache_client


class SocketSecurityError(Exception):
    """Custom exception for Socket.IO security violations."""
    pass


class SocketAuthenticationError(SocketSecurityError):
    """Exception for Socket.IO authentication failures."""
    pass


class SocketAuthorizationError(SocketSecurityError):
    """Exception for Socket.IO authorization failures."""
    pass


class SocketRateLimitError(SocketSecurityError):
    """Exception for Socket.IO rate limit violations."""
    pass


# Rate limiting configuration
SOCKET_RATE_LIMITS = {
    'join_canvas': {'limit': 5, 'window': 60},      # 5 per minute
    'leave_canvas': {'limit': 10, 'window': 60},    # 10 per minute
    'object_created': {'limit': 60, 'window': 60},  # 60 per minute (1 per second for normal drawing)
    'object_updated': {'limit': 60, 'window': 60},  # 60 per minute (1 per second for normal editing)
    'object_deleted': {'limit': 20, 'window': 60},  # 20 per minute
    'cursor_move': {'limit': 600, 'window': 60},    # 600 per minute (10 per second for smooth tracking)
    'cursor_leave': {'limit': 10, 'window': 60},    # 10 per minute
    'user_online': {'limit': 5, 'window': 60},      # 5 per minute
    'user_offline': {'limit': 10, 'window': 60},    # 10 per minute
    'presence_update': {'limit': 20, 'window': 60}, # 20 per minute
    'collaboration_invite': {'limit': 5, 'window': 60}, # 5 per minute
    'collaboration_accept': {'limit': 10, 'window': 60}, # 10 per minute
    'collaboration_reject': {'limit': 10, 'window': 60}, # 10 per minute
}


def authenticate_socket_user(id_token: str) -> Any:
    """
    Authenticate user for Socket.IO events with enhanced security.
    
    Args:
        id_token: Firebase ID token
        
    Returns:
        User object if authentication successful
        
    Raises:
        SocketAuthenticationError: If authentication fails
    """
    try:
        if not id_token or len(id_token) < 10:
            raise SocketAuthenticationError("Invalid or missing authentication token")
        
        auth_service = AuthService()
        decoded_token = auth_service.verify_token(id_token)
        
        if not decoded_token or 'uid' not in decoded_token:
            raise SocketAuthenticationError("Invalid token format")
        
        user = auth_service.get_user_by_id(decoded_token['uid'])
        if not user:
            # Register new user
            user = auth_service.register_user(id_token)
            security_logger.log_auth(user.id, "registered_via_socket")
        else:
            security_logger.log_auth(user.id, "authenticated_via_socket")
        
        return user
        
    except Exception as e:
        security_logger.log_error(f"Socket authentication failed: {str(e)}", e)
        raise SocketAuthenticationError(f"Authentication failed: {str(e)}")


def check_canvas_permission(canvas_id: str, user_id: str, permission: str = 'view') -> bool:
    """
    Check if user has permission for canvas operation.

    Args:
        canvas_id: Canvas identifier
        user_id: User identifier
        permission: Required permission level ('view' or 'edit')

    Returns:
        True if user has permission, False otherwise

    Raises:
        CanvasNotFoundError: If canvas does not exist (caller should handle as 404)
    """
    try:
        canvas_service = CanvasService()
        has_permission = canvas_service.check_canvas_permission(canvas_id, user_id, permission)

        if not has_permission:
            security_logger.log_security(
                user_id,
                f"permission_denied_canvas_{permission}",
                f"Canvas: {canvas_id}"
            )

        return has_permission

    except CanvasNotFoundError:
        # Re-raise CanvasNotFoundError so caller can return 404
        # Don't treat as permission error (401)
        security_logger.log_error(f"Canvas not found: {canvas_id}", None)
        raise
    except Exception as e:
        security_logger.log_error(f"Permission check failed: {str(e)}", e)
        return False


def check_socket_rate_limit(user_id: str, event_type: str) -> bool:
    """
    Check if user has exceeded rate limit for Socket.IO event.
    
    Args:
        user_id: User identifier
        event_type: Type of Socket.IO event
        
    Returns:
        True if within rate limit, False if exceeded
    """
    try:
        if not redis_client:
            # Allow if Redis not available (fallback)
            return True
        
        rate_config = SOCKET_RATE_LIMITS.get(event_type)
        if not rate_config:
            # No rate limit configured for this event
            return True
        
        limit = rate_config['limit']
        window = rate_config['window']
        
        # Create rate limit key
        key = f"rate_limit:socket:{user_id}:{event_type}"
        
        # Check current count
        current_count = redis_client.get(key)
        
        if current_count is None:
            # First request in window
            redis_client.setex(key, window, 1)
            return True
        
        current_count = int(current_count)
        
        if current_count >= limit:
            # Rate limit exceeded
            security_logger.log_security(
                user_id, 
                f"rate_limit_exceeded_{event_type}", 
                f"Limit: {limit}/{window}s, Current: {current_count}"
            )
            return False
        
        # Increment counter
        redis_client.incr(key)
        return True
        
    except Exception as e:
        security_logger.log_error(f"Rate limit check failed: {str(e)}", e)
        # Allow on error (fail open)
        return True


def check_anonymous_rate_limit(rate_limit_key: str, event_type: str) -> bool:
    """
    Check rate limit for anonymous users based on IP address.
    
    Args:
        rate_limit_key: Rate limit key (e.g., "anonymous:ip:event_type")
        event_type: Type of Socket.IO event
        
    Returns:
        True if within rate limit, False if exceeded
    """
    try:
        if not redis_client:
            # Allow if Redis not available (fallback)
            return True
        
        # More restrictive limits for anonymous users
        anonymous_limits = {
            'cursor_move': {'limit': 10, 'window': 60},  # 10 per minute
            'object_update': {'limit': 5, 'window': 60},  # 5 per minute
            'join_canvas': {'limit': 3, 'window': 60},   # 3 per minute
            'default': {'limit': 5, 'window': 60}        # 5 per minute default
        }
        
        rate_config = anonymous_limits.get(event_type, anonymous_limits['default'])
        limit = rate_config['limit']
        window = rate_config['window']
        
        # Create rate limit key
        key = f"rate_limit:anonymous:{rate_limit_key}"
        
        # Check current count
        current_count = redis_client.get(key)
        
        if current_count is None:
            # First request in window
            redis_client.setex(key, window, 1)
            return True
        
        current_count = int(current_count)
        
        if current_count >= limit:
            # Rate limit exceeded
            security_logger.log_security(
                rate_limit_key, 
                f"anonymous_rate_limit_exceeded_{event_type}", 
                f"Limit: {limit}/{window}s, Current: {current_count}"
            )
            return False
        
        # Increment counter
        redis_client.incr(key)
        return True
        
    except Exception as e:
        security_logger.log_error(f"Anonymous rate limit check failed: {str(e)}", e)
        # Allow on error (fail open)
        return True


def sanitize_socket_event_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize Socket.IO event data to prevent XSS and injection attacks.

    Args:
        data: Raw event data

    Returns:
        Sanitized event data
    """
    try:
        # Fields that should NOT be sanitized (authentication tokens, IDs, etc.)
        SKIP_SANITIZATION_FIELDS = {
            'id_token',  # Firebase JWT token - must not be modified
            'canvas_id',  # UUID/ID fields already validated by schema
            'object_id',
            'user_id',
            'invitation_id',
            '_token_metadata',  # Metadata fields
            '_authenticated_user',
            '_token_issues',
            '_token_optimization_applied'
        }

        sanitized = {}

        for key, value in data.items():
            # Skip sanitization for specific fields
            if key in SKIP_SANITIZATION_FIELDS:
                sanitized[key] = value
            elif isinstance(value, str):
                # Sanitize string values
                sanitized[key] = SanitizationService.sanitize_html(value)
            elif isinstance(value, dict):
                # Recursively sanitize nested dictionaries
                sanitized[key] = sanitize_socket_event_data(value)
            elif isinstance(value, list):
                # Sanitize list items
                sanitized_list = []
                for item in value:
                    if isinstance(item, dict):
                        sanitized_list.append(sanitize_socket_event_data(item))
                    elif isinstance(item, str):
                        sanitized_list.append(SanitizationService.sanitize_html(item))
                    else:
                        sanitized_list.append(item)
                sanitized[key] = sanitized_list
            else:
                # Keep non-string values as-is
                sanitized[key] = value

        return sanitized
        
    except Exception as e:
        security_logger.log_error(f"Data sanitization failed: {str(e)}", e)
        # Return original data on sanitization failure
        return data


def sanitize_broadcast_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize data before broadcasting to other users.
    
    Args:
        data: Data to broadcast
        
    Returns:
        Sanitized broadcast data
    """
    try:
        # Sanitize the data
        sanitized = sanitize_socket_event_data(data)
        
        # Additional security measures for broadcast data
        if 'user' in sanitized and isinstance(sanitized['user'], dict):
            user_data = sanitized['user']
            # Ensure user data is safe for broadcast
            safe_user_data = {
                'id': user_data.get('id'),
                'name': SanitizationService.sanitize_html(user_data.get('name', '')),
                'email': user_data.get('email'),
                'avatar_url': SanitizationService.sanitize_url(user_data.get('avatar_url', ''))
            }
            sanitized['user'] = safe_user_data
        
        return sanitized
        
    except Exception as e:
        security_logger.log_error(f"Broadcast data sanitization failed: {str(e)}", e)
        return data


def validate_socket_input(schema_class):
    """
    Decorator to validate Socket.IO event input data.
    
    Args:
        schema_class: Marshmallow schema class for validation
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(data, *args, **kwargs):
            try:
                # Validate input data
                schema = schema_class()
                validated_data = schema.load(data)
                
                # Sanitize validated data
                sanitized_data = sanitize_socket_event_data(validated_data)
                
                # Call original function with sanitized data
                return func(sanitized_data, *args, **kwargs)
                
            except ValidationError as e:
                security_logger.log_error(f"Input validation failed: {e.messages}", e)
                emit('error', {'message': f'Invalid input data: {e.messages}'})
                return
            except Exception as e:
                security_logger.log_error(f"Input validation error: {str(e)}", e)
                emit('error', {'message': 'Input validation failed'})
                return
        
        return wrapper
    return decorator


def require_socket_auth(func: Callable) -> Callable:
    """
    Decorator to require authentication for Socket.IO events with fallback methods.
    Uses session data set during connection authentication with fallback to direct token validation.
    """
    @functools.wraps(func)
    def wrapper(data, *args, **kwargs):
        try:
            from flask import session
            import time

            # Debug session and data information
            security_logger.log_info(f"Socket event authentication check - Session keys: {list(session.keys())}")
            security_logger.log_info(f"Socket event authentication check - Data keys: {list(data.keys()) if data else 'None'}")
            security_logger.log_info(f"Socket event authentication check - Has id_token: {'id_token' in data if data else False}")
            
            # Try session-based authentication first
            user_data = session.get('authenticated_user')
            
            if not user_data:
                # Fallback to direct token authentication
                id_token = data.get('id_token')
                if id_token:
                    try:
                        security_logger.log_info("Attempting fallback token authentication")
                        auth_service = AuthService()
                        decoded_token = auth_service.verify_token(id_token)
                        user = auth_service.get_user_by_id(decoded_token['uid'])
                        
                        if user:
                            user_data = {
                                'id': user.id,
                                'email': user.email,
                                'name': user.name,
                                'auth_method': 'fallback_token',
                                'authenticated_at': time.time(),
                                'token_uid': decoded_token.get('uid')
                            }
                            # Store in session for future use
                            session['authenticated_user'] = user_data
                            security_logger.log_info(f"Fallback authentication successful for user: {user.email}")
                        else:
                            security_logger.log_warning("Fallback authentication failed: User not found")
                            emit('error', {'message': 'User not found', 'type': 'auth_error'})
                            return
                    except Exception as e:
                        security_logger.log_error(f"Fallback token authentication failed: {str(e)}", e)
                        emit('error', {'message': 'Token authentication failed', 'type': 'auth_error'})
                        return
                else:
                    security_logger.log_warning("Socket event missing authenticated user context and no fallback token")
                    security_logger.log_warning(f"Session contents: {dict(session)}")
                    emit('error', {'message': 'User or canvas ID missing', 'type': 'auth_error'})
                    return
            
            # Validate user data
            if not user_data.get('id') or not user_data.get('email'):
                security_logger.log_warning("Invalid user data in session")
                emit('error', {'message': 'Invalid user data', 'type': 'auth_error'})
                return
            
            # Add user to data for use in handler
            data['_authenticated_user'] = user_data
            security_logger.log_info(f"Socket event authenticated for user: {user_data.get('email', 'unknown')} (method: {user_data.get('auth_method', 'session')})")
            
            return func(data, *args, **kwargs)
            
        except Exception as e:
            security_logger.log_error(f"Socket authentication error: {str(e)}", e)
            emit('error', {'message': 'Authentication error occurred', 'type': 'auth_error'})
            return
    
    return wrapper


def check_canvas_permission_decorator(permission: str = 'view'):
    """
    Decorator to check canvas permissions for Socket.IO events.
    
    Args:
        permission: Required permission level ('view' or 'edit')
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(data, *args, **kwargs):
            try:
                user = data.get('_authenticated_user')
                canvas_id = data.get('canvas_id')

                if not user or not canvas_id:
                    emit('error', {'message': 'User or canvas ID missing', 'type': 'validation_error'})
                    return

                # Check permission (handle both user object and user dict)
                user_id = user.id if hasattr(user, 'id') else user.get('id')
                if not check_canvas_permission(canvas_id, user_id, permission):
                    emit('error', {'message': f'{permission.title()} permission required', 'type': 'permission_error'})
                    return

                return func(data, *args, **kwargs)

            except CanvasNotFoundError as e:
                security_logger.log_warning(f"Canvas not found: {str(e)}")
                emit('error', {
                    'message': 'Canvas not found',
                    'type': 'canvas_not_found',
                    'canvas_id': data.get('canvas_id'),
                    'details': 'The canvas you are trying to access does not exist or has been deleted'
                })
                return
            except Exception as e:
                security_logger.log_error(f"Permission check error: {str(e)}", e)
                emit('error', {'message': 'Permission check failed', 'type': 'permission_error'})
                return
        
        return wrapper
    return decorator


def rate_limit_socket_event(event_type: str):
    """
    Decorator to apply rate limiting to Socket.IO events.
    
    Args:
        event_type: Type of Socket.IO event for rate limiting
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(data, *args, **kwargs):
            try:
                user = data.get('_authenticated_user')
                if not user:
                    # For unauthenticated events, use a default rate limit based on IP or session
                    # This prevents abuse while allowing basic functionality
                    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
                    rate_limit_key = f"anonymous:{client_ip}:{event_type}"
                    
                    # Apply a more restrictive rate limit for anonymous users
                    if not check_anonymous_rate_limit(rate_limit_key, event_type):
                        security_logger.log_warning(f"Anonymous rate limit exceeded for IP {client_ip} on event {event_type}")
                        emit('error', {
                            'message': 'Rate limit exceeded. Please authenticate for higher limits.',
                            'type': 'rate_limit_error',
                            'code': 'ANONYMOUS_RATE_LIMIT'
                        })
                        return
                else:
                    # Check rate limit for authenticated users
                    # Handle both user object and user dict
                    user_id = user.id if hasattr(user, 'id') else user.get('id')
                    if not check_socket_rate_limit(user_id, event_type):
                        rate_config = SOCKET_RATE_LIMITS.get(event_type, {})
                        limit = rate_config.get('limit', 'unknown')
                        window = rate_config.get('window', 'unknown')
                        security_logger.log_warning(f"Rate limit exceeded for user {user_id} on event {event_type}")
                        emit('error', {
                            'message': f'Rate limit exceeded. Limit: {limit} requests per {window} seconds',
                            'type': 'rate_limit_error',
                            'code': 'AUTHENTICATED_RATE_LIMIT'
                        })
                        return
                
                return func(data, *args, **kwargs)
                
            except Exception as e:
                security_logger.log_error(f"Rate limit check error: {str(e)}", e)
                emit('error', {
                    'message': 'Rate limit check failed',
                    'type': 'rate_limit_error',
                    'code': 'RATE_LIMIT_CHECK_ERROR'
                })
                return
        
        return wrapper
    return decorator


def secure_socket_event(event_type: str, permission: str = 'view'):
    """
    Combined decorator for comprehensive Socket.IO event security.
    
    Args:
        event_type: Type of Socket.IO event
        permission: Required permission level ('view' or 'edit')
    """
    def decorator(func: Callable) -> Callable:
        # Get schema for validation
        schema_class = get_socket_event_schema(event_type)

        # Apply all security decorators in correct order
        # NOTE: Decorators are applied bottom-to-top, so execution order is REVERSE
        # Desired execution: validate -> auth -> permission -> rate_limit -> handler
        # So apply in reverse: rate_limit, permission, auth, validate

        func = rate_limit_socket_event(event_type)(func)
        func = check_canvas_permission_decorator(permission)(func)
        func = require_socket_auth(func)

        if schema_class:
            func = validate_socket_input(schema_class)(func)

        return func
    
    return decorator
