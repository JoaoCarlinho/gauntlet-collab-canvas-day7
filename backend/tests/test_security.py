"""
Security Testing Suite for CollabCanvas
Tests input validation, XSS prevention, SQL injection protection, and other security measures.
"""

import pytest
import json
import re
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import User, Canvas, CanvasObject, Invitation
from app.services.auth_service import AuthService
from app.services.sanitization_service import SanitizationService


class TestInputValidation:
    """Test input validation across all endpoints."""
    
    @pytest.fixture
    def app(self):
        from app.config import TestingConfig
        app = create_app(TestingConfig)
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
        }
    
    def test_canvas_creation_input_validation(self, client, auth_headers):
        """Test canvas creation with various invalid inputs."""
        
        # Test cases for invalid inputs
        invalid_inputs = [
            # Empty title
            {'title': '', 'description': 'Valid description', 'is_public': False},
            # Title too long (over 255 chars)
            {'title': 'x' * 256, 'description': 'Valid description', 'is_public': False},
            # Title with HTML tags
            {'title': '<script>alert("xss")</script>', 'description': 'Valid description', 'is_public': False},
            # Description too long (over 2000 chars)
            {'title': 'Valid Title', 'description': 'x' * 2001, 'is_public': False},
            # Invalid boolean for is_public
            {'title': 'Valid Title', 'description': 'Valid description', 'is_public': 'not_boolean'},
            # Missing required fields
            {'description': 'Valid description', 'is_public': False},
            # XSS in description
            {'title': 'Valid Title', 'description': '<img src=x onerror=alert("xss")>', 'is_public': False},
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for invalid_input in invalid_inputs:
                response = client.post('/api/canvas/', 
                                     headers=auth_headers,
                                     data=json.dumps(invalid_input))
                
                # Should return 400 Bad Request for invalid inputs
                assert response.status_code == 400, f"Expected 400 for input: {invalid_input}"
    
    def test_object_creation_input_validation(self, client, auth_headers):
        """Test object creation with various invalid inputs."""
        
        invalid_inputs = [
            # Invalid object type
            {'canvas_id': 'test-canvas', 'object_type': 'invalid_type', 'properties': {}},
            # Missing required fields
            {'object_type': 'rectangle', 'properties': {}},
            # Invalid coordinates (out of bounds)
            {'canvas_id': 'test-canvas', 'object_type': 'rectangle', 
             'properties': {'x': -20000, 'y': 0, 'width': 100, 'height': 100}},
            # Invalid size values
            {'canvas_id': 'test-canvas', 'object_type': 'rectangle', 
             'properties': {'x': 0, 'y': 0, 'width': -100, 'height': 100}},
            # XSS in text content
            {'canvas_id': 'test-canvas', 'object_type': 'text', 
             'properties': {'x': 0, 'y': 0, 'text': '<script>alert("xss")</script>'}},
            # Invalid color format
            {'canvas_id': 'test-canvas', 'object_type': 'rectangle', 
             'properties': {'x': 0, 'y': 0, 'width': 100, 'height': 100, 'fill': 'invalid_color'}},
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for invalid_input in invalid_inputs:
                response = client.post('/api/objects/', 
                                     headers=auth_headers,
                                     data=json.dumps(invalid_input))
                
                assert response.status_code == 400, f"Expected 400 for input: {invalid_input}"
    
    def test_collaboration_invite_validation(self, client, auth_headers):
        """Test collaboration invite with various invalid inputs."""
        
        invalid_inputs = [
            # Invalid email format
            {'canvas_id': 'test-canvas', 'invitee_email': 'invalid-email', 'permission_type': 'view'},
            # Email too long
            {'canvas_id': 'test-canvas', 'invitee_email': 'x' * 250 + '@example.com', 'permission_type': 'view'},
            # Invalid permission type
            {'canvas_id': 'test-canvas', 'invitee_email': 'test@example.com', 'permission_type': 'invalid'},
            # XSS in invitation message
            {'canvas_id': 'test-canvas', 'invitee_email': 'test@example.com', 
             'permission_type': 'view', 'invitation_message': '<script>alert("xss")</script>'},
            # Message too long
            {'canvas_id': 'test-canvas', 'invitee_email': 'test@example.com', 
             'permission_type': 'view', 'invitation_message': 'x' * 1001},
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for invalid_input in invalid_inputs:
                response = client.post('/api/collaboration/invite', 
                                     headers=auth_headers,
                                     data=json.dumps(invalid_input))
                
                assert response.status_code == 400, f"Expected 400 for input: {invalid_input}"


class TestXSSPrevention:
    """Test XSS prevention across the application."""
    
    @pytest.fixture
    def app(self):
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_xss_payloads_in_canvas_title(self, client):
        """Test various XSS payloads in canvas titles."""
        
        xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<svg onload=alert("XSS")>',
            '<iframe src="javascript:alert(\'XSS\')"></iframe>',
            '<body onload=alert("XSS")>',
            '<input onfocus=alert("XSS") autofocus>',
            '<select onfocus=alert("XSS") autofocus>',
            '<textarea onfocus=alert("XSS") autofocus>',
            '<keygen onfocus=alert("XSS") autofocus>',
            '<video><source onerror="alert(\'XSS\')">',
            '<audio src=x onerror=alert("XSS")>',
            '<details open ontoggle=alert("XSS")>',
            '<marquee onstart=alert("XSS")>',
            '<math><mi//xlink:href="data:x,<script>alert(\'XSS\')</script>">',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in xss_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should either reject the input (400) or sanitize it (200)
                assert response.status_code in [200, 400], f"Unexpected status for payload: {payload}"
                
                if response.status_code == 200:
                    # If accepted, verify it was sanitized
                    data = response.get_json()
                    assert '<script>' not in data.get('title', ''), f"Script tag not sanitized: {payload}"
                    assert 'javascript:' not in data.get('title', ''), f"JavaScript not sanitized: {payload}"
    
    def test_xss_payloads_in_object_text(self, client):
        """Test XSS payloads in object text content."""
        
        xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<svg onload=alert("XSS")>',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in xss_payloads:
                response = client.post('/api/objects/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'canvas_id': 'test-canvas',
                                         'object_type': 'text',
                                         'properties': {
                                             'x': 0, 'y': 0,
                                             'text': payload,
                                             'fontSize': 16
                                         }
                                     }))
                
                assert response.status_code in [200, 400], f"Unexpected status for payload: {payload}"
                
                if response.status_code == 200:
                    data = response.get_json()
                    properties = data.get('properties', {})
                    text_content = properties.get('text', '')
                    assert '<script>' not in text_content, f"Script tag not sanitized: {payload}"
                    assert 'javascript:' not in text_content, f"JavaScript not sanitized: {payload}"


class TestSQLInjectionPrevention:
    """Test SQL injection prevention."""
    
    @pytest.fixture
    def app(self):
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_sql_injection_in_canvas_title(self, client):
        """Test SQL injection attempts in canvas titles."""
        
        sql_injection_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --",
            "'; INSERT INTO users VALUES ('hacker', 'password'); --",
            "' OR 1=1 --",
            "admin'--",
            "admin'/*",
            "' OR 'x'='x",
            "') OR ('1'='1",
            "' OR 1=1#",
            "' OR 1=1/*",
            "') OR ('1'='1' AND '1'='1",
            "1' OR '1'='1' AND '1'='1",
            "x' OR name LIKE '%admin%' --",
            "x'; UPDATE users SET password='hacked' WHERE name='admin'; --",
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in sql_injection_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should handle gracefully without SQL errors
                assert response.status_code in [200, 400], f"SQL injection caused error: {payload}"
                
                # Should not return SQL error messages
                if response.status_code == 500:
                    response_text = response.get_data(as_text=True)
                    assert 'sql' not in response_text.lower(), f"SQL error exposed: {payload}"
                    assert 'syntax' not in response_text.lower(), f"SQL syntax error exposed: {payload}"
    
    def test_sql_injection_in_user_email(self, client):
        """Test SQL injection attempts in user email fields."""
        
        sql_injection_payloads = [
            "test@example.com'; DROP TABLE users; --",
            "test@example.com' OR '1'='1",
            "test@example.com' UNION SELECT * FROM users --",
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in sql_injection_payloads:
                response = client.post('/api/collaboration/invite', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'canvas_id': 'test-canvas',
                                         'invitee_email': payload,
                                         'permission_type': 'view'
                                     }))
                
                # Should handle gracefully
                assert response.status_code in [200, 400], f"SQL injection caused error: {payload}"


