"""
Fallback AI Agent Service
Provides a completely fallback implementation that doesn't rely on OpenAI
when all other AI services fail.
"""

import json
import uuid
from typing import Dict, List, Any, Optional
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas
from app.utils.logger import SmartLogger
from app.extensions import db


class FallbackAIAgentService:
    """Fallback service that creates canvas objects without AI when all else fails."""
    
    def __init__(self):
        self.logger = SmartLogger('fallback_ai_agent_service', 'WARNING')
        self.logger.log_info("Fallback AI Agent Service initialized - no OpenAI dependency")
    
    def create_canvas_from_query(
        self, 
        query: str, 
        user_id: str, 
        canvas_id: Optional[str] = None,
        style: str = "modern",
        color_scheme: str = "default"
    ) -> Dict[str, Any]:
        """
        Create canvas objects using predefined templates when AI fails.
        
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
            self.logger.log_info(f"Creating fallback canvas for user {user_id} with query: {query[:100]}...")
            
            # Validate input parameters
            if not query or not query.strip():
                raise ValueError("Query cannot be empty")
            if not user_id or not user_id.strip():
                raise ValueError("User ID cannot be empty")
            
            # Sanitize query
            sanitized_query = query.strip()[:500]
            
            # Create or get canvas
            if canvas_id:
                canvas = Canvas.query.get(canvas_id)
                if not canvas:
                    raise ValueError("Canvas not found")
            else:
                canvas = Canvas(
                    id=str(uuid.uuid4()),
                    title=f"Canvas: {sanitized_query[:50]}...",
                    user_id=user_id,
                    is_public=False
                )
                db.session.add(canvas)
                db.session.commit()
            
            # Generate fallback objects based on query keywords
            objects_data = self._generate_fallback_objects(sanitized_query, style, color_scheme)
            
            # Create canvas objects
            created_objects = []
            for obj_data in objects_data:
                canvas_object = CanvasObject(
                    id=str(uuid.uuid4()),
                    canvas_id=canvas.id,
                    object_type=obj_data.get('type', 'rectangle'),
                    properties=json.dumps(obj_data.get('properties', {})),
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
                        'properties': json.loads(obj.properties) if obj.properties else {},
                        'x': obj.position_x,
                        'y': obj.position_y,
                        'width': obj.width,
                        'height': obj.height
                    }
                    for obj in created_objects
                ],
                'message': f"Created {len(created_objects)} objects using fallback templates"
            }
            
            self.logger.log_info(f"Fallback canvas creation completed successfully for user {user_id}")
            return result
            
        except Exception as e:
            self.logger.log_error(f"Fallback canvas creation failed: {str(e)}", e)
            db.session.rollback()
            raise
    
    def _generate_fallback_objects(self, query: str, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Generate fallback objects based on query keywords."""
        query_lower = query.lower()
        
        # Determine object type based on keywords
        if any(keyword in query_lower for keyword in ['flowchart', 'flow', 'process', 'workflow', 'diagram']):
            return self._create_flowchart_objects(style, color_scheme)
        elif any(keyword in query_lower for keyword in ['mindmap', 'mind map', 'brainstorm', 'ideas']):
            return self._create_mindmap_objects(style, color_scheme)
        elif any(keyword in query_lower for keyword in ['wireframe', 'layout', 'mockup', 'design']):
            return self._create_wireframe_objects(style, color_scheme)
        elif any(keyword in query_lower for keyword in ['chart', 'graph', 'data', 'analytics']):
            return self._create_chart_objects(style, color_scheme)
        elif any(keyword in query_lower for keyword in ['calendar', 'schedule', 'timeline', 'events']):
            return self._create_calendar_objects(style, color_scheme)
        else:
            return self._create_generic_objects(query, style, color_scheme)
    
    def _create_flowchart_objects(self, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Create flowchart objects."""
        colors = self._get_color_scheme(color_scheme)
        
        return [
            {
                'type': 'rectangle',
                'x': 200,
                'y': 50,
                'width': 120,
                'height': 60,
                'properties': {
                    'fill': colors['primary'],
                    'stroke': colors['primary_dark'],
                    'text': 'Start',
                    'fontSize': 14,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'diamond',
                'x': 200,
                'y': 150,
                'width': 120,
                'height': 80,
                'properties': {
                    'fill': colors['secondary'],
                    'stroke': colors['secondary_dark'],
                    'text': 'Decision',
                    'fontSize': 12,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'rectangle',
                'x': 200,
                'y': 270,
                'width': 120,
                'height': 60,
                'properties': {
                    'fill': colors['accent'],
                    'stroke': colors['accent_dark'],
                    'text': 'End',
                    'fontSize': 14,
                    'fontFamily': 'Arial'
                }
            }
        ]
    
    def _create_mindmap_objects(self, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Create mindmap objects."""
        colors = self._get_color_scheme(color_scheme)
        
        return [
            {
                'type': 'circle',
                'x': 300,
                'y': 200,
                'width': 100,
                'height': 100,
                'properties': {
                    'fill': colors['primary'],
                    'stroke': colors['primary_dark'],
                    'text': 'Central Topic',
                    'fontSize': 16,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'rectangle',
                'x': 150,
                'y': 150,
                'width': 100,
                'height': 50,
                'properties': {
                    'fill': colors['secondary'],
                    'stroke': colors['secondary_dark'],
                    'text': 'Branch 1',
                    'fontSize': 12,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'rectangle',
                'x': 450,
                'y': 150,
                'width': 100,
                'height': 50,
                'properties': {
                    'fill': colors['secondary'],
                    'stroke': colors['secondary_dark'],
                    'text': 'Branch 2',
                    'fontSize': 12,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'rectangle',
                'x': 150,
                'y': 300,
                'width': 100,
                'height': 50,
                'properties': {
                    'fill': colors['accent'],
                    'stroke': colors['accent_dark'],
                    'text': 'Branch 3',
                    'fontSize': 12,
                    'fontFamily': 'Arial'
                }
            }
        ]
    
    def _create_wireframe_objects(self, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Create wireframe objects."""
        colors = self._get_color_scheme(color_scheme)
        
        return [
            {
                'type': 'rectangle',
                'x': 50,
                'y': 50,
                'width': 500,
                'height': 80,
                'properties': {
                    'fill': colors['neutral'],
                    'stroke': colors['neutral_dark'],
                    'text': 'Header',
                    'fontSize': 16,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'rectangle',
                'x': 50,
                'y': 150,
                'width': 150,
                'height': 300,
                'properties': {
                    'fill': colors['light'],
                    'stroke': colors['neutral_dark'],
                    'text': 'Sidebar',
                    'fontSize': 14,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'rectangle',
                'x': 220,
                'y': 150,
                'width': 330,
                'height': 300,
                'properties': {
                    'fill': colors['light'],
                    'stroke': colors['neutral_dark'],
                    'text': 'Main Content',
                    'fontSize': 14,
                    'fontFamily': 'Arial'
                }
            }
        ]
    
    def _create_chart_objects(self, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Create chart objects."""
        colors = self._get_color_scheme(color_scheme)
        
        return [
            {
                'type': 'rectangle',
                'x': 100,
                'y': 100,
                'width': 400,
                'height': 200,
                'properties': {
                    'fill': colors['light'],
                    'stroke': colors['neutral_dark'],
                    'text': 'Chart Area',
                    'fontSize': 16,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'text',
                'x': 100,
                'y': 320,
                'width': 400,
                'height': 40,
                'properties': {
                    'fill': colors['text'],
                    'text': 'Data Visualization',
                    'fontSize': 18,
                    'fontFamily': 'Arial'
                }
            }
        ]
    
    def _create_calendar_objects(self, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Create calendar objects."""
        colors = self._get_color_scheme(color_scheme)
        
        return [
            {
                'type': 'rectangle',
                'x': 100,
                'y': 100,
                'width': 400,
                'height': 300,
                'properties': {
                    'fill': colors['light'],
                    'stroke': colors['neutral_dark'],
                    'text': 'Calendar Grid',
                    'fontSize': 14,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'text',
                'x': 100,
                'y': 420,
                'width': 400,
                'height': 40,
                'properties': {
                    'fill': colors['text'],
                    'text': 'Calendar View',
                    'fontSize': 16,
                    'fontFamily': 'Arial'
                }
            }
        ]
    
    def _create_generic_objects(self, query: str, style: str, color_scheme: str) -> List[Dict[str, Any]]:
        """Create generic objects for any query."""
        colors = self._get_color_scheme(color_scheme)
        
        return [
            {
                'type': 'rectangle',
                'x': 200,
                'y': 150,
                'width': 200,
                'height': 100,
                'properties': {
                    'fill': colors['primary'],
                    'stroke': colors['primary_dark'],
                    'text': 'Main Object',
                    'fontSize': 16,
                    'fontFamily': 'Arial'
                }
            },
            {
                'type': 'text',
                'x': 200,
                'y': 280,
                'width': 200,
                'height': 40,
                'properties': {
                    'fill': colors['text'],
                    'text': f'Canvas for: {query[:30]}...',
                    'fontSize': 14,
                    'fontFamily': 'Arial'
                }
            }
        ]
    
    def _get_color_scheme(self, color_scheme: str) -> Dict[str, str]:
        """Get color scheme based on preference."""
        schemes = {
            'pastel': {
                'primary': '#A8E6CF',
                'primary_dark': '#7FCDCD',
                'secondary': '#FFD3A5',
                'secondary_dark': '#FD9853',
                'accent': '#FFA8B6',
                'accent_dark': '#FF6B9D',
                'neutral': '#E8E8E8',
                'neutral_dark': '#B8B8B8',
                'light': '#F8F8F8',
                'text': '#4A4A4A'
            },
            'vibrant': {
                'primary': '#FF6B6B',
                'primary_dark': '#E55353',
                'secondary': '#4ECDC4',
                'secondary_dark': '#45B7B8',
                'accent': '#45B7D1',
                'accent_dark': '#3A9BC1',
                'neutral': '#96CEB4',
                'neutral_dark': '#7FB069',
                'light': '#FFEAA7',
                'text': '#2D3436'
            },
            'monochrome': {
                'primary': '#636E72',
                'primary_dark': '#2D3436',
                'secondary': '#74B9FF',
                'secondary_dark': '#0984E3',
                'accent': '#A29BFE',
                'accent_dark': '#6C5CE7',
                'neutral': '#DDD6FE',
                'neutral_dark': '#A29BFE',
                'light': '#F8F9FA',
                'text': '#2D3436'
            },
            'default': {
                'primary': '#3B82F6',
                'primary_dark': '#1E40AF',
                'secondary': '#10B981',
                'secondary_dark': '#059669',
                'accent': '#F59E0B',
                'accent_dark': '#D97706',
                'neutral': '#6B7280',
                'neutral_dark': '#374151',
                'light': '#F3F4F6',
                'text': '#111827'
            }
        }
        
        return schemes.get(color_scheme, schemes['default'])
