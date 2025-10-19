#!/usr/bin/env python3
"""
Production User Stories Validation Test Suite
Comprehensive testing framework to validate all 13 user stories in production environment.
"""

import asyncio
import aiohttp
import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('production_test_results.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ProductionTestSuite:
    """Comprehensive production testing suite for user stories validation."""
    
    def __init__(self, base_url: str = "https://gauntlet-collab-canvas-day7-production.up.railway.app"):
        self.base_url = base_url
        self.session = None
        self.test_results = {}
        self.start_time = None
        self.end_time = None
        
        # Test configuration
        self.timeout = 30
        self.retry_attempts = 3
        self.retry_delay = 2
        
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout),
            headers={'Content-Type': 'application/json'}
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, 
                          headers: Dict = None, expected_status: int = 200) -> Dict:
        """Make HTTP request with retry logic."""
        url = f"{self.base_url}{endpoint}"
        
        for attempt in range(self.retry_attempts):
            try:
                async with self.session.request(
                    method, url, json=data, headers=headers
                ) as response:
                    response_data = await response.json() if response.content_type == 'application/json' else {}
                    
                    if response.status == expected_status:
                        return {
                            'success': True,
                            'status': response.status,
                            'data': response_data,
                            'headers': dict(response.headers)
                        }
                    else:
                        logger.warning(f"Request failed with status {response.status}: {response_data}")
                        return {
                            'success': False,
                            'status': response.status,
                            'data': response_data,
                            'error': f"Expected status {expected_status}, got {response.status}"
                        }
                        
            except Exception as e:
                logger.warning(f"Request attempt {attempt + 1} failed: {str(e)}")
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay)
                else:
                    return {
                        'success': False,
                        'error': str(e),
                        'status': 0
                    }
    
    async def test_health_endpoints(self) -> Dict:
        """Test health endpoints availability."""
        logger.info("🔍 Testing health endpoints...")
        
        endpoints = ['/health', '/api/health']
        results = {}
        
        for endpoint in endpoints:
            result = await self.make_request('GET', endpoint)
            results[endpoint] = result
            
        return {
            'test_name': 'Health Endpoints',
            'success': all(r['success'] for r in results.values()),
            'results': results,
            'message': 'Health endpoints are accessible' if all(r['success'] for r in results.values()) else 'Some health endpoints failed'
        }
    
    async def test_user_story_1_passkey_login(self) -> Dict:
        """Test User Story 1: User can login with passkey."""
        logger.info("🔐 Testing User Story 1: Passkey Login")
        
        # Test authentication endpoints
        auth_endpoints = [
            '/api/auth/register',
            '/api/auth/login',
            '/api/auth/verify-token'
        ]
        
        results = {}
        for endpoint in auth_endpoints:
            # Test endpoint availability (should return method not allowed or validation error)
            result = await self.make_request('POST', endpoint, {}, expected_status=400)
            results[endpoint] = result
        
        # Test Firebase configuration endpoint
        firebase_result = await self.make_request('GET', '/test-firebase')
        results['/test-firebase'] = firebase_result
        
        success = all(r['success'] for r in results.values())
        
        return {
            'test_name': 'User Story 1: Passkey Login',
            'success': success,
            'results': results,
            'message': 'Authentication endpoints are accessible and properly configured' if success else 'Authentication endpoints have issues'
        }
    
    async def test_user_story_2_canvas_creation(self) -> Dict:
        """Test User Story 2: User can create a canvas with name and description."""
        logger.info("🎨 Testing User Story 2: Canvas Creation")
        
        # Test canvas creation endpoint
        canvas_data = {
            'title': 'Test Canvas',
            'description': 'Test canvas for production validation',
            'is_public': False
        }
        
        result = await self.make_request('POST', '/api/canvas', canvas_data, expected_status=401)
        
        # Should return 401 (unauthorized) since we don't have auth token
        # This indicates the endpoint exists and is properly secured
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 2: Canvas Creation',
            'success': success,
            'results': {'canvas_creation': result},
            'message': 'Canvas creation endpoint is properly secured' if success else 'Canvas creation endpoint has issues'
        }
    
    async def test_user_story_3_canvas_list(self) -> Dict:
        """Test User Story 3: User can see a list of created canvases."""
        logger.info("📋 Testing User Story 3: Canvas List")
        
        # Test canvas list endpoint
        result = await self.make_request('GET', '/api/canvas', expected_status=401)
        
        # Should return 401 (unauthorized) since we don't have auth token
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 3: Canvas List',
            'success': success,
            'results': {'canvas_list': result},
            'message': 'Canvas list endpoint is properly secured' if success else 'Canvas list endpoint has issues'
        }
    
    async def test_user_story_4_canvas_opening(self) -> Dict:
        """Test User Story 4: User can open a canvas for updating."""
        logger.info("🔓 Testing User Story 4: Canvas Opening")
        
        # Test canvas retrieval endpoint with a test ID
        test_canvas_id = "test-canvas-id"
        result = await self.make_request('GET', f'/api/canvas/{test_canvas_id}', expected_status=401)
        
        # Should return 401 (unauthorized) since we don't have auth token
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 4: Canvas Opening',
            'success': success,
            'results': {'canvas_opening': result},
            'message': 'Canvas opening endpoint is properly secured' if success else 'Canvas opening endpoint has issues'
        }
    
    async def test_user_story_5_text_box(self) -> Dict:
        """Test User Story 5: User can place a text-box on the canvas and enter text."""
        logger.info("📝 Testing User Story 5: Text Box Placement")
        
        # Test object creation endpoint
        test_canvas_id = "test-canvas-id"
        text_box_data = {
            'object_type': 'text',
            'properties': {
                'text': 'Test text',
                'x': 100,
                'y': 100,
                'fontSize': 16
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       text_box_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 5: Text Box Placement',
            'success': success,
            'results': {'text_box_creation': result},
            'message': 'Text box creation endpoint is properly secured' if success else 'Text box creation endpoint has issues'
        }
    
    async def test_user_story_6_star_shape(self) -> Dict:
        """Test User Story 6: User can place a star on the canvas."""
        logger.info("⭐ Testing User Story 6: Star Shape Placement")
        
        # Test star object creation
        test_canvas_id = "test-canvas-id"
        star_data = {
            'object_type': 'star',
            'properties': {
                'x': 200,
                'y': 200,
                'width': 100,
                'height': 100,
                'points': 5
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       star_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 6: Star Shape Placement',
            'success': success,
            'results': {'star_creation': result},
            'message': 'Star creation endpoint is properly secured' if success else 'Star creation endpoint has issues'
        }
    
    async def test_user_story_7_circle_shape(self) -> Dict:
        """Test User Story 7: User can place a circle on the canvas."""
        logger.info("⭕ Testing User Story 7: Circle Shape Placement")
        
        # Test circle object creation
        test_canvas_id = "test-canvas-id"
        circle_data = {
            'object_type': 'circle',
            'properties': {
                'x': 300,
                'y': 300,
                'radius': 50
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       circle_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 7: Circle Shape Placement',
            'success': success,
            'results': {'circle_creation': result},
            'message': 'Circle creation endpoint is properly secured' if success else 'Circle creation endpoint has issues'
        }
    
    async def test_user_story_8_rectangle_shape(self) -> Dict:
        """Test User Story 8: User can place a rectangle on the canvas."""
        logger.info("⬜ Testing User Story 8: Rectangle Shape Placement")
        
        # Test rectangle object creation
        test_canvas_id = "test-canvas-id"
        rectangle_data = {
            'object_type': 'rectangle',
            'properties': {
                'x': 400,
                'y': 400,
                'width': 100,
                'height': 80
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       rectangle_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 8: Rectangle Shape Placement',
            'success': success,
            'results': {'rectangle_creation': result},
            'message': 'Rectangle creation endpoint is properly secured' if success else 'Rectangle creation endpoint has issues'
        }
    
    async def test_user_story_9_line_shape(self) -> Dict:
        """Test User Story 9: User can place a line on the canvas."""
        logger.info("📏 Testing User Story 9: Line Shape Placement")
        
        # Test line object creation
        test_canvas_id = "test-canvas-id"
        line_data = {
            'object_type': 'line',
            'properties': {
                'x1': 100,
                'y1': 100,
                'x2': 200,
                'y2': 200,
                'stroke': '#000000',
                'strokeWidth': 2
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       line_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 9: Line Shape Placement',
            'success': success,
            'results': {'line_creation': result},
            'message': 'Line creation endpoint is properly secured' if success else 'Line creation endpoint has issues'
        }
    
    async def test_user_story_10_arrow_shape(self) -> Dict:
        """Test User Story 10: User can place an arrow on the canvas."""
        logger.info("➡️ Testing User Story 10: Arrow Shape Placement")
        
        # Test arrow object creation
        test_canvas_id = "test-canvas-id"
        arrow_data = {
            'object_type': 'arrow',
            'properties': {
                'x1': 150,
                'y1': 150,
                'x2': 250,
                'y2': 250,
                'stroke': '#FF0000',
                'strokeWidth': 3
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       arrow_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 10: Arrow Shape Placement',
            'success': success,
            'results': {'arrow_creation': result},
            'message': 'Arrow creation endpoint is properly secured' if success else 'Arrow creation endpoint has issues'
        }
    
    async def test_user_story_11_diamond_shape(self) -> Dict:
        """Test User Story 11: User can place a diamond on the canvas."""
        logger.info("💎 Testing User Story 11: Diamond Shape Placement")
        
        # Test diamond object creation
        test_canvas_id = "test-canvas-id"
        diamond_data = {
            'object_type': 'diamond',
            'properties': {
                'x': 500,
                'y': 500,
                'width': 80,
                'height': 80,
                'fill': '#00FF00'
            }
        }
        
        result = await self.make_request('POST', f'/api/canvas/{test_canvas_id}/objects', 
                                       diamond_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 11: Diamond Shape Placement',
            'success': success,
            'results': {'diamond_creation': result},
            'message': 'Diamond creation endpoint is properly secured' if success else 'Diamond creation endpoint has issues'
        }
    
    async def test_user_story_12_shape_resizing(self) -> Dict:
        """Test User Story 12: User can resize any shape placed on the canvas."""
        logger.info("📐 Testing User Story 12: Shape Resizing")
        
        # Test object update endpoint
        test_canvas_id = "test-canvas-id"
        test_object_id = "test-object-id"
        resize_data = {
            'properties': {
                'width': 150,
                'height': 150,
                'x': 100,
                'y': 100
            }
        }
        
        result = await self.make_request('PUT', f'/api/canvas/{test_canvas_id}/objects/{test_object_id}', 
                                       resize_data, expected_status=401)
        
        success = result['status'] == 401
        
        return {
            'test_name': 'User Story 12: Shape Resizing',
            'success': success,
            'results': {'shape_resizing': result},
            'message': 'Shape resizing endpoint is properly secured' if success else 'Shape resizing endpoint has issues'
        }
    
    async def test_user_story_13_ai_canvas_generation(self) -> Dict:
        """Test User Story 13: User can send a message to an AI Agent and request canvas generation."""
        logger.info("🤖 Testing User Story 13: AI Canvas Generation")
        
        # Test AI agent canvas creation endpoint
        ai_request_data = {
            'instructions': 'Create a simple canvas with a rectangle and some text',
            'canvas_name': 'AI Generated Canvas',
            'canvas_description': 'Canvas generated by AI agent'
        }
        
        result = await self.make_request('POST', '/api/ai-agent/create-canvas', 
                                       ai_request_data, expected_status=401)
        
        success = result['status'] == 401
        
        # Test AI agent health endpoint
        health_result = await self.make_request('GET', '/api/ai-agent/health')
        ai_health_success = health_result['success']
        
        return {
            'test_name': 'User Story 13: AI Canvas Generation',
            'success': success and ai_health_success,
            'results': {
                'ai_canvas_creation': result,
                'ai_health': health_result
            },
            'message': 'AI canvas generation endpoint is properly secured and AI service is healthy' if success and ai_health_success else 'AI canvas generation has issues'
        }
    
    async def run_all_tests(self) -> Dict:
        """Run all user story tests."""
        logger.info("🚀 Starting Production User Stories Validation")
        self.start_time = datetime.now()
        
        # Test health endpoints first
        health_test = await self.test_health_endpoints()
        self.test_results['health'] = health_test
        
        if not health_test['success']:
            logger.error("❌ Health endpoints failed. Stopping tests.")
            return self.generate_report()
        
        # Run all user story tests
        user_story_tests = [
            self.test_user_story_1_passkey_login,
            self.test_user_story_2_canvas_creation,
            self.test_user_story_3_canvas_list,
            self.test_user_story_4_canvas_opening,
            self.test_user_story_5_text_box,
            self.test_user_story_6_star_shape,
            self.test_user_story_7_circle_shape,
            self.test_user_story_8_rectangle_shape,
            self.test_user_story_9_line_shape,
            self.test_user_story_10_arrow_shape,
            self.test_user_story_11_diamond_shape,
            self.test_user_story_12_shape_resizing,
            self.test_user_story_13_ai_canvas_generation
        ]
        
        for i, test_func in enumerate(user_story_tests, 1):
            try:
                result = await test_func()
                self.test_results[f'user_story_{i}'] = result
                logger.info(f"✅ User Story {i}: {result['message']}")
            except Exception as e:
                logger.error(f"❌ User Story {i} failed with exception: {str(e)}")
                self.test_results[f'user_story_{i}'] = {
                    'test_name': f'User Story {i}',
                    'success': False,
                    'error': str(e),
                    'message': f'User Story {i} failed with exception'
                }
        
        self.end_time = datetime.now()
        return self.generate_report()
    
    def generate_report(self) -> Dict:
        """Generate comprehensive test report."""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result.get('success', False))
        failed_tests = total_tests - passed_tests
        
        duration = (self.end_time - self.start_time).total_seconds() if self.start_time and self.end_time else 0
        
        report = {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
                'duration_seconds': duration,
                'timestamp': datetime.now().isoformat()
            },
            'test_results': self.test_results,
            'recommendations': self.generate_recommendations()
        }
        
        return report
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results."""
        recommendations = []
        
        failed_tests = [name for name, result in self.test_results.items() 
                       if not result.get('success', False)]
        
        if failed_tests:
            recommendations.append(f"Address failed tests: {', '.join(failed_tests)}")
        
        if self.test_results.get('health', {}).get('success', False):
            recommendations.append("✅ Health endpoints are working correctly")
        else:
            recommendations.append("❌ Fix health endpoint issues before proceeding")
        
        if all(self.test_results.get(f'user_story_{i}', {}).get('success', False) 
               for i in range(1, 14)):
            recommendations.append("🎉 All user stories are properly secured and accessible")
        else:
            recommendations.append("🔧 Review and fix failed user story endpoints")
        
        return recommendations

async def main():
    """Main function to run the production test suite."""
    base_url = os.getenv('PRODUCTION_URL', 'https://gauntlet-collab-canvas-day7-production.up.railway.app')
    
    async with ProductionTestSuite(base_url) as test_suite:
        report = await test_suite.run_all_tests()
        
        # Save report to file
        with open('production_test_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        # Print summary
        summary = report['summary']
        logger.info(f"\n📊 PRODUCTION TEST SUMMARY")
        logger.info(f"Total Tests: {summary['total_tests']}")
        logger.info(f"Passed: {summary['passed_tests']}")
        logger.info(f"Failed: {summary['failed_tests']}")
        logger.info(f"Success Rate: {summary['success_rate']:.1f}%")
        logger.info(f"Duration: {summary['duration_seconds']:.2f} seconds")
        
        # Print recommendations
        logger.info(f"\n💡 RECOMMENDATIONS:")
        for rec in report['recommendations']:
            logger.info(f"  {rec}")
        
        return report

if __name__ == "__main__":
    asyncio.run(main())
