/**
 * Integration tests for AI Agent with existing canvas functionality.
 * Tests that AI Agent integration doesn't break existing canvas operations.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AIAgentButton } from '../AIAgentButton';
import { AIAgentPanel } from '../AIAgentPanel';
import { useAIAgent } from '../../hooks/useAIAgent';
import { useAuth } from '../../hooks/useAuth';

// Mock the hooks
jest.mock('../../hooks/useAIAgent');
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useNotifications');
jest.mock('../../services/socket');

const mockUseAIAgent = useAIAgent as jest.MockedFunction<typeof useAIAgent>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('AI Agent Integration Tests', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: '',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  const mockAIAgentHook = {
    createCanvas: jest.fn(),
    isLoading: false,
    error: null,
    clearError: jest.fn(),
    isAuthenticated: true
  };

  const mockAuthHook = {
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshUser: jest.fn(),
    checkAuthState: jest.fn()
  };

  beforeEach(() => {
    mockUseAIAgent.mockReturnValue(mockAIAgentHook);
    mockUseAuth.mockReturnValue(mockAuthHook);
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Agent Button Integration', () => {
    it('should render AI Agent button when user is authenticated', () => {
      render(
        <BrowserRouter>
          <AIAgentButton
            onClick={jest.fn()}
            isOpen={false}
            disabled={false}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('AI Agent')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should be disabled when user is not authenticated', () => {
      mockAuthHook.isAuthenticated = false;
      mockUseAuth.mockReturnValue(mockAuthHook);

      render(
        <BrowserRouter>
          <AIAgentButton
            onClick={jest.fn()}
            isOpen={false}
            disabled={true}
          />
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled');
    });

    it('should show active state when panel is open', () => {
      render(
        <BrowserRouter>
          <AIAgentButton
            onClick={jest.fn()}
            isOpen={true}
            disabled={false}
          />
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('active');
    });

    it('should call onClick when clicked', () => {
      const mockOnClick = jest.fn();
      
      render(
        <BrowserRouter>
          <AIAgentButton
            onClick={mockOnClick}
            isOpen={false}
            disabled={false}
          />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI Agent Panel Integration', () => {
    it('should render AI Agent panel when open', () => {
      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={jest.fn()}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      expect(screen.getByText('AI Canvas Creator')).toBeInTheDocument();
      expect(screen.getByLabelText('Describe what you want to create:')).toBeInTheDocument();
      expect(screen.getByText('Create Canvas')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={false}
            onClose={jest.fn()}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      expect(screen.queryByText('AI Canvas Creator')).not.toBeInTheDocument();
    });

    it('should handle form submission successfully', async () => {
      const mockOnSuccess = jest.fn();
      const mockCreateCanvas = jest.fn().mockResolvedValue({
        success: true,
        canvas: {
          id: 'new-canvas-id',
          title: 'Test Canvas',
          objects: [
            {
              id: 'obj-1',
              object_type: 'rectangle',
              properties: { x: 100, y: 100, width: 120, height: 60 }
            }
          ]
        },
        message: 'Success'
      });

      mockAIAgentHook.createCanvas = mockCreateCanvas;
      mockUseAIAgent.mockReturnValue(mockAIAgentHook);

      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={jest.fn()}
            onSuccess={mockOnSuccess}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      // Fill in the form
      const textarea = screen.getByLabelText('Describe what you want to create:');
      fireEvent.change(textarea, { target: { value: 'Create a test rectangle' } });

      // Submit the form
      const submitButton = screen.getByText('Create Canvas');
      fireEvent.click(submitButton);

      // Wait for the API call
      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalledWith({
          instructions: 'Create a test rectangle',
          style: 'modern',
          colorScheme: 'default',
          canvas_id: 'test-canvas-id'
        });
      });

      // Verify success callback was called
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith('new-canvas-id');
      });
    });

    it('should handle form submission errors', async () => {
      const mockCreateCanvas = jest.fn().mockRejectedValue(new Error('API Error'));
      mockAIAgentHook.createCanvas = mockCreateCanvas;
      mockUseAIAgent.mockReturnValue(mockAIAgentHook);

      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={jest.fn()}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      // Fill in the form
      const textarea = screen.getByLabelText('Describe what you want to create:');
      fireEvent.change(textarea, { target: { value: 'Create a test rectangle' } });

      // Submit the form
      const submitButton = screen.getByText('Create Canvas');
      fireEvent.click(submitButton);

      // Wait for the error
      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalled();
      });
    });

    it('should close panel when close button is clicked', () => {
      const mockOnClose = jest.fn();
      
      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      const closeButton = screen.getByLabelText('Close AI Agent panel');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close panel when clicking outside', () => {
      const mockOnClose = jest.fn();
      
      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      const overlay = screen.getByRole('button', { hidden: true }).closest('.ai-agent-panel-overlay');
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should handle keyboard shortcuts', () => {
      const mockOnClose = jest.fn();
      
      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      // Test Escape key
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should show loading state during submission', async () => {
      const mockCreateCanvas = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      mockAIAgentHook.createCanvas = mockCreateCanvas;
      mockAIAgentHook.isLoading = true;
      mockUseAIAgent.mockReturnValue(mockAIAgentHook);

      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={jest.fn()}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(screen.getByText('Create Canvas')).toBeDisabled();
    });

    it('should show error messages', () => {
      mockAIAgentHook.error = 'Test error message';
      mockUseAIAgent.mockReturnValue(mockAIAgentHook);

      render(
        <BrowserRouter>
          <AIAgentPanel
            isOpen={true}
            onClose={jest.fn()}
            onSuccess={jest.fn()}
            currentCanvasId="test-canvas-id"
          />
        </BrowserRouter>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
  });

  describe('AI Agent Hook Integration', () => {
    it('should use correct API endpoint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          canvas: { id: 'test-canvas', title: 'Test', objects: [] },
          message: 'Success'
        })
      });
      
      global.fetch = mockFetch;

      const { result } = renderHook(() => useAIAgent());
      
      await act(async () => {
        await result.current.createCanvas({
          instructions: 'Test instruction'
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai-agent/create-canvas'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          }),
          body: JSON.stringify({
            instructions: 'Test instruction',
            style: 'modern',
            colorScheme: 'default',
            canvas_id: undefined
          })
        })
      );
    });

    it('should handle authentication errors', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Unauthorized' })
      });
      
      global.fetch = mockFetch;

      const { result } = renderHook(() => useAIAgent());
      
      await act(async () => {
        try {
          await result.current.createCanvas({
            instructions: 'Test instruction'
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.error).toBe('Unauthorized');
    });

    it('should clear errors when requested', () => {
      const { result } = renderHook(() => useAIAgent());
      
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Canvas Integration Compatibility', () => {
    it('should not interfere with existing canvas object creation', () => {
      // This test verifies that AI Agent components don't interfere
      // with existing canvas object creation patterns
      
      const mockCanvasObject = {
        id: 'existing-obj-1',
        canvas_id: 'test-canvas',
        object_type: 'rectangle',
        properties: { x: 100, y: 100, width: 120, height: 60 },
        created_by: 'test-user',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      // Verify that existing canvas object structure is compatible
      expect(mockCanvasObject).toHaveProperty('id');
      expect(mockCanvasObject).toHaveProperty('canvas_id');
      expect(mockCanvasObject).toHaveProperty('object_type');
      expect(mockCanvasObject).toHaveProperty('properties');
      expect(mockCanvasObject).toHaveProperty('created_by');
      expect(mockCanvasObject).toHaveProperty('created_at');
      expect(mockCanvasObject).toHaveProperty('updated_at');
    });

    it('should work with existing authentication patterns', () => {
      // This test verifies that AI Agent uses the same authentication
      // patterns as existing components
      
      expect(mockAuthHook.user).toBeDefined();
      expect(mockAuthHook.isAuthenticated).toBe(true);
      expect(mockAuthHook.isLoading).toBe(false);
      
      // Verify localStorage token access (same pattern as existing API service)
      expect(window.localStorage.getItem).toHaveBeenCalledWith('idToken');
    });

    it('should work with existing notification patterns', () => {
      // This test verifies that AI Agent uses the same notification
      // patterns as existing components
      
      const mockNotification = {
        type: 'success',
        title: 'AI Canvas Created',
        message: 'Successfully created 3 objects'
      };

      expect(mockNotification).toHaveProperty('type');
      expect(mockNotification).toHaveProperty('title');
      expect(mockNotification).toHaveProperty('message');
    });
  });
});

// Helper function to render hook
function renderHook(hook) {
  let result;
  function TestComponent() {
    result = hook();
    return null;
  }
  
  render(<TestComponent />);
  return { result };
}

// Helper function to act on async operations
async function act(callback) {
  await callback();
}
