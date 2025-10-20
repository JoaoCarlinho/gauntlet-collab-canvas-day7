import { useState } from 'react';
import { useAuth } from './useAuth';
import { CanvasObject } from '../types';
import { getApiUrl } from '../utils/env';

interface AIAgentResponse {
  success: boolean;
  canvas?: {
    id: string;
    title: string;
    objects: CanvasObject[];
  };
  message: string;
  error?: string;
  request_id?: string;
  job_id?: string;
  status?: string;
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
  const { user } = useAuth();
  
  const createCanvas = async (request: AIAgentRequest): Promise<AIAgentResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const API_URL = getApiUrl();
      const token = localStorage.getItem('idToken');
      
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
      
      // New async response format: returns job_id instead of immediate result
      if (data.job_id) {
        return {
          success: true,
          job_id: data.job_id,
          message: data.message || 'Canvas creation job started',
          status: data.status || 'queued'
        };
      }
      
      // Fallback for old format (if any)
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  const getJobStatus = async (jobId: string): Promise<any> => {
    try {
      const API_URL = getApiUrl();
      const token = localStorage.getItem('idToken');
      
      const response = await fetch(`${API_URL}/api/ai-agent/job/${jobId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status');
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  };

  const getJobResult = async (jobId: string): Promise<any> => {
    try {
      const API_URL = getApiUrl();
      const token = localStorage.getItem('idToken');
      
      const response = await fetch(`${API_URL}/api/ai-agent/job/${jobId}/result`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job result');
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  };

  const clearError = () => setError(null);
  
  return {
    createCanvas,
    getJobStatus,
    getJobResult,
    isLoading,
    error,
    clearError,
    isAuthenticated: !!user
  };
};
