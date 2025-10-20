# Implementation Task Breakdown

## Overview

This document provides detailed, actionable tasks for implementing asynchronous AI processing in CollabCanvas. Each task includes specific code examples, file locations, and step-by-step instructions.

## Phase 1: Infrastructure Foundation

### Task 1.1: Database Schema Updates

#### Step 1.1.1: Create AIJob Model
**File**: `backend/app/models/ai_job.py`

```python
import uuid
from datetime import datetime
from app.extensions import db

class AIJob(db.Model):
    """Model for tracking AI background jobs."""
    
    __tablename__ = 'ai_jobs'
    
    # Primary key
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign keys
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    canvas_id = db.Column(db.String(36), db.ForeignKey('canvas.id'), nullable=True)
    
    # Job details
    job_type = db.Column(db.String(50), nullable=False)  # 'create_canvas', 'modify_canvas'
    status = db.Column(db.String(20), default='queued')  # queued, processing, completed, failed
    priority = db.Column(db.Integer, default=0)  # Higher number = higher priority
    
    # Data storage
    request_data = db.Column(db.JSON, nullable=False)
    result_data = db.Column(db.JSON, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    
    # RQ integration
    rq_job_id = db.Column(db.String(100), nullable=True)
    
    # Retry tracking
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='ai_jobs')
    canvas = db.relationship('Canvas', backref='ai_jobs')
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_ai_job_user_status', 'user_id', 'status'),
        db.Index('idx_ai_job_created_at', 'created_at'),
        db.Index('idx_ai_job_priority', 'priority', 'created_at'),
        db.Index('idx_ai_job_type', 'job_type'),
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
```

#### Step 1.1.2: Update Model Imports
**File**: `backend/app/models/__init__.py`

```python
# Add to existing imports
from .ai_job import AIJob

# Add to __all__ list
__all__ = [
    'User', 'Canvas', 'CanvasObject', 'CanvasPermission', 
    'Invitation', 'AIJob'  # Add this line
]
```

#### Step 1.1.3: Create Database Migration
**File**: `backend/migrations/versions/xxx_add_ai_job_table.py`

```python
"""Add AIJob table

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
        sa.Column('rq_job_id', sa.String(100), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('max_retries', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['canvas_id'], ['canvas.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_ai_job_user_status', 'ai_jobs', ['user_id', 'status'])
    op.create_index('idx_ai_job_created_at', 'ai_jobs', ['created_at'])
    op.create_index('idx_ai_job_priority', 'ai_jobs', ['priority', 'created_at'])
    op.create_index('idx_ai_job_type', 'ai_jobs', ['job_type'])

def downgrade():
    # Drop indexes
    op.drop_index('idx_ai_job_type', table_name='ai_jobs')
    op.drop_index('idx_ai_job_priority', table_name='ai_jobs')
    op.drop_index('idx_ai_job_created_at', table_name='ai_jobs')
    op.drop_index('idx_ai_job_user_status', table_name='ai_jobs')
    
    # Drop table
    op.drop_table('ai_jobs')
```

### Task 1.2: Background Job Processing Setup

#### Step 1.2.1: Update Docker Compose
**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: collabcanvas
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  web:
    build: ./backend
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/collabcanvas
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./backend:/app

  worker:
    build: ./backend
    command: python -m rq worker --url redis://redis:6379/0 ai_tasks
    depends_on:
      - redis
      - postgres
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/collabcanvas
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./backend:/app

volumes:
  postgres_data:
  redis_data:
```

#### Step 1.2.2: Update Requirements
**File**: `backend/requirements.txt`

```txt
# Add these lines to existing requirements.txt
rq==1.15.1
redis==5.0.1
elasticsearch==8.11.0
```

#### Step 1.2.3: Create Redis Configuration
**File**: `backend/app/config/redis_config.py`

```python
import os
from redis import Redis
from rq import Queue

class RedisConfig:
    """Redis configuration and connection management."""
    
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.redis_conn = None
        self.task_queue = None
    
    def get_connection(self):
        """Get Redis connection."""
        if not self.redis_conn:
            self.redis_conn = Redis.from_url(self.redis_url)
        return self.redis_conn
    
    def get_queue(self, queue_name='ai_tasks'):
        """Get RQ queue."""
        if not self.task_queue:
            self.task_queue = Queue(queue_name, connection=self.get_connection())
        return self.task_queue
    
    def test_connection(self):
        """Test Redis connection."""
        try:
            conn = self.get_connection()
            conn.ping()
            return True
        except Exception as e:
            print(f"Redis connection failed: {e}")
            return False

# Global instance
redis_config = RedisConfig()
```

### Task 1.3: Background Job Service

#### Step 1.3.1: Create AIJobService
**File**: `backend/app/services/ai_job_service.py`

```python
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.models.ai_job import AIJob
from app.extensions import db
from app.config.redis_config import redis_config
from app.utils.logger import SmartLogger

