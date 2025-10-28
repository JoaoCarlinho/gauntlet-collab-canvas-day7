import threading
import time
import signal
import sys
from datetime import datetime
from typing import Optional
from app.models.ai_job import AIJob
from app.services.ai_job_service import AIJobService
from app.config_modules.job_config import job_config
from app.utils.logger import SmartLogger

class JobProcessor:
    """Background job processor using threading."""
    
    def __init__(self):
        self.running = False
        self.thread = None
        self.job_service = AIJobService()
        self.config = job_config
        self.logger = SmartLogger('job_processor', 'INFO')
        
        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def start(self):
        """Start the job processor in a background thread."""
        if self.running:
            self.logger.log_info("Job processor already running")
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._process_loop, daemon=True)
        self.thread.start()
        self.logger.log_info("Job processor started")
    
    def stop(self):
        """Stop the job processor."""
        if not self.running:
            return
            
        self.running = False
        if self.thread:
            self.thread.join(timeout=self.config.THREAD_JOIN_TIMEOUT)
        self.logger.log_info("Job processor stopped")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        self.logger.log_info(f"Received signal {signum}, shutting down job processor...")
        self.stop()
        sys.exit(0)
    
    def _process_loop(self):
        """Main processing loop."""
        self.logger.log_info("Job processor loop started")
        
        # Use the existing app context instead of creating a new one
        from flask import current_app
        
        while self.running:
            try:
                # Use current_app if available, otherwise skip this iteration
                if not current_app:
                    time.sleep(1)
                    continue
                
                # Check if we can process more jobs
                active_jobs = self.job_service.get_active_jobs_count()
                
                if active_jobs < self.config.MAX_CONCURRENT_JOBS:
                    # Get next job
                    job = self.job_service.get_next_job()
                    
                    if job:
                        self.logger.log_info(f"Processing job {job.id}")
                        
                        # Process job in a separate thread to avoid blocking
                        job_thread = threading.Thread(
                            target=self._process_single_job,
                            args=(job,),
                            daemon=True
                        )
                        job_thread.start()
                    else:
                        # No jobs to process, wait
                        time.sleep(self.config.PROCESSING_INTERVAL)
                else:
                    # Too many active jobs, wait
                    self.logger.log_info(f"Max concurrent jobs reached ({active_jobs}), waiting...")
                    time.sleep(1)
                    
            except Exception as e:
                self.logger.log_error(f"Job processor error: {str(e)}", e)
                time.sleep(5)  # Wait before retrying
        
        self.logger.log_info("Job processor loop ended")
    
    def _process_single_job(self, job: AIJob):
        """Process a single job."""
        try:
            # Use the existing app context instead of creating a new one
            from flask import current_app
            if current_app:
                self.job_service.process_job(job)
            else:
                self.logger.log_error(f"No app context available for job {job.id}")
        except Exception as e:
            self.logger.log_error(f"Error processing job {job.id}: {str(e)}", e)
    
    def get_status(self) -> dict:
        """Get processor status."""
        return {
            'running': self.running,
            'active_jobs': self.job_service.get_active_jobs_count(),
            'max_concurrent_jobs': self.config.MAX_CONCURRENT_JOBS,
            'processing_interval': self.config.PROCESSING_INTERVAL
        }

# Global job processor instance
job_processor = JobProcessor()
