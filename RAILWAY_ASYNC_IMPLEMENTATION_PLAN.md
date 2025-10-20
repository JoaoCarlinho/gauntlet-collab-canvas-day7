# Railway-Compatible Asynchronous AI Implementation Plan

## Executive Summary

**Problem**: Original Redis + RQ worker approach is incompatible with Railway infrastructure  
**Solution**: PostgreSQL-based job queue with polling-based background processing  
**Timeline**: 2 weeks (10 working days)  
**Infrastructure**: Uses existing Railway PostgreSQL database  

## Architecture Overview

### Current vs. Proposed Architecture

#### Current (Synchronous)
```
Frontend → Backend API → AI Service → Response (5-30 seconds)
```

#### Proposed (Asynchronous with PostgreSQL)
```
Frontend → Backend API → Job Queue (PostgreSQL) → Background Processor → Socket.IO Updates
         ↓
    Immediate Response (<100ms)
```

### Key Components

1. **AIJob Model** - PostgreSQL table for job tracking
2. **JobProcessor** - Background thread for job processing
3. **AIJobService** - Job management and processing logic
4. **Socket.IO** - Real-time status updates
5. **Frontend Polling** - Job status tracking

## Phase 1: Database & Core Infrastructure (Week 1, Days 1-3)

### Task 1.1: Database Schema Implementation
**Priority**: Critical  
**Estimated Time**: 4 hours  
**Dependencies**: None

#### Step 1.1.1: Create AIJob Model
**File**: `backend/app/models/ai_job.py`

```python
import uuid
from datetime import datetime, timedelta
from app.extensions import db

class AIJob(db.Model):
    """Model for tracking AI background jobs using PostgreSQL."""
    
    __tablename__ = 'ai_jobs'
    
    # Primary key
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign keys
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    canvas_id = db.Column(db.String(36), db.ForeignKey('canvas.id'), nullable=True)
    
    # Job details
    job_type = db.Column(db.String(50), nullable=False)  # 'create_canvas', 'modify_canvas'
    status = db.Column(db.String(20), default='queued')  # queued, processing, completed, failed, cancelled
    priority = db.Column(db.Integer, default=0)  # Higher number = higher priority
    
    # Data storage
    request_data = db.Column(db.JSON, nullable=False)
    result_data = db.Column(db.JSON, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    
    # Retry tracking
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    next_processing_at = db.Column(db.DateTime, default=datetime.utcnow)  # For delayed processing
    
    # Relationships
    user = db.relationship('User', backref='ai_jobs')
    canvas = db.relationship('Canvas', backref='ai_jobs')
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_ai_job_status_processing', 'status', 'next_processing_at'),
        db.Index('idx_ai_job_user_status', 'user_id', 'status'),
        db.Index('idx_ai_job_created_at', 'created_at'),
        db.Index('idx_ai_job_priority', 'priority', 'created_at'),
    )
    
    def to_dict(self):
        """Convert job to dictionary for API responses."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'canvas_id': self.canvas_id,
            'job_type': self.job_type,
            'status': self.status,
            'priority': self.priority,
            'request_data': self.request_data,
            'result_data': self.result_data,
            'error_message': self.error_message,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'next_processing_at': self.next_processing_at.isoformat() if self.next_processing_at else None,
        }
    
    def can_retry(self):
        """Check if job can be retried."""
        return self.retry_count < self.max_retries and self.status == 'failed'
    
    def mark_started(self):
        """Mark job as started."""
        self.status = 'processing'
        self.started_at = datetime.utcnow()
        db.session.commit()
    
    def mark_completed(self, result_data):
        """Mark job as completed with results."""
        self.status = 'completed'
        self.result_data = result_data
        self.completed_at = datetime.utcnow()
        db.session.commit()
    
    def mark_failed(self, error_message):
        """Mark job as failed with error message."""
        self.status = 'failed'
        self.error_message = error_message
        self.completed_at = datetime.utcnow()
        db.session.commit()
    
    def schedule_retry(self, error_message):
        """Schedule job for retry with exponential backoff."""
        self.retry_count += 1
        if self.retry_count < self.max_retries:
            self.status = 'queued'
            self.next_processing_at = datetime.utcnow() + timedelta(
                minutes=2 ** self.retry_count  # Exponential backoff: 2, 4, 8 minutes
            )
            self.error_message = error_message
        else:
            self.mark_failed(error_message)
        db.session.commit()
```