class AIJobService:
    """Service for managing AI background jobs."""
    
    def __init__(self):
        self.logger = SmartLogger()
        self.redis_config = redis_config
        self.task_queue = self.redis_config.get_queue('ai_tasks')
    
    def create_canvas_job(self, user_id: str, request_data: dict, priority: int = 0) -> str:
        """Create a new canvas creation job."""
        try:
            # Create job record
            job = AIJob(
                user_id=user_id,
                job_type='create_canvas',
                request_data=request_data,
                status='queued',
                priority=priority
            )
            db.session.add(job)
            db.session.commit()
            
            # Enqueue background job
            rq_job = self.task_queue.enqueue(
                'app.tasks.process_canvas_creation_job',
                job.id,
                job_timeout=1800,  # 30 minutes timeout
                job_id=job.id  # Use our job ID as RQ job ID
            )
            
            job.rq_job_id = rq_job.id
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
    
    def get_user_jobs(self, user_id: str, limit: int = 50, offset: int = 0) -> List[AIJob]:
        """Get jobs for a specific user."""
        return AIJob.query.filter_by(user_id=user_id)\
                         .order_by(AIJob.created_at.desc())\
                         .limit(limit)\
                         .offset(offset)\
                         .all()
    
    def cancel_job(self, job_id: str, user_id: str) -> bool:
        """Cancel a job if it's still queued."""
        job = self.get_job(job_id, user_id)
        if not job:
            return False
        
        if job.status in ['queued', 'processing']:
            # Cancel RQ job if it exists
            if job.rq_job_id:
                try:
                    rq_job = self.task_queue.fetch_job(job.rq_job_id)
                    if rq_job:
                        rq_job.cancel()
                except Exception as e:
                    self.logger.log_error(f"Failed to cancel RQ job: {str(e)}")
            
            # Update job status
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
            job.retry_count += 1
            job.error_message = None
            job.started_at = None
            job.completed_at = None
            db.session.commit()
            
            # Re-enqueue job
            rq_job = self.task_queue.enqueue(
                'app.tasks.process_canvas_creation_job',
                job.id,
                job_timeout=1800,
                job_id=job.id
            )
            
            job.rq_job_id = rq_job.id
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
        }
        
        # Calculate success rate
        total_processed = stats['completed_jobs'] + stats['failed_jobs']
        if total_processed > 0:
            stats['success_rate'] = (stats['completed_jobs'] / total_processed) * 100
        else:
            stats['success_rate'] = 0
        
        return stats
```

#### Step 1.3.2: Create Background Tasks
**File**: `backend/app/tasks.py`

```python
import os
import json
from datetime import datetime
from typing import Dict, Any
from app import create_app
from app.models.ai_job import AIJob
from app.extensions import db, socketio
from app.services.ai_agent_service import AIAgentService
from app.utils.logger import SmartLogger

def process_canvas_creation_job(job_id: str):
    """Background task for canvas creation."""
    app = create_app()
    logger = SmartLogger()
    
    with app.app_context():
        try:
            # Get job from database
            job = AIJob.query.get(job_id)
            if not job:
                logger.log_error(f"Job {job_id} not found")
                return
            
            # Mark job as started
            job.mark_started()
            
            # Emit status update
            socketio.emit('ai_job_update', {
                'job_id': job_id,
                'status': 'processing',
                'message': 'Starting AI canvas generation...',
                'progress': 10
            })
            
            # Initialize AI service
            try:
                ai_service = AIAgentService()
                logger.log_info(f"AI service initialized for job {job_id}")
            except Exception as e:
                logger.log_error(f"Failed to initialize AI service: {str(e)}", e)
                job.mark_failed(f"AI service initialization failed: {str(e)}")
                socketio.emit('ai_job_error', {
                    'job_id': job_id,
                    'status': 'failed',
                    'error': f"AI service initialization failed: {str(e)}"
                })
                return
            
            # Emit progress update
            socketio.emit('ai_job_update', {
                'job_id': job_id,
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
                'job_id': job_id,
                'status': 'processing',
                'message': 'Finalizing canvas...',
                'progress': 90
            })
            
            # Mark job as completed
            job.mark_completed(result)
            
            # Emit completion
            socketio.emit('ai_job_complete', {
                'job_id': job_id,
                'status': 'completed',
                'result': result,
                'progress': 100
            })
            
            logger.log_info(f"AI job {job_id} completed successfully")
            
        except Exception as e:
            logger.log_error(f"AI job {job_id} failed: {str(e)}", e)
            
            # Mark job as failed
            if job:
                job.mark_failed(str(e))
            
            # Emit error
            socketio.emit('ai_job_error', {
                'job_id': job_id,
                'status': 'failed',
                'error': str(e)
            })

