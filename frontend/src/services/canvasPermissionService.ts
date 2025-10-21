/**
 * Comprehensive Canvas Permission System
 */

import { errorLogger } from '../utils/errorLogger'
import { authService } from './authService'
import { unifiedCanvasService } from './unifiedCanvasService'

export interface CanvasPermission {
  id: string
  canvasId: string
  userId: string
  permissionType: 'owner' | 'edit' | 'view' | 'comment'
  grantedBy: string
  grantedAt: string
  expiresAt?: string
  isActive: boolean
}

export interface PermissionCheck {
  hasPermission: boolean
  permissionType?: string
  reason?: string
  canUpgrade?: boolean
  canDowngrade?: boolean
}

export interface PermissionChange {
  canvasId: string
  userId: string
  oldPermission: string
  newPermission: string
  changedBy: string
  timestamp: number
  reason?: string
}

export interface PermissionMetrics {
  totalChecks: number
  permissionDenied: number
  permissionGranted: number
  permissionChanges: number
  averageCheckTime: number
  lastCheckTime: number
}

class CanvasPermissionService {
  private permissions: Map<string, CanvasPermission[]> = new Map()
  private permissionChanges: PermissionChange[] = []
  private metrics: PermissionMetrics = {
    totalChecks: 0,
    permissionDenied: 0,
    permissionGranted: 0,
    permissionChanges: 0,
    averageCheckTime: 0,
    lastCheckTime: 0
  }
  private permissionCache = new Map<string, { permission: PermissionCheck; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.initializePermissionSystem()
  }

  /**
   * Initialize permission system
   */
  private initializePermissionSystem(): void {
    // Listen for permission changes
    window.addEventListener('permissionChanged', this.handlePermissionChange.bind(this) as EventListener)
    
    // Listen for user changes
    window.addEventListener('userChanged', this.handleUserChange.bind(this) as EventListener)
    
    // Clear cache periodically
    setInterval(() => {
      this.clearExpiredCache()
    }, 60000) // Clear every minute
  }

  /**
   * Check if user has permission for canvas
   */
  public async checkPermission(
    canvasId: string,
    requiredPermission: 'owner' | 'edit' | 'view' | 'comment',
    userId?: string
  ): Promise<PermissionCheck> {
    const startTime = Date.now()
    this.metrics.totalChecks++
    this.metrics.lastCheckTime = Date.now()

    try {
      // Get current user if not provided
      if (!userId) {
        const user = authService.getUser()
        if (!user) {
          return {
            hasPermission: false,
            reason: 'User not authenticated'
          }
        }
        userId = user.id
      }

      // Check cache first
      const cacheKey = `${canvasId}-${userId}-${requiredPermission}`
      const cached = this.permissionCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.permission
      }

      // Get user's permission for this canvas
      const userPermission = await this.getUserPermission(canvasId, userId)
      
      if (!userPermission) {
        this.metrics.permissionDenied++
        const result = {
          hasPermission: false,
          reason: 'No permission found for this canvas'
        }
        
        // Cache the result
        this.permissionCache.set(cacheKey, {
          permission: result,
          timestamp: Date.now()
        })
        
        return result
      }

      // Check if permission is active
      if (!userPermission.isActive) {
        this.metrics.permissionDenied++
        const result = {
          hasPermission: false,
          reason: 'Permission is inactive'
        }
        
        this.permissionCache.set(cacheKey, {
          permission: result,
          timestamp: Date.now()
        })
        
        return result
      }

      // Check if permission has expired
      if (userPermission.expiresAt && new Date(userPermission.expiresAt) < new Date()) {
        this.metrics.permissionDenied++
        const result = {
          hasPermission: false,
          reason: 'Permission has expired'
        }
        
        this.permissionCache.set(cacheKey, {
          permission: result,
          timestamp: Date.now()
        })
        
        return result
      }

      // Check permission hierarchy
      const hasPermission = this.checkPermissionHierarchy(userPermission.permissionType, requiredPermission)
      
      if (hasPermission) {
        this.metrics.permissionGranted++
        const result = {
          hasPermission: true,
          permissionType: userPermission.permissionType,
          canUpgrade: this.canUpgradePermission(userPermission.permissionType),
          canDowngrade: this.canDowngradePermission(userPermission.permissionType)
        }
        
        this.permissionCache.set(cacheKey, {
          permission: result,
          timestamp: Date.now()
        })
        
        return result
      } else {
        this.metrics.permissionDenied++
        const result = {
          hasPermission: false,
          permissionType: userPermission.permissionType,
          reason: `Insufficient permission. Required: ${requiredPermission}, Current: ${userPermission.permissionType}`
        }
        
        this.permissionCache.set(cacheKey, {
          permission: result,
          timestamp: Date.now()
        })
        
        return result
      }

    } catch (error) {
      console.error('Permission check failed:', error)
      errorLogger.logError(error as Error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: { canvasId, requiredPermission, userId }
      })

