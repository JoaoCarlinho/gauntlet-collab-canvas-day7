# 🤖 AI Agent Canvas Creation - UI Development Plan

## 📋 **Executive Summary**

This plan outlines the development of a user interface for AI-powered canvas creation. Users will be able to describe what they want to create in natural language, and the AI agent will generate the corresponding canvas objects and layout.

---

## 🎯 **Feature Requirements**

### **Core Functionality:**
1. **AI Agent Button** - A button at the bottom of the toolbox that opens the AI interface
2. **Text Input Area** - A text area where users can enter their canvas creation prompts
3. **Submit Button** - A submit button to send the prompt to the AI agent
4. **Query Processing** - Backend processing of user queries to generate canvas content

---

## 🛠️ **Technical Implementation Plan**

### **Phase 1: Frontend UI Components**

#### **1.1 AI Agent Button Component**
**File:** `frontend/src/components/AIAgentButton.tsx`

```typescript
interface AIAgentButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const AIAgentButton: React.FC<AIAgentButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button
      className={`ai-agent-button ${isOpen ? 'active' : ''}`}
      onClick={onClick}
      title="AI Agent - Create canvas with AI"
    >
      <span className="ai-icon">🤖</span>
      <span className="button-text">AI Agent</span>
    </button>
  );
};
```

**Features:**
- ✅ Toggle button to open/close AI interface
- ✅ Visual feedback when active
- ✅ Accessible with proper ARIA labels
- ✅ Responsive design for mobile/desktop

#### **1.2 AI Agent Panel Component**
**File:** `frontend/src/components/AIAgentPanel.tsx`

```typescript
interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

const AIAgentPanel: React.FC<AIAgentPanelProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading
}) => {
  const [query, setQuery] = useState('');
  
  return (
    <div className={`ai-agent-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="panel-header">
        <h3>AI Canvas Creator</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="panel-content">
        <textarea
          className="query-input"
          placeholder="Describe what you want to create... (e.g., 'Create a flowchart for a user login process')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          disabled={isLoading}
        />
        
        <div className="panel-footer">
          <div className="character-count">
            {query.length}/500
          </div>
          <button
            className="submit-button"
            onClick={() => onSubmit(query)}
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Canvas'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Features:**
- ✅ Slide-up panel animation
- ✅ Text area with character limit (500 chars)
- ✅ Submit button with loading state
- ✅ Character counter
- ✅ Input validation
- ✅ Keyboard shortcuts (Enter to submit, Escape to close)

#### **1.3 AI Agent Integration Hook**
**File:** `frontend/src/hooks/useAIAgent.ts`

```typescript
interface AIAgentResponse {
  success: boolean;
  objects: CanvasObject[];
  message: string;
  error?: string;
}

export const useAIAgent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const createCanvas = async (query: string): Promise<AIAgentResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai-agent/create-canvas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ query })
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
  
  return {
    createCanvas,
    isLoading,
    error,
    clearError: () => setError(null)
  };
};
```

**Features:**
- ✅ API integration for AI agent
- ✅ Loading state management
- ✅ Error handling
- ✅ Authentication token handling
- ✅ TypeScript interfaces

### **Phase 2: Backend API Development**

#### **2.1 AI Agent API Endpoint**
**File:** `backend/app/routes/ai_agent.py`

```python
from flask import Blueprint, request, jsonify
from app.services.ai_agent_service import AIAgentService
from app.middleware.auth import require_auth
from app.schemas.ai_agent_schemas import CanvasCreationRequestSchema
from app.services.unified_rate_limiter import unified_rate_limiter

ai_agent_bp = Blueprint('ai_agent', __name__, url_prefix='/api/ai-agent')

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
            query=data['query'],
            user_id=current_user.id,
            canvas_id=data.get('canvas_id')
        )
        
        return jsonify({
            'success': True,
            'objects': result['objects'],
            'message': result['message'],
            'canvas_id': result['canvas_id']
        }), 200
        
    except ValidationError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'details': e.messages
        }), 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Failed to create canvas',
            'message': str(e)
        }), 500
```

**Features:**
- ✅ Authentication required
- ✅ Rate limiting (5 requests per minute for free users)
- ✅ Input validation with Marshmallow schemas
- ✅ Error handling and logging
- ✅ JSON response format

#### **2.2 AI Agent Service**
**File:** `backend/app/services/ai_agent_service.py`

