# Asynchronous AI Implementation Plan

## Project Overview

**Objective**: Migrate CollabCanvas from synchronous AI processing to asynchronous background job processing using PostgreSQL-based job queuing, following the Config app's proven architecture but adapted for Railway infrastructure.

**Timeline**: 5 phases over 2-3 weeks  
**Complexity**: High  
**Impact**: Significant improvement in user experience, scalability, and reliability

## Current State Analysis

### Current Architecture (Synchronous)
- **Frontend**: React with direct API calls
- **Backend**: Flask with immediate AI processing
- **Processing Time**: 5-30 seconds per request
- **User Experience**: Long waits, potential timeouts
- **Scalability**: Limited by synchronous processing

### Target Architecture (Asynchronous)
- **Frontend**: React with job polling and real-time updates
- **Backend**: Flask with PostgreSQL-based job queue
- **Processing**: Background threading with job persistence
- **Response Time**: <100ms for job creation
- **User Experience**: Immediate feedback with progress tracking

## Implementation Phases

### Phase 1: Infrastructure Foundation (Week 1, Days 1-3)

#### Task 1.1: Database Schema Implementation
**Priority**: Critical  
**Estimated Time**: 4 hours  
**Dependencies**: None

#### Subtasks:
1. **Create AIJob Model**
   - File: `backend/app/models/ai_job.py`
   - Job tracking fields
   - Status management
   - Retry logic
   - Timestamps and relationships

2. **Create Database Migration**
   - File: `backend/migrations/versions/xxx_add_ai_job_table.py`
   - Table creation
   - Indexes for performance
   - Foreign key constraints

#### Acceptance Criteria:
- [ ] AIJob model created with all required fields
- [ ] Database migration created and tested
- [ ] Indexes added for performance
- [ ] Model relationships working

#### Code Example:
```python
# backend/app/models/ai_job.py
class AIJob(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    job_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='queued')
    priority = db.Column(db.Integer, default=0)
    request_data = db.Column(db.JSON, nullable=False)
    result_data = db.Column(db.JSON, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    next_processing_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.Index('idx_ai_job_status_processing', 'status', 'next_processing_at'),
        db.Index('idx_ai_job_user_status', 'user_id', 'status'),
        db.Index('idx_ai_job_created_at', 'created_at'),
    )
```

### Task 1.2: Background Job Processing Setup
**Priority**: Critical  
**Estimated Time**: 3 hours  
**Dependencies**: Task 1.1

#### Subtasks:
1. **Update Requirements**
   - File: `backend/requirements.txt`
   - Add threading and job processing dependencies
   - Add monitoring and logging dependencies

2. **Create Job Processing Configuration**
   - File: `backend/app/config/job_config.py`
   - Job processing settings
   - Threading configuration
   - Environment variable handling

3. **Create Background Job Processor**
   - File: `backend/app/services/job_processor.py`
   - Threading-based job processing
   - Job queue management
   - Error handling and retry logic

#### Acceptance Criteria:
- [ ] Job processor service created
- [ ] Threading configuration working
- [ ] Dependencies installed
- [ ] Job processing tested

#### Code Example:
```python
# backend/app/config/job_config.py
import os
from datetime import timedelta

class JobConfig:
    """Configuration for background job processing."""
    
    # Job processing settings
    MAX_CONCURRENT_JOBS = int(os.getenv('MAX_CONCURRENT_JOBS', '3'))
    PROCESSING_INTERVAL = int(os.getenv('JOB_PROCESSING_INTERVAL', '5'))  # seconds
    MAX_RETRIES = int(os.getenv('MAX_JOB_RETRIES', '3'))
    
    # Retry backoff settings
    RETRY_BACKOFF_BASE = 2  # minutes
    RETRY_BACKOFF_MAX = 8   # minutes
    
    # Job cleanup settings
    JOB_CLEANUP_DAYS = int(os.getenv('JOB_CLEANUP_DAYS', '7'))
    
    # Threading settings
    THREAD_DAEMON = True
    THREAD_JOIN_TIMEOUT = 10  # seconds
```

