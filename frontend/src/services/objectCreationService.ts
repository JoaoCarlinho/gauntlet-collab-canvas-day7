/**
 * Object Creation Service with Socket.IO and HTTP API fallback
 */

import { socketService } from './socket'
import { objectsAPI } from './api'
import { retryWithBackoff, RETRY_PRESETS } from '../utils/retryLogic'
import { errorLogger } from '../utils/errorLogger'
import { CanvasObject } from '../types'

export interface CreationResult {
  success: boolean
  method: 'socket' | 'rest' | 'failed'
  error?: any
  object?: CanvasObject
  attempts: number
  totalTime: number
}

export interface CreationOptions {
  retryOptions?: any
  onProgress?: (attempt: number, method: string) => void
  fallbackToRest?: boolean
}

class ObjectCreationService {
  private pendingCreations = new Map<string, Promise<CreationResult>>()

  /**
   * Enhanced authentication context validation
   */
  private validateAuthContext(
    canvasId: string, 
    idToken: string, 
    object: { type: string; properties: Record<string, any> }
  ): void {
    if (!canvasId || !idToken) {
      throw new Error('Missing authentication context: canvasId or idToken')
    }
    
    // Additional validation
    if (canvasId.length < 10) {
      throw new Error('Invalid canvas ID format')
    }
    
    if (idToken.length < 100) {
      throw new Error('Invalid authentication token format')
    }
    
    if (!object || !object.type) {
      throw new Error('Invalid object data: missing type')
    }
    
    // Validate object type
    const validTypes = ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
    if (!validTypes.includes(object.type)) {
      throw new Error(`Invalid object type: ${object.type}`)
    }
    
    // Validate properties
    if (!object.properties || typeof object.properties !== 'object') {
      throw new Error('Invalid object properties')
    }
  }

  /**
   * Confirm object creation by verifying it exists on the server
   */
  private async confirmObjectCreation(canvasId: string, objectId: string): Promise<boolean> {
    try {
      console.log(`Confirming object creation: ${objectId} on canvas: ${canvasId}`)
      
      // Wait a moment for the object to be persisted
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const response = await objectsAPI.getObject(canvasId, objectId)
      const objectExists = response.data && response.data.id === objectId
      
      console.log(`Object creation confirmation: ${objectExists ? 'SUCCESS' : 'FAILED'} for ${objectId}`)
      return objectExists
    } catch (error) {
      console.error('Object creation confirmation failed:', error)
      return false
    }
  }

  /**
   * Validate object state after creation
   */
  private async validateObjectState(canvasId: string, expectedObjects: number): Promise<boolean> {
    try {
      console.log(`Validating object state: expecting ${expectedObjects} objects on canvas: ${canvasId}`)
      
      // Wait for state to sync
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const response = await objectsAPI.getObjects(canvasId)
      const actualObjects = response.data.length
      const stateValid = actualObjects >= expectedObjects
      
      console.log(`Object state validation: ${stateValid ? 'SUCCESS' : 'FAILED'} (expected: ${expectedObjects}, actual: ${actualObjects})`)
      return stateValid
    } catch (error) {
      console.error('Object state validation failed:', error)
      return false
    }
  }

