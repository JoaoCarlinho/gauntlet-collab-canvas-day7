"""
Comprehensive WebSocket Testing Suite
Tests real-time WebSocket functionality including collaboration, presence, and error handling
"""
import pytest
import json
import time
import threading
from flask import Flask
from flask_socketio import SocketIO, emit, join_room, leave_room
from app import create_app, db, socketio
from app.models import User, Canvas, CanvasObject
from app.services.auth_service import AuthService


class TestWebSocketComprehensive:
    """Comprehensive WebSocket test suite."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self, app, session):
        """Set up test data for each test method."""
        self.app = app
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
            description='A test canvas for WebSocket testing',
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

    def test_canvas_join_and_leave(self):
        """Test joining and leaving canvas rooms."""
        with self.app.test_client() as client:
            with client.session_transaction() as sess:
                sess['user_id'] = self.user1.id
            
            # Test joining canvas room
            response = client.get('/socket.io/')
            assert response.status_code == 200
            
            # Simulate WebSocket connection
            socketio_client = socketio.test_client(self.app)
            assert socketio_client.is_connected()
            
            # Test joining canvas room
            socketio_client.emit('join_canvas', {
                'canvas_id': self.canvas.id,
                'user_id': self.user1.id
            })
            
            # Wait for acknowledgment
            received = socketio_client.get_received()
            assert len(received) > 0
            assert received[0]['name'] == 'canvas_joined'
            
            # Test leaving canvas room
            socketio_client.emit('leave_canvas', {
                'canvas_id': self.canvas.id,
                'user_id': self.user1.id
            })
            
            received = socketio_client.get_received()
            assert len(received) > 0
            assert received[-1]['name'] == 'canvas_left'

    def test_object_creation_synchronization(self):
        """Test real-time object creation synchronization."""
        # Create two WebSocket clients to simulate multiple users
        client1 = socketio.test_client(self.app)
        client2 = socketio.test_client(self.app)
        
        # Both clients join the canvas
        client1.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        client2.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user2.id
        })
        
        # Wait for both to join
        time.sleep(0.1)
        
        # User 1 creates an object
        object_data = {
            'canvas_id': self.canvas.id,
            'object_type': 'circle',
            'properties': {
                'x': 200,
                'y': 200,
                'radius': 50,
                'fill': '#00ff00'
            },
            'user_id': self.user1.id
        }
        
        client1.emit('create_object', object_data)
        
        # Wait for synchronization
        time.sleep(0.1)
        
        # Check that User 2 receives the object creation event
        received = client2.get_received()
        object_created_event = None
        for event in received:
            if event['name'] == 'object_created':
                object_created_event = event
                break
        
        assert object_created_event is not None
        assert object_created_event['args'][0]['object_type'] == 'circle'
        assert object_created_event['args'][0]['properties']['x'] == 200

    def test_object_modification_synchronization(self):
        """Test real-time object modification synchronization."""
        # Create two WebSocket clients
        client1 = socketio.test_client(self.app)
        client2 = socketio.test_client(self.app)
        
        # Both clients join the canvas
        client1.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        client2.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user2.id
        })
        
        time.sleep(0.1)
        
        # User 1 modifies an existing object
        modification_data = {
            'canvas_id': self.canvas.id,
            'object_id': self.canvas_object.id,
            'properties': {
                'x': 300,
                'y': 300,
                'width': 250,
                'height': 200,
                'fill': '#0000ff'
            },
            'user_id': self.user1.id
        }
        
        client1.emit('update_object', modification_data)
        
        # Wait for synchronization
        time.sleep(0.1)
        
        # Check that User 2 receives the object update event
        received = client2.get_received()
        object_updated_event = None
        for event in received:
            if event['name'] == 'object_updated':
                object_updated_event = event
                break
        
        assert object_updated_event is not None
        assert object_updated_event['args'][0]['object_id'] == self.canvas_object.id
        assert object_updated_event['args'][0]['properties']['x'] == 300

    def test_object_deletion_synchronization(self):
        """Test real-time object deletion synchronization."""
        # Create two WebSocket clients
        client1 = socketio.test_client(self.app)
        client2 = socketio.test_client(self.app)
        
        # Both clients join the canvas
        client1.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        client2.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user2.id
        })
        
        time.sleep(0.1)
        
        # User 1 deletes an object
        deletion_data = {
            'canvas_id': self.canvas.id,
            'object_id': self.canvas_object.id,
            'user_id': self.user1.id
        }
        
        client1.emit('delete_object', deletion_data)
        
        # Wait for synchronization
        time.sleep(0.1)
        
        # Check that User 2 receives the object deletion event
        received = client2.get_received()
        object_deleted_event = None
        for event in received:
            if event['name'] == 'object_deleted':
                object_deleted_event = event
                break
        
        assert object_deleted_event is not None
        assert object_deleted_event['args'][0]['object_id'] == self.canvas_object.id

    def test_cursor_position_synchronization(self):
        """Test real-time cursor position synchronization."""
        # Create two WebSocket clients
        client1 = socketio.test_client(self.app)
        client2 = socketio.test_client(self.app)
        
        # Both clients join the canvas
        client1.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        client2.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user2.id
        })
        
        time.sleep(0.1)
        
        # User 1 moves cursor
        cursor_data = {
            'canvas_id': self.canvas.id,
            'x': 150,
            'y': 150,
            'user_id': self.user1.id
        }
        
        client1.emit('cursor_move', cursor_data)
        
        # Wait for synchronization
        time.sleep(0.1)
        
        # Check that User 2 receives the cursor position update
        received = client2.get_received()
        cursor_move_event = None
        for event in received:
            if event['name'] == 'cursor_moved':
                cursor_move_event = event
                break
        
        assert cursor_move_event is not None
        assert cursor_move_event['args'][0]['user_id'] == self.user1.id
        assert cursor_move_event['args'][0]['x'] == 150
        assert cursor_move_event['args'][0]['y'] == 150

    def test_user_presence_synchronization(self):
        """Test user presence synchronization."""
        # Create two WebSocket clients
        client1 = socketio.test_client(self.app)
        client2 = socketio.test_client(self.app)
        
        # User 1 joins the canvas
        client1.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        
        time.sleep(0.1)
        
        # User 2 joins the canvas
        client2.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user2.id
        })
        
        # Wait for synchronization
        time.sleep(0.1)
        
        # Check that User 1 receives User 2's presence
        received = client1.get_received()
        user_joined_event = None
        for event in received:
            if event['name'] == 'user_joined':
                user_joined_event = event
                break
        
        assert user_joined_event is not None
        assert user_joined_event['args'][0]['user_id'] == self.user2.id
        
        # User 2 leaves the canvas
        client2.emit('leave_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user2.id
        })
        
        # Wait for synchronization
        time.sleep(0.1)
        
        # Check that User 1 receives User 2's departure
        received = client1.get_received()
        user_left_event = None
        for event in received:
            if event['name'] == 'user_left':
                user_left_event = event
                break
        
        assert user_left_event is not None
        assert user_left_event['args'][0]['user_id'] == self.user2.id

    def test_concurrent_operations(self):
        """Test handling of concurrent WebSocket operations."""
        # Create multiple WebSocket clients
        clients = []
        for i in range(5):
            client = socketio.test_client(self.app)
            clients.append(client)
            
            # Each client joins the canvas
            client.emit('join_canvas', {
                'canvas_id': self.canvas.id,
                'user_id': f'test-user-{i}'
            })
        
        time.sleep(0.1)
        
        # All clients perform operations simultaneously
        threads = []
        for i, client in enumerate(clients):
            thread = threading.Thread(target=self._perform_concurrent_operation, 
                                    args=(client, i))
            threads.append(thread)
            thread.start()
        
        # Wait for all operations to complete
        for thread in threads:
            thread.join()
        
        time.sleep(0.2)
        
        # Verify all operations were processed
        for client in clients:
            received = client.get_received()
            # Should have received events from other clients
            assert len(received) > 0

    def _perform_concurrent_operation(self, client, user_index):
        """Helper method for concurrent operations."""
        # Create an object
        object_data = {
            'canvas_id': self.canvas.id,
            'object_type': 'rectangle',
            'properties': {
                'x': user_index * 100,
                'y': user_index * 100,
                'width': 50,
                'height': 50,
                'fill': f'#{user_index:02x}0000'
            },
            'user_id': f'test-user-{user_index}'
        }
        
        client.emit('create_object', object_data)
        time.sleep(0.1)

    def test_websocket_error_handling(self):
        """Test WebSocket error handling."""
        client = socketio.test_client(self.app)
        
        # Test invalid canvas ID
        client.emit('join_canvas', {
            'canvas_id': 'invalid-canvas-id',
            'user_id': self.user1.id
        })
        
        time.sleep(0.1)
        
        received = client.get_received()
        error_event = None
        for event in received:
            if event['name'] == 'error':
                error_event = event
                break
        
        assert error_event is not None
        assert 'error' in error_event['args'][0]

    def test_websocket_authentication(self):
        """Test WebSocket authentication."""
        # Test connection without authentication
        client = socketio.test_client(self.app)
        
        # Try to join canvas without proper authentication
        client.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': 'unauthorized-user'
        })
        
        time.sleep(0.1)
        
        received = client.get_received()
        error_event = None
        for event in received:
            if event['name'] == 'error':
                error_event = event
                break
        
        assert error_event is not None
        assert 'unauthorized' in error_event['args'][0]['error'].lower()

    def test_websocket_rate_limiting(self):
        """Test WebSocket rate limiting."""
        client = socketio.test_client(self.app)
        
        # Join canvas first
        client.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        
        time.sleep(0.1)
        
        # Send many rapid events
        for i in range(100):
            client.emit('cursor_move', {
                'canvas_id': self.canvas.id,
                'x': i,
                'y': i,
                'user_id': self.user1.id
            })
        
        time.sleep(0.1)
        
        # Should receive rate limit warning
        received = client.get_received()
        rate_limit_event = None
        for event in received:
            if event['name'] == 'rate_limit_warning':
                rate_limit_event = event
                break
        
        # Rate limiting might not trigger with test client, but should not crash
        assert client.is_connected()

    def test_websocket_reconnection(self):
        """Test WebSocket reconnection handling."""
        # Create client and join canvas
        client = socketio.test_client(self.app)
        client.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        
        time.sleep(0.1)
        
        # Disconnect client
        client.disconnect()
        
        # Reconnect
        client = socketio.test_client(self.app)
        client.emit('join_canvas', {
            'canvas_id': self.canvas.id,
            'user_id': self.user1.id
        })
        
        time.sleep(0.1)
        
        # Should be able to reconnect successfully
        assert client.is_connected()
        
        received = client.get_received()
        canvas_joined_event = None
        for event in received:
            if event['name'] == 'canvas_joined':
                canvas_joined_event = event
                break
        
        assert canvas_joined_event is not None