### Task 1.3: Background Job Service
**Priority**: Critical  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.2

#### Subtasks:
1. **Create AIJobService**
   - File: `backend/app/services/ai_job_service.py`
   - Job creation and management
   - Job processing logic
   - Error handling and retry logic

2. **Create Background Tasks**
   - File: `backend/app/tasks.py`
   - AI processing tasks
   - Job status updates
   - Socket.IO integration

3. **Create Worker Script**
   - File: `backend/worker.py`
   - Job processor entry point
   - Signal handling
   - Logging configuration

#### Acceptance Criteria:
- [ ] AIJobService created with all methods
- [ ] Background tasks process successfully
- [ ] Worker script runs and processes jobs
- [ ] Error handling works correctly

#### Code Example:
```python
# backend/app/services/ai_job_service.py
import threading
from datetime import datetime, timedelta
from app.models.ai_job import AIJob
from app.extensions import db
from app.config.job_config import JobConfig

class AIJobService:
    def __init__(self):
        self.config = JobConfig()
        self.logger = SmartLogger()
    
    def create_canvas_job(self, user_id: str, request_data: dict) -> str:
        """Create a new canvas creation job."""
        job = AIJob(
            user_id=user_id,
            job_type='create_canvas',
            request_data=request_data,
            status='queued',
            next_processing_at=datetime.utcnow()
        )
        db.session.add(job)
        db.session.commit()
        return job.id
    
    def get_next_job(self) -> Optional[AIJob]:
        """Get the next job to process."""
        return AIJob.query.filter(
            AIJob.status == 'queued',
            AIJob.next_processing_at <= datetime.utcnow()
        ).order_by(AIJob.priority.desc(), AIJob.created_at.asc()).first()
    
    def process_job(self, job: AIJob) -> bool:
        """Process a single job."""
        try:
            job.mark_started()
            
            # Emit status update
            socketio.emit('ai_job_update', {
                'job_id': job.id,
                'status': 'processing',
                'message': 'Starting AI generation...',
                'progress': 10
            })
            
            # Process with AI service
            ai_service = AIAgentService()
            result = ai_service.create_canvas_from_query(
                query=job.request_data['instructions'],
                user_id=job.user_id,
                canvas_id=job.request_data.get('canvas_id'),
                style=job.request_data.get('style', 'modern'),
                color_scheme=job.request_data.get('colorScheme', 'default')
            )
            
            # Mark as completed
            job.mark_completed(result)
            
            # Emit completion
            socketio.emit('ai_job_complete', {
                'job_id': job.id,
                'status': 'completed',
                'result': result,
                'progress': 100
            })
            
            return True
            
        except Exception as e:
            job.schedule_retry(str(e))
            socketio.emit('ai_job_error', {
                'job_id': job.id,
                'status': job.status,
                'error': str(e)
            })
            return False
```

## Phase 2: API Layer Updates (Week 1, Days 4-5)

### Task 2.1: Update AI Agent Routes
**Priority**: Critical  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.3

#### Subtasks:
1. **Modify Create Canvas Endpoint**
   - File: `backend/app/routes/ai_agent.py`
   - Change from synchronous to asynchronous
   - Return job ID immediately
   - Add job status endpoints

2. **Add Job Management Endpoints**
   - Job status checking
   - Job cancellation
   - Job retry functionality
   - Job statistics

#### Acceptance Criteria:
- [ ] Create canvas endpoint returns job ID
- [ ] Job status endpoint working
- [ ] Job management endpoints functional
- [ ] Error handling improved

#### Code Example:
```python
@ai_agent_bp.route('/create-canvas', methods=['POST'])
@require_auth
def create_canvas_with_ai(current_user):
    """Create canvas using AI agent with background processing."""
    try:
        schema = CanvasCreationRequestSchema()
        data = schema.load(request.json)
        
        job_service = AIJobService()
        job_id = job_service.create_canvas_job(
            user_id=current_user.id,
            request_data=data
        )
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'message': 'Canvas creation job started',
            'status': 'queued'
        }), 202  # Accepted
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_agent_bp.route('/job/<job_id>/status', methods=['GET'])
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
        return jsonify({'error': str(e)}), 500
```

