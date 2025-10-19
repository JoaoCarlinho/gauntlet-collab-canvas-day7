"""
Robust AI Agent Service with enhanced error handling and compatibility.
This service handles OpenAI client initialization issues and provides fallbacks.
"""

import openai
import json
import os
import uuid
from typing import Dict, List, Any, Optional
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas
from app.utils.logger import SmartLogger
from app.extensions import db
from app.services.openai_client_factory import OpenAIClientFactory


class RobustAIAgentService:
    """Robust service for AI-powered canvas creation with enhanced error handling."""
    
    def __init__(self):
        # Use WARNING level to reduce log volume on Railway
        self.logger = SmartLogger('robust_ai_agent_service', 'WARNING')
        
        # Check OpenAI API key
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            self.logger.log_error("OPENAI_API_KEY environment variable not set")
            raise ValueError("OpenAI API key is required but not configured")
        
        # Initialize OpenAI client using factory
        self.openai_client = OpenAIClientFactory.create_client(api_key)
        if not self.openai_client:
            raise ValueError("Failed to initialize OpenAI client")
        
        # Only log success in development
        if os.environ.get('FLASK_ENV') == 'development':
            self.logger.log_info("Robust AI Agent Service initialized successfully")
    
    
    def create_canvas_from_query(
        self, 
        query: str, 
        user_id: str, 
        canvas_id: Optional[str] = None,
        style: str = "modern",
        color_scheme: str = "default"
    ) -> Dict[str, Any]:
        """
        Create canvas objects using AI based on user query.
        
        Args:
            query: User's natural language description
            user_id: ID of the user creating the canvas
            canvas_id: Optional existing canvas ID
            style: Visual style (modern, corporate, creative, minimal)
            color_scheme: Color scheme (pastel, vibrant, monochrome, default)
            
        Returns:
            Dictionary containing canvas data and objects
        """
        try:
            # Only log detailed info in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info(f"Starting AI canvas creation for user {user_id} with query: {query[:100]}...")
            
            # Validate input parameters
            if not query or not query.strip():
                raise ValueError("Query cannot be empty")
            if not user_id or not user_id.strip():
                raise ValueError("User ID cannot be empty")
            
            # Sanitize query
            sanitized_query = query.strip()[:500]  # Limit length
            
            # Create or get canvas
            if canvas_id:
                canvas = Canvas.query.get(canvas_id)
                if not canvas:
                    raise ValueError("Canvas not found")
            else:
                canvas = Canvas(
                    id=str(uuid.uuid4()),
                    title=f"AI Generated: {sanitized_query[:50]}...",
                    user_id=user_id,
                    is_public=False
                )
                db.session.add(canvas)
                db.session.commit()
            
            # Generate AI response
            ai_response = self._generate_ai_response(sanitized_query, style, color_scheme)
            
            # Parse and validate AI response
            objects_data = self._parse_ai_response(ai_response)
            
            # Create canvas objects
            created_objects = []
            for obj_data in objects_data:
                canvas_object = CanvasObject(
                    id=str(uuid.uuid4()),
                    canvas_id=canvas.id,
                    object_type=obj_data.get('type', 'rectangle'),
                    properties=obj_data.get('properties', {}),
                    position_x=obj_data.get('x', 100),
                    position_y=obj_data.get('y', 100),
                    width=obj_data.get('width', 120),
                    height=obj_data.get('height', 60)
                )
                db.session.add(canvas_object)
                created_objects.append(canvas_object)
            
            db.session.commit()
            
            # Prepare response
            result = {
                'success': True,
                'canvas_id': canvas.id,
                'title': canvas.title,
                'objects': [
                    {
                        'id': obj.id,
                        'type': obj.object_type,
                        'properties': obj.properties,
                        'x': obj.position_x,
                        'y': obj.position_y,
                        'width': obj.width,
                        'height': obj.height
                    }
                    for obj in created_objects
                ],
                'message': f"Successfully created {len(created_objects)} objects for your canvas"
            }
            
            # Only log success in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info(f"AI canvas creation completed successfully for user {user_id}")
            
            return result
            
        except Exception as e:
            self.logger.log_error(f"AI canvas creation failed: {str(e)}", e)
            db.session.rollback()
            raise
    
    def _generate_ai_response(self, query: str, style: str, color_scheme: str) -> str:
        """Generate AI response for canvas creation."""
        try:
            # Create a focused prompt for canvas object generation
            prompt = f"""
            Create a canvas layout based on this request: "{query}"
            
            Style: {style}
            Color scheme: {color_scheme}
            
            Generate 3-8 canvas objects (rectangles, circles, text, arrows) that represent this request.
            Return ONLY a JSON array of objects with this exact format:
            [
                {{
                    "type": "rectangle|circle|text|arrow",
                    "x": 100,
                    "y": 100,
                    "width": 120,
                    "height": 60,
                    "properties": {{
                        "fill": "#3B82F6",
                        "stroke": "#1E40AF",
                        "text": "Label text",
                        "fontSize": 14
                    }}
                }}
            ]
            
            Make sure objects don't overlap and are well-positioned.
            """
            
            # Make API call with error handling
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a canvas design assistant. Return only valid JSON arrays."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1000,
                    temperature=0.7
                )
                
                return response.choices[0].message.content
                
            except Exception as api_error:
                self.logger.log_error(f"OpenAI API call failed: {str(api_error)}")
                # Return fallback objects
                return self._get_fallback_objects(query)
                
        except Exception as e:
            self.logger.log_error(f"AI response generation failed: {str(e)}")
            return self._get_fallback_objects(query)
    
    def _parse_ai_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse AI response and extract objects."""
        try:
            # Clean the response
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.endswith('```'):
                response = response[:-3]
            
            # Parse JSON
            objects_data = json.loads(response)
            
            if not isinstance(objects_data, list):
                raise ValueError("Response is not a list")
            
            # Validate and clean objects
            validated_objects = []
            for obj in objects_data:
                if isinstance(obj, dict) and 'type' in obj:
                    validated_obj = {
                        'type': obj.get('type', 'rectangle'),
                        'x': max(0, min(1000, obj.get('x', 100))),
                        'y': max(0, min(1000, obj.get('y', 100))),
                        'width': max(20, min(500, obj.get('width', 120))),
                        'height': max(20, min(500, obj.get('height', 60))),
                        'properties': obj.get('properties', {})
                    }
                    validated_objects.append(validated_obj)
            
            return validated_objects[:8]  # Limit to 8 objects
            
        except Exception as e:
            self.logger.log_error(f"Failed to parse AI response: {str(e)}")
            return self._get_fallback_objects("fallback")
    
    def _get_fallback_objects(self, query: str) -> str:
        """Get fallback objects when AI fails."""
        fallback_objects = [
            {
                "type": "rectangle",
                "x": 100,
                "y": 100,
                "width": 200,
                "height": 100,
                "properties": {
                    "fill": "#3B82F6",
                    "stroke": "#1E40AF",
                    "text": "Main Object",
                    "fontSize": 16
                }
            },
            {
                "type": "text",
                "x": 100,
                "y": 220,
                "width": 200,
                "height": 40,
                "properties": {
                    "fill": "#374151",
                    "text": f"Canvas for: {query[:30]}...",
                    "fontSize": 14
                }
            }
        ]
        
        return json.dumps(fallback_objects)
