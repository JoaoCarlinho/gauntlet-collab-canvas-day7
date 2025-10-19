from flask_socketio import emit, join_room, leave_room
from app.services.auth_service import AuthService
from app.extensions import redis_client
from app.services.sanitization_service import SanitizationService
from app.middleware.rate_limiting import check_socket_rate_limit
from app.utils.railway_logger import railway_logger, log_socket_event
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
        """Handle user coming online."""
        try:
            # Sanitize input data
            sanitized_data = SanitizationService.sanitize_socket_event_data(data)
            
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
            if redis_client:
                presence_data = {
                    'user_id': user.id,
                    'user_name': user.name,
                    'user_email': user.email,
                    'avatar_url': user.avatar_url,
                    'timestamp': data.get('timestamp')
                }
                redis_client.setex(
                    f'presence:{canvas_id}:{user.id}',
                    60,  # 60 seconds TTL
                    json.dumps(presence_data)
                )
            
            # Join the presence room
            join_room(f'presence:{canvas_id}')
            
            # Notify other users
            emit('user_came_online', {
                'user': user.to_dict()
            }, room=f'presence:{canvas_id}', include_self=False)
            
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
            if redis_client:
                redis_client.delete(f'presence:{canvas_id}:{user.id}')
                redis_client.delete(f'cursor:{canvas_id}:{user.id}')
            
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
            if redis_client:
                presence_keys = redis_client.keys(f'presence:{canvas_id}:*')
                for key in presence_keys:
                    presence_data = redis_client.get(key)
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
            if redis_client:
                presence_data = {
                    'user_id': user.id,
                    'user_name': user.name,
                    'user_email': user.email,
                    'avatar_url': user.avatar_url,
                    'timestamp': data.get('timestamp')
                }
                redis_client.setex(
                    f'presence:{canvas_id}:{user.id}',
                    60,  # 60 seconds TTL
                    json.dumps(presence_data)
                )
            
        except Exception as e:
            emit('error', {'message': str(e)})