### Task 2.2: Application Integration
**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: Task 2.1

#### Subtasks:
1. **Update Application Initialization**
   - File: `backend/app/__init__.py`
   - Start job processor
   - Register new routes
   - Update error handling

2. **Update Configuration**
   - Environment variables
   - Logging configuration
   - Performance settings

#### Acceptance Criteria:
- [ ] Job processor starts automatically
- [ ] New routes registered
- [ ] Configuration updated
- [ ] Application starts successfully

## Phase 3: Frontend Integration (Week 2, Days 1-3)

### Task 3.1: Update AI Agent Service
**Priority**: Critical  
**Estimated Time**: 6 hours  
**Dependencies**: Task 2.2

#### Subtasks:
1. **Create Job Types**
   - File: `frontend/src/types/ai.ts`
   - AIJob interface
   - Job status types
   - Request/response types

2. **Update AI Agent Service**
   - File: `frontend/src/services/aiAgentService.ts`
   - Async job creation
   - Job status polling
   - Error handling

#### Acceptance Criteria:
- [ ] Job types defined
- [ ] Service updated for async processing
- [ ] Polling mechanism working
- [ ] Error handling improved

#### Code Example:
```typescript
export interface AIJob {
  id: string;
  user_id: string;
  job_type: 'create_canvas' | 'modify_canvas';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  request_data: any;
  result_data?: any;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export class AIAgentService {
  async createCanvasWithAI(instructions: string, options: any = {}): Promise<AIJob> {
    const response = await fetch('/api/ai-agent/create-canvas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ instructions, ...options })
    });

    const result = await response.json();
    
    if (result.success) {
      return this.pollJobStatus(result.job_id);
    }
    
    throw new Error(result.error || 'Failed to create canvas');
  }

  private async pollJobStatus(jobId: string): Promise<AIJob> {
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
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
      }, 1000);
    });
  }
}
```

### Task 3.2: Real-time Updates Integration
**Priority**: High  
**Estimated Time**: 4 hours  
**Dependencies**: Task 3.1

#### Subtasks:
1. **Create Job Update Hook**
   - File: `frontend/src/hooks/useAIJobUpdates.ts`
   - Socket.IO integration
   - Job status tracking
   - Real-time updates

2. **Update Canvas Components**
   - Progress indicators
   - Job status display
   - Error handling
   - User feedback

#### Acceptance Criteria:
- [ ] Socket.IO integration working
- [ ] Real-time updates functional
- [ ] Progress indicators added
- [ ] User experience improved

#### Code Example:
```typescript
export const useAIJobUpdates = () => {
  const [jobStatus, setJobStatus] = useState<Record<string, any>>({});

  useEffect(() => {
    const socket = io();
    
    socket.on('ai_job_update', (data) => {
      setJobStatus(prev => ({
        ...prev,
        [data.job_id]: data
      }));
    });
    
    socket.on('ai_job_complete', (data) => {
      setJobStatus(prev => ({
        ...prev,
        [data.job_id]: data
      }));
    });
    
    return () => socket.disconnect();
  }, []);

  return { jobStatus, getJobStatus: (jobId: string) => jobStatus[jobId] };
};
```

## Phase 4: Advanced Features (Week 2, Days 4-5)

### Task 4.1: Job Prioritization
**Priority**: Medium  
**Estimated Time**: 4 hours  
**Dependencies**: Task 3.2

#### Subtasks:
1. **Implement Priority System**
   - Priority-based job processing
   - User priority settings
   - Priority queue management

2. **Add Priority Controls**
   - Frontend priority selection
   - Priority display
   - Priority-based UI

#### Acceptance Criteria:
- [ ] Priority system working
- [ ] Jobs processed by priority
- [ ] Priority controls added
- [ ] UI updated for priority

### Task 4.2: Retry Mechanism
**Priority**: Medium  
**Estimated Time**: 4 hours  
**Dependencies**: Task 4.1

#### Subtasks:
1. **Implement Retry Logic**
   - Automatic retry on failure
   - Exponential backoff
   - Retry limits