  /**
   * Enhanced object data validation
   */
  private validateObjectData(object: { type: string; properties: Record<string, any> }): void {
    // Validate object type
    const validTypes = ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
    if (!validTypes.includes(object.type)) {
      throw new Error(`Invalid object type: ${object.type}`)
    }
    
    // Validate properties structure
    if (!object.properties || typeof object.properties !== 'object') {
      throw new Error('Invalid object properties')
    }
    
    // Validate specific property requirements based on object type
    switch (object.type) {
      case 'rectangle':
      case 'circle':
      case 'star':
      case 'diamond':
        if (typeof object.properties.x !== 'number' || typeof object.properties.y !== 'number') {
          throw new Error(`${object.type} requires x and y coordinates`)
        }
        break
      case 'line':
      case 'arrow':
        if (typeof object.properties.x1 !== 'number' || typeof object.properties.y1 !== 'number' ||
            typeof object.properties.x2 !== 'number' || typeof object.properties.y2 !== 'number') {
          throw new Error(`${object.type} requires x1, y1, x2, y2 coordinates`)
        }
        break
      case 'text':
        if (typeof object.properties.text !== 'string') {
          throw new Error('Text object requires text property')
        }
        break
    }
    
    // Validate property values are reasonable
    for (const [key, value] of Object.entries(object.properties)) {
      if (typeof value === 'number') {
        if (isNaN(value) || !isFinite(value)) {
          throw new Error(`Invalid numeric value for property ${key}: ${value}`)
        }
        if (Math.abs(value) > 10000) {
          throw new Error(`Property ${key} value too large: ${value}`)
        }
      }
    }
  }

  /**
   * Create object with socket fallback to REST API
   */
  async createObject(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: CreationOptions = {}
  ): Promise<CreationResult> {
    // Enhanced authentication context validation
    this.validateAuthContext(canvasId, idToken, object)
    
    // Enhanced object data validation
    this.validateObjectData(object)
    
    const creationKey = `${canvasId}_${object.type}_${Date.now()}`
    
    // Prevent duplicate creations
    if (this.pendingCreations.has(creationKey)) {
      return this.pendingCreations.get(creationKey)!
    }

    const creationPromise = this.performCreationWithConfirmation(
      canvasId,
      idToken,
      object,
      options
    )

    this.pendingCreations.set(creationKey, creationPromise)
    
    try {
      const result = await creationPromise
      return result
    } finally {
      this.pendingCreations.delete(creationKey)
    }
  }

  /**
   * Perform creation with confirmation and validation
   */
  private async performCreationWithConfirmation(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: CreationOptions
  ): Promise<CreationResult> {
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      
      try {
        console.log(`Object creation attempt ${attempts}/${maxAttempts} for ${object.type}`)
        
        // Perform the creation
        const result = await this.performCreation(canvasId, idToken, object, options)
        
        if (result.success && result.object) {
          // Confirm object creation
          const confirmed = await this.confirmObjectCreation(canvasId, result.object.id)
          
          if (confirmed) {
            console.log(`Object creation confirmed: ${result.object.id}`)
            return {
              ...result,
              attempts,
              totalTime: Date.now() - startTime
            }
          } else {
            console.warn(`Object creation not confirmed: ${result.object.id}`)
            if (attempts < maxAttempts) {
              console.log('Retrying object creation...')
              continue
            }
          }
        }
        
        return {
          ...result,
          attempts,
          totalTime: Date.now() - startTime
        }
        
      } catch (error) {
        console.error(`Object creation attempt ${attempts} failed:`, error)
        
        if (attempts >= maxAttempts) {
          return {
            success: false,
            method: 'failed',
            error,
            attempts,
            totalTime: Date.now() - startTime
          }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
      }
    }
    
    return {
      success: false,
      method: 'failed',
      error: new Error('Max attempts reached'),
      attempts,
      totalTime: Date.now() - startTime
    }
  }

  /**
   * Perform object creation with fallback logic
   */
  private async performCreation(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: CreationOptions
  ): Promise<CreationResult> {
    const retryOptions = options.retryOptions || RETRY_PRESETS.STANDARD
    const fallbackToRest = options.fallbackToRest !== false // Default to true

    // Try socket first
    const socketResult = await this.trySocketCreation(
      canvasId,
      idToken,
      object,
      retryOptions,
      options.onProgress
    )

    if (socketResult.success) {
      return socketResult
    }

    // If socket fails and fallback is enabled, try REST API
    if (fallbackToRest) {
      console.log('Socket creation failed, falling back to REST API')
      const restResult = await this.tryRestCreation(
        canvasId,
        idToken,
        object,
        retryOptions,
        options.onProgress
      )

      return {
        success: restResult.success,
        method: restResult.success ? 'rest' : 'failed',
        error: restResult.error,
        object: restResult.object,
        attempts: socketResult.attempts + restResult.attempts,
        totalTime: socketResult.totalTime + restResult.totalTime
      }
    }

    return socketResult
  }

