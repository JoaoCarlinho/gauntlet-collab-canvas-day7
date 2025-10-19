"""
Comprehensive API Testing Suite
Tests all API endpoints with various scenarios including edge cases and error handling
"""
import pytest
import json
from flask import url_for
from app import create_app, db
from app.models import User, Canvas, CanvasObject, CanvasPermission, Invitation
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService
from app.services.collaboration_service import CollaborationService


class TestAPIComprehensive:
    """Comprehensive API test suite."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self, app, session):
        """Set up test data for each test method."""
        self.app = app
        self.client = app.test_client()
        self.session = session
        
        # Create test users
        self.user1 = User(
            id='test-user-1',
            email='user1@test.com',
            name='Test User 1',
            firebase_uid='firebase-uid-1'
        )
        self.user2 = User(
            id='test-user-2',
            email='user2@test.com',
            name='Test User 2',
            firebase_uid='firebase-uid-2'
        )
        self.session.add_all([self.user1, self.user2])
        self.session.commit()
        
        # Create test canvas
        self.canvas = Canvas(
            id='test-canvas-id',
            name='Test Canvas',
            description='A test canvas for API testing',
            owner_id=self.user1.id,
            visibility='private'
        )
        self.session.add(self.canvas)
        self.session.commit()
        
        # Create test canvas object
        self.canvas_object = CanvasObject(
            id='test-object-id',
            canvas_id=self.canvas.id,
            object_type='rectangle',
            properties=json.dumps({
                'x': 100,
                'y': 100,
                'width': 200,
                'height': 150,
                'fill': '#ff0000'
            }),
            created_by=self.user1.id
        )
        self.session.add(self.canvas_object)
        self.session.commit()

    def test_health_endpoint(self):
        """Test health check endpoint."""
        response = self.client.get('/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data

    def test_canvas_crud_operations(self):
        """Test complete CRUD operations for canvas."""
        # Test CREATE
        canvas_data = {
            'name': 'New Test Canvas',
            'description': 'A new test canvas',
            'visibility': 'private'
        }
        
        response = self.client.post(
            '/api/canvases',
            data=json.dumps(canvas_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['name'] == canvas_data['name']
        canvas_id = data['id']
        
        # Test READ
        response = self.client.get(
            f'/api/canvases/{canvas_id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['name'] == canvas_data['name']
        
        # Test UPDATE
        update_data = {
            'name': 'Updated Canvas Name',
            'description': 'Updated description'
        }
        response = self.client.put(
            f'/api/canvases/{canvas_id}',
            data=json.dumps(update_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['name'] == update_data['name']
        
        # Test DELETE
        response = self.client.delete(
            f'/api/canvases/{canvas_id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 204
        
        # Verify deletion
        response = self.client.get(
            f'/api/canvases/{canvas_id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 404

    def test_canvas_object_operations(self):
        """Test canvas object CRUD operations."""
        # Test CREATE object
        object_data = {
            'object_type': 'circle',
            'properties': {
                'x': 200,
                'y': 200,
                'radius': 50,
                'fill': '#00ff00'
            }
        }
        
        response = self.client.post(
            f'/api/canvases/{self.canvas.id}/objects',
            data=json.dumps(object_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['object_type'] == object_data['object_type']
        object_id = data['id']
        
        # Test READ object
        response = self.client.get(
            f'/api/canvases/{self.canvas.id}/objects/{object_id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['object_type'] == object_data['object_type']
        
        # Test UPDATE object
        update_data = {
            'properties': {
                'x': 300,
                'y': 300,
                'radius': 75,
                'fill': '#0000ff'
            }
        }
        response = self.client.put(
            f'/api/canvases/{self.canvas.id}/objects/{object_id}',
            data=json.dumps(update_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert json.loads(data['properties'])['x'] == 300
        
        # Test DELETE object
        response = self.client.delete(
            f'/api/canvases/{self.canvas.id}/objects/{object_id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 204

    def test_authentication_endpoints(self):
        """Test authentication-related endpoints."""
        # Test user registration
        user_data = {
            'email': 'newuser@test.com',
            'name': 'New User',
            'firebase_uid': 'new-firebase-uid'
        }
        
        response = self.client.post(
            '/api/auth/register',
            data=json.dumps(user_data),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['email'] == user_data['email']
        
        # Test user login
        login_data = {
            'firebase_uid': 'new-firebase-uid'
        }
        
        response = self.client.post(
            '/api/auth/login',
            data=json.dumps(login_data),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'token' in data
        assert 'user' in data

    def test_collaboration_endpoints(self):
        """Test collaboration-related endpoints."""
        # Test sending invitation
        invitation_data = {
            'invitee_email': 'user2@test.com',
            'permission_type': 'edit'
        }
        
        response = self.client.post(
            f'/api/canvases/{self.canvas.id}/invitations',
            data=json.dumps(invitation_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['invitee_email'] == invitation_data['invitee_email']
        invitation_id = data['id']
        
        # Test accepting invitation
        response = self.client.post(
            f'/api/invitations/{invitation_id}/accept',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user2)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'accepted'
        
        # Test listing canvas permissions
        response = self.client.get(
            f'/api/canvases/{self.canvas.id}/permissions',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) >= 2  # Owner + invited user

    def test_ai_agent_endpoints(self):
        """Test AI agent-related endpoints."""
        # Test AI canvas generation
        generation_data = {
            'prompt': 'Create a simple diagram with a rectangle and circle',
            'canvas_id': self.canvas.id
        }
        
        response = self.client.post(
            '/api/ai/generate-canvas',
            data=json.dumps(generation_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'objects' in data
        assert len(data['objects']) > 0

    def test_error_handling(self):
        """Test API error handling."""
        # Test 404 for non-existent canvas
        response = self.client.get(
            '/api/canvases/non-existent-id',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 404
        
        # Test 401 for missing authentication
        response = self.client.get('/api/canvases')
        assert response.status_code == 401
        
        # Test 403 for insufficient permissions
        response = self.client.get(
            f'/api/canvases/{self.canvas.id}',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user2)}'}
        )
        assert response.status_code == 403
        
        # Test 400 for invalid data
        invalid_data = {
            'name': '',  # Empty name should be invalid
            'visibility': 'invalid-visibility'
        }
        response = self.client.post(
            '/api/canvases',
            data=json.dumps(invalid_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 400

    def test_rate_limiting(self):
        """Test rate limiting functionality."""
        # Make multiple requests to trigger rate limiting
        for i in range(10):
            response = self.client.get(
                '/api/canvases',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
            )
            if response.status_code == 429:
                break
        
        # Should eventually hit rate limit
        assert response.status_code == 429

    def test_cors_headers(self):
        """Test CORS headers are properly set."""
        response = self.client.options('/api/canvases')
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
        assert 'Access-Control-Allow-Methods' in response.headers
        assert 'Access-Control-Allow-Headers' in response.headers

    def test_input_validation(self):
        """Test input validation and sanitization."""
        # Test SQL injection attempt
        malicious_data = {
            'name': "'; DROP TABLE users; --",
            'description': '<script>alert("xss")</script>'
        }
        
        response = self.client.post(
            '/api/canvases',
            data=json.dumps(malicious_data),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        
        # Should either reject or sanitize the input
        if response.status_code == 201:
            data = json.loads(response.data)
            # Verify input was sanitized
            assert 'DROP TABLE' not in data['name']
            assert '<script>' not in data['description']

    def test_pagination(self):
        """Test pagination for list endpoints."""
        # Create multiple canvases
        for i in range(15):
            canvas = Canvas(
                id=f'canvas-{i}',
                name=f'Canvas {i}',
                owner_id=self.user1.id,
                visibility='private'
            )
            self.session.add(canvas)
        self.session.commit()
        
        # Test pagination
        response = self.client.get(
            '/api/canvases?page=1&per_page=10',
            headers={'Authorization': f'Bearer {self._get_auth_token(self.user1)}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['items']) == 10
        assert data['page'] == 1
        assert data['per_page'] == 10
        assert 'total' in data
        assert 'pages' in data

    def _get_auth_token(self, user):
        """Helper method to get auth token for user."""
        auth_service = AuthService()
        return auth_service.generate_token(user.id)