2. **Add Retry Controls**
   - Manual retry functionality
   - Retry status display
   - Retry history

#### Acceptance Criteria:
- [ ] Automatic retry working
- [ ] Exponential backoff implemented
- [ ] Manual retry functional
- [ ] Retry status displayed

## Phase 5: Monitoring & Optimization (Week 3)

### Task 5.1: Performance Optimization
**Priority**: Medium  
**Estimated Time**: 6 hours  
**Dependencies**: Task 4.2

#### Subtasks:
1. **Implement Caching**
   - File: `backend/app/services/cache_service.py`
   - Database-based result caching
   - Cache invalidation
   - Cache statistics

2. **Optimize Database Queries**
   - Query optimization
   - Index optimization
   - Connection pooling

#### Acceptance Criteria:
- [ ] Caching system working
- [ ] Database queries optimized
- [ ] Performance improved
- [ ] Cache statistics available

### Task 5.2: Monitoring & Metrics
**Priority**: Medium  
**Estimated Time**: 4 hours  
**Dependencies**: Task 5.1

#### Subtasks:
1. **Add Job Statistics**
   - Job processing metrics
   - Performance statistics
   - Error tracking

2. **Implement Health Checks**
   - Service health monitoring
   - Database health checks
   - Job processor health

#### Acceptance Criteria:
- [ ] Statistics endpoint working
- [ ] Health checks functional
- [ ] Monitoring dashboard ready
- [ ] Performance metrics collected

## Testing Strategy

### Unit Tests
- **Backend**: AIJobService, JobProcessor, API endpoints
- **Frontend**: AIAgentService, hooks, components
- **Coverage**: Target 80% code coverage

### Integration Tests
- **End-to-end job processing**
- **Database operations**
- **Socket.IO communication**
- **API endpoint testing**

### Load Tests
- **Concurrent job processing**
- **High-volume job creation**
- **Database performance**
- **Memory and CPU usage**

## Risk Assessment

### High Risk
- **Database migration issues**: AIJob table creation
- **Job processing failures**: Background task errors
- **Threading issues**: Race conditions and deadlocks

### Medium Risk
- **Frontend integration complexity**: Async job handling
- **Performance degradation**: Additional infrastructure overhead
- **User experience issues**: Job status confusion

### Low Risk
- **Documentation updates**: Outdated documentation
- **UI/UX changes**: User confusion

## Rollback Plan

### Phase 1 Rollback
- Remove AIJob table and migration
- Revert job processing configuration
- Remove background job dependencies

### Phase 2 Rollback
- Revert API endpoint changes
- Remove job management endpoints
- Restore synchronous processing

### Phase 3 Rollback
- Revert frontend service changes
- Remove job polling logic
- Restore direct API calls

## Success Metrics

### Performance Metrics
- **Job creation time**: < 100ms
- **Job processing time**: < 30 seconds average
- **Queue throughput**: > 100 jobs/minute
- **Error rate**: < 1% job failures

### User Experience Metrics
- **Immediate feedback**: < 100ms job confirmation
- **Progress visibility**: Real-time status updates
- **Error clarity**: Clear, actionable error messages
- **Job management**: Easy job tracking and cancellation

### Technical Metrics
- **Database performance**: < 10ms query time for job operations
- **Memory usage**: < 512MB per worker process
- **CPU usage**: < 50% average per worker
- **System uptime**: > 99.9%

## Conclusion

This PostgreSQL-based asynchronous implementation provides:

1. **✅ Railway Compatibility** - Uses existing PostgreSQL database
2. **✅ Async Benefits** - Immediate response with background processing
3. **✅ Reliability** - Job persistence and retry logic
4. **✅ Scalability** - Configurable concurrent processing
5. **✅ Cost Efficiency** - No additional infrastructure costs
6. **✅ Real-time Updates** - Socket.IO integration
7. **✅ Monitoring** - Comprehensive job tracking and statistics

The solution delivers the same user experience benefits as traditional message queue approaches while working perfectly within Railway's infrastructure constraints.
