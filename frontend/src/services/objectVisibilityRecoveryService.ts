/**
 * Object Visibility Recovery Service
 * Handles recovery of objects that become invisible due to connection issues
 */

import { objectsAPI, canvasAPI } from './api'
import { socketService } from './socket'

export interface RecoveryResult {
  success: boolean
  recoveredObjects: number
  errors: string[]
  method: 'socket' | 'rest' | 'hybrid'
}

export interface VisibilityIssue {
  canvasId: string
  missingObjects: string[]
  timestamp: number
  reason: 'disconnection' | 'parse_error' | 'sync_failure' | 'unknown'
}

class ObjectVisibilityRecoveryService {
  private recoveryAttempts = new Map<string, number>()
  private maxRecoveryAttempts = 3
  private recoveryCooldown = 5000 // 5 seconds

  /**
   * Detect visibility issues by comparing local and server state
   */
  async detectVisibilityIssues(canvasId: string, localObjects: any[]): Promise<VisibilityIssue | null> {
    try {
      console.log(`Detecting visibility issues for canvas: ${canvasId}`)
      
      // Get server objects
      const response = await canvasAPI.getCanvasObjects(canvasId)
      const serverObjects = response.objects || []
      
      // Find missing objects (on server but not local)
      const localIds = new Set(localObjects.map(obj => obj.id))
      const missingObjects = serverObjects
        .filter((serverObj: any) => !localIds.has(serverObj.id))
        .map((obj: any) => obj.id)
      
      if (missingObjects.length > 0) {
        console.warn(`Visibility issue detected: ${missingObjects.length} objects missing locally`)
        
        return {
          canvasId,
          missingObjects,
          timestamp: Date.now(),
          reason: 'sync_failure'
        }
      }
      
      return null
    } catch (error) {
      console.error('Error detecting visibility issues:', error)
      return null
    }
  }

  /**
   * Recover missing objects using multiple strategies
   */
  async recoverMissingObjects(canvasId: string, missingObjectIds: string[]): Promise<RecoveryResult> {
    const attempts = this.recoveryAttempts.get(canvasId) || 0
    
    if (attempts >= this.maxRecoveryAttempts) {
      console.warn(`Max recovery attempts reached for canvas: ${canvasId}`)
      return {
        success: false,
        recoveredObjects: 0,
        errors: ['Max recovery attempts reached'],
        method: 'rest'
      }
    }
    
    this.recoveryAttempts.set(canvasId, attempts + 1)
    
    try {
      console.log(`Recovering ${missingObjectIds.length} missing objects for canvas: ${canvasId}`)
      
      const errors: string[] = []
      let recoveredObjects = 0
      let method: 'socket' | 'rest' | 'hybrid' = 'rest'
      
      // Strategy 1: Try to get missing objects via REST API
      for (const objectId of missingObjectIds) {
        try {
          const response = await objectsAPI.getObject(objectId)
          if (response.object) {
            recoveredObjects++
            console.log(`Recovered object via REST: ${objectId}`)
          }
        } catch (error) {
          errors.push(`Failed to recover object ${objectId}: ${error}`)
        }
      }
      
      // Strategy 2: If some objects still missing, try socket sync
      if (recoveredObjects < missingObjectIds.length) {
        try {
          const syncedObjects = await socketService.syncObjectState(canvasId, [])
          const additionalRecovered = syncedObjects.filter(obj => 
            missingObjectIds.includes(obj.id as string)
          ).length
          
          if (additionalRecovered > 0) {
            recoveredObjects += additionalRecovered
            method = 'hybrid'
            console.log(`Recovered ${additionalRecovered} additional objects via socket sync`)
          }
        } catch (error) {
          errors.push(`Socket sync recovery failed: ${error}`)
        }
      }
      
      const success = recoveredObjects > 0
      
      if (success) {
        console.log(`Recovery successful: ${recoveredObjects}/${missingObjectIds.length} objects recovered`)
        // Reset attempts on success
        this.recoveryAttempts.delete(canvasId)
      } else {
        console.error(`Recovery failed: 0/${missingObjectIds.length} objects recovered`)
      }
      
      return {
        success,
        recoveredObjects,
        errors,
        method
      }
      
    } catch (error) {
      console.error('Object recovery failed:', error)
      return {
        success: false,
        recoveredObjects: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        method: 'rest'
      }
    }
  }

  /**
   * Monitor object visibility and trigger recovery when needed
   */
  async monitorObjectVisibility(canvasId: string, localObjects: any[]): Promise<void> {
    try {
      const visibilityIssue = await this.detectVisibilityIssues(canvasId, localObjects)
      
      if (visibilityIssue) {
        console.log(`Visibility issue detected: ${visibilityIssue.missingObjects.length} missing objects`)
        
        // Check cooldown
        const lastAttempt = this.recoveryAttempts.get(canvasId)
        if (lastAttempt && Date.now() - lastAttempt < this.recoveryCooldown) {
          console.log('Recovery in cooldown, skipping')
          return
        }
        
        // Attempt recovery
        const result = await this.recoverMissingObjects(canvasId, visibilityIssue.missingObjects)
        
        if (result.success) {
          console.log(`Visibility recovery successful: ${result.recoveredObjects} objects recovered`)
          
          // Log recovery success (emit functionality can be added later if needed)
          console.log('Visibility recovery success:', {
            canvasId,
            recoveredObjects: result.recoveredObjects,
            method: result.method,
            timestamp: Date.now()
          })
        } else {
          console.error(`Visibility recovery failed: ${result.errors.join(', ')}`)
          
          // Log recovery failure (emit functionality can be added later if needed)
          console.log('Visibility recovery failed:', {
            canvasId,
            errors: result.errors,
            timestamp: Date.now()
          })
        }
      }
    } catch (error) {
      console.error('Error monitoring object visibility:', error)
    }
  }

  /**
   * Force refresh of all objects for a canvas
   */
  async forceRefreshCanvas(canvasId: string): Promise<RecoveryResult> {
    try {
      console.log(`Force refreshing canvas: ${canvasId}`)
      
      // Get all objects from server
      const response = await canvasAPI.getCanvasObjects(canvasId)
      const serverObjects = response.objects || []
      
      console.log(`Force refresh completed: ${serverObjects.length} objects retrieved`)
      
      return {
        success: true,
        recoveredObjects: serverObjects.length,
        errors: [],
        method: 'rest'
      }
      
    } catch (error) {
      console.error('Force refresh failed:', error)
      return {
        success: false,
        recoveredObjects: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        method: 'rest'
      }
    }
  }

  /**
   * Clear recovery attempts for a canvas
   */
  clearRecoveryAttempts(canvasId: string): void {
    this.recoveryAttempts.delete(canvasId)
    console.log(`Cleared recovery attempts for canvas: ${canvasId}`)
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): { [canvasId: string]: number } {
    return Object.fromEntries(this.recoveryAttempts)
  }
}

export const objectVisibilityRecoveryService = new ObjectVisibilityRecoveryService()
