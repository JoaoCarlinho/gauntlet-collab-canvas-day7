/**
 * Unified Canvas Service - Handles both Development and Production Modes
 */

import { Canvas, CanvasObject } from '../types'
import { canvasAPI, objectsAPI } from './api'
import { enhancedSocketService } from './enhancedSocketService'
import { authService } from './authService'
import { objectValidationService } from './objectValidationService'
import { errorRecoveryService } from './errorRecoveryService'
// import { errorLogger } from '../utils/errorLogger' // Unused import

export interface UnifiedOperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  method: 'development' | 'production' | 'fallback'
  timestamp: number
}

export interface CanvasOperationOptions {
  retryOnFailure?: boolean
  fallbackToDev?: boolean
  timeout?: number
  validateData?: boolean
}

class UnifiedCanvasService {
  private isDevelopment: boolean
  private mockData: {
    canvases: Canvas[]
    objects: Map<string, CanvasObject[]>
  }

  constructor() {
    this.isDevelopment = this.detectDevelopmentMode()
    this.mockData = {
      canvases: [],
      objects: new Map()
    }
    this.initializeMockData()
  }

  /**
   * Detect if we're in development mode
   */
  private detectDevelopmentMode(): boolean {
    return import.meta.env.DEV || 
           import.meta.env.VITE_DEBUG_MODE === 'true' ||
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1'
  }

