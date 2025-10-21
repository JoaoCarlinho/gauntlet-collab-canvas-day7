/**
 * Enhanced Object Creation Service with Advanced Reliability and Error Handling
 */

import { enhancedSocketService } from './enhancedSocketService'
import { objectsAPI } from './api'
import { authService } from './authService'
import { retryWithBackoff, RETRY_PRESETS } from '../utils/retryLogic'
import { CanvasObject } from '../types'

export interface EnhancedCreationResult {
  success: boolean
  method: 'socket' | 'rest' | 'failed'
  error?: any
  object?: CanvasObject
  attempts: number
  totalTime: number
  confirmationStatus: 'confirmed' | 'pending' | 'failed'
  retryable: boolean
  errorType: 'validation' | 'network' | 'auth' | 'server' | 'timeout' | 'unknown'
}

export interface EnhancedCreationOptions {
  retryOptions?: any
  onProgress?: (attempt: number, method: string, status: string) => void
  fallbackToRest?: boolean
  requireConfirmation?: boolean
  timeout?: number
  maxRetries?: number
}

export interface ObjectValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

class EnhancedObjectCreationService {
  private pendingCreations = new Map<string, Promise<EnhancedCreationResult>>()
  private creationMetrics = {
    totalCreations: 0,
    successfulCreations: 0,
    failedCreations: 0,
    socketCreations: 0,
    restCreations: 0,
    averageCreationTime: 0
  }

  /**
   * Enhanced authentication context validation
   */
  private async validateAuthContext(
    canvasId: string, 
    idToken: string, 
    object: { type: string; properties: Record<string, any> }
  ): Promise<void> {
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'
    
    // Validate canvas ID
    if (!canvasId || canvasId.trim() === '') {
      throw new Error('Canvas ID is required and cannot be empty')
    }
    
    // Validate token
    if (!isDev) {
      if (!idToken || idToken.trim() === '') {
        throw new Error('Authentication token is required')
      }
      
      // Validate token format
      const tokenValidation = await authService.validateAndRefreshToken()
      if (!tokenValidation.isValid) {
        throw new Error(`Invalid authentication token: ${tokenValidation.error}`)
      }
    }
    
    // Validate object data
    if (!object) {
      throw new Error('Object data is required')
    }
    
    const objectType = object.type || (object as any).object_type
    if (!objectType) {
      throw new Error('Object type is required')
    }
    
    // Validate object type
    const validTypes = ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
    if (!validTypes.includes(objectType)) {
      throw new Error(`Invalid object type: ${objectType}. Valid types: ${validTypes.join(', ')}`)
    }
    
    // Validate properties
    const objectProperties = object.properties || object
    if (!objectProperties || typeof objectProperties !== 'object') {
      throw new Error('Object properties must be a valid object')
    }
  }

  /**
   * Enhanced object data validation
   */
  private validateObjectData(object: { type: string; properties: Record<string, any> }): ObjectValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    const objectType = object.type || (object as any).object_type
    const properties = object.properties || (object as any)
    
    // Validate required properties based on object type
    switch (objectType) {
      case 'rectangle':
      case 'circle':
      case 'heart':
      case 'star':
      case 'diamond':
        if (typeof properties.x !== 'number' || typeof properties.y !== 'number') {
          errors.push('Position (x, y) is required and must be numbers')
        }
        if (typeof properties.width !== 'number' || typeof properties.height !== 'number') {
          errors.push('Size (width, height) is required and must be numbers')
        }
        if (properties.width <= 0 || properties.height <= 0) {
          errors.push('Width and height must be positive numbers')
        }
        break
        
      case 'text':
        if (typeof properties.x !== 'number' || typeof properties.y !== 'number') {
          errors.push('Position (x, y) is required and must be numbers')
        }
        if (!properties.text || typeof properties.text !== 'string') {
          errors.push('Text content is required')
        }
        if (properties.text.length > 1000) {
          warnings.push('Text content is very long and may affect performance')
        }
        break
        
      case 'line':
      case 'arrow':
        if (!Array.isArray(properties.points) || properties.points.length < 4) {
          errors.push('Line/arrow requires points array with at least 4 values [x1, y1, x2, y2]')
        }
        break
    }
    
