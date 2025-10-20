from datetime import datetime
from app.extensions import db
import json

class Prompt(db.Model):
    __tablename__ = 'prompts'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID
    user_id = db.Column(db.String(128), db.ForeignKey('users.id'), nullable=False)
    instructions = db.Column(db.Text, nullable=False)
    style = db.Column(db.String(50), default='modern')  # modern, corporate, creative, minimal
    color_scheme = db.Column(db.String(50), default='default')  # pastel, vibrant, monochrome, default
    model_used = db.Column(db.String(100))  # e.g., 'gpt-4'
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    request_metadata = db.Column(db.Text)  # JSON string for request_id, timestamps, etc.
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    canvases = db.relationship('Canvas', backref='prompt', lazy='dynamic', foreign_keys='Canvas.prompt_id')
    creator = db.relationship('User', backref='prompts', lazy='joined', foreign_keys='Prompt.user_id')
    
    def __repr__(self):
        return f'<Prompt {self.id} - {self.status}>'
    
    def get_metadata(self):
        """Get request metadata as a dictionary."""
        try:
            return json.loads(self.request_metadata) if self.request_metadata else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_metadata(self, metadata_dict):
        """Set request metadata from a dictionary."""
        self.request_metadata = json.dumps(metadata_dict)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'instructions': self.instructions,
            'style': self.style,
            'color_scheme': self.color_scheme,
            'model_used': self.model_used,
            'status': self.status,
            'request_metadata': self.get_metadata(),
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'canvas_count': self.canvases.count()
        }
