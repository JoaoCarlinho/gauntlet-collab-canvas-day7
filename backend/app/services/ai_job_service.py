import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.models.ai_job import AIJob
from app.extensions import db, socketio
from app.config_modules.job_config import job_config
from app.utils.logger import SmartLogger

class AIJobService:
    """Service for managing AI background jobs using PostgreSQL."""
    
    def __init__(self):
        self.logger = SmartLogger('ai_job_service', 'INFO')
        self.config = job_config
    
    def create_canvas_job(self, user_id: str, request_data: dict, priority: int = 0) -> str:
        """Create a new canvas creation job."""
        try:
            # Create job record
            job = AIJob(
                user_id=user_id,
                job_type='create_canvas',
                request_data=request_data,
                status='queued',
                priority=priority,
                next_processing_at=datetime.utcnow()  # Process immediately
            )
            db.session.add(job)
            db.session.commit()
            
            self.logger.log_info(f"Created AI job {job.id} for user {user_id}")
            return job.id
            
        except Exception as e:
            self.logger.log_error(f"Failed to create AI job: {str(e)}", e)
            db.session.rollback()
            raise
    
    def get_job(self, job_id: str, user_id: str = None) -> Optional[AIJob]:
        """Get job by ID, optionally filtered by user."""
        query = AIJob.query.filter_by(id=job_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        return query.first()
    
    def get_next_job(self) -> Optional[AIJob]:
        """Get the next job to process."""
        return AIJob.query.filter(
            AIJob.status == 'queued',
            AIJob.next_processing_at <= datetime.utcnow()
        ).order_by(AIJob.priority.desc(), AIJob.created_at.asc()).first()
    
    def get_active_jobs_count(self) -> int:
        """Get count of currently processing jobs."""
        return AIJob.query.filter_by(status='processing').count()
    
    def process_job(self, job: AIJob) -> bool:
        """Process a single job."""
        try:
            # Mark as processing
            job.mark_started()
            
            # Emit status update
            socketio.emit('ai_job_update', {
                'job_id': job.id,
                'status': 'processing',
                'message': 'Starting AI generation...',
                'progress': 10
            })
            
            # Initialize AI service
            try:
                from app.services.ai_agent_service import AIAgentService
                ai_service = AIAgentService()
                self.logger.log_info(f"AI service initialized for job {job.id}")
            except Exception as e:
                self.logger.log_error(f"Failed to initialize AI service: {str(e)}", e)
                job.mark_failed(f"AI service initialization failed: {str(e)}")
                socketio.emit('ai_job_error', {
                    'job_id': job.id,
                    'status': 'failed',
                    'error': f"AI service initialization failed: {str(e)}"
                })
                return False
            
            # Emit progress update
            socketio.emit('ai_job_update', {
                'job_id': job.id,
                'status': 'processing',
                'message': 'Generating canvas with AI...',
                'progress': 30
            })
            
            # Process with AI service
            request_data = job.request_data
            result = ai_service.create_canvas_from_query(
                query=request_data['instructions'],
                user_id=job.user_id,
                canvas_id=request_data.get('canvas_id'),
                style=request_data.get('style', 'modern'),
                color_scheme=request_data.get('colorScheme', 'default')
            )
            
            # Emit progress update
            socketio.emit('ai_job_update', {
                'job_id': job.id,
                'status': 'processing',
                'message': 'Finalizing canvas...',
                'progress': 90
            })
            
            # Mark as completed
            job.mark_completed(result)
            
            # Emit completion
            socketio.emit('ai_job_complete', {
                'job_id': job.id,
                'status': 'completed',
                'result': result,
                'progress': 100
            })
            
            self.logger.log_info(f"AI job {job.id} completed successfully")
            return True
            
        except Exception as e:
            self.logger.log_error(f"AI job {job.id} failed: {str(e)}", e)
            
            # Schedule retry or mark as failed
            job.schedule_retry(str(e))
            
            # Emit error
            socketio.emit('ai_job_error', {
                'job_id': job.id,
                'status': job.status,
                'error': str(e)
            })
            
            return False
    
    def cancel_job(self, job_id: str, user_id: str) -> bool:
        """Cancel a job if it's still queued."""
        job = self.get_job(job_id, user_id)
        if not job:
            return False
        
        if job.status in ['queued', 'processing']:
            job.status = 'cancelled'
            job.completed_at = datetime.utcnow()
            db.session.commit()
            return True
        
        return False
    
    def retry_failed_job(self, job_id: str, user_id: str) -> bool:
        """Retry a failed job."""
        job = self.get_job(job_id, user_id)
        if not job or not job.can_retry():
            return False
        
        try:
            # Reset job status
            job.status = 'queued'
            job.retry_count = 0
            job.error_message = None
            job.started_at = None
            job.completed_at = None
            job.next_processing_at = datetime.utcnow()
            db.session.commit()
            
            self.logger.log_info(f"Retried AI job {job.id}")
            return True
            
        except Exception as e:
            self.logger.log_error(f"Failed to retry AI job: {str(e)}", e)
            db.session.rollback()
            return False
    
    def cleanup_old_jobs(self, days: int = 7):
        """Clean up old completed jobs."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        old_jobs = AIJob.query.filter(
            AIJob.status.in_(['completed', 'failed', 'cancelled']),
            AIJob.completed_at < cutoff_date
        ).all()
        
        for job in old_jobs:
            db.session.delete(job)
        
        db.session.commit()
        self.logger.log_info(f"Cleaned up {len(old_jobs)} old jobs")
    
    def get_job_statistics(self) -> Dict:
        """Get job processing statistics."""
        stats = {
            'total_jobs': AIJob.query.count(),
            'queued_jobs': AIJob.query.filter_by(status='queued').count(),
            'processing_jobs': AIJob.query.filter_by(status='processing').count(),
            'completed_jobs': AIJob.query.filter_by(status='completed').count(),
            'failed_jobs': AIJob.query.filter_by(status='failed').count(),
            'cancelled_jobs': AIJob.query.filter_by(status='cancelled').count(),
        }
        
        # Calculate success rate
        total_processed = stats['completed_jobs'] + stats['failed_jobs']
        if total_processed > 0:
            stats['success_rate'] = (stats['completed_jobs'] / total_processed) * 100
        else:
            stats['success_rate'] = 0
        
        return stats
