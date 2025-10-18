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
    
    @pytest.fixture(autouse=True)
    def setup_openai_mock(self):
        """Mock OpenAI client for all tests."""
        with patch('app.services.ai_agent_service.openai.OpenAI') as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client
            # Set a mock API key for testing
            os.environ['OPENAI_API_KEY'] = 'test-api-key'
            yield mock_client
            # Clean up
            if 'OPENAI_API_KEY' in os.environ:
                del os.environ['OPENAI_API_KEY']

    def test_create_canvas_from_query_success(self, app, session, sample_user, setup_openai_mock):
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
            
            with patch.object(ai_service, '_generate_ai_response') as mock_generate:
                mock_generate.return_value = json.dumps(mock_response)
                
                result = ai_service.create_canvas_from_query(
                    query="Create a test canvas",
                    user_id=sample_user.id
                )
                
                assert result['success'] is True
                assert len(result['objects']) == 1
                assert result['objects'][0]['object_type'] == 'rectangle'

    def test_create_canvas_with_existing_canvas(self, app, session, sample_user, sample_canvas, setup_openai_mock):
        """Test canvas creation with existing canvas."""
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
            
            with patch.object(ai_service, '_generate_ai_response') as mock_generate:
                mock_generate.return_value = json.dumps(mock_response)
                
                result = ai_service.create_canvas_from_query(
                    query="Add a circle to the canvas",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                assert result['success'] is True
                assert result['canvas_id'] == sample_canvas.id
                assert len(result['objects']) == 1

    def test_validate_object_valid(self, setup_openai_mock):
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

    def test_validate_object_invalid_type(self, setup_openai_mock):
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

    def test_validate_object_invalid_coordinates(self, setup_openai_mock):
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

    def test_validate_object_missing_fields(self, setup_openai_mock):
        """Test object validation with missing required fields."""
        ai_service = AIAgentService()
        
        invalid_object = {
            "type": "rectangle",
            "x": 100,
            # Missing y, width, height
        }
        
        assert ai_service._validate_object(invalid_object) is False

    def test_clean_object(self, setup_openai_mock):
        """Test object cleaning and standardization."""
        ai_service = AIAgentService()
        
        raw_object = {
            "type": "rectangle",
            "x": "100",  # String that should be converted to float
            "y": "200",
            "width": "120",
            "height": "60",
            "color": "#3B82F6",
            "label": "Test Label",
            "fontSize": "14"
        }
        
        cleaned = ai_service._clean_object(raw_object)
        
        assert cleaned['type'] == 'rectangle'
        assert cleaned['x'] == 100.0
        assert cleaned['y'] == 200.0
        assert cleaned['width'] == 120.0
        assert cleaned['height'] == 60.0
        assert cleaned['color'] == '#3B82F6'
        assert cleaned['text'] == 'Test Label'
        assert cleaned['fontSize'] == 14

    def test_get_style_guidance(self, setup_openai_mock):
        """Test style guidance generation."""
        ai_service = AIAgentService()
        
        # Test modern style
        guidance = ai_service._get_style_guidance("modern", "pastel")
        assert "modern" in guidance.lower()
        assert "pastel" in guidance.lower()
        
        # Test corporate style
        guidance = ai_service._get_style_guidance("corporate", "default")
        assert "corporate" in guidance.lower()
        assert "professional" in guidance.lower()

    def test_parse_ai_response_to_objects(self, setup_openai_mock):
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

    def test_parse_ai_response_invalid_json(self, setup_openai_mock):
        """Test parsing invalid AI response."""
        ai_service = AIAgentService()
        
        invalid_response = "This is not valid JSON"
        
        with pytest.raises(ValueError, match="Failed to parse AI response"):
            ai_service._parse_ai_response_to_objects(invalid_response)

    def test_parse_ai_response_missing_objects(self, setup_openai_mock):
        """Test parsing AI response without objects."""
        ai_service = AIAgentService()
        
        ai_response = json.dumps({
            "title": "Test Canvas"
            # Missing objects array
        })
        
        with pytest.raises(ValueError, match="Invalid AI response structure"):
            ai_service._parse_ai_response_to_objects(ai_response)


class TestAIAgentAPI:
    """Test cases for AI Agent API endpoints."""
    
    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
        }

    def test_create_canvas_success(self, client, auth_headers):
        """Test successful API request."""
        with patch('app.services.ai_agent_service.AIAgentService.create_canvas_from_query') as mock_create:
            mock_create.return_value = {
                'success': True,
                'canvas_id': 'test_canvas_id',
                'objects': [{'id': 'obj_1', 'object_type': 'rectangle', 'x': 100, 'y': 100}],
                'message': 'Success',
                'title': 'Test Canvas'
            }
            
            response = client.post('/api/ai-agent/create-canvas', 
                                 json={'instructions': 'Create a test canvas'},
                                 headers=auth_headers)
            
            assert response.status_code == 200
            assert response.json['success'] is True
            assert 'canvas' in response.json

    def test_create_canvas_validation_error(self, client, auth_headers):
        """Test API validation error handling."""
        response = client.post('/api/ai-agent/create-canvas',
                             json={'instructions': ''},  # Empty instructions
                             headers=auth_headers)
        
        assert response.status_code == 400
        assert response.json['success'] is False
        assert 'error' in response.json

    def test_create_canvas_unauthorized(self, client):
        """Test API without authentication."""
        response = client.post('/api/ai-agent/create-canvas',
                             json={'instructions': 'Create a test canvas'})
        
        assert response.status_code == 401

    def test_create_canvas_with_style_options(self, client, auth_headers):
        """Test API with style and color scheme options."""
        with patch('app.services.ai_agent_service.AIAgentService.create_canvas_from_query') as mock_create:
            mock_create.return_value = {
                'success': True,
                'canvas_id': 'test_canvas_id',
                'objects': [],
                'message': 'Success',
                'title': 'Test Canvas'
            }
            
            response = client.post('/api/ai-agent/create-canvas', 
                                 json={
                                     'instructions': 'Create a modern canvas',
                                     'style': 'modern',
                                     'colorScheme': 'pastel'
                                 },
                                 headers=auth_headers)
            
            assert response.status_code == 200
            assert response.json['success'] is True

    def test_health_check_success(self, client):
        """Test health check endpoint success."""
        with patch('app.services.ai_agent_service.AIAgentService') as mock_service:
            mock_instance = MagicMock()
            mock_service.return_value = mock_instance
            mock_instance.openai_client.models.list.return_value = MagicMock()
            
            response = client.get('/api/ai-agent/health')
            
            assert response.status_code == 200
            assert response.json['status'] == 'healthy'

    def test_health_check_failure(self, client):
        """Test health check endpoint failure."""
        with patch('app.services.ai_agent_service.AIAgentService') as mock_service:
            mock_service.side_effect = Exception("OpenAI connection failed")
            
            response = client.get('/api/ai-agent/health')
            
            assert response.status_code == 500
            assert response.json['status'] == 'unhealthy'

    def test_list_models_success(self, client, auth_headers):
        """Test list models endpoint success."""
        with patch('app.services.ai_agent_service.AIAgentService') as mock_service:
            mock_instance = MagicMock()
            mock_service.return_value = mock_instance
            mock_instance.openai_client.models.list.return_value = MagicMock()
            
            response = client.get('/api/ai-agent/models', headers=auth_headers)
            
            assert response.status_code == 200
            assert response.json['success'] is True

    def test_list_models_unauthorized(self, client):
        """Test list models endpoint without authentication."""
        response = client.get('/api/ai-agent/models')
        
        assert response.status_code == 401


