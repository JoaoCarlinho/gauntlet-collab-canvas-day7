"""
Test Execution API routes for automated production testing.
Handles passkey authentication, test execution, and result management.
"""

from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from datetime import datetime, timezone, timedelta
import secrets
import hashlib
from app.services.webauthn_service import WebAuthnService
from app.services.test_execution_service import TestExecutionService, TestType
from app.models.test_user import TestUser
from app.utils.logger import SmartLogger
from app.extensions import db

test_execution_bp = Blueprint('test_execution', __name__, url_prefix='/api/test-execution')
logger = SmartLogger('test_execution_routes', 'WARNING')

# Initialize services
webauthn_service = WebAuthnService()
test_service = TestExecutionService()

# Store session tokens (in production, use Redis)
session_tokens = {}

def generate_session_token(user_id: str) -> str:
    """Generate a secure session token."""
    token_data = f"{user_id}:{datetime.now(timezone.utc).isoformat()}:{secrets.token_hex(32)}"
    token = hashlib.sha256(token_data.encode()).hexdigest()
    
    # Store token with expiration
    session_tokens[token] = {
        'user_id': user_id,
        'created_at': datetime.now(timezone.utc),
        'expires_at': datetime.now(timezone.utc) + timedelta(hours=1)
    }
    
    return token

def validate_session_token(token: str) -> TestUser:
    """Validate session token and return user."""
    if token not in session_tokens:
        raise ValueError("Invalid session token")
    
    token_data = session_tokens[token]
    if datetime.now(timezone.utc) > token_data['expires_at']:
        del session_tokens[token]
        raise ValueError("Session token expired")
    
    user = TestUser.query.get(token_data['user_id'])
    if not user or not user.is_active:
        raise ValueError("User not found or inactive")
    
    return user

def require_test_auth(f):
    """Decorator to require test execution authentication."""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Missing or invalid authorization header'}), 401
            
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            user = validate_session_token(token)
            
            # Add user to kwargs
            kwargs['current_user'] = user
            return f(*args, **kwargs)
            
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        except Exception as e:
            logger.log_error(f"Authentication error: {str(e)}", e)
            return jsonify({'error': 'Authentication failed'}), 500
    
    return decorated_function

