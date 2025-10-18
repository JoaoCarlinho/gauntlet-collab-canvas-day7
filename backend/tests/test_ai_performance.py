"""
Performance tests for AI Agent optimization features.
Tests caching, request optimization, and performance metrics.
"""

import pytest
import time
import json
from unittest.mock import patch, MagicMock
from app.services.ai_agent_service import AIAgentService
from app.services.ai_performance_service import AIPerformanceService
from app.models.user import User
from app.models.canvas import Canvas


class TestAIPerformanceOptimization:
    """Test AI Agent performance optimization features."""
    
    def test_request_caching(self, app, session, sample_user, sample_canvas):
        """Test that identical requests are cached for better performance."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock OpenAI response
            mock_response = {
                "canvas": {
                    "title": "Cached Test Canvas",
                    "objects": [
                        {
                            "type": "rectangle",
                            "label": "Cached Rectangle",
                            "x": 100,
                            "y": 100,
                            "width": 120,
                            "height": 60,
                            "color": "#3B82F6",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_response)
                
                # First request - should call OpenAI
                start_time = time.time()
                result1 = ai_service.create_canvas_from_query(
                    query="Create a test rectangle",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                first_request_time = time.time() - start_time
                
                # Second identical request - should use cache
                start_time = time.time()
                result2 = ai_service.create_canvas_from_query(
                    query="Create a test rectangle",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                second_request_time = time.time() - start_time
                
                # Verify cache was used (second request should be faster)
                assert second_request_time < first_request_time
                assert result1['success'] == result2['success']
                
                # Verify OpenAI was only called once
                assert mock_create.call_count == 1
    
    def test_common_pattern_detection(self, app, session, sample_user, sample_canvas):
        """Test that common patterns are detected and used instead of AI generation."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Test flowchart pattern detection
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                result = ai_service.create_canvas_from_query(
                    query="Create a flowchart for user login process",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify OpenAI was not called (pattern was used instead)
                assert mock_create.call_count == 0
                assert result['success'] is True
                assert len(result['objects']) > 0
                
                # Verify pattern objects have correct structure
                for obj in result['objects']:
                    assert 'id' in obj
                    assert 'object_type' in obj
                    assert 'properties' in obj
    
    def test_query_optimization(self, app, session, sample_user, sample_canvas):
        """Test that user queries are optimized for better AI performance."""
        with app.app_context():
            performance_service = AIPerformanceService()
            
            # Test short query optimization
            short_query = "create"
            optimized = performance_service._optimize_query(short_query)
            assert len(optimized) > len(short_query)
            assert "Create a canvas with:" in optimized
            
            # Test vague query optimization
            vague_query = "make something"
            optimized = performance_service._optimize_query(vague_query)
            assert "with clear structure and labels" in optimized
            
            # Test normal query (should remain unchanged)
            normal_query = "Create a detailed flowchart for the user registration process"
            optimized = performance_service._optimize_query(normal_query)
            assert optimized == normal_query.strip()
    
    def test_object_optimization_for_rendering(self, app, session, sample_user, sample_canvas):
        """Test that AI-generated objects are optimized for rendering performance."""
        with app.app_context():
            performance_service = AIPerformanceService()
            
            # Test objects with missing properties
            test_objects = [
                {
                    "type": "rectangle",
                    "label": "Test Rectangle",
                    "x": 100,
                    "y": 100,
                    "width": 120,
                    "height": 60
                },
                {
                    "type": "text",
                    "label": "Test Text",
                    "x": 200,
                    "y": 200
                }
            ]
            
            optimized_objects = performance_service.optimize_objects_for_rendering(test_objects)
            
            # Verify all objects have required properties
            for obj in optimized_objects:
                properties = obj['properties']
                assert 'x' in properties
                assert 'y' in properties
                assert 'width' in properties
                assert 'height' in properties
                assert 'fill' in properties
                assert 'stroke' in properties
                assert 'strokeWidth' in properties
                
                # Verify text objects have text property
                if obj['type'] == 'text':
                    assert 'text' in properties
                    assert 'fontSize' in properties
                    assert 'fontFamily' in properties
    
    def test_performance_metrics_tracking(self, app, session, sample_user, sample_canvas):
        """Test that performance metrics are properly tracked."""
        with app.app_context():
            ai_service = AIAgentService()
            performance_service = ai_service.performance_service
            
            # Mock OpenAI response
            mock_response = {
                "canvas": {
                    "title": "Metrics Test Canvas",
                    "objects": [
                        {
                            "type": "circle",
                            "label": "Test Circle",
                            "x": 150,
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
                mock_create.return_value.choices[0].message.content = json.dumps(mock_response)
                
                # Make a request
                result = ai_service.create_canvas_from_query(
                    query="Create a test circle",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify metrics were updated
                metrics = performance_service.get_performance_metrics()
                assert metrics['total_requests'] >= 1
                assert metrics['cache_misses'] >= 1
                assert metrics['average_response_time'] != "0.00s"
                assert metrics['cache_size'] >= 1
    
    def test_cache_size_limiting(self, app, session, sample_user, sample_canvas):
        """Test that cache size is limited to prevent memory issues."""
        with app.app_context():
            performance_service = AIPerformanceService()
            
            # Fill cache beyond limit
            for i in range(150):  # More than the 100 limit
                cache_key = f"test_key_{i}"
                performance_service._cache_result(cache_key, {"test": f"data_{i}"})
            
            # Verify cache size is limited
            assert len(performance_service.request_cache) <= 100
            
            # Verify oldest entries were removed
            assert "test_key_0" not in performance_service.request_cache
            assert "test_key_49" not in performance_service.request_cache
            assert "test_key_149" in performance_service.request_cache
    
    def test_object_overlap_prevention(self, app, session, sample_user, sample_canvas):
        """Test that object overlap is prevented for better visual layout."""
        with app.app_context():
            performance_service = AIPerformanceService()
            
            # Test objects that would overlap
            test_objects = [
                {
                    "type": "rectangle",
                    "properties": {"x": 100, "y": 100, "width": 120, "height": 60}
                },
                {
                    "type": "rectangle", 
                    "properties": {"x": 150, "y": 120, "width": 120, "height": 60}
                }
            ]
            
            optimized_objects = performance_service.optimize_objects_for_rendering(test_objects)
            
            # Verify objects don't overlap
            obj1 = optimized_objects[0]
            obj2 = optimized_objects[1]
            
            x1, y1 = obj1['properties']['x'], obj1['properties']['y']
            w1, h1 = obj1['properties']['width'], obj1['properties']['height']
            x2, y2 = obj2['properties']['x'], obj2['properties']['y']
            w2, h2 = obj2['properties']['width'], obj2['properties']['height']
            
            # Check that objects don't overlap
            overlap = not (x1 + w1 <= x2 or x2 + w2 <= x1 or y1 + h1 <= y2 or y2 + h2 <= y1)
            assert not overlap, "Objects should not overlap after optimization"
    
    def test_rate_limiting_optimization(self, app, session, sample_user, sample_canvas):
        """Test that rate limiting is optimized for better performance."""
        with app.app_context():
            from app.middleware.rate_limiting import RateLimitConfig
            
            # Verify AI rate limits are reasonable
            ai_limits = RateLimitConfig.AI_LIMITS
            
            # Check that create_canvas limit is reasonable (not too restrictive)
            assert ai_limits['create_canvas'] == '10 per minute'
            
            # Check that health check limit is high (for monitoring)
            assert ai_limits['health'] == '60 per minute'
            
            # Check that models limit is reasonable
            assert ai_limits['models'] == '20 per minute'
            
            # Check that performance metrics limit is reasonable
            assert ai_limits['performance'] == '30 per minute'
    
    def test_memory_usage_optimization(self, app, session, sample_user, sample_canvas):
        """Test that memory usage is optimized."""
        with app.app_context():
            performance_service = AIPerformanceService()
            
            # Test that cache doesn't grow indefinitely
            initial_cache_size = len(performance_service.request_cache)
            
            # Add many items to cache
            for i in range(50):
                cache_key = f"memory_test_{i}"
                performance_service._cache_result(cache_key, {"data": f"test_{i}"})
            
            # Verify cache size is controlled
            final_cache_size = len(performance_service.request_cache)
            assert final_cache_size <= 100  # Should not exceed limit
            
            # Test cache clearing
            performance_service.clear_cache()
            assert len(performance_service.request_cache) == 0


class TestAIPerformanceIntegration:
    """Test AI Agent performance integration with existing systems."""
    
    def test_performance_service_integration(self, app, session, sample_user, sample_canvas):
        """Test that performance service integrates properly with AI service."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Verify performance service is properly initialized
            assert ai_service.performance_service is not None
            assert isinstance(ai_service.performance_service, AIPerformanceService)
            
            # Verify performance service methods are accessible
            assert hasattr(ai_service.performance_service, 'optimize_request')
            assert hasattr(ai_service.performance_service, 'get_performance_metrics')
            assert hasattr(ai_service.performance_service, 'clear_cache')
    
    def test_performance_metrics_endpoint(self, app, session, sample_user, sample_canvas):
        """Test that performance metrics endpoint works correctly."""
        with app.app_context():
            from app.routes.ai_agent import ai_agent_bp
            
            # Verify performance endpoint is registered
            routes = []
            for rule in app.url_map.iter_rules():
                if 'ai-agent' in rule.rule:
                    routes.append(rule.rule)
            
            assert '/api/ai-agent/performance' in routes
    
    def test_performance_optimization_does_not_break_functionality(self, app, session, sample_user, sample_canvas):
        """Test that performance optimizations don't break existing functionality."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock OpenAI response
            mock_response = {
                "canvas": {
                    "title": "Functionality Test Canvas",
                    "objects": [
                        {
                            "type": "rectangle",
                            "label": "Test Rectangle",
                            "x": 100,
                            "y": 100,
                            "width": 120,
                            "height": 60,
                            "color": "#3B82F6",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_response)
                
                # Test that optimized service still works correctly
                result = ai_service.create_canvas_from_query(
                    query="Create a test rectangle",
                    user_id=sample_user.id,
                    canvas_id=sample_canvas.id
                )
                
                # Verify result structure is correct
                assert result['success'] is True
                assert 'canvas_id' in result
                assert 'objects' in result
                assert 'message' in result
                assert 'title' in result
                
                # Verify objects are properly structured
                for obj in result['objects']:
                    assert 'id' in obj
                    assert 'object_type' in obj
                    assert 'properties' in obj
                    assert 'created_by' in obj
                    assert 'created_at' in obj
                    assert 'updated_at' in obj


if __name__ == '__main__':
    pytest.main([__file__])