class TestAIAgentIntegration:
    """Integration tests for AI Agent functionality."""
    
    def test_end_to_end_canvas_creation(self, app, session, client, sample_user):
        """Test end-to-end canvas creation flow."""
        with app.app_context():
            with patch('app.services.ai_agent_service.AIAgentService.create_canvas_from_query') as mock_create:
                mock_create.return_value = {
                    'success': True,
                    'canvas_id': 'test_canvas_id',
                    'objects': [
                        {
                            'id': 'obj_1',
                            'object_type': 'rectangle',
                            'x': 100,
                            'y': 100,
                            'width': 120,
                            'height': 60,
                            'color': '#3B82F6',
                            'text': 'Test Object',
                            'font_size': 14
                        }
                    ],
                    'message': 'Success',
                    'title': 'Test Canvas'
                }
                
                # Mock authentication
                with patch('app.services.auth_service.AuthService.verify_token') as mock_verify:
                    mock_verify.return_value = {
                        'uid': sample_user.id,
                        'email': sample_user.email,
                        'name': sample_user.name
                    }
                    
                    response = client.post('/api/ai-agent/create-canvas',
                                         json={'instructions': 'Create a test canvas'},
                                         headers={'Authorization': 'Bearer valid-token'})
                    
                    assert response.status_code == 200
                    assert response.json['success'] is True
                    assert 'canvas' in response.json