```python
import openai
from typing import Dict, List, Any
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas
from app.utils.logger import SmartLogger

class AIAgentService:
    """Service for AI-powered canvas creation."""
    
    def __init__(self):
        self.logger = SmartLogger('ai_agent_service', 'INFO')
        self.openai_client = openai.OpenAI(
            api_key=os.environ.get('OPENAI_API_KEY')
        )
    
    def create_canvas_from_query(self, query: str, user_id: str, canvas_id: str = None) -> Dict[str, Any]:
        """Create canvas objects from natural language query."""
        try:
            # Generate AI response
            ai_response = self._generate_ai_response(query)
            
            # Parse AI response into canvas objects
            objects = self._parse_ai_response_to_objects(ai_response)
            
            # Create or update canvas
            if not canvas_id:
                canvas = self._create_new_canvas(user_id, query)
                canvas_id = canvas.id
            else:
                canvas = Canvas.query.get(canvas_id)
            
            # Save objects to database
            saved_objects = self._save_objects_to_canvas(objects, canvas_id, user_id)
            
            return {
                'objects': [obj.to_dict() for obj in saved_objects],
                'message': f'Successfully created {len(saved_objects)} objects',
                'canvas_id': canvas_id
            }
            
        except Exception as e:
            self.logger.log_error(f"AI canvas creation failed: {str(e)}", e)
            raise
    
    def _generate_ai_response(self, query: str) -> str:
        """Generate AI response using OpenAI API."""
        prompt = f"""
        Create a canvas layout based on this description: "{query}"
        
        Return a JSON array of objects with the following structure:
        [
            {{
                "type": "rectangle|circle|text|line|arrow",
                "x": number,
                "y": number,
                "width": number,
                "height": number,
                "text": "string (for text objects)",
                "color": "hex color",
                "fontSize": number (for text objects)
            }}
        ]
        
        Guidelines:
        - Use coordinates between 0 and 1000
        - Make objects appropriately sized
        - Use clear, readable text
        - Choose appropriate colors
        - Position objects logically
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a canvas layout designer. Create logical, well-organized layouts."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    def _parse_ai_response_to_objects(self, ai_response: str) -> List[Dict[str, Any]]:
        """Parse AI response into canvas object dictionaries."""
        import json
        
        try:
            # Extract JSON from AI response
            json_start = ai_response.find('[')
            json_end = ai_response.rfind(']') + 1
            json_str = ai_response[json_start:json_end]
            
            objects = json.loads(json_str)
            
            # Validate and clean objects
            validated_objects = []
            for obj in objects:
                if self._validate_object(obj):
                    validated_objects.append(self._clean_object(obj))
            
            return validated_objects
            
        except Exception as e:
            self.logger.log_error(f"Failed to parse AI response: {str(e)}", e)
            return []
    
    def _validate_object(self, obj: Dict[str, Any]) -> bool:
        """Validate object structure and values."""
        required_fields = ['type', 'x', 'y', 'width', 'height']
        
        # Check required fields
        if not all(field in obj for field in required_fields):
            return False
        
        # Validate coordinates and dimensions
        if not (0 <= obj['x'] <= 1000 and 0 <= obj['y'] <= 1000):
            return False
        
        if not (1 <= obj['width'] <= 500 and 1 <= obj['height'] <= 500):
            return False
        
        # Validate object type
        valid_types = ['rectangle', 'circle', 'text', 'line', 'arrow']
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
            'color': obj.get('color', '#000000'),
            'text': obj.get('text', ''),
            'fontSize': obj.get('fontSize', 16)
        }
        
        return cleaned
```

**Features:**
- ✅ OpenAI GPT-4 integration
- ✅ Structured prompt engineering
- ✅ JSON response parsing
- ✅ Object validation and cleaning
- ✅ Error handling and logging
- ✅ Canvas creation and object saving

### **Phase 3: Integration and Styling**

#### **3.1 CSS Styling**
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
}

.ai-agent-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.ai-agent-button.active {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.ai-icon {
  font-size: 18px;
}

/* AI Agent Panel */
.ai-agent-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #e1e5e9;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(100%);
  transition: transform 0.3s ease;
  z-index: 1000;
  max-height: 50vh;
}

.ai-agent-panel.open {
  transform: translateY(0);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background-color: #e9ecef;
}

.panel-content {
  padding: 20px;
}

.query-input {
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s ease;
}

.query-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.query-input:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.character-count {
  font-size: 12px;
  color: #6c757d;
}

.submit-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.submit-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .ai-agent-panel {
    max-height: 60vh;
  }
  
  .panel-content {
    padding: 16px;
  }
  
  .query-input {
    min-height: 80px;
  }
  
  .ai-agent-button {
    padding: 10px 12px;
    font-size: 13px;
  }
}
```

**Features:**
- ✅ Modern gradient design
- ✅ Smooth animations and transitions
- ✅ Mobile responsive design
- ✅ Accessibility considerations
- ✅ Loading states and disabled states
- ✅ Consistent with existing UI theme

#### **3.2 Integration with Toolbox**
**File:** `frontend/src/components/Toolbox.tsx` (modifications)

```typescript
// Add to existing Toolbox component
import { AIAgentButton } from './AIAgentButton';
import { AIAgentPanel } from './AIAgentPanel';
import { useAIAgent } from '../hooks/useAIAgent';