    // Validate common properties
    if (properties.x !== undefined && (properties.x < -10000 || properties.x > 10000)) {
      warnings.push('X position is very far from origin')
    }
    if (properties.y !== undefined && (properties.y < -10000 || properties.y > 10000)) {
      warnings.push('Y position is very far from origin')
    }
    if (properties.width !== undefined && properties.width > 5000) {
      warnings.push('Width is very large and may affect performance')
    }
    if (properties.height !== undefined && properties.height > 5000) {
      warnings.push('Height is very large and may affect performance')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Enhanced object creation with comprehensive error handling
   */
  public async createObject(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: EnhancedCreationOptions = {}
  ): Promise<EnhancedCreationResult> {
    const startTime = Date.now()
    const creationId = `${canvasId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Check if creation is already in progress
    if (this.pendingCreations.has(creationId)) {
      return this.pendingCreations.get(creationId)!
    }

    this.creationMetrics.totalCreations++

    const creationPromise = this.performCreation(canvasId, idToken, object, options, creationId, startTime)
    this.pendingCreations.set(creationId, creationPromise)

    try {
      const result = await creationPromise
      return result
    } finally {
      this.pendingCreations.delete(creationId)
    }
  }

  /**
   * Perform object creation with retry logic
   */
  private async performCreation(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: EnhancedCreationOptions,
    creationId: string,
    startTime: number
  ): Promise<EnhancedCreationResult> {
    const requireConfirmation = options.requireConfirmation !== false

    try {
      // Validate authentication and object data
      await this.validateAuthContext(canvasId, idToken, object)
      
      const validation = this.validateObjectData(object)
      if (!validation.isValid) {
        return {
          success: false,
          method: 'failed',
          error: validation.errors.join('; '),
          attempts: 1,
          totalTime: Date.now() - startTime,
          confirmationStatus: 'failed',
          retryable: false,
          errorType: 'validation'
        }
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Object creation warnings:', validation.warnings)
      }

      // Try socket creation first, then REST API fallback
      let result: EnhancedCreationResult

      try {
        result = await this.trySocketCreation(canvasId, idToken, object, options, creationId, startTime)
      } catch (socketError) {
        console.warn('Socket creation failed, trying REST API:', socketError)
        result = await this.tryRestCreation(canvasId, object, options)
      }

      // Confirm creation if required
      if (result.success && requireConfirmation && result.object) {
        const confirmed = await this.confirmObjectCreation(canvasId, result.object.id)
        result.confirmationStatus = confirmed ? 'confirmed' : 'failed'
        
        if (!confirmed) {
          result.success = false
          result.error = 'Object creation confirmation failed'
          result.errorType = 'server'
        }
      }

      // Update metrics
      if (result.success) {
        this.creationMetrics.successfulCreations++
        if (result.method === 'socket') {
          this.creationMetrics.socketCreations++
        } else if (result.method === 'rest') {
          this.creationMetrics.restCreations++
        }
      } else {
        this.creationMetrics.failedCreations++
      }

      return result

    } catch (error) {
      console.error('Object creation failed:', error)
      
      const errorType = this.classifyError(error)
      const retryable = this.isRetryableError(error)
      
      this.creationMetrics.failedCreations++

      return {
        success: false,
        method: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: 1,
        totalTime: Date.now() - startTime,
        confirmationStatus: 'failed',
        retryable,
        errorType
      }
    }
  }

  /**
   * Try socket creation with enhanced error handling
   */
  private async trySocketCreation(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: EnhancedCreationOptions,
    creationId: string,
    startTime: number
  ): Promise<EnhancedCreationResult> {
    const timeout = options.timeout || 15000
    
    return new Promise((resolve, reject) => {
      if (!enhancedSocketService.isConnected()) {
        reject(new Error('Socket not connected'))
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Socket creation timeout'))
      }, timeout)

      const onSuccess = (data: { object: CanvasObject }) => {
        clearTimeout(timeoutId)
        enhancedSocketService.off('object_created', onSuccess)
        enhancedSocketService.off('object_create_failed', onFailure)
        enhancedSocketService.off('socket_error', onError)
        
        resolve({
          success: true,
          method: 'socket',
          object: data.object,
          attempts: 1,
          totalTime: Date.now() - startTime,
          confirmationStatus: 'pending',
          retryable: false,
          errorType: 'unknown'
        })
      }

      const onFailure = (data: { message: string; type?: string }) => {
        clearTimeout(timeoutId)
        enhancedSocketService.off('object_created', onSuccess)
        enhancedSocketService.off('object_create_failed', onFailure)
        enhancedSocketService.off('socket_error', onError)
        
        const error = new Error(data.message || 'Socket creation failed')
        reject(error)
      }

      const onError = (data: any) => {
        clearTimeout(timeoutId)
        enhancedSocketService.off('object_created', onSuccess)
        enhancedSocketService.off('object_create_failed', onFailure)
        enhancedSocketService.off('socket_error', onError)
        
        const error = new Error(data?.error?.message || data?.details?.message || 'Socket error during creation')
        reject(error)
      }

      // Set up listeners
      enhancedSocketService.on('object_created', onSuccess)
      enhancedSocketService.on('object_create_failed', onFailure)
      enhancedSocketService.on('socket_error', onError)

      // Send creation request
      enhancedSocketService.emit('object_created', {
        canvas_id: canvasId,
        id_token: idToken,
        object,
        creation_id: creationId
      })
    })
  }

  /**
   * Try REST API creation with enhanced error handling
   */
  private async tryRestCreation(
    canvasId: string,
    object: { type: string; properties: Record<string, any> },
    options: EnhancedCreationOptions
  ): Promise<EnhancedCreationResult> {
    const retryOptions = options.retryOptions || RETRY_PRESETS.STANDARD
    
    const result = await retryWithBackoff(async () => {
      const response = await objectsAPI.createObject({
        canvas_id: canvasId,
        object_type: object.type || (object as any).object_type,
        properties: object.properties || object
      })

      return response
    }, retryOptions)

    if (result.success && result.data) {
      return {
        success: true,
        method: 'rest',
        object: result.data.object,
        attempts: result.attempts,
        totalTime: result.totalTime,
        confirmationStatus: 'confirmed',
        retryable: false,
        errorType: 'unknown'
      }
    } else {
      return {
        success: false,
        method: 'failed',
        error: result.error,
        attempts: result.attempts,
        totalTime: result.totalTime,
        confirmationStatus: 'failed',
        retryable: true,
        errorType: 'network'
      }
    }
  }

  /**
   * Confirm object creation by verifying it exists on the server
   */
  private async confirmObjectCreation(canvasId: string, objectId: string): Promise<boolean> {
    try {
      console.log(`Confirming object creation: ${objectId} on canvas: ${canvasId}`)
      
      // Wait a moment for the object to be persisted
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const response = await objectsAPI.getObject(objectId)
      const objectExists = response.object && response.object.id === objectId
      
      console.log(`Object creation confirmation: ${objectExists ? 'SUCCESS' : 'FAILED'} for ${objectId}`)
      return objectExists
    } catch (error) {
      console.error('Object creation confirmation failed:', error)
      return false
    }
  }

  /**
   * Classify error type for better handling
   */
  private classifyError(error: any): 'validation' | 'network' | 'auth' | 'server' | 'timeout' | 'unknown' {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      if (message.includes('validation') || message.includes('invalid')) {
        return 'validation'
      }
      if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
        return 'network'
      }
      if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
        return 'auth'
      }
      if (message.includes('server') || message.includes('500') || message.includes('internal')) {
        return 'server'
      }
      if (message.includes('timeout')) {
        return 'timeout'
      }
    }
    
    return 'unknown'
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorType = this.classifyError(error)
    
    switch (errorType) {
      case 'network':
      case 'timeout':
      case 'server':
        return true
      case 'validation':
      case 'auth':
        return false
      default:
        return true
    }
  }

  /**
   * Get creation metrics
   */
  public getCreationMetrics() {
    return { ...this.creationMetrics }
  }

  /**
   * Reset metrics
   */
  public resetMetrics() {
    this.creationMetrics = {
      totalCreations: 0,
      successfulCreations: 0,
      failedCreations: 0,
      socketCreations: 0,
      restCreations: 0,
      averageCreationTime: 0
    }
  }

  /**
   * Get pending creations count
   */
  public getPendingCreationsCount(): number {
    return this.pendingCreations.size
  }

  /**
   * Cancel all pending creations
   */
  public cancelAllPendingCreations(): void {
    this.pendingCreations.clear()
  }
}

// Export singleton instance
export const enhancedObjectCreationService = new EnhancedObjectCreationService()

// Export service
export { EnhancedObjectCreationService }