def process_canvas_modification_job(job_id: str):
    """Background task for canvas modification."""
    # Similar implementation to process_canvas_creation_job
    # but for modifying existing canvases
    pass

def cleanup_old_jobs():
    """Background task for cleaning up old jobs."""
    app = create_app()
    
    with app.app_context():
        from app.services.ai_job_service import AIJobService
        job_service = AIJobService()
        job_service.cleanup_old_jobs(days=7)
```

#### Step 1.3.3: Create Worker Script
**File**: `backend/worker.py`

```python
#!/usr/bin/env python3
"""
RQ Worker for processing AI background jobs.
"""
import os
import sys
from rq import Worker, Connection
from redis import Redis

def main():
    """Main worker function."""
    # Get Redis URL from environment
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    
    try:
        # Create Redis connection
        redis_conn = Redis.from_url(redis_url)
        
        # Test connection
        redis_conn.ping()
        print(f"Connected to Redis at {redis_url}")
        
        # Create worker
        with Connection(redis_conn):
            worker = Worker(['ai_tasks'])
            print("Starting RQ worker for 'ai_tasks' queue...")
            worker.work()
            
    except Exception as e:
        print(f"Worker failed to start: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
```

## Phase 2: API Layer Updates

### Task 2.1: Update AI Agent Routes

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
        
        job_service = AIJobService()
        jobs = job_service.get_user_jobs(current_user.id, limit, offset)
        
        return jsonify({
            'success': True,
            'jobs': [job.to_dict() for job in jobs]
        })
        
    except Exception as e:
        logger.log_error(f"Failed to get user jobs: {str(e)}", e)
        return jsonify({'error': str(e)}), 500
```

## Phase 3: Frontend Integration

### Task 3.1: Update AI Agent Service

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

#### Step 3.2.2: Update Canvas Components
**File**: `frontend/src/components/Canvas/CanvasEditor.tsx`

```typescript
import React, { useState } from 'react';
import { useAIJobUpdates } from '../../hooks/useAIJobUpdates';
import { aiAgentService } from '../../services/aiAgentService';

export const CanvasEditor: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const { getJobStatus } = useAIJobUpdates();

  const handleAIGeneration = async (instructions: string) => {
    try {
      setIsGenerating(true);
      const job = await aiAgentService.createCanvasWithAI(instructions);
      setCurrentJobId(job.id);
      
      // Job will be completed via polling or Socket.IO
      if (job.status === 'completed') {
        handleJobComplete(job);
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      setIsGenerating(false);
      setCurrentJobId(null);
    }
  };

  const handleJobComplete = (job: any) => {
    setIsGenerating(false);
    setCurrentJobId(null);
    
    // Handle the completed job result
    if (job.result_data) {
      // Update canvas with generated objects
      // Implementation depends on your canvas management
    }
  };

  // Get current job status for progress display
  const currentJobStatus = currentJobId ? getJobStatus(currentJobId) : null;

  return (
    <div className="canvas-editor">
      {/* Your existing canvas editor UI */}
      
      {/* AI Generation Progress */}
      {isGenerating && currentJobStatus && (
        <div className="ai-generation-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${currentJobStatus.progress || 0}%` }}
            />
          </div>
          <p>{currentJobStatus.message || 'Generating canvas...'}</p>
        </div>
      )}
    </div>
  );
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

### Integration Tests

#### End-to-End Job Processing
**File**: `backend/tests/test_job_processing.py`

```python
import pytest
from app.tasks import process_canvas_creation_job
from app.models.ai_job import AIJob

def test_canvas_creation_job_processing(app, user):
    with app.app_context():
        # Create a test job
        job = AIJob(
            user_id=user.id,
            job_type='create_canvas',
            request_data={'instructions': 'Create a simple rectangle'},
            status='queued'
        )
        db.session.add(job)
        db.session.commit()
        
        # Process the job
        process_canvas_creation_job(job.id)
        
        # Check job was completed
        updated_job = AIJob.query.get(job.id)
        assert updated_job.status == 'completed'
        assert updated_job.result_data is not None
```

## Deployment Checklist

### Infrastructure
- [ ] Redis service added to docker-compose.yml
- [ ] Worker service configured
- [ ] Database migration applied
- [ ] Environment variables set

### Code
- [ ] AIJob model created
- [ ] AIJobService implemented
- [ ] Background tasks created
- [ ] API endpoints updated
- [ ] Frontend service updated
- [ ] Socket.IO integration added

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] End-to-end tests written and passing
- [ ] Load tests completed

### Monitoring
- [ ] Job statistics endpoint working
- [ ] Error logging configured
- [ ] Performance metrics collected
- [ ] Health checks implemented

This implementation plan provides a comprehensive roadmap for migrating CollabCanvas to asynchronous AI processing, with detailed code examples and step-by-step instructions for each task.
