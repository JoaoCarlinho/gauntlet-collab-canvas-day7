# 🚀 Comprehensive Full-Stack AI Canvas Implementation Plan

## 📋 **Executive Summary**

This document provides a complete implementation plan for integrating AI-powered canvas creation into the existing CollabCanvas application. Since your deployment infrastructure (Railway backend, Vercel frontend, Firebase authentication) is already in place, this plan focuses on adding OpenAI API integration to enable AI-powered canvas generation.

---

## 🔧 **OpenAI API Setup (Required Before Implementation)**

### **1. OpenAI Account & API Key Setup**

#### **1.1 Create OpenAI Account**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create account or sign in
3. Navigate to API Keys section
4. Generate new API key

#### **1.2 Add OpenAI Environment Variables**
Add these environment variables to your existing Railway backend deployment:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
```

#### **1.3 OpenAI Usage Considerations**
- **Rate Limits**: OpenAI has rate limits based on your account tier
- **Cost Management**: Monitor usage to avoid unexpected charges
- **Model Selection**: GPT-4 provides better results but costs more than GPT-3.5
- **Token Limits**: Be aware of input/output token limits for requests

### **2. Backend Environment Update**
Since your deployment is already in place, you only need to:
1. Add the OpenAI environment variables to your Railway project
2. Update your `requirements.txt` to include the OpenAI package
3. Redeploy your backend with the new environment variables

---

## 🏗️ **Implementation Architecture**

### **System Overview**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Flask Backend  │    │   OpenAI API    │
│   (Existing)    │◄──►│   (Existing)    │◄──►│   (New)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Firebase Auth   │    │ PostgreSQL DB   │
│ (Existing)      │    │ (Existing)      │
└─────────────────┘    └─────────────────┘
```

### **Technology Stack**
| Component | Technology | Status | Purpose |
|-----------|------------|---------|---------|
| Frontend | React + TypeScript + Vite | ✅ Existing | UI and user interactions |
| Backend | Flask + Python 3.10+ | ✅ Existing | API and business logic |
| Database | PostgreSQL | ✅ Existing | Data persistence |
| Authentication | Firebase Auth | ✅ Existing | User management |
| AI Service | OpenAI GPT-4 | 🆕 New | Canvas generation |
| Deployment | Vercel (Frontend) + Railway (Backend) | ✅ Existing | Production hosting |

---

## 🎯 **API Route Specification**

### **AI Canvas Generation Endpoint**
```http
POST /api/ai-agent/create-canvas
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "instructions": "Create a flow diagram showing a user signup process",
  "style": "modern",
  "colorScheme": "pastel",
  "canvas_id": "optional_existing_canvas_id"
}
```

### **Response Format**
```json
{
  "success": true,
  "canvas": {
    "id": "canvas_123",
    "title": "User Signup Flow",
    "objects": [
      {
        "id": "obj_1",
        "type": "rectangle",
        "label": "Landing Page",
        "x": 100,
        "y": 50,
        "width": 120,
        "height": 60,
        "color": "#3B82F6",
        "fontSize": 14
      },
      {
        "id": "obj_2",
        "type": "diamond",
        "label": "Sign Up?",
        "x": 250,
        "y": 150,
        "width": 100,
        "height": 80,
        "color": "#10B981",
        "fontSize": 14
      },
      {
        "id": "obj_3",
        "type": "arrow",
        "from": "obj_1",
        "to": "obj_2",
        "color": "#6B7280"
      }
    ]
  },
  "message": "Successfully created 3 objects"
}
```

---

## 🧠 **AI Model Integration**

### **System Prompt Design**
```python
SYSTEM_PROMPT = """
You are an expert product manager and Figma power user.
Your task is to generate a JSON specification of a design canvas.

Available object types:
- rectangle: For boxes, containers, buttons
- circle: For decision points, highlights
- diamond: For decision points, conditions
- text: For labels, descriptions
- arrow: For connections, flow direction
- line: For separators, connections

Guidelines:
- Use coordinates between 0 and 1000
- Make objects appropriately sized (width: 50-200, height: 30-100)
- Use clear, readable text (fontSize: 12-18)
- Choose appropriate colors (hex format)
- Position objects logically with proper spacing
- Include arrows to show relationships between objects

Return ONLY valid JSON in the specified format.
"""
```

