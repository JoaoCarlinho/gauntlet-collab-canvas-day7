import axios from 'axios'
import { User, Canvas, CanvasObject, Invitation } from '../types'
import { getApiUrl } from '../utils/env'
import { authService } from './authService'
import { apiCircuitBreaker, authenticationCircuitBreaker } from './circuitBreakerService'
import { recordApiError, recordAuthError } from './errorRateMonitor'

const API_URL = getApiUrl()

console.log('API Service initialized with URL:', API_URL)
console.log('Full baseURL will be:', `${API_URL}/api`)

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
})

// Enhanced auth token interceptor with automatic refresh
api.interceptors.request.use(async (config) => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV || 
                       import.meta.env.VITE_DEBUG_MODE === 'true' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1'
  
  // Skip authentication in development mode
  if (!isDevelopment) {
    try {
      // Get valid token with automatic refresh
      const token = await authService.getValidToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      } else {
        console.warn('No valid token available for API request')
      }
    } catch (error) {
      console.error('Failed to get valid token for API request:', error)
      // Continue without token - let the server handle the auth error
    }
  } else {
    console.log('Development mode: Skipping authentication for API request')
  }
  
  const fullUrl = (config.baseURL || '') + (config.url || '')
  console.log('Making API request to:', fullUrl)
  console.log('Request config:', {
    baseURL: config.baseURL,
    url: config.url,
    method: config.method,
    headers: config.headers
  })
  
  return config
})

// Enhanced response interceptor with authentication error handling, circuit breaker, and exponential backoff
api.interceptors.response.use(
  (response) => {
    console.log('API response received:', response.status, response.config.url)
    return response
  },
  async (error) => {
    // Filter out non-critical errors from browser extensions or third-party services
    const url = error.config?.url || ''
    const isExternalError = url.includes('/jwt') || url.includes('chrome-extension') || url.includes('moz-extension')
    
    if (!isExternalError) {
      console.error('API request failed:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      })
      
      // Add retry count to config if not present
      error.config.retryCount = error.config.retryCount || 0
      const maxRetries = 3
      
      // Handle 404 errors - don't retry, resource doesn't exist
      if (error.response?.status === 404) {
        console.warn('Resource not found (404):', error.config?.url)
        recordApiError(`404 Not Found: ${error.config?.url}`, error.config?.url)

        // Check if it's a canvas not found error
        const errorData = error.response?.data
        if (errorData?.error_type === 'canvas_not_found' || errorData?.error === 'Canvas not found') {
          console.error('Canvas not found - redirecting to dashboard')
          // Emit custom event for canvas not found so CanvasPage can handle it
          window.dispatchEvent(new CustomEvent('canvas-not-found', {
            detail: {
              canvasId: errorData.canvas_id,
              message: errorData.message || 'Canvas not found or has been deleted'
            }
          }))
        }

        // Don't retry 404 errors - resource doesn't exist
        return Promise.reject(error)
      }
      // Handle authentication errors with circuit breaker protection
      else if (error.response?.status === 401) {
        console.warn('Authentication error - attempting token refresh')
        recordAuthError(`401 Unauthorized: ${error.config?.url}`, error.config?.url)

        // Don't retry on auth errors if we've already tried too many times
        if (error.config.retryCount >= maxRetries) {
          console.error('Max retry attempts reached for authentication')
          authService.clearAuth()
          return Promise.reject(error)
        }

        try {
          // Use authentication circuit breaker for token refresh (not API circuit breaker)
          await authenticationCircuitBreaker.execute(async () => {
            await authService.forceTokenRefresh()
            // Retry the original request with new token
            const newToken = await authService.getValidToken()
            if (newToken && error.config) {
              error.config.headers.Authorization = `Bearer ${newToken}`
              error.config.retryCount = (error.config.retryCount || 0) + 1
              // Reset API circuit breaker on successful token refresh
              apiCircuitBreaker.reset()
              return api.request(error.config)
            }
          })
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          recordAuthError(`Token refresh failed: ${refreshError}`, error.config?.url)
          // Clear auth state if refresh fails
          authService.clearAuth()
        }
      } 
      // Handle server errors with exponential backoff
      else if (error.response?.status >= 500 && error.config.retryCount < maxRetries) {
        console.warn(`Server error ${error.response.status} - attempting retry ${error.config.retryCount + 1}/${maxRetries}`)
        recordApiError(`Server Error ${error.response.status}: ${error.message}`, error.config?.url)
        
        // Calculate exponential backoff delay with jitter
        const baseDelay = 1000 // 1 second
        const retryCount = error.config.retryCount
        const delay = Math.min(
          baseDelay * Math.pow(2, retryCount) + Math.random() * 1000, // Add jitter
          10000 // Max 10 seconds
        )
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // Increment retry count and retry
        error.config.retryCount = retryCount + 1
        return api.request(error.config)
      }
      // Handle rate limiting with longer backoff
      else if (error.response?.status === 429 && error.config.retryCount < maxRetries) {
        console.warn('Rate limited - waiting before retry')
        recordApiError(`Rate Limited: ${error.message}`, error.config?.url)
        
        // Wait longer for rate limiting (5-15 seconds)
        const delay = 5000 + Math.random() * 10000
        await new Promise(resolve => setTimeout(resolve, delay))
        
        error.config.retryCount = (error.config.retryCount || 0) + 1
        return api.request(error.config)
      }
      // Handle network errors with retry
      else if (!error.response && error.config.retryCount < maxRetries) {
        console.warn('Network error - attempting retry')
        recordApiError(`Network Error: ${error.message}`, error.config?.url)
        
        // Shorter delay for network errors
        const delay = 1000 + Math.random() * 2000
        await new Promise(resolve => setTimeout(resolve, delay))
        
        error.config.retryCount = (error.config.retryCount || 0) + 1
        return api.request(error.config)
      }
      else {
        // Record other API errors
        recordApiError(`API Error ${error.response?.status}: ${error.message}`, error.config?.url)
      }
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        console.error('404 Error - Check if API URL is correct:', API_URL)
      }
    } else {
      // Log external errors at debug level only
      console.debug('External service error (ignored):', url, error.response?.status)
    }
    
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: async (idToken: string) => {
    const response = await api.post('/auth/register', { idToken })
    return response.data
  },
  
  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me')
    return response.data
  },
  
  verifyToken: async (idToken: string) => {
    const response = await api.post('/auth/verify', { idToken })
    return response.data
  },
}

