import React, { useState, useEffect } from 'react';
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
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'sending' | 'processing' | 'receiving'>('idle');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  
  const { createCanvas, isLoading, error, clearError } = useAIAgent();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  
  // Listen for AI generation websocket events
  useEffect(() => {
    const handleGenerationStarted = (data: any) => {
      console.log('AI Generation Started:', data);
      if (data.request_id === currentRequestId) {
        setGenerationStatus('processing');
        addNotification({
          type: 'info',
          title: 'AI Processing',
          message: 'Sending your request to AI...'
        });
      }
    };
    
    const handleGenerationCompleted = (data: any) => {
      console.log('AI Generation Completed:', data);
      if (data.request_id === currentRequestId) {
        setGenerationStatus('receiving');
        addNotification({
          type: 'success',
          title: 'AI Canvas Created',
          message: `Successfully created ${data.object_count} objects!`
        });
        
        // Close panel and reset form
        handleClose();
        
        // Call success callback
        if (onSuccess && data.canvas_id) {
          onSuccess(data.canvas_id);
        }
      }
    };
    
    const handleGenerationFailed = (data: any) => {
      console.error('AI Generation Failed:', data);
      if (data.request_id === currentRequestId) {
        setGenerationStatus('idle');
        addNotification({
          type: 'error',
          title: 'AI Generation Failed',
          message: data.error_message || 'Failed to generate canvas. Please try again.'
        });
      }
    };
    
    socketService.on('ai_generation_started', handleGenerationStarted);
    socketService.on('ai_generation_completed', handleGenerationCompleted);
    socketService.on('ai_generation_failed', handleGenerationFailed);
    
    return () => {
      socketService.off('ai_generation_started', handleGenerationStarted);
      socketService.off('ai_generation_completed', handleGenerationCompleted);
      socketService.off('ai_generation_failed', handleGenerationFailed);
    };
  }, [currentRequestId, onSuccess, addNotification]);
  
  const handleSubmit = async () => {
    if (!query.trim()) return;
    
    try {
      clearError();
      setGenerationStatus('sending');
      
      // Generate a request ID to track this request
      const requestId = crypto.randomUUID();
      setCurrentRequestId(requestId);
      
      // Send request to backend - websocket events will handle the rest
      const result = await createCanvas({
        instructions: query,
        style,
        colorScheme,
        canvas_id: currentCanvasId || undefined
      });
      
      // Note: We no longer manually create objects here
      // The websocket events (ai_generation_started, ai_generation_completed) 
      // will handle status updates and UI changes
      
      // If the result includes a request_id, update our tracking
      if (result.request_id) {
        setCurrentRequestId(result.request_id);
      }
      
    } catch (err) {
      console.error('AI Agent error:', err);
      setGenerationStatus('idle');
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create canvas. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('Invalid object data')) {
          errorMessage = 'AI generated invalid object data. Please try a different request.';
        } else if (err.message.includes('authentication')) {
          errorMessage = 'Authentication error. Please refresh the page and try again.';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      addNotification({
        type: 'error',
        title: 'AI Canvas Creation Failed',
        message: errorMessage
      });
    }
  };
  
  const handleClose = () => {
    setQuery('');
    setStyle('modern');
    setColorScheme('default');
    setGenerationStatus('idle');
    setCurrentRequestId(null);
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
              disabled={!query.trim() || isLoading || generationStatus !== 'idle'}
            >
              {generationStatus === 'sending' && 'Sending Request...'}
              {generationStatus === 'processing' && 'AI Processing...'}
              {generationStatus === 'receiving' && 'Receiving Objects...'}
              {(generationStatus === 'idle' && isLoading) && 'Creating...'}
              {(generationStatus === 'idle' && !isLoading) && 'Create Canvas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