### **Response Format Enforcement**
```python
RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "canvas_spec",
        "schema": {
            "type": "object",
            "properties": {
                "canvas": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "objects": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": {"type": "string", "enum": ["rectangle", "circle", "diamond", "text", "arrow", "line"]},
                                    "label": {"type": "string"},
                                    "x": {"type": "number", "minimum": 0, "maximum": 1000},
                                    "y": {"type": "number", "minimum": 0, "maximum": 1000},
                                    "width": {"type": "number", "minimum": 10, "maximum": 500},
                                    "height": {"type": "number", "minimum": 10, "maximum": 500},
                                    "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                                    "fontSize": {"type": "number", "minimum": 8, "maximum": 24}
                                },
                                "required": ["type", "x", "y", "width", "height"]
                            }
                        }
                    },
                    "required": ["title", "objects"]
                }
            },
            "required": ["canvas"]
        }
    }
}
```

---

## 🛠️ **Backend Implementation**

### **1. AI Agent Service**
**File:** `backend/app/services/ai_agent_service.py`

```python
import openai
import json
import os
from typing import Dict, List, Any, Optional
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas
from app.utils.logger import SmartLogger
from app.services.auth_service import AuthService

class AIAgentService:
    """Service for AI-powered canvas creation."""
    
    def __init__(self):
        self.logger = SmartLogger('ai_agent_service', 'INFO')
        self.openai_client = openai.OpenAI(
            api_key=os.environ.get('OPENAI_API_KEY')
        )
        self.auth_service = AuthService()
    
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
                if not canvas or canvas.user_id != user_id:
                    raise ValueError("Canvas not found or access denied")
            
            # Save objects to database
            saved_objects = self._save_objects_to_canvas(objects_data, canvas_id, user_id)
            
            return {
                'canvas_id': canvas_id,
                'objects': [obj.to_dict() for obj in saved_objects],
                'message': f'Successfully created {len(saved_objects)} objects',
                'title': objects_data.get('title', 'AI Generated Canvas')
            }
            
        except Exception as e:
            self.logger.log_error(f"AI canvas creation failed: {str(e)}", e)
            raise
    
    def _generate_ai_response(self, query: str, style: str, color_scheme: str) -> str:
        """Generate AI response using OpenAI API."""
        style_guidance = self._get_style_guidance(style, color_scheme)
        
        prompt = f"""
        Create a canvas layout based on this description: "{query}"
        
        Style preferences: {style_guidance}
        
        Return a JSON object with this exact structure:
        {{
            "title": "Descriptive title for the canvas",
            "objects": [
                {{
                    "type": "rectangle|circle|diamond|text|arrow|line",
                    "label": "Object label or text content",
                    "x": number (0-1000),
                    "y": number (0-1000),
                    "width": number (10-500),
                    "height": number (10-500),
                    "color": "hex color code",
                    "fontSize": number (8-24, for text objects)
                }}
            ]
        }}
        
        Guidelines:
        - Use logical positioning and spacing
        - Include arrows to show relationships
        - Use appropriate colors for the style
        - Make text readable and concise
        - Ensure objects don't overlap unnecessarily
        """
        
        response = self.openai_client.chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4'),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            response_format=RESPONSE_FORMAT,
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
            if 'canvas' not in data:
                raise ValueError("Invalid AI response structure")
            
            canvas_data = data['canvas']
            
            # Validate and clean objects
            validated_objects = []
            for obj in canvas_data.get('objects', []):
                if self._validate_object(obj):
                    validated_objects.append(self._clean_object(obj))
            
            return {
                'title': canvas_data.get('title', 'AI Generated Canvas'),
                'objects': validated_objects
            }
            
        except Exception as e:
            self.logger.log_error(f"Failed to parse AI response: {str(e)}", e)
            raise ValueError("Failed to parse AI response")
    
    def _validate_object(self, obj: Dict[str, Any]) -> bool:
        """Validate object structure and values."""
        required_fields = ['type', 'x', 'y', 'width', 'height']
        
        # Check required fields
        if not all(field in obj for field in required_fields):
            return False
        
        # Validate coordinates and dimensions
        if not (0 <= obj['x'] <= 1000 and 0 <= obj['y'] <= 1000):
            return False
        
        if not (10 <= obj['width'] <= 500 and 10 <= obj['height'] <= 500):
            return False
        
        # Validate object type
        valid_types = ['rectangle', 'circle', 'diamond', 'text', 'arrow', 'line']
        if obj['type'] not in valid_types:
            return False
        
        return True
    
    def _clean_object(self, obj: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and standardize object data."""
        cleaned = {
            'type': obj['type'],
            'x': float(obj['x']),
            'y': float(obj['y']),
            'width': float(obj['width']),
            'height': float(obj['height']),
            'color': obj.get('color', '#3B82F6'),
            'text': obj.get('label', ''),
            'fontSize': obj.get('fontSize', 14)
        }
        
        return cleaned
    
    def _create_new_canvas(self, user_id: str, query: str) -> Canvas:
        """Create a new canvas for AI-generated content."""
        canvas = Canvas(
            title=f"AI Generated: {query[:50]}...",
            user_id=user_id,
            is_public=False
        )
        
        from app.extensions import db
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
        
        for obj_data in objects_data['objects']:
            canvas_object = CanvasObject(
                canvas_id=canvas_id,
                user_id=user_id,
                object_type=obj_data['type'],
                x=obj_data['x'],
                y=obj_data['y'],
                width=obj_data['width'],
                height=obj_data['height'],
                color=obj_data['color'],
                text=obj_data['text'],
                font_size=obj_data['fontSize']
            )
            
            from app.extensions import db
            db.session.add(canvas_object)
            saved_objects.append(canvas_object)
        
        from app.extensions import db
        db.session.commit()
        
        return saved_objects
```

