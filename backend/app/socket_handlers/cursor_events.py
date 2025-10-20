from flask_socketio import emit, join_room, leave_room
from app.services.auth_service import AuthService
from app.extensions import redis_client
from app.utils.production_logger import production_logger
from app.utils.railway_logger import railway_logger, log_socket_event, log_cursor_event
from app.schemas.validation_schemas import CursorMoveEventSchema
from app.middleware.rate_limiting import check_socket_rate_limit
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService
from app.utils.socketio_config_optimizer import SocketIOConfigOptimizer
import json

def register_cursor_handlers(socketio):
    """Register cursor-related Socket.IO event handlers."""
    
    # Initialize logger
    # Use production logger for optimized logging
    
    def authenticate_socket_user_quiet(id_token):
        """Authenticate user with minimal logging."""
        try:
            auth_service = AuthService()
            decoded_token = auth_service.verify_token(id_token)
            user = auth_service.get_user_by_id(decoded_token['uid'])
            
            if not user:
                user = auth_service.register_user(id_token)
                production_logger.log_auth(user.id, "registered")
            else:
                production_logger.log_auth(user.id, "authenticated")
            
            return user
        except Exception as e:
            production_logger.log_error(f"Authentication failed", e)
            raise e
    
    def authenticate_socket_user(id_token):
        """Authenticate user for Socket.IO events (Railway-optimized logging)."""
        try:
            # Use Railway-optimized logging instead of print statements
            railway_logger.log('cursor', 10, f"Cursor authentication attempt, token length: {len(id_token) if id_token else 0}")
            
            auth_service = AuthService()
            decoded_token = auth_service.verify_token(id_token)
            user_id = decoded_token.get('uid', 'unknown')
            railway_logger.log('cursor', 10, f"Token verified for user: {user_id}")
            
            user = auth_service.get_user_by_id(decoded_token['uid'])
            if not user:
                railway_logger.log('cursor', 10, "User not found in database, registering...")
                user = auth_service.register_user(id_token)
                railway_logger.log('cursor', 10, f"User registered: {user.email}")
            else:
                railway_logger.log('cursor', 10, f"User found in database: {user.email}")
            
            return user
        except Exception as e:
            railway_logger.log('cursor', 40, f"Socket.IO cursor authentication failed: {str(e)}")
            raise e
    
    @socketio.on('cursor_move')
    def handle_cursor_move(data):
        """Handle cursor movement with parse error prevention and reduced logging."""
        try:
            # Validate message size to prevent parse errors
            if not SocketIOConfigOptimizer.validate_message_size(data, max_size=10000):  # 10KB for cursor data
                railway_logger.log('cursor', 40, "Cursor move message too large, rejecting")
                return
            
            # Sanitize input data to prevent parse errors
            sanitized_data = SocketIOConfigOptimizer.sanitize_message_data(data)
            sanitized_data = SanitizationService.sanitize_socket_event_data(sanitized_data)
            
            # Validate input using schema
            schema = CursorMoveEventSchema()
            try:
                validated_data = schema.load(sanitized_data)
            except ValidationError as e:
                railway_logger.log('cursor', 40, f"Cursor move validation failed: {e.messages}")
                return
            
            canvas_id = validated_data['canvas_id']
            id_token = validated_data['id_token']
            position = validated_data['position']
            timestamp = validated_data.get('timestamp')
            
            # Verify authentication (with reduced logging)
            try:
                user = authenticate_socket_user_quiet(id_token)
            except Exception as e:
                railway_logger.log('cursor', 40, f"Cursor authentication failed: {str(e)}")
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'cursor_move'):
                railway_logger.log('cursor', 40, f"Cursor move rate limit exceeded for user {user.id}")
                return
            
            # Log cursor movement with Railway optimization (high sampling)
            log_cursor_event(user.id, 'move')
            
            # Store cursor position in Redis with size validation
            if redis_client:
                cursor_data = {
                    'user_id': user.id,
                    'user_name': user.name,
                    'position': position,
                    'timestamp': timestamp
                }
                
                # Validate cursor data size
                cursor_json = json.dumps(cursor_data)
                if len(cursor_json.encode('utf-8')) > 1000:  # 1KB limit for cursor data
                    railway_logger.log('cursor', 40, f"Cursor data too large: {len(cursor_json)} bytes")
                    return
                
                redis_client.setex(
                    f'cursor:{canvas_id}:{user.id}',
                    30,  # 30 seconds TTL
                    cursor_json
                )
            
            # Prepare broadcast data with size validation
            broadcast_data = {
                'user_id': user.id,
                'user_name': user.name,
                'position': position,
                'timestamp': timestamp
            }
            
            # Validate broadcast data size to prevent parse errors
            if not SocketIOConfigOptimizer.validate_message_size(broadcast_data, max_size=5000):  # 5KB limit
                railway_logger.log('cursor', 40, "Cursor broadcast data too large, skipping broadcast")
                return
            
            # Sanitize broadcast data
            sanitized_broadcast = SocketIOConfigOptimizer.sanitize_message_data(broadcast_data)
            
            # Broadcast cursor position
            emit('cursor_moved', sanitized_broadcast, room=canvas_id, include_self=False)
            
        except ValidationError as e:
            railway_logger.log('cursor', 40, f"Cursor move validation failed: {e.messages}")
        except Exception as e:
            railway_logger.log('cursor', 40, f"Cursor move handler error: {str(e)}")
            emit('error', {'message': str(e)})
    
    @socketio.on('cursor_leave')
    def handle_cursor_leave(data):
        """Handle cursor leaving the canvas."""
        try:
            canvas_id = data.get('canvas_id')
            id_token = data.get('id_token')
            
            if not all([canvas_id, id_token]):
                return
            
            # Verify authentication (with reduced logging)
            try:
                user = authenticate_socket_user_quiet(id_token)
            except Exception as e:
                production_logger.log_error(f"Cursor leave authentication failed", e)
                return
            
            # Remove cursor from Redis
            if redis_client:
                redis_client.delete(f'cursor:{canvas_id}:{user.id}')
            
            # Notify other users
            emit('cursor_left', {
                'user_id': user.id,
                'user_name': user.name
            }, room=canvas_id, include_self=False)
            
        except Exception as e:
            production_logger.log_error(f"Cursor leave handler error", e)
            emit('error', {'message': str(e)})
    
    @socketio.on('get_cursors')
    def handle_get_cursors(data):
        """Get all active cursors for a canvas."""
        try:
            canvas_id = data.get('canvas_id')
            id_token = data.get('id_token')
            
            if not all([canvas_id, id_token]):
                return
            
            # Verify authentication (with reduced logging)
            try:
                user = authenticate_socket_user_quiet(id_token)
            except Exception as e:
                production_logger.log_error(f"Get cursors authentication failed", e)
                return
            
            # Get all active cursors from Redis
            cursors = []
            if redis_client:
                cursor_keys = redis_client.keys(f'cursor:{canvas_id}:*')
                for key in cursor_keys:
                    cursor_data = redis_client.get(key)
                    if cursor_data:
                        try:
                            cursor_info = json.loads(cursor_data)
                            cursors.append(cursor_info)
                        except json.JSONDecodeError:
                            continue
            
            # Send cursors to the requesting user
            emit('cursors_data', {
                'cursors': cursors
            })
            
        except Exception as e:
            production_logger.log_error(f"Get cursors handler error", e)
            emit('error', {'message': str(e)})
