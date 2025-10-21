#!/usr/bin/env python3
"""
Script to set up test user for passkey authentication.
This script registers a test user and sets up passkey credentials.
"""

import requests
import json
import secrets
import base64
from datetime import datetime, timezone

# Production API URL
API_URL = "https://collab-canvas-frontend.up.railway.app"

def register_test_user():
    """Register a new test user."""
    print("🔐 Registering test user...")
    
    user_data = {
        "email": "test@collabcanvas.com",
        "name": "Test User"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/api/test-execution/register",
            json=user_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            print("✅ Test user registered successfully!")
            return response.json()
        elif response.status_code == 409:
            print("ℹ️  Test user already exists")
            return {"success": True, "message": "User already exists"}
        else:
            print(f"❌ Failed to register test user: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error registering test user: {str(e)}")
        return None

def create_passkey_challenge():
    """Create a passkey registration challenge."""
    print("🔑 Creating passkey registration challenge...")
    
    challenge_data = {
        "email": "test@collabcanvas.com"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/api/test-execution/passkey/register/challenge",
            json=challenge_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Passkey challenge created successfully!")
            return response.json()
        else:
            print(f"❌ Failed to create passkey challenge: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating passkey challenge: {str(e)}")
        return None

def register_passkey(challenge_response):
    """Register passkey with mock credentials."""
    print("🔐 Registering passkey...")
    
    # Generate mock passkey credentials
    passkey_id = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('=')
    
    # Mock credential data
    credential_data = {
        "challenge": challenge_response["challenge"]["challenge"],
        "credential": {
            "id": passkey_id,
            "rawId": base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('='),
            "response": {
                "attestationObject": base64.urlsafe_b64encode(secrets.token_bytes(100)).decode('utf-8').rstrip('='),
                "clientDataJSON": base64.urlsafe_b64encode(json.dumps({
                    "type": "webauthn.create",
                    "challenge": challenge_response["challenge"]["challenge"],
                    "origin": API_URL,
                    "crossOrigin": False
                }).encode()).decode('utf-8').rstrip('=')
            },
            "type": "public-key"
        }
    }
    
    try:
        response = requests.post(
            f"{API_URL}/api/test-execution/passkey/register/verify",
            json=credential_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Passkey registered successfully!")
            return response.json()
        else:
            print(f"❌ Failed to register passkey: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error registering passkey: {str(e)}")
        return None

def test_passkey_authentication():
    """Test passkey authentication."""
    print("🧪 Testing passkey authentication...")
    
    # Create authentication challenge
    challenge_data = {
        "email": "test@collabcanvas.com"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/api/test-execution/passkey/auth/challenge",
            json=challenge_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Passkey authentication challenge created!")
            challenge_response = response.json()
            
            # Mock authentication
            passkey_id = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('=')
            
            auth_data = {
                "challenge": challenge_response["challenge"]["challenge"],
                "credential": {
                    "id": passkey_id,
                    "rawId": base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('='),
                    "response": {
                        "authenticatorData": base64.urlsafe_b64encode(secrets.token_bytes(37)).decode('utf-8').rstrip('='),
                        "clientDataJSON": base64.urlsafe_b64encode(json.dumps({
                            "type": "webauthn.get",
                            "challenge": challenge_response["challenge"]["challenge"],
                            "origin": API_URL,
                            "crossOrigin": False
                        }).encode()).decode('utf-8').rstrip('='),
                        "signature": base64.urlsafe_b64encode(secrets.token_bytes(64)).decode('utf-8').rstrip('='),
                        "userHandle": base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('=')
                    }
                }
            }
            
            # Verify authentication
            verify_response = requests.post(
                f"{API_URL}/api/test-execution/passkey/auth/verify",
                json=auth_data,
                headers={"Content-Type": "application/json"}
            )
            
            if verify_response.status_code == 200:
                print("✅ Passkey authentication successful!")
                return verify_response.json()
            else:
                print(f"❌ Failed to verify passkey authentication: {verify_response.status_code}")
                print(f"Response: {verify_response.text}")
                return None
        else:
            print(f"❌ Failed to create authentication challenge: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error testing passkey authentication: {str(e)}")
        return None

def main():
    """Main function to set up test user and passkey."""
    print("🚀 Setting up test user for passkey authentication...")
    print(f"API URL: {API_URL}")
    print("=" * 50)
    
    # Step 1: Register test user
    user_result = register_test_user()
    if not user_result:
        print("❌ Failed to register test user. Exiting.")
        return
    
    # Step 2: Create passkey registration challenge
    challenge_result = create_passkey_challenge()
    if not challenge_result:
        print("❌ Failed to create passkey challenge. Exiting.")
        return
    
    # Step 3: Register passkey
    passkey_result = register_passkey(challenge_result)
    if not passkey_result:
        print("❌ Failed to register passkey. Exiting.")
        return
    
    # Step 4: Test authentication
    auth_result = test_passkey_authentication()
    if not auth_result:
        print("❌ Failed to test passkey authentication. Exiting.")
        return
    
    print("=" * 50)
    print("🎉 Test user setup completed successfully!")
    print("✅ User registered: test@collabcanvas.com")
    print("✅ Passkey registered and working")
    print("✅ Authentication test passed")
    print("\nYou can now run the passkey authentication tests!")

if __name__ == "__main__":
    main()