  /**
   * Initialize mock data for development mode
   */
  private initializeMockData(): void {
    if (this.isDevelopment) {
      this.mockData.canvases = [
        {
          id: 'dev-canvas-1',
          title: 'Development Canvas 1',
          description: 'A test canvas for development',
          owner_id: 'dev-user',
          is_public: false,
          object_count: 0,
          collaborator_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'dev-canvas-2',
          title: 'Development Canvas 2',
          description: 'Another test canvas',
          owner_id: 'dev-user',
          is_public: true,
          object_count: 3,
          collaborator_count: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Get canvases with unified handling
   */
  public async getCanvases(_options: CanvasOperationOptions = {}): Promise<UnifiedOperationResult<Canvas[]>> {
    // const _startTime = Date.now() // Unused variable
    
    try {
      if (this.isDevelopment) {
        return await this.getCanvasesDevelopment(_options)
      } else {
        return await this.getCanvasesProduction(_options)
      }
    } catch (error) {
      console.error('Failed to get canvases:', error)
      
      // Attempt recovery
      if (_options.retryOnFailure !== false) {
        const recoveryResult = await errorRecoveryService.attemptRecovery(
          error,
          'get_canvases',
          { _options }
        )
        
        if (recoveryResult.success && recoveryResult.recovered) {
          // Retry the operation
          return this.getCanvases({ ..._options, retryOnFailure: false })
        }
      }
      
      // Fallback to development mode if enabled
      if (_options.fallbackToDev && !this.isDevelopment) {
        console.log('Falling back to development mode for getCanvases')
        return await this.getCanvasesDevelopment(_options)
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: this.isDevelopment ? 'development' : 'production',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get canvases in development mode
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getCanvasesDevelopment(__options: CanvasOperationOptions): Promise<UnifiedOperationResult<Canvas[]>> {
    // Simulate network delay
    await this.simulateDelay(300)
    
    return {
      success: true,
      data: [...this.mockData.canvases],
      method: 'development',
      timestamp: Date.now()
    }
  }

  /**
   * Get canvases in production mode
   */
  private async getCanvasesProduction(_options: CanvasOperationOptions): Promise<UnifiedOperationResult<Canvas[]>> {
    const response = await canvasAPI.getCanvases()
    
    return {
      success: true,
      data: response.canvases,
      method: 'production',
      timestamp: Date.now()
    }
  }

  /**
   * Get canvas by ID with unified handling
   */
  public async getCanvas(__canvasId: string, _options: CanvasOperationOptions = {}): Promise<UnifiedOperationResult<Canvas>> {
    try {
      if (this.isDevelopment) {
        return await this.getCanvasDevelopment(__canvasId, _options)
      } else {
        return await this.getCanvasProduction(__canvasId, _options)
      }
    } catch (error) {
      console.error('Failed to get canvas:', error)
      
      // Attempt recovery
      if (_options.retryOnFailure !== false) {
        const recoveryResult = await errorRecoveryService.attemptRecovery(
          error,
          'get_canvas',
          { __canvasId, _options }
        )
        
        if (recoveryResult.success && recoveryResult.recovered) {
          return this.getCanvas(__canvasId, { ..._options, retryOnFailure: false })
        }
      }
      
      // Fallback to development mode if enabled
      if (_options.fallbackToDev && !this.isDevelopment) {
        console.log('Falling back to development mode for getCanvas')
        return await this.getCanvasDevelopment(__canvasId, _options)
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: this.isDevelopment ? 'development' : 'production',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get canvas in development mode
   */
  private async getCanvasDevelopment(__canvasId: string, _options: CanvasOperationOptions): Promise<UnifiedOperationResult<Canvas>> {
    await this.simulateDelay(200)
    
    const canvas = this.mockData.canvases.find(c => c.id === __canvasId)
    if (!canvas) {
      // Create a new mock canvas if not found
      const newCanvas: Canvas = {
        id: __canvasId,
        title: `Development Canvas ${__canvasId}`,
        description: 'A test canvas for development',
        owner_id: 'dev-user',
        is_public: false,
        object_count: 0,
        collaborator_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      this.mockData.canvases.push(newCanvas)
      
      return {
        success: true,
        data: newCanvas,
        method: 'development',
        timestamp: Date.now()
      }
    }
    
    return {
      success: true,
      data: canvas,
      method: 'development',
      timestamp: Date.now()
    }
  }

  /**
   * Get canvas in production mode
   */
  private async getCanvasProduction(__canvasId: string, _options: CanvasOperationOptions): Promise<UnifiedOperationResult<Canvas>> {
    const response = await canvasAPI.getCanvas(__canvasId)
    
    return {
      success: true,
      data: response.canvas,
      method: 'production',
      timestamp: Date.now()
    }
  }

  /**
   * Get canvas objects with unified handling
   */
  public async getCanvasObjects(__canvasId: string, _options: CanvasOperationOptions = {}): Promise<UnifiedOperationResult<CanvasObject[]>> {
    try {
      if (this.isDevelopment) {
        return await this.getCanvasObjectsDevelopment(__canvasId, _options)
      } else {
        return await this.getCanvasObjectsProduction(__canvasId, _options)
      }
    } catch (error) {
      console.error('Failed to get canvas objects:', error)
      
      // Attempt recovery
      if (_options.retryOnFailure !== false) {
        const recoveryResult = await errorRecoveryService.attemptRecovery(
          error,
          'get_canvas_objects',
          { __canvasId, _options }
        )
        
        if (recoveryResult.success && recoveryResult.recovered) {
          return this.getCanvasObjects(__canvasId, { ..._options, retryOnFailure: false })
        }
      }
      
      // Fallback to development mode if enabled
      if (_options.fallbackToDev && !this.isDevelopment) {
        console.log('Falling back to development mode for getCanvasObjects')
        return await this.getCanvasObjectsDevelopment(__canvasId, _options)
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: this.isDevelopment ? 'development' : 'production',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get canvas objects in development mode
   */
  private async getCanvasObjectsDevelopment(__canvasId: string, _options: CanvasOperationOptions): Promise<UnifiedOperationResult<CanvasObject[]>> {
    await this.simulateDelay(150)
    
    let objects = this.mockData.objects.get(__canvasId) || []
    
    // If no objects exist, create some mock objects
    if (objects.length === 0) {
      objects = this.createMockObjects(__canvasId)
      this.mockData.objects.set(__canvasId, objects)
    }
    
    return {
      success: true,
      data: [...objects],
      method: 'development',
      timestamp: Date.now()
    }
  }

  /**
   * Get canvas objects in production mode
   */
  private async getCanvasObjectsProduction(__canvasId: string, _options: CanvasOperationOptions): Promise<UnifiedOperationResult<CanvasObject[]>> {
    const response = await canvasAPI.getCanvasObjects(__canvasId)
    
    return {
      success: true,
      data: response.objects,
      method: 'production',
      timestamp: Date.now()
    }
  }

  /**
   * Create object with unified handling
   */
  public async createObject(
    __canvasId: string,
    object: { type: string; properties: Record<string, any> },
    _options: CanvasOperationOptions = {}
  ): Promise<UnifiedOperationResult<CanvasObject>> {
    try {
      // Validate object data if requested
      if (_options.validateData !== false) {
        const validation = objectValidationService.validateObject(object)
        if (!validation.isValid) {
          return {
            success: false,
            error: validation.errors.map(e => e.message).join('; '),
            method: this.isDevelopment ? 'development' : 'production',
            timestamp: Date.now()
          }
        }
      }

      if (this.isDevelopment) {
        return await this.createObjectDevelopment(__canvasId, object, _options)
      } else {
        return await this.createObjectProduction(__canvasId, object, _options)
      }
    } catch (error) {
      console.error('Failed to create object:', error)
      
      // Attempt recovery
      if (_options.retryOnFailure !== false) {
        const recoveryResult = await errorRecoveryService.attemptRecovery(
          error,
          'create_object',
          { __canvasId, object, _options }
        )
        
        if (recoveryResult.success && recoveryResult.recovered) {
          return this.createObject(__canvasId, object, { ..._options, retryOnFailure: false })
        }
      }
      
      // Fallback to development mode if enabled
      if (_options.fallbackToDev && !this.isDevelopment) {
        console.log('Falling back to development mode for createObject')
        return await this.createObjectDevelopment(__canvasId, object, _options)
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: this.isDevelopment ? 'development' : 'production',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Create object in development mode
   */
  private async createObjectDevelopment(
    __canvasId: string,
    object: { type: string; properties: Record<string, any> },
    _options: CanvasOperationOptions
  ): Promise<UnifiedOperationResult<CanvasObject>> {
    await this.simulateDelay(100)
    
    const newObject: CanvasObject = {
      id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      canvas_id: __canvasId,
      object_type: object.type as 'text' | 'rectangle' | 'circle' | 'heart' | 'star' | 'diamond' | 'line' | 'arrow',
      properties: object.properties as any,
      z_index: 1,
      created_by: 'dev-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Add to mock data
    const objects = this.mockData.objects.get(__canvasId) || []
    objects.push(newObject)
    this.mockData.objects.set(__canvasId, objects)
    
    // Update canvas object count
    const canvas = this.mockData.canvases.find(c => c.id === __canvasId)
    if (canvas) {
      canvas.object_count = objects.length
      canvas.updated_at = new Date().toISOString()
    }
    
    return {
      success: true,
      data: newObject,
      method: 'development',
      timestamp: Date.now()
    }
  }

  /**
   * Create object in production mode
   */
  private async createObjectProduction(
    __canvasId: string,
    object: { type: string; properties: Record<string, any> },
    _options: CanvasOperationOptions
  ): Promise<UnifiedOperationResult<CanvasObject>> {
    // Try socket first, then REST API
    if (enhancedSocketService.isConnected()) {
      try {
        const token = await authService.getValidToken()
        if (token) {
          // Use socket service for real-time updates
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket creation timeout'))
            }, _options.timeout || 10000)

            const onSuccess = (data: { object: CanvasObject }) => {
              clearTimeout(timeout)
              enhancedSocketService.off('object_created', onSuccess)
              enhancedSocketService.off('object_create_failed', onFailure)
              
              resolve({
                success: true,
                data: data.object,
                method: 'production',
                timestamp: Date.now()
              })
            }

            const onFailure = (data: { message: string }) => {
              clearTimeout(timeout)
              enhancedSocketService.off('object_created', onSuccess)
              enhancedSocketService.off('object_create_failed', onFailure)
              reject(new Error(data.message))
            }

            enhancedSocketService.on('object_created', onSuccess)
            enhancedSocketService.on('object_create_failed', onFailure)
            enhancedSocketService.emit('object_created', {
              canvas_id: __canvasId,
              id_token: token,
              object
            })
          })
        }
      } catch (socketError) {
        console.warn('Socket creation failed, falling back to REST API:', socketError)
      }
    }

    // Fallback to REST API
    const response = await objectsAPI.createObject({
      canvas_id: __canvasId,
      object_type: object.type,
      properties: object.properties
    })
    
    return {
      success: true,
      data: response.object,
      method: 'production',
      timestamp: Date.now()
    }
  }

  /**
   * Update object with unified handling
   */
  public async updateObject(
    objectId: string,
    properties: Record<string, any>,
    _options: CanvasOperationOptions = {}
  ): Promise<UnifiedOperationResult<CanvasObject>> {
    try {
      if (this.isDevelopment) {
        return await this.updateObjectDevelopment(objectId, properties, _options)
      } else {
        return await this.updateObjectProduction(objectId, properties, _options)
      }
    } catch (error) {
      console.error('Failed to update object:', error)
      
      // Attempt recovery
      if (_options.retryOnFailure !== false) {
        const recoveryResult = await errorRecoveryService.attemptRecovery(
          error,
          'update_object',
          { objectId, properties, _options }
        )
        
        if (recoveryResult.success && recoveryResult.recovered) {
          return this.updateObject(objectId, properties, { ..._options, retryOnFailure: false })
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: this.isDevelopment ? 'development' : 'production',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Update object in development mode
   */
  private async updateObjectDevelopment(
    objectId: string,
    properties: Record<string, any>,
    _options: CanvasOperationOptions
  ): Promise<UnifiedOperationResult<CanvasObject>> {
    await this.simulateDelay(50)
    
    // Find and update object in mock data
    for (const [__canvasId, objects] of this.mockData.objects.entries()) {
      const objectIndex = objects.findIndex(obj => obj.id === objectId)
      if (objectIndex !== -1) {
        objects[objectIndex] = {
          ...objects[objectIndex],
          properties: { ...objects[objectIndex].properties, ...properties },
          updated_at: new Date().toISOString()
        }
        
        return {
          success: true,
          data: objects[objectIndex],
          method: 'development',
          timestamp: Date.now()
        }
      }
    }
    
    throw new Error('Object not found')
  }

  /**
   * Update object in production mode
   */
  private async updateObjectProduction(
    objectId: string,
    properties: Record<string, any>,
    _options: CanvasOperationOptions
  ): Promise<UnifiedOperationResult<CanvasObject>> {
    const response = await objectsAPI.updateObject(objectId, { properties })
    
    return {
      success: true,
      data: response.object,
      method: 'production',
      timestamp: Date.now()
    }
  }

  /**
   * Delete object with unified handling
   */
  public async deleteObject(objectId: string, _options: CanvasOperationOptions = {}): Promise<UnifiedOperationResult<void>> {
    try {
      if (this.isDevelopment) {
        return await this.deleteObjectDevelopment(objectId, _options)
      } else {
        return await this.deleteObjectProduction(objectId, _options)
      }
    } catch (error) {
      console.error('Failed to delete object:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method: this.isDevelopment ? 'development' : 'production',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Delete object in development mode
   */
  private async deleteObjectDevelopment(objectId: string, _options: CanvasOperationOptions): Promise<UnifiedOperationResult<void>> {
    await this.simulateDelay(50)
    
    // Find and remove object from mock data
    for (const [__canvasId, objects] of this.mockData.objects.entries()) {
      const objectIndex = objects.findIndex(obj => obj.id === objectId)
      if (objectIndex !== -1) {
        objects.splice(objectIndex, 1)
        
        // Update canvas object count
        const canvas = this.mockData.canvases.find(c => c.id === __canvasId)
        if (canvas) {
          canvas.object_count = objects.length
          canvas.updated_at = new Date().toISOString()
        }
        
        return {
          success: true,
          method: 'development',
          timestamp: Date.now()
        }
      }
    }
    
    throw new Error('Object not found')
  }

  /**
   * Delete object in production mode
   */
  private async deleteObjectProduction(objectId: string, _options: CanvasOperationOptions): Promise<UnifiedOperationResult<void>> {
    await objectsAPI.deleteObject(objectId)
    
    return {
      success: true,
      method: 'production',
      timestamp: Date.now()
    }
  }

  /**
   * Create mock objects for development
   */
  private createMockObjects(__canvasId: string): CanvasObject[] {
    const now = new Date().toISOString()
    
    return [
      {
        id: `dev-obj-1-${__canvasId}`,
        canvas_id: __canvasId,
        object_type: 'rectangle',
        properties: {
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          fill: '#3b82f6',
          stroke: '#1e40af',
          strokeWidth: 2
        },
        z_index: 1,
        created_by: 'dev-user',
        created_at: now,
        updated_at: now
      },
      {
        id: `dev-obj-2-${__canvasId}`,
        canvas_id: __canvasId,
        object_type: 'text',
        properties: {
          x: 150,
          y: 200,
          text: 'Hello World!',
          fontSize: 24,
          fill: '#1f2937',
          fontFamily: 'Arial'
        },
        z_index: 2,
        created_by: 'dev-user',
        created_at: now,
        updated_at: now
      },
      {
        id: `dev-obj-3-${__canvasId}`,
        canvas_id: __canvasId,
        object_type: 'circle',
        properties: {
          x: 300,
          y: 150,
          radius: 50,
          fill: '#ef4444',
          stroke: '#dc2626',
          strokeWidth: 2
        },
        z_index: 3,
        created_by: 'dev-user',
        created_at: now,
        updated_at: now
      }
    ]
  }

  /**
   * Simulate network delay for development mode
   */
  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current mode
   */
  public getMode(): 'development' | 'production' {
    return this.isDevelopment ? 'development' : 'production'
  }

  /**
   * Check if in development mode
   */
  public isInDevelopmentMode(): boolean {
    return this.isDevelopment
  }

  /**
   * Reset mock data
   */
  public resetMockData(): void {
    this.mockData = {
      canvases: [],
      objects: new Map()
    }
    this.initializeMockData()
  }
}

// Export singleton instance
export const unifiedCanvasService = new UnifiedCanvasService()

// Export service
export { UnifiedCanvasService }
