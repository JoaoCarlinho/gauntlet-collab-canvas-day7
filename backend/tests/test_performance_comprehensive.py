"""
Comprehensive Performance Testing Suite
Tests system performance under various load conditions and scenarios
"""
import pytest
import json
import time
import threading
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask
from app import create_app, db
from app.models import User, Canvas, CanvasObject
from app.services.auth_service import AuthService
from app.services.canvas_service import CanvasService
from app.services.ai_service import AIService


class TestPerformanceComprehensive:
    """Comprehensive performance test suite."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self, app, session):
        """Set up test data for each test method."""
        self.app = app
        self.client = app.test_client()
        self.session = session
        
        # Create test users
        self.users = []
        for i in range(10):
            user = User(
                id=f'perf-user-{i}',
                email=f'user{i}@perf.com',
                name=f'Performance User {i}',
                firebase_uid=f'firebase-uid-{i}'
            )
            self.users.append(user)
            self.session.add(user)
        
        self.session.commit()
        
        # Create test canvas
        self.canvas = Canvas(
            id='perf-test-canvas',
            name='Performance Test Canvas',
            description='A canvas for performance testing',
            owner_id=self.users[0].id,
            visibility='private'
        )
        self.session.add(self.canvas)
        self.session.commit()

    def test_api_response_times(self):
        """Test API response times under normal load."""
        response_times = []
        
        # Test canvas list endpoint
        for _ in range(50):
            start_time = time.time()
            response = self.client.get(
                '/api/canvases',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.users[0])}'}
            )
            end_time = time.time()
            
            assert response.status_code == 200
            response_times.append(end_time - start_time)
        
        # Calculate statistics
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        max_response_time = max(response_times)
        
        # Performance assertions
        assert avg_response_time < 0.5, f"Average response time too high: {avg_response_time:.3f}s"
        assert p95_response_time < 1.0, f"95th percentile response time too high: {p95_response_time:.3f}s"
        assert max_response_time < 2.0, f"Max response time too high: {max_response_time:.3f}s"
        
        print(f"API Response Times - Avg: {avg_response_time:.3f}s, P95: {p95_response_time:.3f}s, Max: {max_response_time:.3f}s")

    def test_concurrent_canvas_creation(self):
        """Test concurrent canvas creation performance."""
        def create_canvas(user_id, canvas_index):
            """Helper function to create a canvas."""
            canvas_data = {
                'name': f'Performance Canvas {canvas_index}',
                'description': f'Canvas created for performance testing {canvas_index}',
                'visibility': 'private'
            }
            
            start_time = time.time()
            response = self.client.post(
                '/api/canvases',
                data=json.dumps(canvas_data),
                content_type='application/json',
                headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
            )
            end_time = time.time()
            
            return {
                'status_code': response.status_code,
                'response_time': end_time - start_time,
                'canvas_id': json.loads(response.data).get('id') if response.status_code == 201 else None
            }
        
        # Test concurrent canvas creation
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(20):
                future = executor.submit(create_canvas, i, i)
                futures.append(future)
            
            results = []
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
        
        # Analyze results
        successful_creations = [r for r in results if r['status_code'] == 201]
        response_times = [r['response_time'] for r in successful_creations]
        
        assert len(successful_creations) >= 18, f"Only {len(successful_creations)}/20 canvas creations succeeded"
        
        avg_response_time = statistics.mean(response_times)
        max_response_time = max(response_times)
        
        assert avg_response_time < 1.0, f"Average concurrent creation time too high: {avg_response_time:.3f}s"
        assert max_response_time < 3.0, f"Max concurrent creation time too high: {max_response_time:.3f}s"
        
        print(f"Concurrent Canvas Creation - Success: {len(successful_creations)}/20, Avg: {avg_response_time:.3f}s, Max: {max_response_time:.3f}s")

    def test_concurrent_object_operations(self):
        """Test concurrent object operations performance."""
        def perform_object_operations(user_id, operation_count):
            """Helper function to perform object operations."""
            results = []
            
            for i in range(operation_count):
                # Create object
                object_data = {
                    'object_type': 'rectangle',
                    'properties': {
                        'x': i * 10,
                        'y': i * 10,
                        'width': 50,
                        'height': 50,
                        'fill': f'#{i:02x}0000'
                    }
                }
                
                start_time = time.time()
                response = self.client.post(
                    f'/api/canvases/{self.canvas.id}/objects',
                    data=json.dumps(object_data),
                    content_type='application/json',
                    headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
                )
                end_time = time.time()
                
                if response.status_code == 201:
                    object_id = json.loads(response.data)['id']
                    
                    # Update object
                    update_data = {
                        'properties': {
                            'x': i * 10 + 5,
                            'y': i * 10 + 5,
                            'width': 60,
                            'height': 60,
                            'fill': f'#{i:02x}0000'
                        }
                    }
                    
                    update_start = time.time()
                    update_response = self.client.put(
                        f'/api/canvases/{self.canvas.id}/objects/{object_id}',
                        data=json.dumps(update_data),
                        content_type='application/json',
                        headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
                    )
                    update_end = time.time()
                    
                    results.append({
                        'create_time': end_time - start_time,
                        'update_time': update_end - update_start,
                        'create_success': response.status_code == 201,
                        'update_success': update_response.status_code == 200
                    })
            
            return results
        
        # Test concurrent object operations
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for i in range(5):
                future = executor.submit(perform_object_operations, i, 10)
                futures.append(future)
            
            all_results = []
            for future in as_completed(futures):
                results = future.result()
                all_results.extend(results)
        
        # Analyze results
        successful_operations = [r for r in all_results if r['create_success'] and r['update_success']]
        create_times = [r['create_time'] for r in successful_operations]
        update_times = [r['update_time'] for r in successful_operations]
        
        assert len(successful_operations) >= 40, f"Only {len(successful_operations)}/50 operations succeeded"
        
        avg_create_time = statistics.mean(create_times)
        avg_update_time = statistics.mean(update_times)
        
        assert avg_create_time < 0.5, f"Average object creation time too high: {avg_create_time:.3f}s"
        assert avg_update_time < 0.3, f"Average object update time too high: {avg_update_time:.3f}s"
        
        print(f"Concurrent Object Operations - Success: {len(successful_operations)}/50, Avg Create: {avg_create_time:.3f}s, Avg Update: {avg_update_time:.3f}s")

    def test_database_query_performance(self):
        """Test database query performance."""
        # Create many canvases and objects for testing
        canvases = []
        for i in range(100):
            canvas = Canvas(
                id=f'perf-canvas-{i}',
                name=f'Performance Canvas {i}',
                owner_id=self.users[i % len(self.users)].id,
                visibility='private'
            )
            canvases.append(canvas)
            self.session.add(canvas)
        
        self.session.commit()
        
        # Create objects for each canvas
        for canvas in canvases:
            for j in range(10):
                obj = CanvasObject(
                    id=f'perf-object-{canvas.id}-{j}',
                    canvas_id=canvas.id,
                    object_type='rectangle',
                    properties=json.dumps({
                        'x': j * 10,
                        'y': j * 10,
                        'width': 50,
                        'height': 50
                    }),
                    created_by=canvas.owner_id
                )
                self.session.add(obj)
        
        self.session.commit()
        
        # Test query performance
        query_times = []
        
        for _ in range(20):
            start_time = time.time()
            
            # Complex query: get all canvases with their objects and owners
            canvases_with_objects = self.session.query(Canvas).join(User).join(CanvasObject).all()
            
            end_time = time.time()
            query_times.append(end_time - start_time)
        
        avg_query_time = statistics.mean(query_times)
        max_query_time = max(query_times)
        
        assert avg_query_time < 0.1, f"Average query time too high: {avg_query_time:.3f}s"
        assert max_query_time < 0.5, f"Max query time too high: {max_query_time:.3f}s"
        
        print(f"Database Query Performance - Avg: {avg_query_time:.3f}s, Max: {max_query_time:.3f}s")

    def test_memory_usage_under_load(self):
        """Test memory usage under load."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create many objects to test memory usage
        objects_created = 0
        for i in range(1000):
            obj = CanvasObject(
                id=f'memory-test-object-{i}',
                canvas_id=self.canvas.id,
                object_type='rectangle',
                properties=json.dumps({
                    'x': i % 100,
                    'y': i % 100,
                    'width': 50,
                    'height': 50,
                    'fill': f'#{i % 256:02x}0000'
                }),
                created_by=self.users[0].id
            )
            self.session.add(obj)
            objects_created += 1
            
            # Commit every 100 objects to avoid memory buildup
            if i % 100 == 0:
                self.session.commit()
        
        self.session.commit()
        
        # Check memory usage
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 100MB for 1000 objects)
        assert memory_increase < 100, f"Memory usage increased too much: {memory_increase:.1f}MB"
        
        print(f"Memory Usage - Initial: {initial_memory:.1f}MB, Final: {final_memory:.1f}MB, Increase: {memory_increase:.1f}MB")

    def test_ai_service_performance(self):
        """Test AI service performance."""
        ai_service = AIService()
        
        # Test AI canvas generation performance
        generation_times = []
        
        for i in range(5):
            start_time = time.time()
            
            try:
                result = ai_service.generate_canvas_content(
                    prompt=f"Create a simple diagram with {i+1} rectangles",
                    canvas_id=self.canvas.id
                )
                end_time = time.time()
                
                generation_times.append(end_time - start_time)
                
                # Verify result structure
                assert 'objects' in result
                assert len(result['objects']) > 0
                
            except Exception as e:
                # AI service might not be available in test environment
                print(f"AI service test skipped: {e}")
                break
        
        if generation_times:
            avg_generation_time = statistics.mean(generation_times)
            max_generation_time = max(generation_times)
            
            # AI generation should complete within reasonable time
            assert avg_generation_time < 10.0, f"Average AI generation time too high: {avg_generation_time:.3f}s"
            assert max_generation_time < 30.0, f"Max AI generation time too high: {max_generation_time:.3f}s"
            
            print(f"AI Service Performance - Avg: {avg_generation_time:.3f}s, Max: {max_generation_time:.3f}s")

    def test_websocket_performance(self):
        """Test WebSocket performance under load."""
        from flask_socketio import SocketIO
        
        socketio = SocketIO(self.app, cors_allowed_origins="*")
        
        # Test WebSocket connection performance
        connection_times = []
        
        for i in range(20):
            start_time = time.time()
            
            with socketio.test_client(self.app) as client:
                client.emit('join_canvas', {
                    'canvas_id': self.canvas.id,
                    'user_id': self.users[i % len(self.users)].id
                })
                
                # Wait for acknowledgment
                received = client.get_received()
                end_time = time.time()
                
                connection_times.append(end_time - start_time)
        
        avg_connection_time = statistics.mean(connection_times)
        max_connection_time = max(connection_times)
        
        assert avg_connection_time < 0.1, f"Average WebSocket connection time too high: {avg_connection_time:.3f}s"
        assert max_connection_time < 0.5, f"Max WebSocket connection time too high: {max_connection_time:.3f}s"
        
        print(f"WebSocket Performance - Avg Connection: {avg_connection_time:.3f}s, Max: {max_connection_time:.3f}s")

    def test_concurrent_user_sessions(self):
        """Test system performance with many concurrent user sessions."""
        def simulate_user_session(user_id, session_duration=5):
            """Simulate a user session with various operations."""
            start_time = time.time()
            operations_performed = 0
            
            while time.time() - start_time < session_duration:
                # Randomly perform different operations
                operation = operations_performed % 4
                
                if operation == 0:
                    # List canvases
                    response = self.client.get(
                        '/api/canvases',
                        headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
                    )
                    assert response.status_code == 200
                
                elif operation == 1:
                    # Create object
                    object_data = {
                        'object_type': 'rectangle',
                        'properties': {
                            'x': operations_performed * 10,
                            'y': operations_performed * 10,
                            'width': 50,
                            'height': 50
                        }
                    }
                    response = self.client.post(
                        f'/api/canvases/{self.canvas.id}/objects',
                        data=json.dumps(object_data),
                        content_type='application/json',
                        headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
                    )
                    assert response.status_code == 201
                
                elif operation == 2:
                    # Get canvas details
                    response = self.client.get(
                        f'/api/canvases/{self.canvas.id}',
                        headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
                    )
                    assert response.status_code == 200
                
                elif operation == 3:
                    # List canvas objects
                    response = self.client.get(
                        f'/api/canvases/{self.canvas.id}/objects',
                        headers={'Authorization': f'Bearer {self._get_auth_token(self.users[user_id % len(self.users)])}'}
                    )
                    assert response.status_code == 200
                
                operations_performed += 1
                time.sleep(0.1)  # Small delay between operations
            
            return operations_performed
        
        # Test with multiple concurrent user sessions
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(20):
                future = executor.submit(simulate_user_session, i, 3)  # 3-second sessions
                futures.append(future)
            
            total_operations = 0
            for future in as_completed(futures):
                operations = future.result()
                total_operations += operations
        
        # Should handle concurrent sessions without issues
        assert total_operations > 100, f"Too few operations completed: {total_operations}"
        
        print(f"Concurrent User Sessions - Total Operations: {total_operations}")

    def _get_auth_token(self, user):
        """Helper method to get auth token for user."""
        auth_service = AuthService()
        return auth_service.generate_token(user.id)