  /**
   * Try socket creation with retry logic
   */
  private async trySocketCreation(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    retryOptions: any,
    onProgress?: (attempt: number, method: string) => void
  ): Promise<CreationResult> {
    return retryWithBackoff(async () => {
      // Check if socket is connected
      if (!socketService.isConnected()) {
        throw new Error('Socket not connected')
      }

      onProgress?.(1, 'socket')

      // Create a promise that resolves when the socket creation succeeds or fails
      return new Promise<CanvasObject>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket creation timeout'))
        }, 10000) // 10 second timeout

        // Listen for success
        const onSuccess = (data: { object: CanvasObject }) => {
          clearTimeout(timeout)
          socketService.off('object_created', onSuccess)
          socketService.off('object_creation_failed', onFailure)
          resolve(data.object)
        }

        // Listen for failure (backend emits 'error' events)
        const onFailure = (data: { message: string; type?: string }) => {
          clearTimeout(timeout)
          socketService.off('object_created', onSuccess)
          socketService.off('error', onFailure)
          
          // Classify error type for better handling
          const errorMessage = data.message || 'Socket creation failed'
          const error = new Error(errorMessage)
          
          // Add error classification
          if (errorMessage.includes('User or canvas ID missing')) {
            error.name = 'ValidationError'
          } else if (errorMessage.includes('Authentication') || errorMessage.includes('not authenticated')) {
            error.name = 'AuthenticationError'
          } else if (errorMessage.includes('permission')) {
            error.name = 'PermissionError'
          } else {
            error.name = 'SocketError'
          }
          
          reject(error)
        }

        // Set up listeners
        socketService.on('object_created', onSuccess)
        socketService.on('error', onFailure)

        // Send the creation request
        socketService.createObject(canvasId, idToken, object)
      })
    }, retryOptions).then(result => ({
      success: true,
      method: 'socket' as const,
      object: result.data,
      attempts: result.attempts,
      totalTime: result.totalTime
    })).catch(error => ({
      success: false,
      method: 'socket' as const,
      error,
      attempts: 1,
      totalTime: 0
    }))
  }

  /**
   * Try REST API creation with retry logic
   */
  private async tryRestCreation(
    canvasId: string,
    _idToken: string, // Prefixed with underscore to indicate intentionally unused
    object: { type: string; properties: Record<string, any> },
    retryOptions: any,
    onProgress?: (attempt: number, method: string) => void
  ): Promise<CreationResult> {
    return retryWithBackoff(async () => {
      onProgress?.(1, 'rest')

      const response = await objectsAPI.createObject({
        canvas_id: canvasId,
        object_type: object.type,
        properties: object.properties
      })

      return response.object
    }, retryOptions).then(result => ({
      success: true,
      method: 'rest' as const,
      object: result.data,
      attempts: result.attempts,
      totalTime: result.totalTime
    })).catch(error => {
      // Log the error
      const context = {
        operation: 'object_create' as const,
        timestamp: Date.now(),
        additionalData: {
          canvasId,
          objectType: object.type,
          error: error.message
        }
      }
      errorLogger.logError(error, context)

      return {
        success: false,
        method: 'rest' as const,
        error,
        attempts: 1,
        totalTime: 0
      }
    })
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return true // Always available since we have REST fallback
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { socket: boolean; rest: boolean } {
    return {
      socket: socketService.isConnected(),
      rest: true // REST API is always available
    }
  }
}

export const objectCreationService = new ObjectCreationService()
