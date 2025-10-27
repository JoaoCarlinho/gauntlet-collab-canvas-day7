import openai
import json
import os
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas
from app.utils.logger import SmartLogger
from app.services.auth_service import AuthService
from app.services.ai_performance_service import AIPerformanceService
from app.services.ai_security_service import AISecurityService
from app.services.prompt_service import PromptService
from app.services.openai_client_factory import OpenAIClientFactory
from app.extensions import db, socketio

class AIAgentService:
    """Service for AI-powered canvas creation."""
    
    def __init__(self):
        # Use WARNING level to reduce log volume on Railway
        self.logger = SmartLogger('ai_agent_service', 'WARNING')
        
        # Check OpenAI API key
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            self.logger.log_error("OPENAI_API_KEY environment variable not set")
            raise ValueError("OpenAI API key is required but not configured")
        
        try:
            # Initialize OpenAI client via factory for compatibility and fallbacks
            self.openai_client = OpenAIClientFactory.create_client(api_key)
            if not self.openai_client:
                raise RuntimeError("Failed to initialize OpenAI client")
            # Only log success in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info("OpenAI client initialized successfully")
        except Exception as e:
            self.logger.log_error(f"Failed to initialize OpenAI client: {str(e)}", e)
            raise
        
        try:
            self.auth_service = AuthService()
            self.performance_service = AIPerformanceService()
            self.security_service = AISecurityService()
            self.prompt_service = PromptService()
            # Only log success in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info("AI Agent Service dependencies initialized successfully")
        except Exception as e:
            self.logger.log_error(f"Failed to initialize AI Agent Service dependencies: {str(e)}", e)
            raise
    
    def create_canvas_from_query(
        self, 
        query: str, 
        user_id: str, 
        canvas_id: Optional[str] = None,
        style: str = "modern",
        color_scheme: str = "default",
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create canvas objects from natural language query."""
        # Generate request ID if not provided
        if not request_id:
            request_id = str(uuid.uuid4())
        
        try:
            # Only log detailed info in development
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info(f"Starting AI canvas creation for user {user_id} with query: {query[:100]}...")
            
            # Validate input parameters
            if not query or not query.strip():
                raise ValueError("Query cannot be empty")
            if not user_id or not user_id.strip():
                raise ValueError("User ID cannot be empty")
            
            # Sanitize and validate user query
            if os.environ.get('FLASK_ENV') == 'development':
                self.logger.log_info("Sanitizing user query...")
            sanitized_query = self.security_service.sanitize_user_query(query)
            
            # Create Prompt record to track this generation
            prompt = None
            model_name = os.environ.get('OPENAI_MODEL', 'gpt-4')
            try:
                prompt = self.prompt_service.create_prompt(
                    user_id=user_id,
                    instructions=query,
                    style=style,
                    color_scheme=color_scheme,
                    model=model_name,
                    request_metadata={
                        'request_id': request_id,
                        'canvas_id': canvas_id,
                        'start_time': datetime.utcnow().isoformat()
                    }
                )
                # Update prompt status to processing
                self.prompt_service.update_prompt_status(prompt.id, 'processing')
                self.logger.log_info(f"Created prompt record: {prompt.id} for request: {request_id}")
            except Exception as e:
                self.logger.log_warning(f"Failed to create prompt record: {str(e)}")
            
            # Emit websocket event: generation started
            try:
                socketio.emit('ai_generation_started', {
                    'request_id': request_id,
                    'prompt_id': prompt.id if prompt else None,
                    'canvas_id': canvas_id,
                    'user_id': user_id,
                    'instructions_preview': query[:100],
                    'style': style,
                    'color_scheme': color_scheme,
                    'timestamp': datetime.utcnow().isoformat()
                }, room=canvas_id if canvas_id else f'user_{user_id}')
                self.logger.log_info(f"Emitted ai_generation_started for request: {request_id}")
            except Exception as e:
                self.logger.log_warning(f"Failed to emit ai_generation_started: {str(e)}")
            
            # Optimize request and check for common patterns
            optimization_result = self.performance_service.optimize_request(sanitized_query, style, color_scheme)
            
            # Check if we have a cached result
            if 'cached_result' in optimization_result:
                return optimization_result['cached_result']
            
            # Check for common patterns first
            pattern_objects = self.performance_service.get_pattern_for_query(query)
            if pattern_objects:
                self.logger.log_info(f"Using common pattern for query: {query[:50]}...")
                objects_data = {
                    'title': f'AI Generated: {query[:50]}...',
                    'objects': pattern_objects
                }
            else:
                # Generate AI response
                ai_response = self._generate_ai_response(
                    optimization_result['optimized_query'], 
                    style, 
                    color_scheme
                )
                
                # Validate and sanitize AI response
                validated_response = self.security_service.validate_ai_response(ai_response)
                
                # Parse AI response into canvas objects
                objects_data = self._parse_ai_response_to_objects(validated_response)
            
            # Optimize objects for rendering
            objects_data['objects'] = self.performance_service.optimize_objects_for_rendering(
                objects_data['objects']
            )
            
            # Create or update canvas
            if not canvas_id:
                canvas = self._create_new_canvas(user_id, query, prompt.id if prompt else None)
                canvas_id = canvas.id
            else:
                canvas = Canvas.query.get(canvas_id)
                if not canvas or canvas.owner_id != user_id:
                    raise ValueError("Canvas not found or access denied")
                # Link canvas to prompt if it doesn't have one
                if prompt and not canvas.prompt_id:
                    canvas.prompt_id = prompt.id
                    db.session.commit()
            
            # Save objects to database
            saved_objects = self._save_objects_to_canvas(objects_data['objects'], canvas_id, user_id)
            
            result = {
                'success': True,
                'canvas_id': canvas_id,
                'objects': [obj.to_dict() for obj in saved_objects],
                'message': f'Successfully created {len(saved_objects)} objects',
                'title': objects_data.get('title', 'AI Generated Canvas'),
                'request_id': request_id
            }
            
            # Record performance metrics
            self.performance_service.record_response_time(
                optimization_result['start_time'],
                optimization_result['cache_key'],
                result
            )
            
            # Update prompt status to completed
            if prompt:
                try:
                    self.prompt_service.update_prompt_status(prompt.id, 'completed')
                    self.prompt_service.update_prompt_metadata(prompt.id, {
                        'completed_time': datetime.utcnow().isoformat(),
                        'object_count': len(saved_objects),
                        'canvas_id': canvas_id
                    })
                    self.logger.log_info(f"Prompt {prompt.id} marked as completed")
                except Exception as e:
                    self.logger.log_warning(f"Failed to update prompt status: {str(e)}")
            
            # Emit websocket event: generation completed
            try:
                generation_time = datetime.utcnow().timestamp() - optimization_result.get('start_time', datetime.utcnow().timestamp())
                socketio.emit('ai_generation_completed', {
                    'request_id': request_id,
                    'prompt_id': prompt.id if prompt else None,
                    'canvas_id': canvas_id,
                    'title': result['title'],
                    'objects': result['objects'],
                    'object_count': len(saved_objects),
                    'generation_time': generation_time,
                    'timestamp': datetime.utcnow().isoformat()
                }, room=canvas_id if canvas_id else f'user_{user_id}')
                self.logger.log_info(f"Emitted ai_generation_completed for request: {request_id}")
            except Exception as e:
                self.logger.log_warning(f"Failed to emit ai_generation_completed: {str(e)}")
            
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
            self.logger.log_error(f"AI canvas creation failed: {str(e)}", e)
            self.logger.log_error(f"Error details: {error_details}")
            
            # Update prompt status to failed
            if prompt:
                try:
                    self.prompt_service.update_prompt_status(
                        prompt.id, 
                        'failed', 
                        error_message=str(e)
                    )
                    self.logger.log_info(f"Prompt {prompt.id} marked as failed")
                except Exception as prompt_error:
                    self.logger.log_warning(f"Failed to update prompt status: {str(prompt_error)}")
            
            # Emit websocket event: generation failed
            try:
                socketio.emit('ai_generation_failed', {
                    'request_id': request_id,
                    'prompt_id': prompt.id if prompt else None,
                    'canvas_id': canvas_id,
                    'error_message': str(e),
                    'error_type': type(e).__name__,
                    'timestamp': datetime.utcnow().isoformat()
                }, room=canvas_id if canvas_id else f'user_{user_id}')
                self.logger.log_info(f"Emitted ai_generation_failed for request: {request_id}")
            except Exception as ws_error:
                self.logger.log_warning(f"Failed to emit ai_generation_failed: {str(ws_error)}")
            
            raise
    
    def _generate_ai_response(self, query: str, style: str, color_scheme: str) -> str:
        """Generate AI response using OpenAI API."""
        style_guidance = self._get_style_guidance(style, color_scheme)
        
        system_prompt = """
You are an expert UI/UX designer and diagramming specialist with deep knowledge of visual design principles.
Your task is to generate a well-structured JSON specification for an interactive canvas.

CANVAS COORDINATE SYSTEM:
- Origin (0,0) is at the top-left corner
- X-axis: 0 (left) to 1000 (right)
- Y-axis: 0 (top) to 1000 (bottom)
- Canvas center: approximately (500, 400)
- Keep important content 50px from edges

AVAILABLE OBJECT TYPES:

1. rectangle - Boxes, containers, buttons, panels
   - Position (x, y) is the top-left corner
   - Properties: x, y, width, height, fill (interior color), stroke (border color), strokeWidth
   - Use for: Process steps, UI components, containers, labels

2. circle - Rounded shapes, decision points, avatars
   - Position (x, y) is the CENTER of the circle
   - Properties: x, y, radius (NOT width/height), fill, stroke, strokeWidth
   - Use for: Start/end points, highlights, decorative elements

3. diamond - Decision points, gateways
   - Position (x, y) is the CENTER
   - Properties: x, y, width, height, fill, stroke, strokeWidth
   - Use for: Flowchart decisions, conditional branches

4. star - Highlights, ratings, emphasis
   - Position (x, y) is the CENTER
   - Properties: x, y, width, height, fill, stroke, strokeWidth

5. heart - Love, favorites, special markers
   - Position (x, y) is the CENTER
   - Properties: x, y, width, height, fill, stroke, strokeWidth

6. text - Labels, headings, descriptions
   - Position (x, y) is the top-left corner
   - Properties: x, y, text (string content), fontSize, color
   - Users can edit text by double-clicking
   - Keep text concise and readable

7. arrow - Directional connections showing flow/relationships
   - Position (x, y) is the starting point
   - Properties: x, y, points [0, 0, endX, endY], stroke, strokeWidth
   - Points are RELATIVE to (x, y) position
   - Arrow head appears at the end point

8. line - Separators, non-directional connections
   - Same as arrow but without arrow head
   - Properties: x, y, points [0, 0, endX, endY], stroke, strokeWidth

VISUAL DESIGN PRINCIPLES:

Typography & Hierarchy:
- Titles/headers: fontSize 16-18, bold or emphasized
- Body text/labels: fontSize 12-14 for readability
- Small annotations: fontSize 10-12

Colors & Contrast:
- Use fill for interior color, stroke for borders
- Provide good contrast: light fills (#E8F4FF, #F0F9FF) with darker strokes (#2563EB, #1E40AF)
- strokeWidth: 2-3 for emphasis, 1 for subtle borders
- Text color should contrast with background (dark text on light background)

Spacing & Whitespace:
- Minimum 30-50px between unrelated objects
- Consistent spacing between related objects (20-30px)
- Leave breathing room - don't pack objects tightly

Alignment & Structure:
- Align objects to implicit grid (use multiples of 10 or 20 for x, y)
- Align edges of related objects
- Use consistent sizing for similar objects

LAYOUT PATTERNS:

Flowcharts:
- Rectangles for process steps (width: 120-180, height: 60-80)
- Diamonds for decisions (width: 100-120, height: 80-100)
- Vertical spacing: 80-120px between steps
- Arrows flowing top-to-bottom or left-to-right
- Connect arrows to edge midpoints, not corners

Hierarchical Diagrams:
- Parent objects centered above children
- 100-150px vertical spacing between levels
- Horizontal spacing: 120-180px between siblings
- Top-down tree structure

Timelines:
- Horizontal sequence with equal spacing (150-200px)
- Consistent object sizes for uniformity
- Left-to-right flow

Mind Maps:
- Central object at canvas center (~500, 400)
- Branch objects radially with 150-200px distance
- Use lines/arrows to connect branches to center

CONNECTION BEST PRACTICES:
- Arrows should be 80-300px in length
- Connect to object edges/midpoints, not centers (unless intentional)
- For rectangles: Connect to middle of edges (top, bottom, left, right)
- Avoid crossing arrows when possible
- Maintain consistent flow direction

IMPORTANT NOTES:
- All objects are interactive (draggable, resizable, editable)
- Users will add more objects later - leave room for expansion
- Ensure click targets are at least 30x30px
- Objects can be layered (z-index) for depth
- Design for clarity and usability

Return ONLY valid JSON in the exact schema specified.
"""
        
        prompt = f"""
Create a canvas layout based on this description: "{query}"

Style preferences: {style_guidance}

Return a JSON object with this exact structure:
{{
    "title": "Descriptive title for the canvas",
    "objects": [
        {{
            "type": "rectangle|circle|diamond|star|heart|text|arrow|line",

            // Common properties for all types:
            "x": number (0-1000),
            "y": number (0-1000),

            // For rectangles, diamonds, stars, hearts:
            "width": number (30-500),
            "height": number (30-500),

            // For circles only (use instead of width/height):
            "radius": number (15-250),

            // For arrows and lines (RELATIVE to x, y):
            "points": [0, 0, endX, endY],  // e.g., [0, 0, 150, 0] for horizontal line

            // Visual styling:
            "fill": "hex color code (interior color)",
            "stroke": "hex color code (border color)",
            "strokeWidth": number (1-4),

            // For text objects:
            "text": "string content",
            "fontSize": number (10-18),
            "color": "hex color code"
        }}
    ]
}}

IMPORTANT SCHEMA RULES:
- Rectangles, diamonds, stars, hearts: MUST have x, y, width, height, fill, stroke, strokeWidth
- Circles: MUST have x, y, radius, fill, stroke, strokeWidth (NOT width/height)
- Text: MUST have x, y, text, fontSize, color
- Arrows/Lines: MUST have x, y, points, stroke, strokeWidth

DESIGN GUIDELINES:
- Apply visual hierarchy: vary sizes and strokeWidth for emphasis
- Use consistent alignment: position objects on a grid (multiples of 10 or 20)
- Provide adequate spacing: minimum 30-50px between unrelated objects
- Choose harmonious colors: lighter fills with darker strokes for contrast
- Connect with purpose: arrows should clearly show relationships and flow
- Consider interactivity: leave room for users to add more content
- Balance the layout: distribute objects evenly across the canvas
"""
        
        response = self.openai_client.chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4'),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "canvas_spec",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "objects": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "type": {"type": "string", "enum": ["rectangle", "circle", "diamond", "star", "heart", "text", "arrow", "line"]},
                                        "label": {"type": "string"},
                                        "x": {"type": "number", "minimum": 0, "maximum": 1000},
                                        "y": {"type": "number", "minimum": 0, "maximum": 1000},
                                        "width": {"type": "number", "minimum": 10, "maximum": 500},
                                        "height": {"type": "number", "minimum": 10, "maximum": 500},
                                        "radius": {"type": "number", "minimum": 10, "maximum": 250},
                                        "fill": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                                        "stroke": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                                        "strokeWidth": {"type": "number", "minimum": 1, "maximum": 5},
                                        "points": {"type": "array", "items": {"type": "number"}},
                                        "text": {"type": "string"},
                                        "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                                        "fontSize": {"type": "number", "minimum": 8, "maximum": 24}
                                    },
                                    "required": ["type", "x", "y"]
                                }
                            }
                        },
                        "required": ["title", "objects"]
                    }
                }
            },
            max_tokens=2000,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    def _get_style_guidance(self, style: str, color_scheme: str) -> str:
        """Get style-specific guidance for AI generation."""
        style_guides = {
            "modern": "Clean lines, minimal design, use modern colors like blues and grays",
            "corporate": "Professional appearance, use corporate colors like navy and white",
            "creative": "Bold colors, creative shapes, artistic layout",
            "minimal": "Simple shapes, lots of white space, subtle colors"
        }
        
        color_guides = {
            "pastel": "Use soft, pastel colors like light blues, pinks, and greens",
            "vibrant": "Use bright, energetic colors like oranges, purples, and yellows",
            "monochrome": "Use shades of gray and black only",
            "default": "Use a balanced color palette with blues, greens, and grays"
        }
        
        return f"{style_guides.get(style, '')} {color_guides.get(color_scheme, '')}"
    
    def _parse_ai_response_to_objects(self, ai_response: str) -> Dict[str, Any]:
        """Parse AI response into canvas object data."""
        try:
            # Parse JSON response
            data = json.loads(ai_response)
            
            # Validate structure
            if 'objects' not in data:
                raise ValueError("Invalid AI response structure")
            
            # Validate and clean objects
            validated_objects = []
            for obj in data.get('objects', []):
                if self._validate_object(obj):
                    validated_objects.append(self._clean_object(obj))
            
            return {
                'title': data.get('title', 'AI Generated Canvas'),
                'objects': validated_objects
            }
            
        except Exception as e:
            self.logger.log_error(f"Failed to parse AI response: {str(e)}", e)
            raise ValueError("Failed to parse AI response")
    
    def _validate_object(self, obj: Dict[str, Any]) -> bool:
        """Validate object structure and values."""
        # All objects require type, x, y
        if 'type' not in obj or 'x' not in obj or 'y' not in obj:
            return False

        # Validate coordinates
        if not (0 <= obj['x'] <= 1000 and 0 <= obj['y'] <= 1000):
            return False

        # Validate object type
        valid_types = ['rectangle', 'circle', 'diamond', 'star', 'heart', 'text', 'arrow', 'line']
        if obj['type'] not in valid_types:
            return False

        # Type-specific validation
        obj_type = obj['type']

        # Rectangles, diamonds, stars, hearts require width and height
        if obj_type in ['rectangle', 'diamond', 'star', 'heart']:
            if 'width' not in obj or 'height' not in obj:
                return False
            if not (10 <= obj['width'] <= 500 and 10 <= obj['height'] <= 500):
                return False

        # Circles require radius
        elif obj_type == 'circle':
            if 'radius' not in obj:
                return False
            if not (10 <= obj['radius'] <= 250):
                return False

        # Text requires text content
        elif obj_type == 'text':
            if 'text' not in obj or not isinstance(obj['text'], str):
                return False

        # Arrows and lines require points array
        elif obj_type in ['arrow', 'line']:
            if 'points' not in obj or not isinstance(obj['points'], list):
                return False
            if len(obj['points']) < 4 or not all(isinstance(p, (int, float)) for p in obj['points']):
                return False

        return True
    
    def _clean_object(self, obj: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and standardize object data."""
        obj_type = obj['type']

        # Base properties for all objects
        cleaned = {
            'type': obj_type,
            'x': float(obj['x']),
            'y': float(obj['y'])
        }

        # Type-specific properties
        if obj_type in ['rectangle', 'diamond', 'star', 'heart']:
            # Shapes with width and height
            cleaned['width'] = float(obj['width'])
            cleaned['height'] = float(obj['height'])
            cleaned['fill'] = obj.get('fill', '#E8F4FF')
            cleaned['stroke'] = obj.get('stroke', '#2563EB')
            cleaned['strokeWidth'] = float(obj.get('strokeWidth', 2))

        elif obj_type == 'circle':
            # Circle with radius
            cleaned['radius'] = float(obj['radius'])
            cleaned['fill'] = obj.get('fill', '#E8F4FF')
            cleaned['stroke'] = obj.get('stroke', '#2563EB')
            cleaned['strokeWidth'] = float(obj.get('strokeWidth', 2))

        elif obj_type == 'text':
            # Text object
            cleaned['text'] = obj.get('text', obj.get('label', ''))
            cleaned['fontSize'] = float(obj.get('fontSize', 14))
            cleaned['color'] = obj.get('color', '#000000')
            # Add width and height for text bounds (optional, can be calculated by frontend)
            cleaned['width'] = float(obj.get('width', 100))
            cleaned['height'] = float(obj.get('height', 30))

        elif obj_type in ['arrow', 'line']:
            # Lines and arrows with points
            cleaned['points'] = obj.get('points', [0, 0, 100, 0])
            cleaned['stroke'] = obj.get('stroke', '#2563EB')
            cleaned['strokeWidth'] = float(obj.get('strokeWidth', 2))

        return cleaned
    
    def _create_new_canvas(self, user_id: str, query: str, prompt_id: Optional[str] = None) -> Canvas:
        """Create a new canvas for AI-generated content."""
        canvas = Canvas(
            id=str(uuid.uuid4()),
            title=f"AI Generated: {query[:50]}...",
            owner_id=user_id,
            prompt_id=prompt_id,
            is_public=False
        )
        
        db.session.add(canvas)
        db.session.commit()
        
        return canvas
    
    def _save_objects_to_canvas(
        self,
        objects_data: List[Dict[str, Any]],
        canvas_id: str,
        user_id: str
    ) -> List[CanvasObject]:
        """Save AI-generated objects to the canvas."""
        saved_objects = []

        for obj_data in objects_data:
            # Create properties dictionary with all available properties
            # The cleaned object already has the correct structure
            properties = {k: v for k, v in obj_data.items() if k not in ['type']}

            canvas_object = CanvasObject(
                id=str(uuid.uuid4()),
                canvas_id=canvas_id,
                object_type=obj_data['type'],
                properties=json.dumps(properties),
                created_by=user_id
            )

            db.session.add(canvas_object)
            saved_objects.append(canvas_object)

        db.session.commit()

        return saved_objects
