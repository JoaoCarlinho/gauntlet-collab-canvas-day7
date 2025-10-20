import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.prompt import Prompt
from app.models.canvas import Canvas
from app.extensions import db
from app.utils.logger import SmartLogger

class PromptService:
    """Service for managing AI generation prompts."""
    
    def __init__(self):
        self.logger = SmartLogger('prompt_service', 'WARNING')
    
    def create_prompt(
        self,
        user_id: str,
        instructions: str,
        style: str = 'modern',
        color_scheme: str = 'default',
        model: str = None,
        request_metadata: Optional[Dict[str, Any]] = None
    ) -> Prompt:
        """Create a new prompt record."""
        try:
            prompt = Prompt(
                id=str(uuid.uuid4()),
                user_id=user_id,
                instructions=instructions,
                style=style,
                color_scheme=color_scheme,
                model_used=model,
                status='pending'
            )
            
            if request_metadata:
                prompt.set_metadata(request_metadata)
            
            db.session.add(prompt)
            db.session.commit()
            
            self.logger.log_info(f"Prompt created: {prompt.id} for user: {user_id}")
            return prompt
            
        except Exception as e:
            db.session.rollback()
            self.logger.log_error(f"Failed to create prompt: {str(e)}", e)
            raise
    
    def get_prompt_by_id(self, prompt_id: str) -> Optional[Prompt]:
        """Get a prompt by its ID."""
        return Prompt.query.filter_by(id=prompt_id).first()
    
    def get_user_prompts(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        status_filter: Optional[str] = None
    ) -> List[Prompt]:
        """Get all prompts for a specific user."""
        query = Prompt.query.filter_by(user_id=user_id)
        
        if status_filter:
            query = query.filter_by(status=status_filter)
        
        query = query.order_by(Prompt.created_at.desc())
        query = query.limit(limit).offset(offset)
        
        return query.all()
    
    def update_prompt_status(
        self,
        prompt_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> Optional[Prompt]:
        """Update the status of a prompt."""
        try:
            prompt = self.get_prompt_by_id(prompt_id)
            if not prompt:
                self.logger.log_warning(f"Prompt not found: {prompt_id}")
                return None
            
            prompt.status = status
            prompt.updated_at = datetime.utcnow()
            
            if error_message:
                prompt.error_message = error_message
            
            db.session.commit()
            
            self.logger.log_info(f"Prompt {prompt_id} status updated to: {status}")
            return prompt
            
        except Exception as e:
            db.session.rollback()
            self.logger.log_error(f"Failed to update prompt status: {str(e)}", e)
            raise
    
    def get_prompt_with_canvases(self, prompt_id: str) -> Optional[Prompt]:
        """Get a prompt with all its associated canvases loaded."""
        prompt = self.get_prompt_by_id(prompt_id)
        if not prompt:
            return None
        
        # Force load the canvases relationship
        prompt.canvases.all()
        return prompt
    
    def delete_prompt(
        self,
        prompt_id: str,
        delete_canvases: bool = False
    ) -> bool:
        """Delete a prompt and optionally its associated canvases."""
        try:
            prompt = self.get_prompt_by_id(prompt_id)
            if not prompt:
                return False
            
            if delete_canvases:
                # Delete all associated canvases
                Canvas.query.filter_by(prompt_id=prompt_id).delete()
            else:
                # Just unlink canvases from the prompt
                Canvas.query.filter_by(prompt_id=prompt_id).update({'prompt_id': None})
            
            db.session.delete(prompt)
            db.session.commit()
            
            self.logger.log_info(f"Prompt deleted: {prompt_id}")
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.log_error(f"Failed to delete prompt: {str(e)}", e)
            raise
    
    def update_prompt_metadata(
        self,
        prompt_id: str,
        metadata: Dict[str, Any]
    ) -> Optional[Prompt]:
        """Update the metadata of a prompt."""
        try:
            prompt = self.get_prompt_by_id(prompt_id)
            if not prompt:
                return None
            
            # Merge with existing metadata
            existing_metadata = prompt.get_metadata()
            existing_metadata.update(metadata)
            prompt.set_metadata(existing_metadata)
            
            prompt.updated_at = datetime.utcnow()
            db.session.commit()
            
            return prompt
            
        except Exception as e:
            db.session.rollback()
            self.logger.log_error(f"Failed to update prompt metadata: {str(e)}", e)
            raise
    
    def get_prompts_stats(self, user_id: str) -> Dict[str, Any]:
        """Get statistics about user's prompts."""
        try:
            total = Prompt.query.filter_by(user_id=user_id).count()
            completed = Prompt.query.filter_by(user_id=user_id, status='completed').count()
            failed = Prompt.query.filter_by(user_id=user_id, status='failed').count()
            processing = Prompt.query.filter_by(user_id=user_id, status='processing').count()
            
            return {
                'total': total,
                'completed': completed,
                'failed': failed,
                'processing': processing,
                'success_rate': (completed / total * 100) if total > 0 else 0
            }
        except Exception as e:
            self.logger.log_error(f"Failed to get prompt stats: {str(e)}", e)
            return {
                'total': 0,
                'completed': 0,
                'failed': 0,
                'processing': 0,
                'success_rate': 0
            }