#### Step 1.1.2: Create Database Migration
**File**: `backend/migrations/versions/xxx_add_ai_job_table.py`

```python
"""Add AIJob table for background job processing

Revision ID: xxx_add_ai_job_table
Revises: [previous_revision_id]
Create Date: [current_date]

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'xxx_add_ai_job_table'
down_revision = '[previous_revision_id]'
branch_labels = None
depends_on = None

def upgrade():
    # Create ai_jobs table
    op.create_table('ai_jobs',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('canvas_id', sa.String(36), nullable=True),
        sa.Column('job_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('request_data', sa.JSON(), nullable=False),
        sa.Column('result_data', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('max_retries', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('next_processing_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['canvas_id'], ['canvas.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('idx_ai_job_status_processing', 'ai_jobs', ['status', 'next_processing_at'])
    op.create_index('idx_ai_job_user_status', 'ai_jobs', ['user_id', 'status'])
    op.create_index('idx_ai_job_created_at', 'ai_jobs', ['created_at'])
    op.create_index('idx_ai_job_priority', 'ai_jobs', ['priority', 'created_at'])

def downgrade():
    # Drop indexes
    op.drop_index('idx_ai_job_priority', table_name='ai_jobs')
    op.drop_index('idx_ai_job_created_at', table_name='ai_jobs')
    op.drop_index('idx_ai_job_user_status', table_name='ai_jobs')
    op.drop_index('idx_ai_job_status_processing', table_name='ai_jobs')
    
    # Drop table
    op.drop_table('ai_jobs')
```

### Task 1.2: Job Processing Service
**Priority**: Critical  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.1

#### Step 1.2.1: Create AIJobService
**File**: `backend/app/services/ai_job_service.py`

```python
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.models.ai_job import AIJob
from app.extensions import db, socketio
from app.utils.logger import SmartLogger

class AIJobService:
    """Service for managing AI background jobs using PostgreSQL."""
    
    def __init__(self):
        self.logger = SmartLogger()
        self.max_concurrent_jobs = int(os.getenv('MAX_CONCURRENT_JOBS', '3'))
        self.processing_interval = int(os.getenv('JOB_PROCESSING_INTERVAL', '5'))
    
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
```

### Task 1.3: Background Job Processor
**Priority**: Critical  
**Estimated Time**: 4 hours  
**Dependencies**: Task 1.2

#### Step 1.3.1: Create JobProcessor
**File**: `backend/app/services/job_processor.py`

```python
import threading
import time
import signal
import sys
from datetime import datetime
from typing import Optional
from app.models.ai_job import AIJob
from app.services.ai_job_service import AIJobService
from app.utils.logger import SmartLogger

class JobProcessor:
    """Background job processor using threading."""
    
    def __init__(self):
        self.running = False
        self.thread = None
        self.job_service = AIJobService()
        self.logger = SmartLogger()
        
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
            self.thread.join(timeout=10)  # Wait up to 10 seconds
        self.logger.log_info("Job processor stopped")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        self.logger.log_info(f"Received signal {signum}, shutting down job processor...")
        self.stop()
        sys.exit(0)
    
    def _process_loop(self):
        """Main processing loop."""
        self.logger.log_info("Job processor loop started")
        
        while self.running:
            try:
                # Check if we can process more jobs
                active_jobs = self.job_service.get_active_jobs_count()
                
                if active_jobs < self.job_service.max_concurrent_jobs:
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
                        time.sleep(self.job_service.processing_interval)
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
            self.job_service.process_job(job)
        except Exception as e:
            self.logger.log_error(f"Error processing job {job.id}: {str(e)}", e)
    
    def get_status(self) -> dict:
        """Get processor status."""
        return {
            'running': self.running,
            'active_jobs': self.job_service.get_active_jobs_count(),
            'max_concurrent_jobs': self.job_service.max_concurrent_jobs,
            'processing_interval': self.job_service.processing_interval
        }

# Global job processor instance
job_processor = JobProcessor()
```

## Phase 2: API Integration (Week 1, Days 4-5)

### Task 2.1: Update AI Agent Routes
**Priority**: Critical  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.3

#### Step 2.1.1: Modify Create Canvas Endpoint
**File**: `backend/app/routes/ai_agent.py`

