import pytest
import json
import os
from unittest.mock import patch, MagicMock
from app.services.ai_agent_service import AIAgentService
from app.models.user import User
from app.models.canvas import Canvas
from app.models.canvas_object import CanvasObject

class TestAIAgentService:
    """Test cases for AIAgentService."""
    
    def test_create_canvas_from_query_success(self, app, db, sample_user):
        """Test successful canvas creation from AI query."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock OpenAI response
            mock_response = {
                "title": "Test Canvas",
                "objects": [
                    {
                        "type": "rectangle",
                        "label": "Test Object",
                        "x": 100,
                        "y": 100,
                        "width": 120,
                        "height": 60,
                        "color": "#3B82F6",
                        "fontSize": 14
                    }
                ]
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_response)
                
                result = ai_service.create_canvas_from_query(
                    query="Create a test canvas",
                    user_id=sample_user.id
                )
                
                assert result['success'] is True
                assert len(result['objects']) == 1
                assert result['objects'][0]['object_type'] == 'rectangle'
                assert result['canvas_id'] is not None
                assert result['title'] == "Test Canvas"
    
    def test_create_canvas_with_existing_canvas(self, app, db, sample_user, sample_canvas):
        """Test adding AI objects to existing canvas."""
        with app.app_context():
            ai_service = AIAgentService()
            
            mock_response = {
                "title": "Updated Canvas",
                "objects": [
                    {
                        "type": "circle",
                        "label": "New Object",
                        "x": 200,
                        "y": 200,
                        "width": 80,
                        "height": 80,
                        "color": "#10B981",
                        "fontSize": 12
                    }
                ]
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_response)
                
                result = ai_service.create_canvas_from_query(
                    query="Add a circle to the canvas",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                assert result['success'] is True
                assert result['canvas_id'] == sample_canvas.id
                assert len(result['objects']) == 1
                assert result['objects'][0]['object_type'] == 'circle'
    
    def test_validate_object_valid(self):
        """Test object validation with valid data."""
        ai_service = AIAgentService()
        
        valid_object = {
            "type": "rectangle",
            "x": 100,
            "y": 100,
            "width": 120,
            "height": 60
        }
        
        assert ai_service._validate_object(valid_object) is True
    
    def test_validate_object_invalid_type(self):
        """Test object validation with invalid type."""
        ai_service = AIAgentService()
        
        invalid_object = {
            "type": "invalid_type",
            "x": 100,
            "y": 100,
            "width": 120,
            "height": 60
        }
        
        assert ai_service._validate_object(invalid_object) is False
    
    def test_validate_object_invalid_coordinates(self):
        """Test object validation with invalid coordinates."""
        ai_service = AIAgentService()
        
        invalid_object = {
            "type": "rectangle",
            "x": -10,  # Invalid coordinate
            "y": 100,
            "width": 120,
            "height": 60
        }
        
        assert ai_service._validate_object(invalid_object) is False
    
    def test_validate_object_missing_fields(self):
        """Test object validation with missing required fields."""
        ai_service = AIAgentService()
        
        invalid_object = {
            "type": "rectangle",
            "x": 100,
            # Missing y, width, height
        }
        
        assert ai_service._validate_object(invalid_object) is False
    
    def test_clean_object(self):
        """Test object cleaning and standardization."""
        ai_service = AIAgentService()
        
        raw_object = {
            "type": "rectangle",
            "x": "100",  # String that should be converted to float
            "y": 100,
            "width": 120,
            "height": 60,
            "color": "#FF0000",
            "label": "Test Label",
            "fontSize": "16"
        }
        
        cleaned = ai_service._clean_object(raw_object)
        
        assert cleaned['type'] == 'rectangle'
        assert cleaned['x'] == 100.0
        assert cleaned['y'] == 100.0
        assert cleaned['width'] == 120.0
        assert cleaned['height'] == 60.0
        assert cleaned['color'] == '#FF0000'
        assert cleaned['text'] == 'Test Label'
        assert cleaned['fontSize'] == 16
    
    def test_get_style_guidance(self):
        """Test style guidance generation."""
        ai_service = AIAgentService()
        
        guidance = ai_service._get_style_guidance('modern', 'pastel')
        assert 'modern' in guidance.lower()
        assert 'pastel' in guidance.lower()
        
        guidance = ai_service._get_style_guidance('corporate', 'monochrome')
        assert 'corporate' in guidance.lower()
        assert 'monochrome' in guidance.lower()
    
    def test_parse_ai_response_to_objects(self):
        """Test parsing AI response into objects."""
        ai_service = AIAgentService()
        
        ai_response = json.dumps({
            "title": "Test Canvas",
            "objects": [
                {
                    "type": "rectangle",
                    "label": "Test Object",
                    "x": 100,
                    "y": 100,
                    "width": 120,
                    "height": 60,
                    "color": "#3B82F6",
                    "fontSize": 14
                }
            ]
        })
        
        result = ai_service._parse_ai_response_to_objects(ai_response)
        
        assert result['title'] == "Test Canvas"
        assert len(result['objects']) == 1
        assert result['objects'][0]['type'] == 'rectangle'
    
    def test_parse_ai_response_invalid_json(self):
        """Test parsing invalid AI response."""
        ai_service = AIAgentService()
        
        invalid_response = "This is not valid JSON"
        
        with pytest.raises(ValueError, match="Failed to parse AI response"):
            ai_service._parse_ai_response_to_objects(invalid_response)
    
    def test_parse_ai_response_missing_objects(self):
        """Test parsing AI response without objects."""
        ai_service = AIAgentService()
        
        invalid_response = json.dumps({
            "title": "Test Canvas"
            # Missing objects array
        })
        
        with pytest.raises(ValueError, match="Invalid AI response structure"):
            ai_service._parse_ai_response_to_objects(invalid_response)

class TestAIAgentAPI:
    """Test cases for AI Agent API endpoints."""
    
    def test_create_canvas_success(self, client, auth_headers):
        """Test successful API request."""
        with patch('app.services.ai_agent_service.AIAgentService.create_canvas_from_query') as mock_create:
            mock_create.return_value = {
                'canvas_id': 'test_canvas_id',
                'objects': [{'id': 'obj_1', 'object_type': 'rectangle', 'properties': {'x': 100, 'y': 100}}],
                'message': 'Success',
                'title': 'Test Canvas'
            }
            
            response = client.post('/api/ai-agent/create-canvas', 
                                 json={'instructions': 'Create a test canvas'},
                                 headers=auth_headers)
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert 'canvas' in data
            assert data['canvas']['id'] == 'test_canvas_id'
    
    def test_create_canvas_validation_error(self, client, auth_headers):
        """Test API validation error handling."""
        response = client.post('/api/ai-agent/create-canvas',
                             json={'instructions': ''},  # Empty instructions
                             headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'error' in data
    
    def test_create_canvas_unauthorized(self, client):
        """Test API without authentication."""
        response = client.post('/api/ai-agent/create-canvas',
                             json={'instructions': 'Create a test canvas'})
        
        assert response.status_code == 401
    
    def test_create_canvas_with_style_options(self, client, auth_headers):
        """Test API with style and color scheme options."""
        with patch('app.services.ai_agent_service.AIAgentService.create_canvas_from_query') as mock_create:
            mock_create.return_value = {
                'canvas_id': 'test_canvas_id',
                'objects': [],
                'message': 'Success',
                'title': 'Test Canvas'
            }
            
            response = client.post('/api/ai-agent/create-canvas', 
                                 json={
                                     'instructions': 'Create a corporate flowchart',
                                     'style': 'corporate',
                                     'colorScheme': 'monochrome'
                                 },
                                 headers=auth_headers)
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
    
    def test_health_check_success(self, client):
        """Test health check endpoint success."""
        with patch('app.services.ai_agent_service.AIAgentService') as mock_service:
            mock_service.return_value.openai_client.models.list.return_value = MagicMock()
            
            response = client.get('/api/ai-agent/health')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['status'] == 'healthy'
            assert data['openai_connected'] is True
    
    def test_health_check_failure(self, client):
        """Test health check endpoint failure."""
        with patch('app.services.ai_agent_service.AIAgentService') as mock_service:
            mock_service.side_effect = Exception("OpenAI connection failed")
            
            response = client.get('/api/ai-agent/health')
            
            assert response.status_code == 500
            data = response.get_json()
            assert data['status'] == 'unhealthy'
            assert data['openai_connected'] is False
    
    def test_list_models_success(self, client, auth_headers):
        """Test list models endpoint success."""
        with patch('app.services.ai_agent_service.AIAgentService') as mock_service:
            mock_model = MagicMock()
            mock_model.id = 'gpt-4'
            mock_model.object = 'model'
            mock_model.created = 1234567890
            
            mock_service.return_value.openai_client.models.list.return_value.data = [mock_model]
            
            response = client.get('/api/ai-agent/models', headers=auth_headers)
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert len(data['models']) == 1
            assert data['models'][0]['id'] == 'gpt-4'
    
    def test_list_models_unauthorized(self, client):
        """Test list models endpoint without authentication."""
        response = client.get('/api/ai-agent/models')
        
        assert response.status_code == 401

class TestAIAgentIntegration:
    """Integration tests for AI Agent functionality."""
    
    def test_end_to_end_canvas_creation(self, app, db, client, sample_user):
        """Test complete end-to-end canvas creation flow."""
        with app.app_context():
            # Mock OpenAI response
            mock_response = {
                "title": "User Login Flow",
                "objects": [
                    {
                        "type": "rectangle",
                        "label": "Login Page",
                        "x": 100,
                        "y": 50,
                        "width": 120,
                        "height": 60,
                        "color": "#3B82F6",
                        "fontSize": 14
                    },
                    {
                        "type": "diamond",
                        "label": "Valid?",
                        "x": 250,
                        "y": 150,
                        "width": 100,
                        "height": 80,
                        "color": "#10B981",
                        "fontSize": 14
                    },
                    {
                        "type": "arrow",
                        "label": "",
                        "x": 220,
                        "y": 110,
                        "width": 30,
                        "height": 40,
                        "color": "#6B7280",
                        "fontSize": 12
                    }
                ]
            }
            
            with patch('app.services.ai_agent_service.AIAgentService._generate_ai_response') as mock_generate:
                mock_generate.return_value = json.dumps(mock_response)
                
                # Get auth token
                auth_response = client.post('/api/auth/login', json={
                    'email': sample_user.email,
                    'password': 'testpassword'
                })
                auth_data = auth_response.get_json()
                token = auth_data['access_token']
                
                # Create canvas with AI
                response = client.post('/api/ai-agent/create-canvas',
                                     json={'instructions': 'Create a user login flowchart'},
                                     headers={'Authorization': f'Bearer {token}'})
                
                assert response.status_code == 200
                data = response.get_json()
                assert data['success'] is True
                assert len(data['canvas']['objects']) == 3
                
                # Verify canvas was created in database
                canvas = Canvas.query.filter_by(id=data['canvas']['id']).first()
                assert canvas is not None
                assert canvas.title == "User Login Flow"
                
                # Verify objects were created
                objects = CanvasObject.query.filter_by(canvas_id=canvas.id).all()
                assert len(objects) == 3
                
                # Verify object types
                object_types = [obj.object_type for obj in objects]
                assert 'rectangle' in object_types
                assert 'diamond' in object_types
                assert 'arrow' in object_types
