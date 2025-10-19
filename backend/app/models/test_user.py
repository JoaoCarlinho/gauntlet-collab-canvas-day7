"""
Test User model for automated testing system.
Stores passkey credentials and test execution permissions.
"""

from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.utils.logger import SmartLogger

logger = SmartLogger('test_user_model', 'WARNING')

class TestUser(db.Model):
    """Model for test execution users with passkey authentication."""
    
    __tablename__ = 'test_users'
    
    id = db.Column(db.String(36), primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    
    # Passkey authentication
    passkey_id = db.Column(db.String(255), unique=True, nullable=True, index=True)
    passkey_public_key = db.Column(db.Text, nullable=True)
    passkey_counter = db.Column(db.Integer, default=0)
    passkey_created_at = db.Column(db.DateTime(timezone=True), nullable=True)
    
    # Test execution permissions
    can_execute_tests = db.Column(db.Boolean, default=False)
    can_view_results = db.Column(db.Boolean, default=False)
    can_manage_tests = db.Column(db.Boolean, default=False)
    
    # Session management
    active_session_token = db.Column(db.String(255), nullable=True, index=True)
    session_expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)
    
    # Audit fields
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True)
    
    def __init__(self, id: str, email: str, name: str, **kwargs):
        self.id = id
        self.email = email
        self.name = name
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'can_execute_tests': self.can_execute_tests,
            'can_view_results': self.can_view_results,
            'can_manage_tests': self.can_manage_tests,
            'has_passkey': bool(self.passkey_id),
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_active': self.is_active
        }
    
    def has_valid_session(self) -> bool:
        """Check if user has a valid active session."""
        if not self.active_session_token or not self.session_expires_at:
            return False
        return datetime.now(timezone.utc) < self.session_expires_at
    
    def create_session(self, token: str, expires_in_minutes: int = 60) -> None:
        """Create a new session for the user."""
        self.active_session_token = token
        self.session_expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
        self.last_login_at = datetime.now(timezone.utc)
        db.session.commit()
    
    def invalidate_session(self) -> None:
        """Invalidate the current session."""
        self.active_session_token = None
        self.session_expires_at = None
        db.session.commit()
    
    def register_passkey(self, passkey_id: str, public_key: str) -> None:
        """Register a new passkey for the user."""
        self.passkey_id = passkey_id
        self.passkey_public_key = public_key
        self.passkey_counter = 0
        self.passkey_created_at = datetime.now(timezone.utc)
        db.session.commit()
    
    def update_passkey_counter(self, new_counter: int) -> None:
        """Update the passkey counter after successful authentication."""
        if new_counter <= self.passkey_counter:
            raise ValueError("Passkey counter must be greater than current counter")
        self.passkey_counter = new_counter
        db.session.commit()
    
    def can_execute_test_type(self, test_type: str) -> bool:
        """Check if user can execute a specific type of test."""
        if not self.can_execute_tests or not self.is_active:
            return False
        
        # Define test type permissions
        test_permissions = {
            'e2e': self.can_execute_tests,
            'api': self.can_execute_tests,
            'security': self.can_manage_tests,  # Security tests require higher permissions
            'performance': self.can_execute_tests,
            'integration': self.can_execute_tests
        }
        
        return test_permissions.get(test_type, False)
    
    @classmethod
    def find_by_email(cls, email: str) -> 'TestUser':
        """Find test user by email."""
        return cls.query.filter_by(email=email, is_active=True).first()
    
    @classmethod
    def find_by_session_token(cls, token: str) -> 'TestUser':
        """Find test user by active session token."""
        return cls.query.filter_by(active_session_token=token, is_active=True).first()
    
    @classmethod
    def find_by_passkey_id(cls, passkey_id: str) -> 'TestUser':
        """Find test user by passkey ID."""
        return cls.query.filter_by(passkey_id=passkey_id, is_active=True).first()
    
    def __repr__(self):
        return f'<TestUser {self.email}>'
