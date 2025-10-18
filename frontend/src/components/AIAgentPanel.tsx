import React, { useState } from 'react';
import { useAIAgent } from '../hooks/useAIAgent';
import { useNotifications } from '../hooks/useNotifications';
import { socketService } from '../services/socket';
import { useAuth } from '../hooks/useAuth';

interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (canvasId: string) => void;
  currentCanvasId?: string;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentCanvasId
}) => {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<'modern' | 'corporate' | 'creative' | 'minimal'>('modern');
  const [colorScheme, setColorScheme] = useState<'pastel' | 'vibrant' | 'monochrome' | 'default'>('default');
  
  const { createCanvas, isLoading, error, clearError } = useAIAgent();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  
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
        // Add objects to current canvas using socket service
        if (currentCanvasId && user) {
          const token = localStorage.getItem('idToken');
          
          if (token) {
            // Add each object to the canvas
            for (const obj of result.canvas.objects) {
              socketService.createObject(currentCanvasId, token, {
                type: obj.object_type,
                properties: obj.properties
              });
            }
          }
        }
        
        // Show success message
        addNotification({
          type: 'success',
          title: 'AI Canvas Created',
          message: `Successfully created ${result.canvas.objects.length} objects!`
        });
        
        // Close panel and reset form
        handleClose();
        
        // Call success callback
        if (onSuccess) {
          onSuccess(result.canvas.id);
        }
      }
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'AI Canvas Creation Failed',
        message: 'Failed to create canvas. Please try again.'
      });
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
  const handleClickOutside = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };
  
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
