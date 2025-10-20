import os
from datetime import timedelta

class JobConfig:
    """Configuration for background job processing."""
    
    def __init__(self):
        # Job processing settings
        self.MAX_CONCURRENT_JOBS = int(os.getenv('MAX_CONCURRENT_JOBS', '3'))
        self.PROCESSING_INTERVAL = int(os.getenv('JOB_PROCESSING_INTERVAL', '5'))  # seconds
        self.MAX_RETRIES = int(os.getenv('MAX_JOB_RETRIES', '3'))
        
        # Retry backoff settings
        self.RETRY_BACKOFF_BASE = 2  # minutes
        self.RETRY_BACKOFF_MAX = 8   # minutes
        
        # Job cleanup settings
        self.JOB_CLEANUP_DAYS = int(os.getenv('JOB_CLEANUP_DAYS', '7'))
        
        # Threading settings
        self.THREAD_DAEMON = True
        self.THREAD_JOIN_TIMEOUT = 10  # seconds
    
    def get_retry_delay(self, retry_count: int) -> timedelta:
        """Calculate retry delay with exponential backoff."""
        delay_minutes = min(
            self.RETRY_BACKOFF_BASE ** retry_count,
            self.RETRY_BACKOFF_MAX
        )
        return timedelta(minutes=delay_minutes)

# Global instance
job_config = JobConfig()