// Canvas API
export const canvasAPI = {
  getCanvases: async (): Promise<{ canvases: Canvas[] }> => {
    const response = await api.get('/canvas')
    return response.data
  },
  
  createCanvas: async (data: { title: string; description?: string; is_public?: boolean }): Promise<{ canvas: Canvas }> => {
    const response = await api.post('/canvas', data)
    return response.data
  },
  
  getCanvas: async (canvasId: string): Promise<{ canvas: Canvas }> => {
    const response = await api.get(`/canvas/${canvasId}`)
    return response.data
  },
  
  updateCanvas: async (canvasId: string, data: Partial<Canvas>): Promise<{ canvas: Canvas }> => {
    const response = await api.put(`/canvas/${canvasId}`, data)
    return response.data
  },
  
  deleteCanvas: async (canvasId: string): Promise<void> => {
    await api.delete(`/canvas/${canvasId}`)
  },
  
  getCanvasObjects: async (canvasId: string): Promise<{ objects: CanvasObject[] }> => {
    if (!canvasId || canvasId.trim() === '') {
      throw new Error('Canvas ID is required and cannot be empty')
    }
    console.log('Getting canvas objects for canvasId:', canvasId)
    const response = await api.get(`/canvas/${canvasId}/objects`)
    return response.data
  },

  // Z-index management methods (convenience access)
  updateObjectZIndex: async (objectId: string, zIndex: number): Promise<{ object: CanvasObject }> => {
    return objectsAPI.updateObjectZIndex(objectId, zIndex)
  },

  bringObjectToFront: async (objectId: string): Promise<{ object: CanvasObject }> => {
    return objectsAPI.bringObjectToFront(objectId)
  },

  sendObjectToBack: async (objectId: string): Promise<{ object: CanvasObject }> => {
    return objectsAPI.sendObjectToBack(objectId)
  },

  moveObjectUp: async (objectId: string): Promise<{ object: CanvasObject }> => {
    return objectsAPI.moveObjectUp(objectId)
  },

  moveObjectDown: async (objectId: string): Promise<{ object: CanvasObject }> => {
    return objectsAPI.moveObjectDown(objectId)
  },

  // Generic POST method for token analysis endpoints
  post: async (path: string, data: any): Promise<any> => {
    const response = await api.post(path, data)
    return response.data
  },
}

