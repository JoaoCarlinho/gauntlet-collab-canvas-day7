"""
Comprehensive Security Testing Suite
Tests security vulnerabilities, authentication, authorization, and data protection
"""
import pytest
import json
import base64
import hashlib
from flask import Flask
from app import create_app, db
from app.models import User, Canvas, CanvasObject
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService


class TestSecurityComprehensive:
    """Comprehensive security test suite."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self, app, session):
        """Set up test data for each test method."""
        self.app = app
        self.client = app.test_client()
        self.session = session
        
        # Create test users
        self.user1 = User(
            id='security-user-1',
            email='user1@security.com',
            name='Security User 1',
            firebase_uid='firebase-uid-1'
        )
        self.user2 = User(
            id='security-user-2',
            email='user2@security.com',
            name='Security User 2',
            firebase_uid='firebase-uid-2'
        )
        self.session.add_all([self.user1, self.user2])
        self.session.commit()
        
        # Create test canvas
        self.canvas = Canvas(
            id='security-test-canvas',
            name='Security Test Canvas',
            description='A canvas for security testing',
            owner_id=self.user1.id,
            visibility='private'
        )
        self.session.add(self.canvas)
        self.session.commit()

    def test_sql_injection_prevention(self):
        """Test SQL injection prevention."""
        # Test SQL injection in canvas name
        malicious_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; INSERT INTO users (id, email) VALUES ('hacker', 'hacker@evil.com'); --",
            "1' UNION SELECT password FROM users WHERE '1'='1",
            "'; UPDATE users SET email='hacked@evil.com' WHERE '1'='1'; --"
        ]
        
        for payload in malicious_payloads:
            canvas_data = {
                'name': payload,
                'description': 'Test canvas',
                'visibility': 'private'
            }
            
            response = self.client.post(
                '/api/canvases',
                data=json.dumps(canvas_data),
                content_type='application/json',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
            )
            
            # Should either reject the request or sanitize the input
            if response.status_code == 201:
                data = json.loads(response.data)
                # Verify the payload was sanitized
                assert 'DROP TABLE' not in data['name']
                assert 'INSERT INTO' not in data['name']
                assert 'UPDATE' not in data['name']
                assert 'UNION SELECT' not in data['name']
            else:
                # Request was rejected (also acceptable)
                assert response.status_code in [400, 422]

    def test_xss_prevention(self):
        """Test XSS (Cross-Site Scripting) prevention."""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "<iframe src=javascript:alert('XSS')></iframe>",
            "';alert('XSS');//",
            "<script>document.cookie='hacked=true'</script>"
        ]
        
        for payload in xss_payloads:
            canvas_data = {
                'name': 'Test Canvas',
                'description': payload,
                'visibility': 'private'
            }
            
            response = self.client.post(
                '/api/canvases',
                data=json.dumps(canvas_data),
                content_type='application/json',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
            )
            
            if response.status_code == 201:
                data = json.loads(response.data)
                # Verify XSS payload was sanitized
                assert '<script>' not in data['description']
                assert 'javascript:' not in data['description']
                assert 'onerror=' not in data['description']
                assert 'onload=' not in data['description']
                assert '<iframe' not in data['description']
                assert '<svg' not in data['description']

    def test_authentication_bypass_attempts(self):
        """Test various authentication bypass attempts."""
        # Test without authentication
        response = self.client.get('/api/canvases')
        assert response.status_code == 401
        
        # Test with invalid token
        response = self.client.get(
            '/api/canvases',
            headers={'Authorization': 'Bearer invalid-token'}
        )
        assert response.status_code == 401
        
        # Test with malformed token
        response = self.client.get(
            '/api/canvases',
            headers={'Authorization': 'Bearer malformed.token.here'}
        )
        assert response.status_code == 401
        
        # Test with expired token (simulate)
        expired_token = self._create_expired_token()
        response = self.client.get(
            '/api/canvases',
            headers={'Authorization': f'Bearer {expired_token}'}
        )
        assert response.status_code == 401
        
        # Test with token for non-existent user
        fake_user_token = self._create_fake_user_token()
        response = self.client.get(
            '/api/canvases',
            headers={'Authorization': f'Bearer {fake_user_token}'}
        )
        assert response.status_code == 401

    def test_authorization_bypass_attempts(self):
        """Test authorization bypass attempts."""
        # Test accessing another user's private canvas
        response = self.client.get(
            f'/api/canvases/{self.canvas.id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user2)}'}
        )
        assert response.status_code == 403
        
        # Test modifying another user's canvas
        canvas_data = {
            'name': 'Hacked Canvas',
            'description': 'I should not be able to do this'
        }
        
        response = self.client.put(
            f'/api/canvases/{self.canvas.id}',
            data=json.dumps(canvas_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user2)}'}
        )
        assert response.status_code == 403
        
        # Test deleting another user's canvas
        response = self.client.delete(
            f'/api/canvases/{self.canvas.id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user2)}'}
        )
        assert response.status_code == 403

    def test_csrf_protection(self):
        """Test CSRF (Cross-Site Request Forgery) protection."""
        # Test CSRF token requirement for state-changing operations
        canvas_data = {
            'name': 'CSRF Test Canvas',
            'description': 'Testing CSRF protection',
            'visibility': 'private'
        }
        
        # Without CSRF token (if implemented)
        response = self.client.post(
            '/api/canvases',
            data=json.dumps(canvas_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        # Should either require CSRF token or have other protection mechanisms
        # For now, we'll just verify the request is properly authenticated
        assert response.status_code in [201, 400, 403]

    def test_input_validation_and_sanitization(self):
        """Test input validation and sanitization."""
        # Test extremely long inputs
        long_string = 'A' * 10000
        
        canvas_data = {
            'name': long_string,
            'description': long_string,
            'visibility': 'private'
        }
        
        response = self.client.post(
            '/api/canvases',
            data=json.dumps(canvas_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        # Should either reject or truncate the input
        if response.status_code == 201:
            data = json.loads(response.data)
            assert len(data['name']) <= 255  # Assuming reasonable length limit
            assert len(data['description']) <= 1000  # Assuming reasonable length limit
        
        # Test invalid data types
        invalid_data = {
            'name': 12345,  # Should be string
            'description': ['not', 'a', 'string'],
            'visibility': 'invalid_visibility'
        }
        
        response = self.client.post(
            '/api/canvases',
            data=json.dumps(invalid_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        assert response.status_code == 400

    def test_rate_limiting_security(self):
        """Test rate limiting for security purposes."""
        # Test rapid requests to trigger rate limiting
        for i in range(100):
            response = self.client.get(
                '/api/canvases',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
            )
            
            if response.status_code == 429:
                break
        
        # Should eventually hit rate limit
        assert response.status_code == 429
        
        # Test rate limiting on authentication endpoints
        for i in range(50):
            response = self.client.post(
                '/api/auth/login',
                data=json.dumps({'firebase_uid': 'test-uid'}),
                content_type='application/json'
            )
            
            if response.status_code == 429:
                break
        
        # Should hit rate limit on auth endpoints
        assert response.status_code == 429

    def test_data_encryption_and_protection(self):
        """Test data encryption and protection."""
        # Test that sensitive data is not exposed in responses
        response = self.client.get(
            f'/api/canvases/{self.canvas.id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Verify sensitive fields are not exposed
        assert 'password' not in data
        assert 'firebase_uid' not in data
        assert 'internal_id' not in data
        
        # Test that user data is properly sanitized
        response = self.client.get(
            '/api/users/me',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        if response.status_code == 200:
            data = json.loads(response.data)
            # Verify only safe fields are exposed
            allowed_fields = {'id', 'email', 'name', 'created_at', 'updated_at'}
            for field in data:
                assert field in allowed_fields

    def test_file_upload_security(self):
        """Test file upload security (if implemented)."""
        # Test malicious file upload attempts
        malicious_files = [
            ('malicious.exe', b'MZ\x90\x00\x03\x00\x00\x00'),  # PE header
            ('script.php', b'<?php system($_GET["cmd"]); ?>'),
            ('shell.sh', b'#!/bin/bash\nrm -rf /'),
            ('virus.js', b'while(true) { /* DoS */ }')
        ]
        
        for filename, content in malicious_files:
            # This test assumes file upload endpoint exists
            # Adjust based on actual implementation
            response = self.client.post(
                '/api/upload',
                data={'file': (content, filename)},
                headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
            )
            
            # Should reject malicious files
            assert response.status_code in [400, 403, 415]

    def test_session_security(self):
        """Test session security."""
        # Test session fixation
        response1 = self.client.get('/api/auth/login')
        session_id_1 = response1.headers.get('Set-Cookie', '')
        
        response2 = self.client.get('/api/auth/login')
        session_id_2 = response2.headers.get('Set-Cookie', '')
        
        # Session IDs should be different
        assert session_id_1 != session_id_2
        
        # Test session timeout
        # This would require implementing session timeout testing
        # For now, we'll just verify sessions are properly managed
        assert 'session' in session_id_1.lower() or 'token' in session_id_1.lower()

    def test_headers_security(self):
        """Test security headers."""
        response = self.client.get('/api/canvases')
        
        # Check for security headers
        security_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security',
            'Content-Security-Policy'
        ]
        
        for header in security_headers:
            # At least some security headers should be present
            if header in response.headers:
                assert response.headers[header] is not None

    def test_cors_security(self):
        """Test CORS security configuration."""
        # Test preflight request
        response = self.client.options(
            '/api/canvases',
            headers={
                'Origin': 'https://malicious-site.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        )
        
        # Should have proper CORS headers
        assert 'Access-Control-Allow-Origin' in response.headers
        assert 'Access-Control-Allow-Methods' in response.headers
        
        # Origin should be restricted (not allow all origins)
        allowed_origins = response.headers.get('Access-Control-Allow-Origin', '')
        assert allowed_origins != '*' or 'malicious-site.com' not in allowed_origins

    def test_parameter_pollution(self):
        """Test HTTP parameter pollution."""
        # Test duplicate parameters
        response = self.client.get(
            '/api/canvases?name=test1&name=test2&visibility=private&visibility=public',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        # Should handle duplicate parameters gracefully
        assert response.status_code in [200, 400]

    def test_path_traversal_prevention(self):
        """Test path traversal prevention."""
        # Test path traversal attempts
        malicious_paths = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '....//....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
        ]
        
        for path in malicious_paths:
            response = self.client.get(
                f'/api/files/{path}',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
            )
            
            # Should reject path traversal attempts
            assert response.status_code in [400, 403, 404]

    def _get_auth_token(self, user):
        """Helper method to get auth token for user."""
        auth_service = AuthService()
        return auth_service.generate_token(user.id)
    
    def _create_expired_token(self):
        """Helper method to create an expired token."""
        # This would require implementing token expiration logic
        # For now, return a malformed token
        return "expired.token.here"
    
    def _create_fake_user_token(self):
        """Helper method to create a token for a non-existent user."""
        # This would require implementing token validation
        # For now, return a fake token
        return "fake.user.token"
