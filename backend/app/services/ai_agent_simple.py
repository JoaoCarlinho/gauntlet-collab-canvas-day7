"""
Simplified AI Agent Service to avoid complex dependency issues.
This is a fallback implementation that focuses on core functionality.
"""

import openai
import json
import os
import uuid
from typing import Dict, List, Any, Optional
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas
from app.utils.logger import SmartLogger
from app.services.openai_client_factory import OpenAIClientFactory
from app.extensions import db

class SimpleAIAgentService:
    """Simplified service for AI-powered canvas creation."""
    
    def __init__(self):
        # Use WARNING level to reduce log volume on Railway
        self.logger = SmartLogger('simple_ai_agent_service', 'WARNING')
        
        # Check OpenAI API key
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            self.logger.log_error("OPENAI_API_KEY environment variable not set")
            raise ValueError("OpenAI API key is required but not configured")
        
        try:
            # Initialize OpenAI client via factory (handles compatibility)
            self.openai_client = OpenAIClientFactory.create_client(api_key)
            if not self.openai_client:
                raise RuntimeError("Failed to initialize OpenAI client")
            # Only log success in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info("Simple OpenAI client initialized successfully")
        except Exception as e:
            self.logger.log_error(f"Failed to initialize OpenAI client: {str(e)}", e)
            raise
    
    def create_canvas_from_query(
        self, 
        query: str, 
        user_id: str, 
        canvas_id: Optional[str] = None,
        style: str = "modern",
        color_scheme: str = "default"
    ) -> Dict[str, Any]:
        """Create canvas objects from natural language query."""
        try:
            # Only log detailed info in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info(f"Starting simple AI canvas creation for user {user_id}")
            
            # Validate input parameters
            if not query or not query.strip():
                raise ValueError("Query cannot be empty")
            if not user_id or not user_id.strip():
                raise ValueError("User ID cannot be empty")
            
            # Generate AI response
            ai_response = self._generate_ai_response(query, style, color_scheme)
            
            # Parse AI response into canvas objects
            objects_data = self._parse_ai_response_to_objects(ai_response)
            
            # Create or update canvas
            if not canvas_id:
                canvas = self._create_new_canvas(user_id, query)
                canvas_id = canvas.id
            else:
                canvas = Canvas.query.get(canvas_id)
                if not canvas or canvas.owner_id != user_id:
                    raise ValueError("Canvas not found or access denied")
            
            # Save objects to database
            saved_objects = self._save_objects_to_canvas(objects_data['objects'], canvas_id, user_id)
            
            result = {
                'success': True,
                'canvas_id': canvas_id,
                'objects': [obj.to_dict() for obj in saved_objects],
                'message': f'Successfully created {len(saved_objects)} objects',
                'title': objects_data.get('title', 'AI Generated Canvas')
            }
            
            return result
            
        except Exception as e:
            import traceback
            error_details = {
                'error': str(e),
                'error_type': type(e).__name__,
                'traceback': traceback.format_exc(),
                'query': query[:100] if query else 'None',
                'user_id': user_id,
                'canvas_id': canvas_id,
                'style': style,
                'color_scheme': color_scheme
            }
            self.logger.log_error(f"Simple AI canvas creation failed: {str(e)}", e)
            self.logger.log_error(f"Error details: {error_details}")
            raise
    
    def _generate_ai_response(self, query: str, style: str, color_scheme: str) -> str:
        """Generate AI response using OpenAI API."""
        try:
            system_prompt = """
You are an expert product manager and Figma power user.
Your task is to generate a JSON specification of a design canvas.

Available object types:
- rectangle: Basic rectangular shapes
- circle: Circular shapes
- text: Text elements
- line: Straight lines
- arrow: Arrow shapes

Generate a JSON response with this structure:
{
  "title": "Canvas Title",
  "objects": [
    {
      "object_type": "rectangle|circle|text|line|arrow",
      "properties": {
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 100,
        "fill": "#3B82F6",
        "stroke": "#1E40AF",
        "strokeWidth": 2,
        "text": "Sample text" (for text objects),
        "fontSize": 16 (for text objects)
      }
    }
  ]
}

Create 3-5 objects that represent the user's request. Use modern, clean design principles.
"""
            
            user_prompt = f"""
Create a canvas design for: {query}

Style: {style}
Color scheme: {color_scheme}

Generate a JSON response with canvas objects that represent this request.
"""
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            self.logger.log_error(f"OpenAI API call failed: {str(e)}", e)
            raise
    
    def _parse_ai_response_to_objects(self, ai_response: str) -> Dict[str, Any]:
        """Parse AI response into canvas objects."""
        try:
            # Clean the response
            cleaned_response = ai_response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            
            # Parse JSON
            data = json.loads(cleaned_response)
            
            if not isinstance(data, dict) or 'objects' not in data:
                raise ValueError("Invalid AI response structure")
            
            return data
            
        except json.JSONDecodeError as e:
            self.logger.log_error(f"Failed to parse AI response as JSON: {str(e)}", e)
            raise ValueError("Failed to parse AI response")
        except Exception as e:
            self.logger.log_error(f"Failed to parse AI response: {str(e)}", e)
            raise
    
    def _create_new_canvas(self, user_id: str, query: str) -> Canvas:
        """Create a new canvas."""
        canvas = Canvas(
            id=str(uuid.uuid4()),
            title=f"AI Generated: {query[:50]}...",
            owner_id=user_id,
            is_public=False
        )
        db.session.add(canvas)
        db.session.commit()
        return canvas
    
    def _save_objects_to_canvas(self, objects_data: List[Dict], canvas_id: str, user_id: str) -> List[CanvasObject]:
        """Save objects to canvas."""
        saved_objects = []
        
        for obj_data in objects_data:
            try:
                # Clean and validate object data
                cleaned_obj = self._clean_object(obj_data)
                
                # Create canvas object
                canvas_obj = CanvasObject(
                    id=str(uuid.uuid4()),
                    canvas_id=canvas_id,
                    object_type=cleaned_obj['object_type'],
                    properties=cleaned_obj['properties'],
                    created_by=user_id
                )
                
                db.session.add(canvas_obj)
                saved_objects.append(canvas_obj)
                
            except Exception as e:
                self.logger.log_error(f"Failed to save object: {str(e)}", e)
                continue
        
        db.session.commit()
        return saved_objects
    
    def _clean_object(self, obj_data: Dict) -> Dict:
        """Clean and validate object data."""
        # Ensure required fields
        if 'object_type' not in obj_data:
            raise ValueError("Object type is required")
        
        if 'properties' not in obj_data:
            raise ValueError("Object properties are required")
        
        # Clean properties
        properties = obj_data['properties'].copy()
        
        # Ensure numeric values are properly typed
        numeric_fields = ['x', 'y', 'width', 'height', 'strokeWidth', 'fontSize']
        for field in numeric_fields:
            if field in properties:
                try:
                    properties[field] = float(properties[field])
                except (ValueError, TypeError):
                    # Set default values for invalid numbers
                    defaults = {
                        'x': 100, 'y': 100, 'width': 200, 'height': 100,
                        'strokeWidth': 2, 'fontSize': 16
                    }
                    properties[field] = defaults.get(field, 0)
        
        return {
            'object_type': obj_data['object_type'],
            'properties': properties
        }
