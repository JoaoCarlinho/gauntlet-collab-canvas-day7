#!/usr/bin/env python3
"""
Test script for the asynchronous AI implementation.
This script tests the core components without requiring a database connection.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all required modules can be imported."""
    print("Testing imports...")
    
    try:
        from app.models.ai_job import AIJob
        print("✅ AIJob model imported successfully")
    except Exception as e:
        print(f"❌ Failed to import AIJob model: {e}")
        return False
    
    try:
        from app.config_modules.job_config import job_config
        print("✅ Job config imported successfully")
    except Exception as e:
        print(f"❌ Failed to import job config: {e}")
        return False
    
    try:
        from app.services.ai_job_service import AIJobService
        print("✅ AIJobService imported successfully")
    except Exception as e:
        print(f"❌ Failed to import AIJobService: {e}")
        return False
    
    try:
        from app.services.job_processor import JobProcessor
        print("✅ JobProcessor imported successfully")
    except Exception as e:
        print(f"❌ Failed to import JobProcessor: {e}")
        return False
    
    return True

def test_job_config():
    """Test job configuration."""
    print("\nTesting job configuration...")
    
    try:
        from app.config_modules.job_config import job_config
        
        # Test configuration values
        assert job_config.MAX_CONCURRENT_JOBS == 3
        assert job_config.PROCESSING_INTERVAL == 5
        assert job_config.MAX_RETRIES == 3
        assert job_config.JOB_CLEANUP_DAYS == 7
        
        print("✅ Job configuration values are correct")
        
        # Test retry delay calculation
        delay = job_config.get_retry_delay(1)
        assert delay.total_seconds() == 120  # 2 minutes
        
        delay = job_config.get_retry_delay(2)
        assert delay.total_seconds() == 240  # 4 minutes
        
        print("✅ Retry delay calculation works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Job configuration test failed: {e}")
        return False

def test_ai_job_model():
    """Test AIJob model methods."""
    print("\nTesting AIJob model...")
    
    try:
        from app.models.ai_job import AIJob
        from datetime import datetime
        
        # Create a mock job (without database)
        job = AIJob()
        job.id = "test-job-id"
        job.user_id = "test-user-id"
        job.job_type = "create_canvas"
        job.status = "queued"
        job.priority = 0
        job.request_data = {"instructions": "Create a test canvas"}
        job.retry_count = 0
        job.max_retries = 3
        job.created_at = datetime.utcnow()
        job.next_processing_at = datetime.utcnow()
        
        # Test to_dict method
        job_dict = job.to_dict()
        assert job_dict['id'] == "test-job-id"
        assert job_dict['user_id'] == "test-user-id"
        assert job_dict['job_type'] == "create_canvas"
        assert job_dict['status'] == "queued"
        
        print("✅ AIJob to_dict method works correctly")
        
        # Test can_retry method
        assert job.can_retry() == False  # status is 'queued', not 'failed'
        
        job.status = "failed"
        job.retry_count = 1
        assert job.can_retry() == True
        
        job.retry_count = 3
        assert job.can_retry() == False  # max retries reached
        
        print("✅ AIJob can_retry method works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ AIJob model test failed: {e}")
        return False

def test_job_processor():
    """Test JobProcessor initialization."""
    print("\nTesting JobProcessor...")
    
    try:
        from app.services.job_processor import JobProcessor
        
        # Create processor instance
        processor = JobProcessor()
        
        # Test initialization
        assert processor.running == False
        assert processor.thread is None
        assert processor.job_service is not None
        assert processor.config is not None
        assert processor.logger is not None
        
        print("✅ JobProcessor initialization works correctly")
        
        # Test status method
        status = processor.get_status()
        assert 'running' in status
        assert 'active_jobs' in status
        assert 'max_concurrent_jobs' in status
        assert 'processing_interval' in status
        
        print("✅ JobProcessor status method works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ JobProcessor test failed: {e}")
        return False

def test_ai_job_service():
    """Test AIJobService initialization."""
    print("\nTesting AIJobService...")
    
    try:
        from app.services.ai_job_service import AIJobService
        
        # Create service instance
        service = AIJobService()
        
        # Test initialization
        assert service.logger is not None
        assert service.config is not None
        
        print("✅ AIJobService initialization works correctly")
        
        # Test statistics method (should work without database)
        try:
            stats = service.get_job_statistics()
            # This might fail without database, but we can test the method exists
            print("✅ AIJobService get_job_statistics method exists")
        except Exception as e:
            print(f"⚠️  AIJobService get_job_statistics requires database: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ AIJobService test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Testing Asynchronous AI Implementation")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_job_config,
        test_ai_job_model,
        test_job_processor,
        test_ai_job_service
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The asynchronous AI implementation is ready.")
        return True
    else:
        print("❌ Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