```python
# Add these imports at the top
from app.services.ai_job_service import AIJobService
from app.models.ai_job import AIJob

# Replace the existing create_canvas_with_ai function
@ai_agent_bp.route('/create-canvas', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
@ai_rate_limit('create_canvas')
def create_canvas_with_ai(current_user):
    """
    Create canvas objects using AI agent with background processing.
    """
    try:
        # Validate request data
        schema = CanvasCreationRequestSchema()
        data = schema.load(request.json)
        
        # Create background job
        job_service = AIJobService()
        job_id = job_service.create_canvas_job(
            user_id=current_user.id,
            request_data=data,
            priority=data.get('priority', 0)
        )
        
        # Only log success in development
        if os.environ.get('FLASK_ENV') == 'development':
            logger.log_info(f"AI canvas job created for user {current_user.id}")
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'message': 'Canvas creation job started',
            'status': 'queued'
        }), 202  # Accepted
        
    except Exception as e:
        logger.log_error(f"Failed to create AI canvas job: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

# Add new endpoints for job management
@ai_agent_bp.route('/job/<job_id>/status', methods=['GET'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
def get_job_status(current_user, job_id):
    """Get status of AI job."""
    try:
        job_service = AIJobService()
        job = job_service.get_job(job_id, current_user.id)
        
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        return jsonify({
            'success': True,
            'job': job.to_dict()
        })
        
    except Exception as e:
        logger.log_error(f"Failed to get job status: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/job/<job_id>/result', methods=['GET'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
def get_job_result(current_user, job_id):
    """Get result of completed AI job."""
    try:
        job_service = AIJobService()
        job = job_service.get_job(job_id, current_user.id)
        
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        if job.status != 'completed':
            return jsonify({'error': 'Job not completed'}), 400
        
        return jsonify({
            'success': True,
            'result': job.result_data
        })
        
    except Exception as e:
        logger.log_error(f"Failed to get job result: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/job/<job_id>/cancel', methods=['POST'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
def cancel_job(current_user, job_id):
    """Cancel an AI job."""
    try:
        job_service = AIJobService()
        success = job_service.cancel_job(job_id, current_user.id)
        
        if not success:
            return jsonify({'error': 'Job cannot be cancelled'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Job cancelled successfully'
        })
        
    except Exception as e:
        logger.log_error(f"Failed to cancel job: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/job/<job_id>/retry', methods=['POST'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
def retry_job(current_user, job_id):
    """Retry a failed AI job."""
    try:
        job_service = AIJobService()
        success = job_service.retry_failed_job(job_id, current_user.id)
        
        if not success:
            return jsonify({'error': 'Job cannot be retried'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Job retry started'
        })
        
    except Exception as e:
        logger.log_error(f"Failed to retry job: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/jobs', methods=['GET'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
def get_user_jobs(current_user):
    """Get jobs for the current user."""
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        jobs = AIJob.query.filter_by(user_id=current_user.id)\
                         .order_by(AIJob.created_at.desc())\
                         .limit(limit)\
                         .offset(offset)\
                         .all()
        
        return jsonify({
            'success': True,
            'jobs': [job.to_dict() for job in jobs]
        })
        
    except Exception as e:
        logger.log_error(f"Failed to get user jobs: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/jobs/stats', methods=['GET'])
@cross_origin(origins=['*'], supports_credentials=True)
@require_auth
def get_job_statistics(current_user):
    """Get job processing statistics."""
    try:
        job_service = AIJobService()
        stats = job_service.get_job_statistics()
        
        return jsonify({
            'success': True,
            'stats': stats
        })
        
    except Exception as e:
        logger.log_error(f"Failed to get job statistics: {str(e)}", e)
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/health', methods=['GET'])
def health_check():
    """Health check for AI agent service."""
    try:
        # Check database connection
        db.session.execute('SELECT 1')
        
        # Check job processor status
        from app.services.job_processor import job_processor
        processor_status = job_processor.get_status()
        
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'job_processor': processor_status,
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500
```

### Task 2.2: Application Integration
**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: Task 2.1

#### Step 2.2.1: Update Application Initialization
**File**: `backend/app/__init__.py`