      this.metrics.permissionDenied++
      return {
        hasPermission: false,
        reason: 'Permission check failed'
      }
    } finally {
      // Update average check time
      const checkTime = Date.now() - startTime
      const totalTime = this.metrics.averageCheckTime * (this.metrics.totalChecks - 1) + checkTime
      this.metrics.averageCheckTime = totalTime / this.metrics.totalChecks
    }
  }

  /**
   * Get user's permission for a canvas
   */
  private async getUserPermission(canvasId: string, userId: string): Promise<CanvasPermission | null> {
    // Check local cache first
    const canvasPermissions = this.permissions.get(canvasId)
    if (canvasPermissions) {
      const userPermission = canvasPermissions.find(p => p.userId === userId)
      if (userPermission) {
        return userPermission
      }
    }

    // In development mode, create mock permissions
    if (unifiedCanvasService.isInDevelopmentMode()) {
      return this.createMockPermission(canvasId, userId)
    }

    // In production, fetch from API
    try {
      // This would typically make an API call to get permissions
      // For now, we'll create a mock permission
      return this.createMockPermission(canvasId, userId)
    } catch (error) {
      console.error('Failed to fetch user permission:', error)
      return null
    }
  }

  /**
   * Create mock permission for development
   */
  private createMockPermission(canvasId: string, userId: string): CanvasPermission {
    // In development, give all users edit permission
    return {
      id: `dev-permission-${canvasId}-${userId}`,
      canvasId,
      userId,
      permissionType: 'edit',
      grantedBy: 'system',
      grantedAt: new Date().toISOString(),
      isActive: true
    }
  }

  /**
   * Check permission hierarchy
   */
  private checkPermissionHierarchy(userPermission: string, requiredPermission: string): boolean {
    const hierarchy = {
      'owner': 4,
      'edit': 3,
      'comment': 2,
      'view': 1
    }

    const userLevel = hierarchy[userPermission as keyof typeof hierarchy] || 0
    const requiredLevel = hierarchy[requiredPermission as keyof typeof hierarchy] || 0

    return userLevel >= requiredLevel
  }

  /**
   * Check if permission can be upgraded
   */
  private canUpgradePermission(currentPermission: string): boolean {
    const currentUser = authService.getUser()
    if (!currentUser) return false

    // Only owners can upgrade permissions
    return currentPermission === 'owner'
  }

  /**
   * Check if permission can be downgraded
   */
  private canDowngradePermission(currentPermission: string): boolean {
    const currentUser = authService.getUser()
    if (!currentUser) return false

    // Owners and users with edit permission can downgrade
    return currentPermission === 'owner' || currentPermission === 'edit'
  }

  /**
   * Grant permission to user
   */
  public async grantPermission(
    canvasId: string,
    userId: string,
    permissionType: 'edit' | 'view' | 'comment',
    expiresAt?: string
  ): Promise<boolean> {
    try {
      const currentUser = authService.getUser()
      if (!currentUser) {
        throw new Error('User not authenticated')
      }

      // Check if current user has permission to grant permissions
      const permissionCheck = await this.checkPermission(canvasId, 'owner', currentUser.id)
      if (!permissionCheck.hasPermission) {
        throw new Error('Insufficient permission to grant permissions')
      }

      const permission: CanvasPermission = {
        id: `permission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        canvasId,
        userId,
        permissionType,
        grantedBy: currentUser.id,
        grantedAt: new Date().toISOString(),
        expiresAt,
        isActive: true
      }

      // Add to local cache
      const canvasPermissions = this.permissions.get(canvasId) || []
      canvasPermissions.push(permission)
      this.permissions.set(canvasId, canvasPermissions)

      // Record permission change
      this.recordPermissionChange(canvasId, userId, 'none', permissionType, currentUser.id)

      // Clear cache for this user
      this.clearUserCache(canvasId, userId)

      // Emit permission change event
      this.emitPermissionChange(permission)

      return true

    } catch (error) {
      console.error('Failed to grant permission:', error)
      errorLogger.logError(error as Error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: { canvasId, userId, permissionType }
      })
      return false
    }
  }

  /**
   * Revoke permission from user
   */
  public async revokePermission(canvasId: string, userId: string): Promise<boolean> {
    try {
      const currentUser = authService.getUser()
      if (!currentUser) {
        throw new Error('User not authenticated')
      }

      // Check if current user has permission to revoke permissions
      const permissionCheck = await this.checkPermission(canvasId, 'owner', currentUser.id)
      if (!permissionCheck.hasPermission) {
        throw new Error('Insufficient permission to revoke permissions')
      }

      // Find and remove permission
      const canvasPermissions = this.permissions.get(canvasId) || []
      const permissionIndex = canvasPermissions.findIndex(p => p.userId === userId)
      
      if (permissionIndex !== -1) {
        const oldPermission = canvasPermissions[permissionIndex].permissionType
        canvasPermissions.splice(permissionIndex, 1)
        this.permissions.set(canvasId, canvasPermissions)

        // Record permission change
        this.recordPermissionChange(canvasId, userId, oldPermission, 'none', currentUser.id)

        // Clear cache for this user
        this.clearUserCache(canvasId, userId)

        // Emit permission change event
        this.emitPermissionChange({ canvasId, userId, permissionType: 'none' } as any)

        return true
      }

      return false

    } catch (error) {
      console.error('Failed to revoke permission:', error)
      errorLogger.logError(error as Error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: { canvasId, userId }
      })
      return false
    }
  }

  /**
   * Update user permission
   */
  public async updatePermission(
    canvasId: string,
    userId: string,
    newPermissionType: 'edit' | 'view' | 'comment'
  ): Promise<boolean> {
    try {
      const currentUser = authService.getUser()
      if (!currentUser) {
        throw new Error('User not authenticated')
      }

      // Check if current user has permission to update permissions
      const permissionCheck = await this.checkPermission(canvasId, 'owner', currentUser.id)
      if (!permissionCheck.hasPermission) {
        throw new Error('Insufficient permission to update permissions')
      }

      // Find and update permission
      const canvasPermissions = this.permissions.get(canvasId) || []
      const permission = canvasPermissions.find(p => p.userId === userId)
      
      if (permission) {
        const oldPermissionType = permission.permissionType
        permission.permissionType = newPermissionType
        permission.grantedBy = currentUser.id
        permission.grantedAt = new Date().toISOString()

        // Record permission change
        this.recordPermissionChange(canvasId, userId, oldPermissionType, newPermissionType, currentUser.id)

        // Clear cache for this user
        this.clearUserCache(canvasId, userId)

        // Emit permission change event
        this.emitPermissionChange(permission)

        return true
      }

      return false

    } catch (error) {
      console.error('Failed to update permission:', error)
      errorLogger.logError(error as Error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: { canvasId, userId, newPermissionType }
      })
      return false
    }
  }

  /**
   * Get all permissions for a canvas
   */
  public getCanvasPermissions(canvasId: string): CanvasPermission[] {
    return this.permissions.get(canvasId) || []
  }

  /**
   * Get all permissions for a user
   */
  public getUserPermissions(userId: string): CanvasPermission[] {
    const allPermissions: CanvasPermission[] = []
    
    for (const canvasPermissions of this.permissions.values()) {
      const userPermissions = canvasPermissions.filter(p => p.userId === userId)
      allPermissions.push(...userPermissions)
    }
    
    return allPermissions
  }

  /**
   * Record permission change
   */
  private recordPermissionChange(
    canvasId: string,
    userId: string,
    oldPermission: string,
    newPermission: string,
    changedBy: string,
    reason?: string
  ): void {
    const change: PermissionChange = {
      canvasId,
      userId,
      oldPermission,
      newPermission,
      changedBy,
      timestamp: Date.now(),
      reason
    }

    this.permissionChanges.push(change)
    this.metrics.permissionChanges++

    // Keep only last 1000 changes
    if (this.permissionChanges.length > 1000) {
      this.permissionChanges = this.permissionChanges.slice(-1000)
    }
  }

  /**
   * Emit permission change event
   */
  private emitPermissionChange(permission: CanvasPermission | { canvasId: string; userId: string; permissionType: string }): void {
    const event = new CustomEvent('permissionChanged', {
      detail: {
        permission,
        timestamp: Date.now()
      }
    })
    window.dispatchEvent(event)
  }

  /**
   * Handle permission change event
   */
  private handlePermissionChange(event: CustomEvent): void {
    const { permission } = event.detail
    console.log('Permission changed:', permission)
    
    // Clear cache for affected user
    this.clearUserCache(permission.canvasId, permission.userId)
  }

  /**
   * Handle user change event
   */
  private handleUserChange(): void {
    // Clear all cache when user changes
    this.permissionCache.clear()
  }

  /**
   * Clear cache for specific user
   */
  private clearUserCache(canvasId: string, userId: string): void {
    const keysToDelete: string[] = []
    
    for (const key of this.permissionCache.keys()) {
      if (key.includes(`${canvasId}-${userId}`)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.permissionCache.delete(key))
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, value] of this.permissionCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.permissionCache.delete(key))
  }

  /**
   * Get permission metrics
   */
  public getMetrics(): PermissionMetrics {
    return { ...this.metrics }
  }

  /**
   * Get permission changes
   */
  public getPermissionChanges(): PermissionChange[] {
    return [...this.permissionChanges]
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalChecks: 0,
      permissionDenied: 0,
      permissionGranted: 0,
      permissionChanges: 0,
      averageCheckTime: 0,
      lastCheckTime: 0
    }
  }

  /**
   * Clear all permissions
   */
  public clearAllPermissions(): void {
    this.permissions.clear()
    this.permissionChanges = []
    this.permissionCache.clear()
  }
}

// Export singleton instance
export const canvasPermissionService = new CanvasPermissionService()

// Export service
export { CanvasPermissionService }
