#!/usr/bin/env python3
"""
Socket.IO Connectivity Test
Tests WebSocket and polling transport connectivity to identify issues.
"""

import socketio
import time
import sys
import os
from typing import Dict, Any

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class SocketConnectivityTester:
    """Test Socket.IO connectivity with different transport configurations."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.environ.get('SOCKET_URL', 'http://localhost:5000')
        self.results = {}
    
    def test_polling_transport(self) -> Dict[str, Any]:
        """Test Socket.IO connection using polling transport only."""
        print("Testing polling transport...")
        
        try:
            # Create Socket.IO client with polling only
            sio = socketio.Client()
            
            connection_successful = False
            error_message = None
            
            @sio.event
            def connect():
                nonlocal connection_successful
                connection_successful = True
                print("✓ Polling transport connection successful")
            
            @sio.event
            def connect_error(data):
                nonlocal error_message
                error_message = str(data)
                print(f"✗ Polling transport connection failed: {data}")
            
            @sio.event
            def disconnect():
                print("Polling transport disconnected")
            
            # Attempt connection with polling only
            sio.connect(
                self.base_url,
                transports=['polling'],
                wait_timeout=10
            )
            
            # Wait a moment for connection to establish
            time.sleep(2)
            
            if connection_successful:
                sio.disconnect()
            
            return {
                'success': connection_successful,
                'error': error_message,
                'transport': 'polling'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'transport': 'polling'
            }
    
    def test_websocket_transport(self) -> Dict[str, Any]:
        """Test Socket.IO connection using WebSocket transport only."""
        print("Testing WebSocket transport...")
        
        try:
            # Create Socket.IO client with WebSocket only
            sio = socketio.Client()
            
            connection_successful = False
            error_message = None
            
            @sio.event
            def connect():
                nonlocal connection_successful
                connection_successful = True
                print("✓ WebSocket transport connection successful")
            
            @sio.event
            def connect_error(data):
                nonlocal error_message
                error_message = str(data)
                print(f"✗ WebSocket transport connection failed: {data}")
            
            @sio.event
            def disconnect():
                print("WebSocket transport disconnected")
            
            # Attempt connection with WebSocket only
            sio.connect(
                self.base_url,
                transports=['websocket'],
                wait_timeout=10
            )
            
            # Wait a moment for connection to establish
            time.sleep(2)
            
            if connection_successful:
                sio.disconnect()
            
            return {
                'success': connection_successful,
                'error': error_message,
                'transport': 'websocket'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'transport': 'websocket'
            }
    
    def test_mixed_transports(self) -> Dict[str, Any]:
        """Test Socket.IO connection using both transports with fallback."""
        print("Testing mixed transports (polling + websocket)...")
        
        try:
            # Create Socket.IO client with both transports
            sio = socketio.Client()
            
            connection_successful = False
            error_message = None
            used_transport = None
            
            @sio.event
            def connect():
                nonlocal connection_successful, used_transport
                connection_successful = True
                used_transport = sio.transport()
                print(f"✓ Mixed transport connection successful using: {used_transport}")
            
            @sio.event
            def connect_error(data):
                nonlocal error_message
                error_message = str(data)
                print(f"✗ Mixed transport connection failed: {data}")
            
            @sio.event
            def disconnect():
                print("Mixed transport disconnected")
            
            # Attempt connection with both transports
            sio.connect(
                self.base_url,
                transports=['polling', 'websocket'],
                wait_timeout=10
            )
            
            # Wait a moment for connection to establish
            time.sleep(2)
            
            if connection_successful:
                sio.disconnect()
            
            return {
                'success': connection_successful,
                'error': error_message,
                'transport': used_transport or 'unknown',
                'available_transports': ['polling', 'websocket']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'transport': 'unknown',
                'available_transports': ['polling', 'websocket']
            }
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all connectivity tests and return results."""
        print(f"=== Socket.IO Connectivity Test ===")
        print(f"Testing against: {self.base_url}")
        print()
        
        # Test polling transport
        self.results['polling'] = self.test_polling_transport()
        print()
        
        # Test WebSocket transport
        self.results['websocket'] = self.test_websocket_transport()
        print()
        
        # Test mixed transports
        self.results['mixed'] = self.test_mixed_transports()
        print()
        
        # Generate summary
        self.print_summary()
        
        return self.results
    
    def print_summary(self):
        """Print test results summary."""
        print("=== Test Results Summary ===")
        
        for test_name, result in self.results.items():
            status = "✓ PASS" if result['success'] else "✗ FAIL"
            transport = result.get('transport', 'unknown')
            error = result.get('error', 'None')
            
            print(f"{test_name.upper()}: {status}")
            print(f"  Transport: {transport}")
            if not result['success']:
                print(f"  Error: {error}")
            print()
        
        # Overall assessment
        successful_tests = sum(1 for result in self.results.values() if result['success'])
        total_tests = len(self.results)
        
        print(f"Overall: {successful_tests}/{total_tests} tests passed")
        
        if successful_tests == 0:
            print("❌ All tests failed - Socket.IO server may not be running or accessible")
        elif successful_tests < total_tests:
            print("⚠️  Some tests failed - Check transport configuration")
        else:
            print("✅ All tests passed - Socket.IO connectivity is working")

def main():
    """Main function to run connectivity tests."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Socket.IO connectivity')
    parser.add_argument('--url', default=None, help='Socket.IO server URL')
    parser.add_argument('--test', choices=['polling', 'websocket', 'mixed', 'all'], 
                       default='all', help='Specific test to run')
    
    args = parser.parse_args()
    
    tester = SocketConnectivityTester(args.url)
    
    if args.test == 'all':
        tester.run_all_tests()
    elif args.test == 'polling':
        result = tester.test_polling_transport()
        print(f"Polling test result: {result}")
    elif args.test == 'websocket':
        result = tester.test_websocket_transport()
        print(f"WebSocket test result: {result}")
    elif args.test == 'mixed':
        result = tester.test_mixed_transports()
        print(f"Mixed transport test result: {result}")

if __name__ == '__main__':
    main()