const Toolbox: React.FC = () => {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const { createCanvas, isLoading, error } = useAIAgent();
  
  const handleAIAgentSubmit = async (query: string) => {
    try {
      const result = await createCanvas(query);
      
      // Add objects to canvas
      if (result.objects) {
        result.objects.forEach(obj => {
          // Add object to canvas using existing canvas management
          addObjectToCanvas(obj);
        });
      }
      
      // Close panel and show success message
      setAiPanelOpen(false);
      showNotification('Canvas created successfully!', 'success');
      
    } catch (err) {
      showNotification('Failed to create canvas. Please try again.', 'error');
    }
  };
  
  return (
    <div className="toolbox">
      {/* Existing toolbox content */}
      
      {/* AI Agent Button */}
      <AIAgentButton
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        isOpen={aiPanelOpen}
      />
      
      {/* AI Agent Panel */}
      <AIAgentPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        onSubmit={handleAIAgentSubmit}
        isLoading={isLoading}
      />
    </div>
  );
};
```

**Features:**
- ✅ Seamless integration with existing toolbox
- ✅ State management for panel open/close
- ✅ Error handling and user feedback
- ✅ Canvas object integration

---

## 🧪 **Testing Strategy**

### **Frontend Testing**
```typescript
// AIAgentButton.test.tsx
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
});

// AIAgentPanel.test.tsx
describe('AIAgentPanel', () => {
  it('opens and closes correctly', () => {
    const { rerender } = render(
      <AIAgentPanel isOpen={false} onClose={jest.fn()} onSubmit={jest.fn()} isLoading={false} />
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    
    rerender(
      <AIAgentPanel isOpen={true} onClose={jest.fn()} onSubmit={jest.fn()} isLoading={false} />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
```

### **Backend Testing**
```python
# test_ai_agent.py
class TestAIAgentAPI:
    def test_create_canvas_success(self, client, auth_headers):
        response = client.post('/api/ai-agent/create-canvas', 
                             json={'query': 'Create a simple flowchart'},
                             headers=auth_headers)
        assert response.status_code == 200
        assert response.json['success'] is True
        assert 'objects' in response.json
    
    def test_create_canvas_invalid_query(self, client, auth_headers):
        response = client.post('/api/ai-agent/create-canvas',
                             json={'query': ''},
                             headers=auth_headers)
        assert response.status_code == 400
        assert response.json['success'] is False
```

---

## 📊 **Implementation Timeline**

### **Week 1: Frontend Components**
- [ ] Create AIAgentButton component
- [ ] Create AIAgentPanel component
- [ ] Implement useAIAgent hook
- [ ] Add CSS styling and animations

### **Week 2: Backend API**
- [ ] Create AI agent API endpoint
- [ ] Implement AIAgentService
- [ ] Add OpenAI integration
- [ ] Create validation schemas

### **Week 3: Integration & Testing**
- [ ] Integrate with existing toolbox
- [ ] Add error handling and loading states
- [ ] Implement comprehensive testing
- [ ] Performance optimization

### **Week 4: Polish & Deployment**
- [ ] UI/UX improvements
- [ ] Mobile responsiveness testing
- [ ] Security review
- [ ] Production deployment

---

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ AI Agent button opens/closes panel smoothly
- ✅ Text area accepts user input with character limit
- ✅ Submit button processes queries and creates canvas objects
- ✅ Loading states provide user feedback
- ✅ Error handling displays helpful messages

### **Performance Requirements**
- ✅ Panel opens/closes in < 300ms
- ✅ AI response time < 10 seconds
- ✅ Canvas objects render immediately after creation
- ✅ Mobile responsive on all screen sizes

### **User Experience Requirements**
- ✅ Intuitive interface that requires no training
- ✅ Clear visual feedback for all interactions
- ✅ Accessible via keyboard navigation
- ✅ Consistent with existing application design

---

## 🚀 **Future Enhancements**

### **Phase 2 Features**
- **Template Library** - Pre-built canvas templates
- **Voice Input** - Speech-to-text for queries
- **Image Upload** - Generate canvas from uploaded images
- **Collaborative AI** - Multiple users can refine AI-generated content

### **Advanced AI Features**
- **Context Awareness** - AI remembers previous canvas content
- **Style Transfer** - Apply consistent styling across objects
- **Smart Layouts** - AI suggests optimal object positioning
- **Content Suggestions** - AI recommends additional objects

---

This comprehensive plan provides a clear roadmap for implementing the AI Agent canvas creation feature with a focus on user experience, performance, and maintainability.
