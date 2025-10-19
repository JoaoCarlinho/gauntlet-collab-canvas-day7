"""
WebAuthn service for passkey authentication in automated testing system.
Handles passkey registration, authentication, and validation.
"""

import json
import base64
import hashlib
import secrets
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
from app.utils.logger import SmartLogger
from app.models.test_user import TestUser
from app.extensions import db

logger = SmartLogger('webauthn_service', 'WARNING')

class WebAuthnService:
    """Service for WebAuthn passkey authentication."""
    
    def __init__(self):
        self.rp_id = "gauntlet-collab-canvas-day7-production.up.railway.app"
        self.rp_name = "CollabCanvas Test System"
        self.origin = "https://gauntlet-collab-canvas-day7-production.up.railway.app"
        
        # Store challenges temporarily (in production, use Redis)
        self.challenges = {}
    
    def generate_registration_challenge(self, user_id: str, email: str) -> Dict[str, Any]:
        """Generate a challenge for passkey registration."""
        try:
            # Generate a random challenge
            challenge = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
            
            # Store challenge with expiration
            self.challenges[challenge] = {
                'type': 'registration',
                'user_id': user_id,
                'email': email,
                'created_at': datetime.now(timezone.utc),
                'expires_at': datetime.now(timezone.utc) + timedelta(minutes=5)
            }
            
            # Create registration options
            registration_options = {
                'challenge': challenge,
                'rp': {
                    'id': self.rp_id,
                    'name': self.rp_name
                },
                'user': {
                    'id': base64.urlsafe_b64encode(user_id.encode('utf-8')).decode('utf-8').rstrip('='),
                    'name': email,
                    'displayName': email
                },
                'pubKeyCredParams': [
                    {'type': 'public-key', 'alg': -7},  # ES256
                    {'type': 'public-key', 'alg': -257}  # RS256
                ],
                'authenticatorSelection': {
                    'authenticatorAttachment': 'platform',
                    'userVerification': 'required',
                    'residentKey': 'required'
                },
                'timeout': 300000,  # 5 minutes
                'attestation': 'direct'
            }
            
            logger.log_info(f"Generated registration challenge for user {email}")
            return registration_options
            
        except Exception as e:
            logger.log_error(f"Failed to generate registration challenge: {str(e)}", e)
            raise
    
    def verify_registration(self, challenge: str, credential: Dict[str, Any]) -> Tuple[bool, str]:
        """Verify passkey registration."""
        try:
            # Check if challenge exists and is valid
            if challenge not in self.challenges:
                return False, "Invalid challenge"
            
            challenge_data = self.challenges[challenge]
            if challenge_data['type'] != 'registration':
                return False, "Invalid challenge type"
            
            if datetime.now(timezone.utc) > challenge_data['expires_at']:
                del self.challenges[challenge]
                return False, "Challenge expired"
            
            # Extract credential data
            credential_id = credential.get('id')
            raw_id = credential.get('rawId')
            response = credential.get('response', {})
            
            if not credential_id or not raw_id or not response:
                return False, "Invalid credential data"
            
            # Verify attestation (simplified - in production, use proper WebAuthn library)
            attestation_object = response.get('attestationObject')
            client_data_json = response.get('clientDataJSON')
            
            if not attestation_object or not client_data_json:
                return False, "Missing attestation data"
            
            # Decode and verify client data
            try:
                client_data = json.loads(base64.urlsafe_b64decode(client_data_json + '=='))
                
                # Verify challenge
                if client_data.get('challenge') != challenge:
                    return False, "Challenge mismatch"
                
                # Verify origin
                if client_data.get('origin') != self.origin:
                    return False, "Origin mismatch"
                
                # Verify type
                if client_data.get('type') != 'webauthn.create':
                    return False, "Invalid type"
                
            except Exception as e:
                logger.log_error(f"Failed to decode client data: {str(e)}", e)
                return False, "Invalid client data"
            
            # Store passkey for user
            user = TestUser.query.get(challenge_data['user_id'])
            if not user:
                return False, "User not found"
            
            # Store passkey data (simplified - in production, store properly)
            user.register_passkey(
                passkey_id=credential_id,
                public_key=json.dumps({
                    'id': credential_id,
                    'rawId': raw_id,
                    'attestationObject': attestation_object,
                    'clientDataJSON': client_data_json
                })
            )
            
            # Clean up challenge
            del self.challenges[challenge]
            
            logger.log_info(f"Successfully registered passkey for user {user.email}")
            return True, "Passkey registered successfully"
            
        except Exception as e:
            logger.log_error(f"Failed to verify registration: {str(e)}", e)
            return False, f"Registration verification failed: {str(e)}"
    
    def generate_authentication_challenge(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate a challenge for passkey authentication."""
        try:
            # Generate a random challenge
            challenge = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
            
            # Store challenge with expiration
            self.challenges[challenge] = {
                'type': 'authentication',
                'user_id': user_id,
                'created_at': datetime.now(timezone.utc),
                'expires_at': datetime.now(timezone.utc) + timedelta(minutes=5)
            }
            
            # Create authentication options
            authentication_options = {
                'challenge': challenge,
                'timeout': 300000,  # 5 minutes
                'rpId': self.rp_id,
                'allowCredentials': []  # Empty for discoverable credentials
            }
            
            # If specific user, include their credentials
            if user_id:
                user = TestUser.query.get(user_id)
                if user and user.passkey_id:
                    authentication_options['allowCredentials'] = [{
                        'type': 'public-key',
                        'id': user.passkey_id
                    }]
            
            logger.log_info(f"Generated authentication challenge for user {user_id or 'any'}")
            return authentication_options
            
        except Exception as e:
            logger.log_error(f"Failed to generate authentication challenge: {str(e)}", e)
            raise
    
    def verify_authentication(self, challenge: str, credential: Dict[str, Any]) -> Tuple[bool, Optional[TestUser], str]:
        """Verify passkey authentication."""
        try:
            # Check if challenge exists and is valid
            if challenge not in self.challenges:
                return False, None, "Invalid challenge"
            
            challenge_data = self.challenges[challenge]
            if challenge_data['type'] != 'authentication':
                return False, None, "Invalid challenge type"
            
            if datetime.now(timezone.utc) > challenge_data['expires_at']:
                del self.challenges[challenge]
                return False, None, "Challenge expired"
            
            # Extract credential data
            credential_id = credential.get('id')
            response = credential.get('response', {})
            
            if not credential_id or not response:
                return False, None, "Invalid credential data"
            
            # Find user by passkey ID
            user = TestUser.find_by_passkey_id(credential_id)
            if not user:
                return False, None, "User not found"
            
            # Verify signature (simplified - in production, use proper WebAuthn library)
            authenticator_data = response.get('authenticatorData')
            client_data_json = response.get('clientDataJSON')
            signature = response.get('signature')
            user_handle = response.get('userHandle')
            
            if not all([authenticator_data, client_data_json, signature]):
                return False, None, "Missing authentication data"
            
            # Decode and verify client data
            try:
                client_data = json.loads(base64.urlsafe_b64decode(client_data_json + '=='))
                
                # Verify challenge
                if client_data.get('challenge') != challenge:
                    return False, None, "Challenge mismatch"
                
                # Verify origin
                if client_data.get('origin') != self.origin:
                    return False, None, "Origin mismatch"
                
                # Verify type
                if client_data.get('type') != 'webauthn.get':
                    return False, None, "Invalid type"
                
            except Exception as e:
                logger.log_error(f"Failed to decode client data: {str(e)}", e)
                return False, None, "Invalid client data"
            
            # Update passkey counter (simplified)
            try:
                # In production, extract counter from authenticator_data
                new_counter = user.passkey_counter + 1
                user.update_passkey_counter(new_counter)
            except Exception as e:
                logger.log_error(f"Failed to update passkey counter: {str(e)}", e)
                return False, None, "Counter update failed"
            
            # Clean up challenge
            del self.challenges[challenge]
            
            logger.log_info(f"Successfully authenticated user {user.email}")
            return True, user, "Authentication successful"
            
        except Exception as e:
            logger.log_error(f"Failed to verify authentication: {str(e)}", e)
            return False, None, f"Authentication verification failed: {str(e)}"
    
    def cleanup_expired_challenges(self) -> None:
        """Clean up expired challenges."""
        try:
            current_time = datetime.now(timezone.utc)
            expired_challenges = [
                challenge for challenge, data in self.challenges.items()
                if current_time > data['expires_at']
            ]
            
            for challenge in expired_challenges:
                del self.challenges[challenge]
            
            if expired_challenges:
                logger.log_info(f"Cleaned up {len(expired_challenges)} expired challenges")
                
        except Exception as e:
            logger.log_error(f"Failed to cleanup expired challenges: {str(e)}", e)
    
    def get_challenge_status(self, challenge: str) -> Dict[str, Any]:
        """Get the status of a challenge."""
        if challenge not in self.challenges:
            return {'exists': False}
        
        challenge_data = self.challenges[challenge]
        return {
            'exists': True,
            'type': challenge_data['type'],
            'user_id': challenge_data.get('user_id'),
            'created_at': challenge_data['created_at'].isoformat(),
            'expires_at': challenge_data['expires_at'].isoformat(),
            'is_expired': datetime.now(timezone.utc) > challenge_data['expires_at']
        }
