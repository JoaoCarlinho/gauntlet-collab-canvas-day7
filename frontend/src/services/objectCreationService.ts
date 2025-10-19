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
   * Create object with socket fallback to REST API
   */
  async createObject(
    canvasId: string,
    idToken: string,
    object: { type: string; properties: Record<string, any> },
    options: CreationOptions = {}
  ): Promise<CreationResult> {
    const creationKey = `${canvasId}_${object.type}_${Date.now()}`
    
    // Prevent duplicate creations
    if (this.pendingCreations.has(creationKey)) {
      return this.pendingCreations.get(creationKey)!
    }

    const creationPromise = this.performCreation(
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

        // Listen for failure
        const onFailure = (data: { error: any }) => {
          clearTimeout(timeout)
          socketService.off('object_created', onSuccess)
          socketService.off('object_creation_failed', onFailure)
          reject(new Error(data.error?.message || 'Socket creation failed'))
        }

        // Set up listeners
        socketService.on('object_created', onSuccess)
        socketService.on('object_creation_failed', onFailure)

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
