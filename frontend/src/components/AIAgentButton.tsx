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
