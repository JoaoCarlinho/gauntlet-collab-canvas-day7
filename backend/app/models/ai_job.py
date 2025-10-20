import uuid
from datetime import datetime, timedelta
from app.extensions import db

class AIJob(db.Model):
    """Model for tracking AI background jobs using PostgreSQL."""
    
    __tablename__ = 'ai_jobs'
    
    # Primary key
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign keys (commented out for now to avoid table dependency issues)
    user_id = db.Column(db.String(36), nullable=False)  # db.ForeignKey('user.id')
    canvas_id = db.Column(db.String(36), nullable=True)  # db.ForeignKey('canvas.id')
    
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
    
    # Relationships (commented out for now to avoid foreign key issues)
    # user = db.relationship('User', backref='ai_jobs')
    # canvas = db.relationship('Canvas', backref='ai_jobs')
    
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