class TestRateLimiting:
    """Test rate limiting functionality."""
    
    @pytest.fixture
    def app(self):
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_canvas_creation_rate_limiting(self, client):
        """Test rate limiting on canvas creation."""
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            # Make multiple rapid requests
            for i in range(25):  # Exceed typical rate limit
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': f'Test Canvas {i}',
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # After rate limit exceeded, should return 429
                if i > 20:  # Assuming rate limit of 20 per minute
                    assert response.status_code == 429, f"Rate limiting not working at request {i}"
    
    def test_object_creation_rate_limiting(self, client):
        """Test rate limiting on object creation."""
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            # Make multiple rapid requests
            for i in range(60):  # Exceed typical rate limit
                response = client.post('/api/objects/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'canvas_id': 'test-canvas',
                                         'object_type': 'rectangle',
                                         'properties': {
                                             'x': i * 10, 'y': 0,
                                             'width': 100, 'height': 100
                                         }
                                     }))
                
                # After rate limit exceeded, should return 429
                if i > 50:  # Assuming rate limit of 50 per minute
                    assert response.status_code == 429, f"Rate limiting not working at request {i}"


class TestAuthenticationSecurity:
    """Test authentication security measures."""
    
    @pytest.fixture
    def app(self):
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_invalid_token_handling(self, client):
        """Test handling of invalid authentication tokens."""
        
        invalid_tokens = [
            'invalid-token',
            'expired-token',
            'malformed-token',
            '',
            None,
            'Bearer invalid-token',
            'Basic invalid-token',
        ]
        
        for token in invalid_tokens:
            headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
            
            response = client.post('/api/canvas/', 
                                 headers=headers,
                                 data=json.dumps({
                                     'title': 'Test Canvas',
                                     'description': 'Test description',
                                     'is_public': False
                                 }))
            
            # Should return 401 Unauthorized
            assert response.status_code == 401, f"Invalid token not rejected: {token}"
    
    def test_missing_authentication(self, client):
        """Test endpoints without authentication."""
        
        response = client.post('/api/canvas/', 
                             headers={'Content-Type': 'application/json'},
                             data=json.dumps({
                                 'title': 'Test Canvas',
                                 'description': 'Test description',
                                 'is_public': False
                             }))
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, "Missing authentication not rejected"
    
    def test_token_tampering(self, client):
        """Test handling of tampered tokens."""
        
        tampered_tokens = [
            'valid-token-tampered',
            'valid-token' + 'x',
            'valid-token'[:-1],
            'valid-token' + '=' + 'x',
        ]
        
        for token in tampered_tokens:
            with patch.object(AuthService, 'verify_token') as mock_verify:
                mock_verify.side_effect = Exception("Invalid token")
                
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': 'Test Canvas',
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should return 401 Unauthorized
                assert response.status_code == 401, f"Tampered token not rejected: {token}"


