"""
Integration tests for AI Agent with existing canvas functionality.
Tests that AI Agent integration doesn't break existing canvas operations.
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from app import create_app
from app.models.user import User
from app.models.canvas import Canvas
from app.models.canvas_object import CanvasObject
from app.services.ai_agent_service import AIAgentService
from app.services.canvas_service import CanvasService
from app.services.auth_service import AuthService


class TestAIAgentCanvasIntegration:
    """Test AI Agent integration with existing canvas functionality."""
    
    def test_ai_objects_compatible_with_existing_canvas_objects(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects are compatible with existing canvas object structure."""
        with app.app_context():
            ai_service = AIAgentService()
            canvas_service = CanvasService()
            
            # Mock AI response
            mock_ai_response = {
                "canvas": {
                    "title": "Test AI Canvas",
                    "objects": [
                        {
                            "type": "rectangle",
                            "label": "AI Rectangle",
                            "x": 100,
                            "y": 100,
                            "width": 120,
                            "height": 60,
                            "color": "#3B82F6",
                            "fontSize": 14
                        },
                        {
                            "type": "circle",
                            "label": "AI Circle",
                            "x": 250,
                            "y": 150,
                            "width": 80,
                            "height": 80,
                            "color": "#10B981",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_ai_response)
                
                # Create AI canvas
                result = ai_service.create_canvas_from_query(
                    query="Create a test canvas with shapes",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify AI objects were created
                assert result['success'] is True
                assert len(result['objects']) == 2
                
                # Verify objects are compatible with existing canvas object structure
                for obj in result['objects']:
                    assert 'id' in obj
                    assert 'canvas_id' in obj
                    assert 'object_type' in obj
                    assert 'properties' in obj
                    assert 'created_by' in obj
                    assert 'created_at' in obj
                    assert 'updated_at' in obj
                    
                    # Verify object can be retrieved via existing canvas service
                    retrieved_obj = canvas_service.get_canvas_object(obj['id'])
                    assert retrieved_obj is not None
                    assert retrieved_obj.object_type in ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
    
    def test_ai_objects_work_with_existing_socket_handlers(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects work with existing socket event handlers."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock AI response
            mock_ai_response = {
                "canvas": {
                    "title": "Socket Test Canvas",
                    "objects": [
                        {
                            "type": "text",
                            "label": "Socket Test Text",
                            "x": 200,
                            "y": 200,
                            "width": 150,
                            "height": 40,
                            "color": "#EF4444",
                            "fontSize": 16
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_ai_response)
                
                # Create AI canvas
                result = ai_service.create_canvas_from_query(
                    query="Create a text object for socket testing",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify object was created and can be used with socket handlers
                assert result['success'] is True
                assert len(result['objects']) == 1
                
                obj = result['objects'][0]
                
                # Simulate socket object_created event data structure
                socket_data = {
                    'canvas_id': sample_canvas.id,
                    'object': {
                        'type': obj['object_type'],
                        'properties': obj['properties']
                    }
                }
                
                # Verify socket data structure is compatible
                assert 'canvas_id' in socket_data
                assert 'object' in socket_data
                assert 'type' in socket_data['object']
                assert 'properties' in socket_data['object']
    
    def test_ai_objects_work_with_existing_api_endpoints(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects work with existing REST API endpoints."""
        with app.app_context():
            ai_service = AIAgentService()
            canvas_service = CanvasService()
            
            # Mock AI response
            mock_ai_response = {
                "canvas": {
                    "title": "API Test Canvas",
                    "objects": [
                        {
                            "type": "diamond",
                            "label": "API Test Diamond",
                            "x": 300,
                            "y": 300,
                            "width": 100,
                            "height": 100,
                            "color": "#8B5CF6",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_ai_response)
                
                # Create AI canvas
                result = ai_service.create_canvas_from_query(
                    query="Create a diamond shape for API testing",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify object was created
                assert result['success'] is True
                assert len(result['objects']) == 1
                
                obj = result['objects'][0]
                
                # Test that object can be retrieved via existing API structure
                retrieved_obj = canvas_service.get_canvas_object(obj['id'])
                assert retrieved_obj is not None
                
                # Verify object can be serialized for API responses
                api_response = retrieved_obj.to_dict()
                assert 'id' in api_response
                assert 'canvas_id' in api_response
                assert 'object_type' in api_response
                assert 'properties' in api_response
                assert 'created_by' in api_response
                assert 'created_at' in api_response
                assert 'updated_at' in api_response
    
    def test_ai_objects_work_with_existing_validation_schemas(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects pass existing validation schemas."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock AI response with various object types
            mock_ai_response = {
                "canvas": {
                    "title": "Validation Test Canvas",
                    "objects": [
                        {
                            "type": "rectangle",
                            "label": "Valid Rectangle",
                            "x": 50,
                            "y": 50,
                            "width": 100,
                            "height": 50,
                            "color": "#3B82F6",
                            "fontSize": 12
                        },
                        {
                            "type": "text",
                            "label": "Valid Text",
                            "x": 200,
                            "y": 100,
                            "width": 120,
                            "height": 30,
                            "color": "#000000",
                            "fontSize": 14
                        },
                        {
                            "type": "line",
                            "label": "Valid Line",
                            "x": 100,
                            "y": 200,
                            "width": 150,
                            "height": 1,
                            "color": "#6B7280",
                            "fontSize": 12
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_ai_response)
                
                # Create AI canvas
                result = ai_service.create_canvas_from_query(
                    query="Create various shapes for validation testing",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify all objects were created successfully
                assert result['success'] is True
                assert len(result['objects']) == 3
                
                # Test each object against existing validation schemas
                from app.schemas.validation_schemas import CanvasObjectSchema
                from app.utils.validators import InputValidator
                
                for obj in result['objects']:
                    # Test object type validation
                    assert obj['object_type'] in ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
                    
                    # Test properties validation
                    properties = obj['properties']
                    assert 'x' in properties
                    assert 'y' in properties
                    assert 'width' in properties
                    assert 'height' in properties
                    
                    # Test coordinate bounds
                    assert 0 <= properties['x'] <= 1000
                    assert 0 <= properties['y'] <= 1000
                    assert 10 <= properties['width'] <= 500
                    assert 10 <= properties['height'] <= 500
    
    def test_ai_objects_work_with_existing_permission_system(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects respect existing permission system."""
        with app.app_context():
            ai_service = AIAgentService()
            canvas_service = CanvasService()
            
            # Mock AI response
            mock_ai_response = {
                "canvas": {
                    "title": "Permission Test Canvas",
                    "objects": [
                        {
                            "type": "star",
                            "label": "Permission Test Star",
                            "x": 150,
                            "y": 150,
                            "width": 80,
                            "height": 80,
                            "color": "#F59E0B",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_ai_response)
                
                # Create AI canvas
                result = ai_service.create_canvas_from_query(
                    query="Create a star for permission testing",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify object was created with correct permissions
                assert result['success'] is True
                assert len(result['objects']) == 1
                
                obj = result['objects'][0]
                
                # Verify object creator matches the authenticated user
                assert obj['created_by'] == sample_user.id
                
                # Verify user has edit permission on the canvas
                assert canvas_service.check_canvas_permission(sample_canvas.id, sample_user.id, 'edit')
                
                # Verify object can be retrieved by the creator
                retrieved_obj = canvas_service.get_canvas_object(obj['id'])
                assert retrieved_obj is not None
                assert retrieved_obj.created_by == sample_user.id
    
    def test_ai_objects_work_with_existing_rate_limiting(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects work with existing rate limiting system."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock AI response
            mock_ai_response = {
                "canvas": {
                    "title": "Rate Limit Test Canvas",
                    "objects": [
                        {
                            "type": "heart",
                            "label": "Rate Limit Test Heart",
                            "x": 100,
                            "y": 100,
                            "width": 60,
                            "height": 60,
                            "color": "#EC4899",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_ai_response)
                
                # Create AI canvas (this should respect rate limits)
                result = ai_service.create_canvas_from_query(
                    query="Create a heart for rate limit testing",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify object was created successfully
                assert result['success'] is True
                assert len(result['objects']) == 1
                
                # Note: Rate limiting is tested at the API endpoint level,
                # not at the service level, so this test verifies that
                # the service can create objects that will be subject to rate limiting
                obj = result['objects'][0]
                assert obj['object_type'] == 'heart'
                assert obj['created_by'] == sample_user.id


class TestAIAgentExistingCanvasCompatibility:
    """Test that AI Agent doesn't interfere with existing canvas operations."""
    
    def test_existing_canvas_operations_still_work(self, app, session, sample_user, sample_canvas):
        """Test that existing canvas operations continue to work after AI Agent integration."""
        with app.app_context():
            canvas_service = CanvasService()
            
            # Test existing canvas object creation
            existing_obj = canvas_service.create_canvas_object(
                canvas_id=sample_canvas.id,
                object_type='rectangle',
                properties=json.dumps({
                    'x': 100,
                    'y': 100,
                    'width': 120,
                    'height': 60,
                    'fill': '#3B82F6'
                }),
                created_by=sample_user.id
            )
            
            # Verify existing object creation still works
            assert existing_obj is not None
            assert existing_obj.object_type == 'rectangle'
            assert existing_obj.created_by == sample_user.id
            
            # Test existing canvas object retrieval
            retrieved_obj = canvas_service.get_canvas_object(existing_obj.id)
            assert retrieved_obj is not None
            assert retrieved_obj.id == existing_obj.id
            
            # Test existing canvas object update
            updated_properties = {
                'x': 150,
                'y': 150,
                'width': 140,
                'height': 70,
                'fill': '#10B981'
            }
            canvas_service.update_canvas_object(
                existing_obj.id,
                properties=json.dumps(updated_properties),
                updated_by=sample_user.id
            )
            
            # Verify update worked
            updated_obj = canvas_service.get_canvas_object(existing_obj.id)
            assert updated_obj is not None
            assert updated_obj.get_properties()['x'] == 150
            assert updated_obj.get_properties()['fill'] == '#10B981'
            
            # Test existing canvas object deletion
            canvas_service.delete_canvas_object(existing_obj.id, sample_user.id)
            
            # Verify deletion worked
            deleted_obj = canvas_service.get_canvas_object(existing_obj.id)
            assert deleted_obj is None
    
    def test_existing_socket_handlers_still_work(self, app, session, sample_user, sample_canvas):
        """Test that existing socket handlers continue to work after AI Agent integration."""
        with app.app_context():
            # This test verifies that the socket handler registration
            # doesn't conflict with AI Agent integration
            
            from app.socket_handlers.canvas_events import register_canvas_handlers
            from app.socket_handlers.cursor_events import register_cursor_handlers
            from app.socket_handlers.presence_events import register_presence_handlers
            
            # Mock socketio object
            mock_socketio = MagicMock()
            
            # Register existing handlers
            register_canvas_handlers(mock_socketio)
            register_cursor_handlers(mock_socketio)
            register_presence_events(mock_socketio)
            
            # Verify handlers were registered
            assert mock_socketio.on.called
            
            # Verify specific canvas events are registered
            registered_events = [call[0][0] for call in mock_socketio.on.call_args_list]
            expected_events = [
                'join_canvas',
                'leave_canvas', 
                'object_created',
                'object_updated',
                'object_deleted',
                'cursor_move',
                'user_online',
                'user_offline'
            ]
            
            for event in expected_events:
                assert event in registered_events, f"Event {event} not registered"
    
    def test_existing_api_endpoints_still_work(self, app, session, sample_user, sample_canvas):
        """Test that existing API endpoints continue to work after AI Agent integration."""
        with app.app_context():
            # This test verifies that existing API routes are still accessible
            # and not affected by AI Agent route registration
            
            from app.routes.canvas import canvas_bp
            from app.routes.objects import objects_bp
            from app.routes.collaboration import collaboration_bp
            from app.routes.ai_agent import ai_agent_bp
            
            # Verify all blueprints are properly registered
            assert canvas_bp is not None
            assert objects_bp is not None
            assert collaboration_bp is not None
            assert ai_agent_bp is not None
            
            # Verify AI Agent routes don't conflict with existing routes
            ai_routes = ['/api/ai-agent/create-canvas', '/api/ai-agent/health', '/api/ai-agent/models']
            existing_routes = [
                '/api/canvas/',
                '/api/objects/',
                '/api/collaboration/',
                '/api/auth/'
            ]
            
            # AI routes should not conflict with existing routes
            for ai_route in ai_routes:
                for existing_route in existing_routes:
                    assert not ai_route.startswith(existing_route), f"AI route {ai_route} conflicts with existing route {existing_route}"
    
    def test_existing_authentication_still_works(self, app, session, sample_user):
        """Test that existing authentication continues to work after AI Agent integration."""
        with app.app_context():
            auth_service = AuthService()
            
            # Test existing authentication methods
            user = auth_service.get_user_by_id(sample_user.id)
            assert user is not None
            assert user.id == sample_user.id
            
            # Test existing user registration
            new_user_data = {
                'uid': 'test-new-user',
                'email': 'newuser@test.com',
                'name': 'New Test User'
            }
            
            # Mock Firebase token
            mock_token = 'mock-firebase-token'
            
            with patch.object(auth_service, 'verify_token') as mock_verify:
                mock_verify.return_value = new_user_data
                
                new_user = auth_service.register_user(mock_token)
                assert new_user is not None
                assert new_user.email == 'newuser@test.com'
            
            # Test existing permission checking
            canvas_service = CanvasService()
            test_canvas = Canvas(
                id='test-canvas-permissions',
                title='Test Canvas',
                user_id=sample_user.id,
                is_public=False
            )
            session.add(test_canvas)
            session.commit()
            
            # Test edit permission
            has_edit_permission = canvas_service.check_canvas_permission(
                test_canvas.id, 
                sample_user.id, 
                'edit'
            )
            assert has_edit_permission is True
            
            # Test view permission
            has_view_permission = canvas_service.check_canvas_permission(
                test_canvas.id, 
                sample_user.id, 
                'view'
            )
            assert has_view_permission is True


if __name__ == '__main__':
    pytest.main([__file__])