```python
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")
    
    # Register blueprints
    from app.routes.ai_agent import ai_agent_bp
    app.register_blueprint(ai_agent_bp, url_prefix='/api/ai-agent')
    
    # Start job processor
    with app.app_context():
        from app.services.job_processor import job_processor
        job_processor.start()
    
    return app
```

## Phase 3: Frontend Integration (Week 2, Days 1-3)

### Task 3.1: Update AI Agent Service
**Priority**: Critical  
**Estimated Time**: 6 hours  
**Dependencies**: Task 2.2

#### Step 3.1.1: Create Job Types
**File**: `frontend/src/types/ai.ts`

```typescript
export interface AIJob {
  id: string;
  user_id: string;
  canvas_id?: string;
  job_type: 'create_canvas' | 'modify_canvas';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  request_data: any;
  result_data?: any;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  next_processing_at?: string;
}

export interface AIJobStatus {
  job_id: string;
  status: string;
  message?: string;
  progress?: number;
  result?: any;
  error?: string;
}

export interface CanvasCreationRequest {
  instructions: string;
  style?: string;
  colorScheme?: string;
  canvas_id?: string;
  priority?: number;
}

export interface CanvasCreationResponse {
  success: boolean;
  job_id: string;
  message: string;
  status: string;
}
```

#### Step 3.1.2: Update AI Agent Service
**File**: `frontend/src/services/aiAgentService.ts`

```typescript
import { AIJob, AIJobStatus, CanvasCreationRequest, CanvasCreationResponse } from '../types/ai';

export class AIAgentService {
  private baseUrl = '/api/ai-agent';
  private pollingInterval = 1000; // 1 second
  private maxPollingTime = 300000; // 5 minutes

  async createCanvasWithAI(
    instructions: string, 
    options: Partial<CanvasCreationRequest> = {}
  ): Promise<AIJob> {
    const requestData: CanvasCreationRequest = {
      instructions,
      ...options
    };

    const response = await fetch(`${this.baseUrl}/create-canvas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create canvas');
    }

    const result: CanvasCreationResponse = await response.json();
    
    if (result.success) {
      // Start polling for job completion
      return this.pollJobStatus(result.job_id);
    }
    
    throw new Error(result.message || 'Failed to create canvas');
  }

  async getJobStatus(jobId: string): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/job/${jobId}/status`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get job status');
    }

    const result = await response.json();
    return result.job;
  }

  async getJobResult(jobId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/job/${jobId}/result`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get job result');
    }

    const result = await response.json();
    return result.result;
  }

  async cancelJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/job/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel job');
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/job/${jobId}/retry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to retry job');
    }
  }

  async getUserJobs(limit: number = 50, offset: number = 0): Promise<AIJob[]> {
    const response = await fetch(`${this.baseUrl}/jobs?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user jobs');
    }

    const result = await response.json();
    return result.jobs;
  }

  async getJobStatistics(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/jobs/stats`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get job statistics');
    }

    const result = await response.json();
    return result.stats;
  }

  private async pollJobStatus(jobId: string): Promise<AIJob> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const pollInterval = setInterval(async () => {
        try {
          // Check if we've exceeded max polling time
          if (Date.now() - startTime > this.maxPollingTime) {
            clearInterval(pollInterval);
            reject(new Error('Job polling timeout'));
            return;
          }

          const job = await this.getJobStatus(jobId);
          
          if (job.status === 'completed') {
            clearInterval(pollInterval);
            resolve(job);
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            reject(new Error(job.error_message || 'Job failed'));
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, this.pollingInterval);
    });
  }

  private getAuthToken(): string {
    // Implement your auth token retrieval logic
    return localStorage.getItem('authToken') || '';
  }
}

// Export singleton instance
export const aiAgentService = new AIAgentService();
```

### Task 3.2: Real-time Updates Integration
**Priority**: High  
**Estimated Time**: 4 hours  
**Dependencies**: Task 3.1

#### Step 3.2.1: Create Job Update Hook
**File**: `frontend/src/hooks/useAIJobUpdates.ts`

```typescript
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { AIJobStatus } from '../types/ai';

