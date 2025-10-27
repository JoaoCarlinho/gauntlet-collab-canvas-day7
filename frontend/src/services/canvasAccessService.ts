/**
 * Canvas Access Service
 * Handles canvas loading with circuit breaker protection to prevent infinite retry loops
 */

import { canvasAPI } from './api'
import { canvasCircuitBreaker } from './circuitBreakerService'
import { Canvas, CanvasObject } from '../types'

export interface CanvasAccessResult {
  success: boolean
  canvas?: Canvas
  error?: string
  shouldRedirect?: boolean
  redirectPath?: string
  redirectReason?: 'not_found' | 'circuit_open' | 'unauthorized' | 'network_error'
}

export interface CanvasObjectsResult {
  success: boolean
  objects?: CanvasObject[]
  error?: string
}

class CanvasAccessService {
  private failedCanvases: Map<string, { count: number; lastAttempt: number }> = new Map()
  private readonly MAX_ATTEMPTS_PER_CANVAS = 3
  private readonly ATTEMPT_RESET_WINDOW = 300000 // 5 minutes

  /**
   * Attempt to load a canvas with circuit breaker protection
   */
  async loadCanvas(canvasId: string): Promise<CanvasAccessResult> {
    // Check if this canvas has failed too many times recently
    const canvasFailures = this.failedCanvases.get(canvasId)
    if (canvasFailures) {
      const timeSinceLastAttempt = Date.now() - canvasFailures.lastAttempt

      // Reset failure count if enough time has passed
      if (timeSinceLastAttempt > this.ATTEMPT_RESET_WINDOW) {
        this.failedCanvases.delete(canvasId)
      } else if (canvasFailures.count >= this.MAX_ATTEMPTS_PER_CANVAS) {
        console.warn(`Canvas ${canvasId} has failed ${canvasFailures.count} times. Blocking access for ${Math.floor((this.ATTEMPT_RESET_WINDOW - timeSinceLastAttempt) / 1000)}s`)
        return {
          success: false,
          error: `This canvas is temporarily unavailable. Please try again in a few minutes.`,
          shouldRedirect: true,
          redirectPath: '/dashboard?error=canvas_temporarily_unavailable',
          redirectReason: 'circuit_open'
        }
      }
    }

    try {
      // Use circuit breaker to protect against infinite retries
      const response = await canvasCircuitBreaker.execute(async () => {
        return await canvasAPI.getCanvas(canvasId)
      })

      // Success - reset failure count for this canvas
      this.failedCanvases.delete(canvasId)
      canvasCircuitBreaker.reset()

      return {
        success: true,
        canvas: response.canvas
      }
    } catch (error: any) {
      console.error('Canvas load failed:', error)

      // Track failure for this specific canvas
      const failures = this.failedCanvases.get(canvasId) || { count: 0, lastAttempt: 0 }
      failures.count++
      failures.lastAttempt = Date.now()
      this.failedCanvases.set(canvasId, failures)

      // Determine error type and appropriate action
      if (error.message?.includes('Circuit breaker')) {
        return {
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
          shouldRedirect: true,
          redirectPath: '/dashboard?error=service_unavailable',
          redirectReason: 'circuit_open'
        }
      }

      if (error.response?.status === 404 || error.response?.data?.error?.includes('not found')) {
        console.warn(`Canvas ${canvasId} not found`)
        return {
          success: false,
          error: 'Canvas not found. It may have been deleted or you may not have permission to access it.',
          shouldRedirect: true,
          redirectPath: '/dashboard?error=canvas_not_found',
          redirectReason: 'not_found'
        }
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          success: false,
          error: 'You do not have permission to access this canvas.',
          shouldRedirect: true,
          redirectPath: '/dashboard?error=unauthorized',
          redirectReason: 'unauthorized'
        }
      }

      if (!error.response) {
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.',
          shouldRedirect: failures.count >= this.MAX_ATTEMPTS_PER_CANVAS,
          redirectPath: '/dashboard?error=network_error',
          redirectReason: 'network_error'
        }
      }

      return {
        success: false,
        error: error.message || 'Failed to load canvas',
        shouldRedirect: failures.count >= this.MAX_ATTEMPTS_PER_CANVAS,
        redirectPath: '/dashboard?error=unknown',
        redirectReason: 'network_error'
      }
    }
  }

  /**
   * Attempt to load canvas objects with error handling
   */
  async loadCanvasObjects(canvasId: string): Promise<CanvasObjectsResult> {
    try {
      const response = await canvasAPI.getCanvasObjects(canvasId)
      return {
        success: true,
        objects: response.objects
      }
    } catch (error: any) {
      console.error('Canvas objects load failed:', error)
      return {
        success: false,
        error: error.message || 'Failed to load canvas objects'
      }
    }
  }

  /**
   * Reset failure tracking for a specific canvas
   */
  resetCanvasFailures(canvasId: string): void {
    this.failedCanvases.delete(canvasId)
  }

  /**
   * Reset all failure tracking
   */
  resetAllFailures(): void {
    this.failedCanvases.clear()
  }

  /**
   * Get failure statistics for debugging
   */
  getFailureStats(): Array<{ canvasId: string; failureCount: number; lastAttempt: number }> {
    return Array.from(this.failedCanvases.entries()).map(([canvasId, data]) => ({
      canvasId,
      failureCount: data.count,
      lastAttempt: data.lastAttempt
    }))
  }

  /**
   * Check if a canvas is currently blocked
   */
  isCanvasBlocked(canvasId: string): boolean {
    const failures = this.failedCanvases.get(canvasId)
    if (!failures) return false

    const timeSinceLastAttempt = Date.now() - failures.lastAttempt
    if (timeSinceLastAttempt > this.ATTEMPT_RESET_WINDOW) {
      this.failedCanvases.delete(canvasId)
      return false
    }

    return failures.count >= this.MAX_ATTEMPTS_PER_CANVAS
  }
}

// Export singleton instance
export const canvasAccessService = new CanvasAccessService()
