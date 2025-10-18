import { useState } from 'react';
import { useAuth } from './useAuth';
import { CanvasObject } from '../types';
import { getApiUrl } from '../utils/env';

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
  const { user, getAuthToken } = useAuth();
  
  const createCanvas = async (request: AIAgentRequest): Promise<AIAgentResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const API_URL = getApiUrl();
      const token = await getAuthToken();
      
      const response = await fetch(`${API_URL}/api/ai-agent/create-canvas`, {
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
    clearError,
    isAuthenticated: !!user
  };
};