### **2. AI Agent API Routes**
**File:** `backend/app/routes/ai_agent.py`

```python
from flask import Blueprint, request, jsonify
from app.services.ai_agent_service import AIAgentService
from app.middleware.auth import require_auth
from app.schemas.ai_agent_schemas import CanvasCreationRequestSchema
from app.services.unified_rate_limiter import unified_rate_limiter
from marshmallow import ValidationError
from app.utils.logger import SmartLogger

ai_agent_bp = Blueprint('ai_agent', __name__, url_prefix='/api/ai-agent')
logger = SmartLogger('ai_agent_routes', 'INFO')

@ai_agent_bp.route('/create-canvas', methods=['POST'])
@require_auth
@unified_rate_limiter.check_rate_limit('ai_canvas_creation', user_tier='free')
def create_canvas_with_ai(current_user):
    """Create canvas objects using AI agent based on user query."""
    try:
        # Validate request data
        schema = CanvasCreationRequestSchema()
        data = schema.load(request.json)
        
        # Initialize AI agent service
        ai_service = AIAgentService()
        
        # Process the query and generate canvas objects
        result = ai_service.create_canvas_from_query(
            query=data['instructions'],
            user_id=current_user.id,
            canvas_id=data.get('canvas_id'),
            style=data.get('style', 'modern'),
            color_scheme=data.get('colorScheme', 'default')
        )
        
        logger.log_info(f"AI canvas created successfully for user {current_user.id}")
        
        return jsonify({
            'success': True,
            'canvas': {
                'id': result['canvas_id'],
                'title': result['title'],
                'objects': result['objects']
            },
            'message': result['message']
        }), 200
        
    except ValidationError as e:
        logger.log_warning(f"Validation error in AI canvas creation: {e.messages}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'details': e.messages
        }), 400
        
    except Exception as e:
        logger.log_error(f"AI canvas creation failed: {str(e)}", e)
        return jsonify({
            'success': False,
            'error': 'Failed to create canvas',
            'message': str(e)
        }), 500

@ai_agent_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for AI agent service."""
    try:
        ai_service = AIAgentService()
        # Test OpenAI connection
        test_response = ai_service.openai_client.models.list()
        
        return jsonify({
            'status': 'healthy',
            'openai_connected': True,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'openai_connected': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500
```