@test_execution_bp.route('/register', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
def register_test_user():
    """Register a new test user."""
    try:
        data = request.json
        email = data.get('email')
        name = data.get('name')
        
        if not email or not name:
            return jsonify({'error': 'Email and name are required'}), 400
        
        # Check if user already exists
        existing_user = TestUser.find_by_email(email)
        if existing_user:
            return jsonify({'error': 'User already exists'}), 409
        
        # Create new test user
        user_id = secrets.token_hex(16)
        user = TestUser(
            id=user_id,
            email=email,
            name=name,
            can_execute_tests=True,  # Default permissions
            can_view_results=True,
            can_manage_tests=False
        )
        
        db.session.add(user)
        db.session.commit()
        
        logger.log_info(f"Registered new test user: {email}")
        
        return jsonify({
            'success': True,
            'user': user.to_dict(),
            'message': 'Test user registered successfully'
        }), 201
        
    except Exception as e:
        logger.log_error(f"Failed to register test user: {str(e)}", e)
        return jsonify({'error': 'Registration failed'}), 500

@test_execution_bp.route('/passkey/register/challenge', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
def create_registration_challenge():
    """Create a passkey registration challenge."""
    try:
        data = request.json
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Find user
        user = TestUser.find_by_email(email)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate registration challenge
        challenge = webauthn_service.generate_registration_challenge(user.id, user.email)
        
        return jsonify({
            'success': True,
            'challenge': challenge,
            'message': 'Registration challenge created'
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to create registration challenge: {str(e)}", e)
        return jsonify({'error': 'Failed to create challenge'}), 500

@test_execution_bp.route('/passkey/register/verify', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
def verify_registration():
    """Verify passkey registration."""
    try:
        data = request.json
        challenge = data.get('challenge')
        credential = data.get('credential')
        
        if not challenge or not credential:
            return jsonify({'error': 'Challenge and credential are required'}), 400
        
        # Verify registration
        success, message = webauthn_service.verify_registration(challenge, credential)
        
        if not success:
            return jsonify({'error': message}), 400
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to verify registration: {str(e)}", e)
        return jsonify({'error': 'Registration verification failed'}), 500

@test_execution_bp.route('/passkey/auth/challenge', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
def create_auth_challenge():
    """Create a passkey authentication challenge."""
    try:
        data = request.json
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Find user
        user = TestUser.find_by_email(email)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate authentication challenge
        challenge = webauthn_service.generate_authentication_challenge(user.id)
        
        return jsonify({
            'success': True,
            'challenge': challenge,
            'message': 'Authentication challenge created'
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to create auth challenge: {str(e)}", e)
        return jsonify({'error': 'Failed to create challenge'}), 500

@test_execution_bp.route('/passkey/auth/verify', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
def verify_authentication():
    """Verify passkey authentication."""
    try:
        data = request.json
        challenge = data.get('challenge')
        credential = data.get('credential')
        
        if not challenge or not credential:
            return jsonify({'error': 'Challenge and credential are required'}), 400
        
        # Verify authentication
        success, user, message = webauthn_service.verify_authentication(challenge, credential)
        
        if not success or not user:
            return jsonify({'error': message}), 401
        
        # Generate session token
        session_token = generate_session_token(user.id)
        user.create_session(session_token, expires_in_minutes=60)
        
        return jsonify({
            'success': True,
            'message': message,
            'session_token': session_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to verify authentication: {str(e)}", e)
        return jsonify({'error': 'Authentication verification failed'}), 500

@test_execution_bp.route('/execute', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_test_auth
def execute_test(current_user):
    """Execute a test suite."""
    try:
        data = request.json
        test_type = data.get('test_type')
        test_suite = data.get('test_suite')
        config = data.get('config', {})
        
        if not test_type or not test_suite:
            return jsonify({'error': 'test_type and test_suite are required'}), 400
        
        # Validate test type
        try:
            TestType(test_type)
        except ValueError:
            return jsonify({'error': f'Invalid test type: {test_type}'}), 400
        
        # Create and execute test
        execution = test_service.create_execution(
            user=current_user,
            test_type=test_type,
            test_suite=test_suite,
            config=config
        )
        
        # Start execution asynchronously (in production, use proper async handling)
        import threading
        def run_test():
            import asyncio
            asyncio.run(test_service.execute_test(execution))
        
        thread = threading.Thread(target=run_test)
        thread.daemon = True
        thread.start()
        
        logger.log_info(f"Started test execution {execution.execution_id} for user {current_user.email}")
        
        return jsonify({
            'success': True,
            'execution_id': execution.execution_id,
            'status': execution.status.value,
            'message': 'Test execution started'
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.log_error(f"Failed to execute test: {str(e)}", e)
        return jsonify({'error': 'Test execution failed'}), 500

@test_execution_bp.route('/executions/<execution_id>', methods=['GET', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_test_auth
def get_execution(current_user, execution_id):
    """Get execution details."""
    try:
        execution = test_service.get_execution(execution_id)
        if not execution:
            return jsonify({'error': 'Execution not found'}), 404
        
        # Check if user can view this execution
        if execution.user.id != current_user.id and not current_user.can_view_results:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'success': True,
            'execution': execution.to_dict()
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get execution: {str(e)}", e)
        return jsonify({'error': 'Failed to get execution'}), 500

@test_execution_bp.route('/executions', methods=['GET', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_test_auth
def get_user_executions(current_user):
    """Get user's test executions."""
    try:
        limit = request.args.get('limit', 50, type=int)
        executions = test_service.get_user_executions(current_user, limit)
        
        return jsonify({
            'success': True,
            'executions': executions,
            'count': len(executions)
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get user executions: {str(e)}", e)
        return jsonify({'error': 'Failed to get executions'}), 500

@test_execution_bp.route('/executions/<execution_id>/cancel', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_test_auth
def cancel_execution(current_user, execution_id):
    """Cancel a running execution."""
    try:
        success = test_service.cancel_execution(execution_id, current_user)
        
        if not success:
            return jsonify({'error': 'Failed to cancel execution'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Execution cancelled successfully'
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to cancel execution: {str(e)}", e)
        return jsonify({'error': 'Failed to cancel execution'}), 500

@test_execution_bp.route('/status', methods=['GET', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_test_auth
def get_execution_status(current_user):
    """Get overall execution status."""
    try:
        status = test_service.get_execution_status()
        
        return jsonify({
            'success': True,
            'status': status
        }), 200
        
    except Exception as e:
        logger.log_error(f"Failed to get execution status: {str(e)}", e)
        return jsonify({'error': 'Failed to get status'}), 500

@test_execution_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'test-execution',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200
