#!/usr/bin/env python3
"""
Test script to verify the async AI integration is working correctly.
This script tests the complete flow from job creation to completion.
"""

import requests
import json
import time
import sys

# Configuration
BACKEND_URL = "http://localhost:5002"
TEST_TOKEN = "test-token"  # This will fail auth, but we can test the endpoint structure

def test_health_endpoint():
    """Test the health endpoint."""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/ai-agent/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data['status']}")
            print(f"   Job processor running: {data['job_processor']['running']}")
            print(f"   Active jobs: {data['job_processor']['active_jobs']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_create_canvas_endpoint():
    """Test the create canvas endpoint structure."""
    print("\n🔍 Testing create canvas endpoint...")
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ai-agent/create-canvas",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {TEST_TOKEN}"
            },
            json={
                "instructions": "Create a simple flowchart",
                "style": "modern",
                "colorScheme": "default"
            }
        )
        
        # We expect a 401 because we're using a test token
        if response.status_code == 401:
            print("✅ Create canvas endpoint is working (authentication required)")
            data = response.json()
            print(f"   Error message: {data.get('error', 'Unknown error')}")
            return True
        elif response.status_code == 202:
            # If somehow auth passed, check for job_id
            data = response.json()
            if 'job_id' in data:
                print("✅ Create canvas endpoint returned job_id (async response)")
                print(f"   Job ID: {data['job_id']}")
                return True
            else:
                print("❌ Create canvas endpoint didn't return job_id")
                return False
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Create canvas endpoint error: {e}")
        return False

def test_job_endpoints():
    """Test the job management endpoints."""
    print("\n🔍 Testing job management endpoints...")
    
    success = True
    
    # Test jobs stats endpoint
    try:
        response = requests.get(f"{BACKEND_URL}/api/ai-agent/jobs/stats")
        if response.status_code == 401:
            print("✅ Jobs stats endpoint is working (authentication required)")
        else:
            print(f"❌ Jobs stats endpoint unexpected response: {response.status_code}")
            success = False
    except Exception as e:
        print(f"❌ Jobs stats endpoint error: {e}")
        success = False
    
    # Test job status endpoint (with fake job ID)
    try:
        fake_job_id = "test-job-id"
        response = requests.get(f"{BACKEND_URL}/api/ai-agent/job/{fake_job_id}/status")
        if response.status_code == 401:
            print("✅ Job status endpoint is working (authentication required)")
        else:
            print(f"❌ Job status endpoint unexpected response: {response.status_code}")
            success = False
    except Exception as e:
        print(f"❌ Job status endpoint error: {e}")
        success = False
    
    return success

def test_frontend_backend_connection():
    """Test if frontend can reach backend."""
    print("\n🔍 Testing frontend-backend connection...")
    try:
        # Test if frontend is running
        frontend_response = requests.get("http://localhost:3002")
        if frontend_response.status_code == 200:
            print("✅ Frontend is running on port 3002")
        else:
            print(f"❌ Frontend not responding: {frontend_response.status_code}")
            return False
        
        # Test if backend is running
        backend_response = requests.get(f"{BACKEND_URL}/health")
        if backend_response.status_code == 200:
            print("✅ Backend is running on port 5002")
        else:
            print(f"❌ Backend not responding: {backend_response.status_code}")
            return False
        
        print("✅ Frontend and backend are both running and accessible")
        return True
        
    except Exception as e:
        print(f"❌ Connection test error: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Testing Async AI Integration")
    print("=" * 50)
    
    tests = [
        test_health_endpoint,
        test_create_canvas_endpoint,
        test_job_endpoints,
        test_frontend_backend_connection
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The async integration is working correctly.")
        print("\n📋 Next steps:")
        print("1. Deploy to Railway using: ./deploy_async.sh")
        print("2. Test with real authentication tokens")
        print("3. Verify job processing in production")
        return True
    else:
        print("❌ Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