### **3. Validation Schemas**
**File:** `backend/app/schemas/ai_agent_schemas.py`

```python
from marshmallow import Schema, fields, validate

class CanvasCreationRequestSchema(Schema):
    instructions = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=1000),
        error_messages={'required': 'Instructions are required'}
    )
    style = fields.Str(
        missing='modern',
        validate=validate.OneOf(['modern', 'corporate', 'creative', 'minimal']),
        error_messages={'validator_failed': 'Invalid style option'}
    )
    colorScheme = fields.Str(
        missing='default',
        validate=validate.OneOf(['pastel', 'vibrant', 'monochrome', 'default']),
        error_messages={'validator_failed': 'Invalid color scheme option'}
    )
    canvas_id = fields.Str(
        missing=None,
        validate=validate.Length(min=1, max=100),
        allow_none=True
    )
```

---

## 🎨 **Frontend Implementation**

### **1. AI Agent Hook**
**File:** `frontend/src/hooks/useAIAgent.ts`

```typescript
import { useState } from 'react';
import { useAuth } from './useAuth';
import { CanvasObject } from '../types';

interface AIAgentResponse {
  success: boolean;
  canvas: {
    id: string;
    title: string;
    objects: CanvasObject[];
  };
  message: string;
  error?: string;
}

interface AIAgentRequest {
  instructions: string;
  style?: 'modern' | 'corporate' | 'creative' | 'minimal';
  colorScheme?: 'pastel' | 'vibrant' | 'monochrome' | 'default';
  canvas_id?: string;
}

export const useAIAgent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAuthToken } = useAuth();
  
  const createCanvas = async (request: AIAgentRequest): Promise<AIAgentResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai-agent/create-canvas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create canvas');
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearError = () => setError(null);
  
  return {
    createCanvas,
    isLoading,
    error,
    clearError
  };
};
```

### **2. AI Agent Button Component**
**File:** `frontend/src/components/AIAgentButton.tsx`

```typescript
import React from 'react';

interface AIAgentButtonProps {
  onClick: () => void;
  isOpen: boolean;
  disabled?: boolean;
}

export const AIAgentButton: React.FC<AIAgentButtonProps> = ({ 
  onClick, 
  isOpen, 
  disabled = false 
}) => {
  return (
    <button
      className={`ai-agent-button ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title="AI Agent - Create canvas with AI"
      aria-label="Open AI Agent to create canvas with artificial intelligence"
    >
      <span className="ai-icon" role="img" aria-label="AI robot">🤖</span>
      <span className="button-text">AI Agent</span>
    </button>
  );
};
```

### **3. AI Agent Panel Component**
**File:** `frontend/src/components/AIAgentPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useAIAgent } from '../hooks/useAIAgent';
import { useCanvas } from '../hooks/useCanvas';
import { useNotification } from '../hooks/useNotification';

interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (canvasId: string) => void;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<'modern' | 'corporate' | 'creative' | 'minimal'>('modern');
  const [colorScheme, setColorScheme] = useState<'pastel' | 'vibrant' | 'monochrome' | 'default'>('default');
  
  const { createCanvas, isLoading, error, clearError } = useAIAgent();
  const { addObjectsToCanvas, currentCanvasId } = useCanvas();
  const { showNotification } = useNotification();
  
  const handleSubmit = async () => {
    if (!query.trim()) return;
    
    try {
      clearError();
      
      const result = await createCanvas({
        instructions: query,
        style,
        colorScheme,
        canvas_id: currentCanvasId || undefined
      });
      
      if (result.success && result.canvas.objects) {
        // Add objects to current canvas
        await addObjectsToCanvas(result.canvas.objects);
        
        // Show success message
        showNotification(
          `Successfully created ${result.canvas.objects.length} objects!`,
          'success'
        );
        
        // Close panel and reset form
        handleClose();
        
        // Call success callback
        if (onSuccess) {
          onSuccess(result.canvas.id);
        }
      }
    } catch (err) {
      showNotification(
        'Failed to create canvas. Please try again.',
        'error'
      );
    }
  };
  
  const handleClose = () => {
    setQuery('');
    setStyle('modern');
    setColorScheme('default');
    clearError();
    onClose();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };
  
  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && e.target === e.currentTarget) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);
  
  return (
    <div 
      className={`ai-agent-panel-overlay ${isOpen ? 'open' : 'closed'}`}
      onClick={handleClickOutside}
    >
      <div className={`ai-agent-panel ${isOpen ? 'open' : 'closed'}`}>
        <div className="panel-header">
          <h3>AI Canvas Creator</h3>
          <button 
            className="close-button" 
            onClick={handleClose}
            aria-label="Close AI Agent panel"
          >
            ×
          </button>
        </div>
        
        <div className="panel-content">
          <div className="input-group">
            <label htmlFor="query-input">Describe what you want to create:</label>
            <textarea
              id="query-input"
              className="query-input"
              placeholder="e.g., 'Create a flowchart for a user login process' or 'Design a mind map for project planning'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              disabled={isLoading}
              maxLength={1000}
            />
            <div className="character-count">
              {query.length}/1000
            </div>
          </div>
          
          <div className="style-options">
            <div className="option-group">
              <label htmlFor="style-select">Style:</label>
              <select
                id="style-select"
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
                disabled={isLoading}
              >
                <option value="modern">Modern</option>
                <option value="corporate">Corporate</option>
                <option value="creative">Creative</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            
            <div className="option-group">
              <label htmlFor="color-scheme-select">Color Scheme:</label>
              <select
                id="color-scheme-select"
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as any)}
                disabled={isLoading}
              >
                <option value="default">Default</option>
                <option value="pastel">Pastel</option>
                <option value="vibrant">Vibrant</option>
                <option value="monochrome">Monochrome</option>
              </select>
            </div>
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="panel-footer">
            <div className="shortcuts">
              <small>Press Ctrl+Enter to submit, Esc to close</small>
            </div>
            <button
              className="submit-button"
              onClick={handleSubmit}
              disabled={!query.trim() || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Canvas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### **4. CSS Styling**
**File:** `frontend/src/styles/AIAgent.css`

```css
/* AI Agent Button */
.ai-agent-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.ai-agent-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.ai-agent-button:hover::before {
  left: 100%;
}

.ai-agent-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.ai-agent-button.active {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.ai-agent-button.disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.ai-agent-button.disabled::before {
  display: none;
}

.ai-icon {
  font-size: 18px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* AI Agent Panel Overlay */
.ai-agent-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
}

.ai-agent-panel-overlay.open {
  opacity: 1;
  visibility: visible;
}

/* AI Agent Panel */
.ai-agent-panel {
  background: white;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(100%);
  transition: transform 0.3s ease;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
}

.ai-agent-panel.open {
  transform: translateY(0);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.panel-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-header h3::before {
  content: '🤖';
  font-size: 24px;
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #6c757d;
  padding: 4px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-button:hover {
  background-color: #e9ecef;
  color: #495057;
}

.panel-content {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(80vh - 120px);
}

.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #495057;
}

.query-input {
  width: 100%;
  min-height: 120px;
  padding: 16px;
  border: 2px solid #e1e5e9;
  border-radius: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: all 0.2s ease;
  background: #f8f9fa;
}

.query-input:focus {
  outline: none;
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.query-input:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.character-count {
  text-align: right;
  font-size: 12px;
  color: #6c757d;
  margin-top: 4px;
}

.style-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.option-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 14px;
}

.option-group select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: border-color 0.2s ease;
}

.option-group select:focus {
  outline: none;
  border-color: #667eea;
}

.option-group select:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid #f5c6cb;
  font-size: 14px;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e1e5e9;
}

.shortcuts {
  color: #6c757d;
  font-size: 12px;
}

.submit-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.submit-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.submit-button:hover::before {
  left: 100%;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.submit-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.submit-button:disabled::before {
  display: none;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .ai-agent-panel {
    max-height: 90vh;
    border-radius: 0;
  }
  
  .panel-content {
    padding: 20px;
  }
  
  .style-options {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .query-input {
    min-height: 100px;
  }
  
  .ai-agent-button {
    padding: 10px 12px;
    font-size: 13px;
  }
  
  .panel-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .shortcuts {
    text-align: center;
  }
}

@media (max-width: 480px) {
  .ai-agent-panel-overlay {
    align-items: flex-end;
  }
  
  .ai-agent-panel {
    width: 100%;
    max-height: 95vh;
  }
  
  .panel-header {
    padding: 16px 20px;
  }
  
  .panel-content {
    padding: 16px;
  }
}
```

### **5. Integration with Toolbox**
**File:** `frontend/src/components/Toolbox.tsx` (modifications)

```typescript
// Add these imports to existing Toolbox component
import { AIAgentButton } from './AIAgentButton';
import { AIAgentPanel } from './AIAgentPanel';
import { useAIAgent } from '../hooks/useAIAgent';

// Add these state variables to existing Toolbox component
const [aiPanelOpen, setAiPanelOpen] = useState(false);

// Add this handler function
const handleAIAgentSuccess = (canvasId: string) => {
  // Optional: Navigate to the created canvas or show success message
  console.log('AI canvas created:', canvasId);
};

// Add these components to the JSX return
return (
  <div className="toolbox">
    {/* Existing toolbox content */}
    
    {/* AI Agent Button */}
    <AIAgentButton
      onClick={() => setAiPanelOpen(!aiPanelOpen)}
      isOpen={aiPanelOpen}
      disabled={!isAuthenticated}
    />
    
    {/* AI Agent Panel */}
    <AIAgentPanel
      isOpen={aiPanelOpen}
      onClose={() => setAiPanelOpen(false)}
      onSuccess={handleAIAgentSuccess}
    />
  </div>
);
```

---

## 🧪 **Testing Strategy**

### **Backend Testing**
**File:** `backend/tests/test_ai_agent.py`

```python
import pytest
import json
from unittest.mock import patch, MagicMock
from app.services.ai_agent_service import AIAgentService
from app.models.user import User
from app.models.canvas import Canvas

class TestAIAgentService:
    def test_create_canvas_from_query_success(self, app, db, sample_user):
        """Test successful canvas creation from AI query."""
        with app.app_context():
            ai_service = AIAgentService()
            
            # Mock OpenAI response
            mock_response = {
                "canvas": {
                    "title": "Test Canvas",
                    "objects": [
                        {
                            "type": "rectangle",
                            "label": "Test Object",
                            "x": 100,
                            "y": 100,
                            "width": 120,
                            "height": 60,
                            "color": "#3B82F6",
                            "fontSize": 14
                        }
                    ]
                }
            }
            
            with patch.object(ai_service.openai_client.chat.completions, 'create') as mock_create:
                mock_create.return_value.choices[0].message.content = json.dumps(mock_response)
                
                result = ai_service.create_canvas_from_query(
                    query="Create a test canvas",
                    user_id=sample_user.id
                )
                
                assert result['success'] is True
                assert len(result['objects']) == 1
                assert result['objects'][0]['type'] == 'rectangle'
    
    def test_validate_object_valid(self):
        """Test object validation with valid data."""
        ai_service = AIAgentService()
        
        valid_object = {
            "type": "rectangle",
            "x": 100,
            "y": 100,
            "width": 120,
            "height": 60
        }
        
        assert ai_service._validate_object(valid_object) is True
    
    def test_validate_object_invalid(self):
        """Test object validation with invalid data."""
        ai_service = AIAgentService()
        
        invalid_object = {
            "type": "invalid_type",
            "x": -10,  # Invalid coordinate
            "y": 100,
            "width": 120,
            "height": 60
        }
        
        assert ai_service._validate_object(invalid_object) is False

class TestAIAgentAPI:
    def test_create_canvas_success(self, client, auth_headers):
        """Test successful API request."""
        with patch('app.services.ai_agent_service.AIAgentService.create_canvas_from_query') as mock_create:
            mock_create.return_value = {
                'canvas_id': 'test_canvas_id',
                'objects': [{'id': 'obj_1', 'type': 'rectangle', 'x': 100, 'y': 100}],
                'message': 'Success',
                'title': 'Test Canvas'
            }
            
            response = client.post('/api/ai-agent/create-canvas', 
                                 json={'instructions': 'Create a test canvas'},
                                 headers=auth_headers)
            
            assert response.status_code == 200
            assert response.json['success'] is True
            assert 'canvas' in response.json
    
    def test_create_canvas_validation_error(self, client, auth_headers):
        """Test API validation error handling."""
        response = client.post('/api/ai-agent/create-canvas',
                             json={'instructions': ''},  # Empty instructions
                             headers=auth_headers)
        
        assert response.status_code == 400
        assert response.json['success'] is False
        assert 'error' in response.json
    
    def test_create_canvas_unauthorized(self, client):
        """Test API without authentication."""
        response = client.post('/api/ai-agent/create-canvas',
                             json={'instructions': 'Create a test canvas'})
        
        assert response.status_code == 401
```

### **Frontend Testing**
**File:** `frontend/src/components/__tests__/AIAgentButton.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIAgentButton } from '../AIAgentButton';

describe('AIAgentButton', () => {
  it('renders with correct text and icon', () => {
    render(<AIAgentButton onClick={jest.fn()} isOpen={false} />);
    
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<AIAgentButton onClick={onClick} isOpen={false} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
  
  it('applies active class when isOpen is true', () => {
    render(<AIAgentButton onClick={jest.fn()} isOpen={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('active');
  });
  
  it('is disabled when disabled prop is true', () => {
    render(<AIAgentButton onClick={jest.fn()} isOpen={false} disabled={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

**File:** `frontend/src/hooks/__tests__/useAIAgent.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAIAgent } from '../useAIAgent';
import { useAuth } from '../useAuth';

