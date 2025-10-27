from flask_socketio import emit, join_room, leave_room
from app.services.auth_service import AuthService
from app.extensions import cache_client
from app.services.sanitization_service import SanitizationService
from app.middleware.rate_limiting import check_socket_rate_limit
from app.utils.railway_logger import railway_logger, log_socket_event
from app.utils.socketio_config_optimizer import SocketIOConfigOptimizer
from app.services.token_optimization_service import token_optimization_service
import json

def register_presence_handlers(socketio):
    """Register presence-related Socket.IO event handlers."""
    
    def authenticate_socket_user(id_token):
        """Authenticate user for Socket.IO events (Railway-optimized logging)."""
        try:
            # Use Railway-optimized logging instead of print statements
            railway_logger.log('presence', 10, f"Presence authentication attempt, token length: {len(id_token) if id_token else 0}")
            
            auth_service = AuthService()
            decoded_token = auth_service.verify_token(id_token)
            user_id = decoded_token.get('uid', 'unknown')
            railway_logger.log('presence', 10, f"Token verified for user: {user_id}")
            
            user = auth_service.get_user_by_id(decoded_token['uid'])
            if not user:
                railway_logger.log('presence', 10, "User not found in database, registering...")
                user = auth_service.register_user(id_token)
                railway_logger.log('presence', 10, f"User registered: {user.email}")
            else:
                railway_logger.log('presence', 10, f"User found in database: {user.email}")
            
            return user
        except Exception as e:
            railway_logger.log('presence', 40, f"Socket.IO presence authentication failed: {str(e)}")
            raise e
    
    @socketio.on('user_online')
    def handle_user_online(data):
        """Handle user coming online with parse error prevention."""
        try:
            # Log incoming message details for parse error debugging
            try:
                message_size = len(json.dumps(data).encode('utf-8'))
                railway_logger.log('presence', 10, f"=== User Online Message Received ===")
                railway_logger.log('presence', 10, f"Message size: {message_size} bytes")
                railway_logger.log('presence', 10, f"Message type: {type(data).__name__}")
                railway_logger.log('presence', 10, f"Message keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                railway_logger.log('presence', 10, f"Canvas ID: {data.get('canvas_id', 'Missing')}")
                railway_logger.log('presence', 10, f"Token length: {len(data.get('id_token', '')) if data.get('id_token') else 0}")
            except Exception as log_error:
                railway_logger.log('presence', 40, f"Failed to log presence message details: {str(log_error)}")
            
            # Validate and optimize token before message validation
            user_id = data.get('_authenticated_user', {}).get('id', 'unknown')
            id_token = data.get('id_token')
            
            if id_token:
                token_validation = token_optimization_service.validate_token_for_socket(id_token, user_id)
                if not token_validation['is_valid']:
                    railway_logger.log('presence', 30, f"Token validation failed for user {user_id}: {token_validation['issues']}")
                    return
                
                # Optimize message with token
                data = token_optimization_service.optimize_socket_message_with_token(data, id_token, user_id)
            
            # Validate message size to prevent parse errors
            if not SocketIOConfigOptimizer.validate_message_size(data, max_size=5000):  # 5KB for presence data
                railway_logger.log('presence', 40, "User online message too large, rejecting")
                return
            
            # Sanitize input data to prevent parse errors
            sanitized_data = SocketIOConfigOptimizer.sanitize_message_data(data)
            sanitized_data = SanitizationService.sanitize_socket_event_data(sanitized_data)
            
            canvas_id = sanitized_data.get('canvas_id')
            id_token = sanitized_data.get('id_token')
            
            if not all([canvas_id, id_token]):
                return
            
            # Verify authentication
            try:
                user = authenticate_socket_user(id_token)
            except Exception as e:
                print(f"Presence authentication failed: {str(e)}")
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'user_online'):
                return
            
            # Store user presence in Redis (if available)
            if cache_client:
                presence_data = {
                    'user_id': user.id,
                    'user_name': user.name,
                    'user_email': user.email,
                    'avatar_url': user.avatar_url,
                    'timestamp': data.get('timestamp')
                }
                cache_client.set(
                    f'presence:{canvas_id}:{user.id}',
                    json.dumps(presence_data),
                    ex=60  # 60 seconds TTL
                )
            
            # Join the presence room
            join_room(f'presence:{canvas_id}')
            
            # Prepare broadcast data with size validation
            broadcast_data = {
                'user': user.to_dict()
            }
            
            # Validate broadcast data size to prevent parse errors
            if not SocketIOConfigOptimizer.validate_message_size(broadcast_data, max_size=10000):  # 10KB limit
                railway_logger.log('presence', 40, "User online broadcast data too large, skipping broadcast")
                return
            
            # Sanitize broadcast data
            sanitized_broadcast = SocketIOConfigOptimizer.sanitize_message_data(broadcast_data)
            
            # Notify other users
            emit('user_came_online', sanitized_broadcast, room=f'presence:{canvas_id}', include_self=False)
            
        except Exception as e:
            emit('error', {'message': str(e)})
    
    @socketio.on('user_offline')
    def handle_user_offline(data):
        """Handle user going offline."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            canvas_id = sanitized_data.get('canvas_id')
            id_token = sanitized_data.get('id_token')
            
            if not all([canvas_id, id_token]):
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception:
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'user_offline'):
                return
            
            # Remove user presence from Redis
            if cache_client:
                cache_client.delete(f'presence:{canvas_id}:{user.id}')
                cache_client.delete(f'cursor:{canvas_id}:{user.id}')
            
            # Leave the presence room
            leave_room(f'presence:{canvas_id}')
            
            # Notify other users
            emit('user_went_offline', {
                'user_id': user.id,
                'user_name': user.name
            }, room=f'presence:{canvas_id}', include_self=False)
            
        except Exception as e:
            emit('error', {'message': str(e)})
    
    @socketio.on('get_online_users')
    def handle_get_online_users(data):
        """Get all online users for a canvas."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            canvas_id = sanitized_data.get('canvas_id')
            id_token = sanitized_data.get('id_token')
            
            if not all([canvas_id, id_token]):
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception:
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'get_online_users'):
                return
            
            # Get all online users from Redis
            online_users = []
            if cache_client:
                presence_keys = cache_client.keys(f'presence:{canvas_id}:*')
                for key in presence_keys:
                    presence_data = cache_client.get(key)
                    if presence_data:
                        try:
                            user_info = json.loads(presence_data)
                            online_users.append(user_info)
                        except json.JSONDecodeError:
                            continue
            
            # Send online users to the requesting user
            emit('online_users', {
                'users': online_users
            })
            
        except Exception as e:
            emit('error', {'message': str(e)})
    
    @socketio.on('heartbeat')
    def handle_heartbeat(data):
        """Handle user heartbeat to maintain presence."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
            canvas_id = sanitized_data.get('canvas_id')
            id_token = sanitized_data.get('id_token')
            
            if not all([canvas_id, id_token]):
                return
            
            # Verify authentication
            auth_service = AuthService()
            try:
                decoded_token = auth_service.verify_token(id_token)
                user = auth_service.get_user_by_id(decoded_token['uid'])
            except Exception:
                return
            
            # Check rate limiting
            if not check_socket_rate_limit(user.id, 'heartbeat'):
                return
            
            # Update presence timestamp in Redis
            if cache_client:
                presence_data = {
                    'user_id': user.id,
                    'user_name': user.name,
                    'user_email': user.email,
                    'avatar_url': user.avatar_url,
                    'timestamp': data.get('timestamp')
                }
                cache_client.set(
                    f'presence:{canvas_id}:{user.id}',
                    json.dumps(presence_data),
                    ex=60  # 60 seconds TTL
                )
            
        except Exception as e:
            emit('error', {'message': str(e)})
