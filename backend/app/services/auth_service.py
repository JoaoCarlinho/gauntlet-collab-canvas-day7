import os
import uuid
from app.models import User
from app.extensions import db
from functools import wraps

class AuthService:
    """Authentication service for Firebase integration."""
    
    def __init__(self):
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK."""
        try:
            # Only initialize Firebase if not in testing mode
            if os.environ.get('FLASK_ENV') != 'testing':
                import firebase_admin
                from firebase_admin import auth, credentials
                
                # Check if Firebase is already initialized
                try:
                    existing_app = firebase_admin.get_app()
                    print("Firebase app already exists, using existing app")
                    return  # Use existing app instead of reinitializing
                except ValueError:
                    print("No existing Firebase app found, initializing new app")
                
                # Debug: Check Firebase environment variables
                print("=== Firebase Initialization Debug ===")
                print(f"FIREBASE_PROJECT_ID: {'SET' if os.environ.get('FIREBASE_PROJECT_ID') else 'NOT SET'}")
                print(f"FIREBASE_CLIENT_EMAIL: {'SET' if os.environ.get('FIREBASE_CLIENT_EMAIL') else 'NOT SET'}")
                private_key_raw = os.environ.get('FIREBASE_PRIVATE_KEY', '')
                print(f"FIREBASE_PRIVATE_KEY: {'SET' if private_key_raw else 'NOT SET'}")
                
                # Fix private key formatting - replace escaped newlines with actual newlines
                private_key = os.environ.get('FIREBASE_PRIVATE_KEY', '')
                if private_key:
                    # Replace escaped newlines with actual newlines
                    private_key = private_key.replace('\\n', '\n')
                    
                    # Ensure proper PEM format
                    if not private_key.startswith('-----BEGIN PRIVATE KEY-----'):
                        private_key = '-----BEGIN PRIVATE KEY-----\n' + private_key
                    if not private_key.endswith('-----END PRIVATE KEY-----\n'):
                        if private_key.endswith('-----END PRIVATE KEY-----'):
                            private_key += '\n'
                        else:
                            private_key += '\n-----END PRIVATE KEY-----\n'
                
                # Initialize Firebase with service account
                firebase_config = {
                    "type": "service_account",
                    "project_id": os.environ.get('FIREBASE_PROJECT_ID'),
                    "private_key_id": os.environ.get('FIREBASE_PRIVATE_KEY_ID'),
                    "private_key": private_key,
                    "client_email": os.environ.get('FIREBASE_CLIENT_EMAIL'),
                    "client_id": os.environ.get('FIREBASE_CLIENT_ID'),
                    "auth_uri": os.environ.get('FIREBASE_AUTH_URI'),
                    "token_uri": os.environ.get('FIREBASE_TOKEN_URI'),
                    "auth_provider_x509_cert_url": os.environ.get('FIREBASE_AUTH_PROVIDER_X509_CERT_URL'),
                    "client_x509_cert_url": os.environ.get('FIREBASE_CLIENT_X509_CERT_URL'),
                }
                
                # Check if all required fields are present
                required_fields = ['project_id', 'private_key', 'client_email']
                missing_fields = [field for field in required_fields if not firebase_config.get(field)]
                
                if missing_fields:
                    print(f"Missing Firebase environment variables: {missing_fields}")
                    raise Exception(f"Missing Firebase environment variables: {missing_fields}")
                
                cred = credentials.Certificate(firebase_config)
                firebase_admin.initialize_app(cred)
                print("Firebase initialized successfully with formatted private key")
                print("=== Firebase Initialization Complete ===")
            else:
                # Mock Firebase for testing
                self._mock_firebase = True
                print("Using mock Firebase for testing")
        except ImportError:
            # Firebase not available, use mock
            self._mock_firebase = True
            print("Firebase not available, using mock")
        except Exception as e:
            print(f"Firebase initialization failed: {e}")
            self._mock_firebase = True
    
    def verify_token(self, id_token):
        """Verify Firebase ID token."""
        try:
            # Allow development tokens when enabled
            allow_dev = os.environ.get('ALLOW_DEV_TOKENS', 'false').lower() == 'true'
            if allow_dev and isinstance(id_token, str) and id_token.startswith('dev.'):
                # Expected format: dev.<b64header>.<b64payload>.<signature>
                parts = id_token.split('.')
                if len(parts) >= 4:
                    import base64
                    import json
                    def b64url_decode(segment: str) -> bytes:
                        padding = '=' * (-len(segment) % 4)
                        segment = segment.replace('-', '+').replace('_', '/') + padding
                        return base64.b64decode(segment)
                    try:
                        payload_bytes = b64url_decode(parts[2])
                        payload = json.loads(payload_bytes.decode('utf-8'))
                        # Map to expected decoded_token shape
                        return {
                            'uid': payload.get('uid') or str(uuid.uuid4()),
                            'email': payload.get('email') or 'dev@example.com',
                            'name': payload.get('name') or 'Development User',
                            'dev': True
                        }
                    except Exception as e:
                        print(f"Failed to decode dev token payload: {str(e)}")
                        raise Exception('Invalid dev token')
                else:
                    raise Exception('Invalid dev token format')

            if hasattr(self, '_mock_firebase') and self._mock_firebase:
                # Mock token verification for testing
                if id_token == 'valid-token':
                    return {
                        'uid': 'test-user-id',
                        'email': 'test@example.com',
                        'name': 'Test User'
                    }
                else:
                    raise Exception('Invalid token')
            else:
                from firebase_admin import auth
                print(f"Verifying token, length: {len(id_token)}")
                print(f"Token starts with: {id_token[:50]}...")
                decoded_token = auth.verify_id_token(id_token)
                print(f"Token verified successfully for user: {decoded_token.get('uid', 'unknown')}")
                return decoded_token
        except Exception as e:
            print(f"Token verification failed: {str(e)}")
            raise Exception(f"Invalid token: {str(e)}")
    
    def register_user(self, id_token):
        """Register a new user."""
        decoded_token = self.verify_token(id_token)
        
        print(f"=== User Registration Debug ===")
        print(f"Decoded token UID: {decoded_token['uid']}")
        print(f"Decoded token email: {decoded_token.get('email', '')}")
        print(f"Decoded token name: {decoded_token.get('name', '')}")
        print(f"Decoded token picture: {decoded_token.get('picture', '')}")
        
        # Check if user already exists
        existing_user = User.query.filter_by(id=decoded_token['uid']).first()
        print(f"Existing user found: {existing_user is not None}")
        if existing_user:
            print(f"Returning existing user: {existing_user.email}")
            return existing_user
        
        # Create new user
        print("Creating new user...")
        user = User(
            id=decoded_token['uid'],
            email=decoded_token.get('email', ''),
            name=decoded_token.get('name', ''),
            avatar_url=decoded_token.get('picture', '')
        )
        
        print(f"User object created: {user}")
        db.session.add(user)
        print("User added to session")
        
        try:
            db.session.commit()
            print("User committed to database successfully")
        except Exception as e:
            print(f"Database commit failed: {str(e)}")
            print(f"Exception type: {type(e)}")
            print(f"Exception details: {e}")
            db.session.rollback()
            raise e
        
        return user
    
    def get_user_by_id(self, user_id):
        """Get user by ID."""
        return User.query.filter_by(id=user_id).first()
    
    def get_user_by_email(self, email):
        """Get user by email."""
        return User.query.filter_by(email=email).first()

def require_auth(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import request, jsonify
        
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        id_token = auth_header.split(' ')[1]
        auth_service = AuthService()
        
        try:
            decoded_token = auth_service.verify_token(id_token)
            user = auth_service.get_user_by_id(decoded_token['uid'])
            if not user:
                user = auth_service.register_user(id_token)
            
            # Add user to kwargs
            kwargs['current_user'] = user
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 401
    
    return decorated_function