class TestDataSanitization:
    """Test data sanitization functionality."""
    
    def test_html_sanitization(self):
        """Test HTML sanitization service."""
        
        sanitization_service = SanitizationService()
        
        test_cases = [
            ('<script>alert("xss")</script>', ''),
            ('<img src=x onerror=alert("xss")>', '<img>'),
            ('<b>Bold text</b>', '<b>Bold text</b>'),
            ('<i>Italic text</i>', '<i>Italic text</i>'),
            ('<p>Paragraph</p>', '<p>Paragraph</p>'),
            ('<div>Div content</div>', 'Div content'),
            ('<span>Span content</span>', 'Span content'),
            ('<a href="javascript:alert(\'xss\')">Link</a>', '<a>Link</a>'),
        ]
        
        for input_text, expected_output in test_cases:
            result = sanitization_service.sanitize_html(input_text)
            assert result == expected_output, f"Sanitization failed for: {input_text}"
    
    def test_text_sanitization(self):
        """Test text sanitization service."""
        
        sanitization_service = SanitizationService()
        
        test_cases = [
            ('<script>alert("xss")</script>', ''),
            ('<img src=x onerror=alert("xss")>', ''),
            ('Plain text', 'Plain text'),
            ('Text with <b>HTML</b>', 'Text with HTML'),
            ('x' * 1001, 'x' * 1000),  # Length limit
        ]
        
        for input_text, expected_output in test_cases:
            result = sanitization_service.sanitize_text(input_text, max_length=1000)
            assert result == expected_output, f"Text sanitization failed for: {input_text}"


class TestSecurityHeaders:
    """Test security headers implementation."""
    
    @pytest.fixture
    def app(self):
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_security_headers_present(self, client):
        """Test that security headers are present in responses."""
        
        response = client.get('/api/health')
        
        # Check for security headers
        security_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security',
            'Content-Security-Policy',
        ]
        
        for header in security_headers:
            assert header in response.headers, f"Security header {header} not present"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