// Mock the useAuth hook
jest.mock('../useAuth');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock fetch
global.fetch = jest.fn();

describe('useAIAgent', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      getAuthToken: jest.fn().mockResolvedValue('mock-token'),
      // ... other auth methods
    });
    
    (global.fetch as jest.Mock).mockClear();
  });
  
  it('creates canvas successfully', async () => {
    const mockResponse = {
      success: true,
      canvas: {
        id: 'canvas_123',
        title: 'Test Canvas',
        objects: [{ id: 'obj_1', type: 'rectangle', x: 100, y: 100 }]
      },
      message: 'Success'
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
    
    const { result } = renderHook(() => useAIAgent());
    
    await act(async () => {
      const response = await result.current.createCanvas({
        instructions: 'Create a test canvas'
      });
      
      expect(response).toEqual(mockResponse);
    });
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });
  
  it('handles API errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API Error' })
    });
    
    const { result } = renderHook(() => useAIAgent());
    
    await act(async () => {
      try {
        await result.current.createCanvas({
          instructions: 'Create a test canvas'
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
    
    expect(result.current.error).toBe('API Error');
    expect(result.current.isLoading).toBe(false);
  });
});
```

---

## 📊 **Implementation Timeline**

### **Phase 1: OpenAI Setup & Backend (Week 1)**
- [ ] **Day 1**: OpenAI API key setup and environment configuration
- [ ] **Day 2-3**: Backend AI service implementation
- [ ] **Day 4**: API routes and validation schemas
- [ ] **Day 5-7**: Backend testing and integration with existing codebase

### **Phase 2: Frontend Components (Week 2)**
- [ ] **Day 1-2**: AI Agent hook and button component
- [ ] **Day 3-4**: AI Agent panel component
- [ ] **Day 5**: CSS styling and animations
- [ ] **Day 6-7**: Frontend testing and integration with existing UI

### **Phase 3: Integration & Testing (Week 3)**
- [ ] **Day 1-2**: Full-stack integration with existing authentication
- [ ] **Day 3-4**: End-to-end testing with existing canvas functionality
- [ ] **Day 5**: Performance optimization and rate limiting
- [ ] **Day 6-7**: Security review and fixes

### **Phase 4: Polish & Production (Week 4)**
- [ ] **Day 1-2**: Final testing and bug fixes
- [ ] **Day 3-4**: User acceptance testing with existing user base
- [ ] **Day 5**: Performance monitoring and optimization
- [ ] **Day 6-7**: Documentation and feature announcement

---

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ AI Agent button opens/closes panel smoothly
- ✅ Text area accepts user input with validation
- ✅ Submit button processes queries and creates canvas objects
- ✅ Loading states provide clear user feedback
- ✅ Error handling displays helpful messages
- ✅ Objects render correctly on canvas

### **Performance Requirements**
- ✅ Panel opens/closes in < 300ms
- ✅ AI response time < 15 seconds
- ✅ Canvas objects render immediately after creation
- ✅ Mobile responsive on all screen sizes
- ✅ API response time < 2 seconds

### **Security Requirements**
- ✅ Authentication required for all AI endpoints
- ✅ Rate limiting prevents abuse
- ✅ Input validation prevents injection attacks
- ✅ Firebase token validation
- ✅ CORS properly configured

### **User Experience Requirements**
- ✅ Intuitive interface requiring no training
- ✅ Clear visual feedback for all interactions
- ✅ Accessible via keyboard navigation
- ✅ Consistent with existing application design
- ✅ Helpful error messages and guidance

---

## 🚀 **Future Enhancements**

### **Phase 2 Features**
- **Template Library**: Pre-built canvas templates
- **Voice Input**: Speech-to-text for queries
- **Image Upload**: Generate canvas from uploaded images
- **Collaborative AI**: Multiple users can refine AI-generated content
- **Style Transfer**: Apply consistent styling across objects

### **Advanced AI Features**
- **Context Awareness**: AI remembers previous canvas content
- **Smart Layouts**: AI suggests optimal object positioning
- **Content Suggestions**: AI recommends additional objects
- **Multi-language Support**: Generate canvases in different languages
- **Custom Models**: Fine-tuned models for specific use cases

### **Integration Features**
- **Export Options**: Export AI-generated canvases to various formats
- **Version History**: Track AI-generated canvas versions
- **Analytics**: Usage analytics for AI features
- **A/B Testing**: Test different AI prompts and styles

---

## 📝 **Integration Checklist**

### **Pre-Integration**
- [ ] OpenAI API key configured in Railway environment
- [ ] OpenAI package added to requirements.txt
- [ ] Tests passing (unit, integration, e2e)
- [ ] Security review completed
- [ ] Performance testing completed

### **Integration**
- [ ] Backend AI service integrated with existing codebase
- [ ] Frontend components integrated with existing UI
- [ ] Existing authentication flow maintained
- [ ] Existing canvas functionality preserved
- [ ] Rate limiting configured for AI endpoints

### **Post-Integration**
- [ ] Health checks passing for new AI endpoints
- [ ] Monitoring configured for OpenAI API usage
- [ ] Error tracking active for AI features
- [ ] User feedback collected on AI functionality
- [ ] Documentation updated with AI features

---

This comprehensive implementation plan provides a complete roadmap for integrating AI-powered canvas creation into your existing CollabCanvas application. Since your deployment infrastructure is already in place, the plan focuses on OpenAI API integration, detailed implementation code, testing strategies, and integration considerations for a production-ready system.