// Objects API
export const objectsAPI = {
  createObject: async (data: { canvas_id: string; object_type: string; properties: Record<string, any>; z_index_behavior?: string }): Promise<{ object: CanvasObject }> => {
    const response = await api.post('/objects/', data)
    return response.data
  },
  
  getObject: async (objectId: string): Promise<{ object: CanvasObject }> => {
    const response = await api.get(`/objects/${objectId}`)
    return response.data
  },
  
  updateObject: async (objectId: string, data: { properties: Record<string, any> }): Promise<{ object: CanvasObject }> => {
    const response = await api.put(`/objects/${objectId}`, data)
    return response.data
  },
  
  deleteObject: async (objectId: string): Promise<void> => {
    await api.delete(`/objects/${objectId}`)
  },

  // Z-index management methods
  updateObjectZIndex: async (objectId: string, zIndex: number): Promise<{ object: CanvasObject }> => {
    const response = await api.put(`/objects/${objectId}/z-index`, { z_index: zIndex })
    return response.data
  },

  bringObjectToFront: async (objectId: string): Promise<{ object: CanvasObject }> => {
    const response = await api.post(`/objects/${objectId}/bring-to-front`)
    return response.data
  },

  sendObjectToBack: async (objectId: string): Promise<{ object: CanvasObject }> => {
    const response = await api.post(`/objects/${objectId}/send-to-back`)
    return response.data
  },

  moveObjectUp: async (objectId: string): Promise<{ object: CanvasObject }> => {
    const response = await api.post(`/objects/${objectId}/move-up`)
    return response.data
  },

  moveObjectDown: async (objectId: string): Promise<{ object: CanvasObject }> => {
    const response = await api.post(`/objects/${objectId}/move-down`)
    return response.data
  },
}

// Collaboration API
export const collaborationAPI = {
  inviteUser: async (data: { canvas_id: string; invitee_email: string; permission_type: 'view' | 'edit' }): Promise<{ invitation: Invitation }> => {
    const response = await api.post('/collaboration/invite', data)
    return response.data
  },
  
  getInvitations: async (): Promise<{ invitations: Invitation[] }> => {
    const response = await api.get('/collaboration/invitations')
    return response.data
  },
  
  acceptInvitation: async (invitationId: string): Promise<{ permission: any }> => {
    const response = await api.post(`/collaboration/invitations/${invitationId}/accept`)
    return response.data
  },
  
  declineInvitation: async (invitationId: string): Promise<{ invitation: Invitation }> => {
    const response = await api.post(`/collaboration/invitations/${invitationId}/decline`)
    return response.data
  },
  
  getCollaborators: async (canvasId: string): Promise<{ collaborators: any[] }> => {
    const response = await api.get(`/collaboration/canvas/${canvasId}/collaborators`)
    return response.data
  },
  
  updateCollaboratorPermission: async (canvasId: string, userId: string, permissionType: 'view' | 'edit'): Promise<{ permission: any }> => {
    const response = await api.put(`/collaboration/canvas/${canvasId}/collaborators/${userId}`, { permission_type: permissionType })
    return response.data
  },
  
  removeCollaborator: async (canvasId: string, userId: string): Promise<void> => {
    await api.delete(`/collaboration/canvas/${canvasId}/collaborators/${userId}`)
  },
  
  getCanvasInvitations: async (canvasId: string): Promise<{ invitations: Invitation[] }> => {
    const response = await api.get(`/collaboration/canvas/${canvasId}/invitations`)
    return response.data
  },
  
  resendInvitation: async (invitationId: string): Promise<{ invitation: Invitation }> => {
    const response = await api.post(`/collaboration/invitations/${invitationId}/resend`)
    return response.data
  },
}