export const useAIJobUpdates = () => {
  const [jobStatus, setJobStatus] = useState<Record<string, AIJobStatus>>({});
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const newSocket = io();
    setSocket(newSocket);

    // Listen for job updates
    newSocket.on('ai_job_update', (data: AIJobStatus) => {
      setJobStatus(prev => ({
        ...prev,
        [data.job_id]: data
      }));
    });

    newSocket.on('ai_job_complete', (data: AIJobStatus) => {
      setJobStatus(prev => ({
        ...prev,
        [data.job_id]: data
      }));
    });

    newSocket.on('ai_job_error', (data: AIJobStatus) => {
      setJobStatus(prev => ({
        ...prev,
        [data.job_id]: data
      }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const getJobStatus = (jobId: string): AIJobStatus | undefined => {
    return jobStatus[jobId];
  };

  const clearJobStatus = (jobId: string): void => {
    setJobStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[jobId];
      return newStatus;
    });
  };

  return {
    jobStatus,
    getJobStatus,
    clearJobStatus,
    socket
  };
};
```

## Testing Strategy

### Unit Tests

#### Backend Tests
**File**: `backend/tests/test_ai_job_service.py`

```python
import pytest
from app.services.ai_job_service import AIJobService
from app.models.ai_job import AIJob
from app.extensions import db

class TestAIJobService:
    def test_create_canvas_job(self, app, user):
        with app.app_context():
            job_service = AIJobService()
            request_data = {
                'instructions': 'Create a flowchart',
                'style': 'modern'
            }
            
            job_id = job_service.create_canvas_job(
                user_id=user.id,
                request_data=request_data
            )
            
            job = AIJob.query.get(job_id)
            assert job is not None
            assert job.job_type == 'create_canvas'
            assert job.status == 'queued'
            assert job.user_id == user.id
    
    def test_get_next_job(self, app, user):
        with app.app_context():
            job_service = AIJobService()
            
            # Create a job
            job_id = job_service.create_canvas_job(
                user_id=user.id,
                request_data={'instructions': 'Test job'}
            )
            
            # Get next job
            next_job = job_service.get_next_job()
            assert next_job is not None
            assert next_job.id == job_id
```

#### Frontend Tests
**File**: `frontend/src/services/__tests__/aiAgentService.test.ts`

```typescript
import { AIAgentService } from '../aiAgentService';

describe('AIAgentService', () => {
  let aiService: AIAgentService;

  beforeEach(() => {
    aiService = new AIAgentService();
  });

  it('should create canvas job successfully', async () => {
    // Mock fetch response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        job_id: 'test-job-id',
        message: 'Job created',
        status: 'queued'
      })
    });

    const result = await aiService.createCanvasWithAI('Create a flowchart');
    
    expect(result.job_id).toBe('test-job-id');
    expect(result.status).toBe('queued');
  });
});
```

## Deployment Checklist

### Railway Deployment
- [ ] Database migration applied
- [ ] Environment variables set
- [ ] Job processor starts automatically
- [ ] Health checks working
- [ ] Socket.IO connections working

### Environment Variables
```bash
# Add to Railway environment
MAX_CONCURRENT_JOBS=3
JOB_PROCESSING_INTERVAL=5
FLASK_ENV=production
```

### Monitoring
- [ ] Job statistics endpoint working
- [ ] Health check endpoint responding
- [ ] Error logging configured
- [ ] Performance metrics collected

## Performance Optimization

### Database Indexes
```sql
-- Optimize job processing queries
CREATE INDEX CONCURRENTLY idx_ai_jobs_status_processing 
ON ai_jobs(status, next_processing_at) 
WHERE status = 'queued';

-- Optimize user job queries
CREATE INDEX CONCURRENTLY idx_ai_jobs_user_created 
ON ai_jobs(user_id, created_at DESC);
```

### Memory Management
- **Job Cleanup**: Automatic cleanup of old jobs (7+ days)
- **Connection Pooling**: Efficient database connections
- **Thread Management**: Daemon threads for background processing

## Conclusion

This Railway-compatible implementation provides:

1. **✅ Railway Compatibility** - Uses existing PostgreSQL database
2. **✅ Async Benefits** - Immediate response with background processing
3. **✅ Reliability** - Job persistence and retry logic
4. **✅ Scalability** - Configurable concurrent processing
5. **✅ Cost Efficiency** - No additional infrastructure costs
6. **✅ Real-time Updates** - Socket.IO integration
7. **✅ Monitoring** - Comprehensive job tracking and statistics

The solution delivers the same user experience benefits as Redis-based approaches while working within Railway's infrastructure constraints.
