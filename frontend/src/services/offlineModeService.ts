/**
 * Offline Mode Service
 * Provides limited functionality when network is unavailable
 * Manages local storage and sync when connection is restored
 */

import { networkHealthService, NetworkStatus } from './networkHealthService'
import { errorLogger } from '../utils/errorLogger'
import { productionLogger } from '../utils/productionLogger'
import toast from 'react-hot-toast'

export interface OfflineAction {
  id: string
  type: 'create' | 'update' | 'delete' | 'move' | 'resize'
  canvasId: string
  objectId?: string
  data: any
  timestamp: number
  retryCount: number
  maxRetries: number
}

export interface OfflineCanvas {
  id: string
  title: string
  objects: any[]
  lastModified: number
  isOffline: boolean
}

export interface SyncResult {
  success: boolean
  syncedActions: number
  failedActions: number
  errors: string[]
  duration: number
}

class OfflineModeService {
  private offlineActions: OfflineAction[] = []
  private offlineCanvases: Map<string, OfflineCanvas> = new Map()
  private isOfflineMode = false
  private syncInProgress = false
  private listeners: Map<string, Function[]> = new Map()
  private readonly STORAGE_KEY = 'collabcanvas_offline_data'
  private readonly MAX_OFFLINE_ACTIONS = 1000

  constructor() {
    this.initializeOfflineMode()
    this.loadOfflineData()
    this.setupNetworkListeners()
  }

  /**
   * Initialize offline mode
   */
  private initializeOfflineMode(): void {
    // Check if we're currently offline
    this.isOfflineMode = !navigator.onLine
    this.updateOfflineStatus()
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    // Listen to network health service
    networkHealthService.addEventListener('networkChange', (status: NetworkStatus) => {
      this.handleNetworkChange(status)
    })

    // Listen to browser online/offline events
    window.addEventListener('online', () => {
      this.handleNetworkRestored()
    })

    window.addEventListener('offline', () => {
      this.handleNetworkLost()
    })
  }

  /**
   * Handle network status change
   */
  private handleNetworkChange(status: NetworkStatus): void {
    const wasOffline = this.isOfflineMode
    this.isOfflineMode = !status.isOnline || status.apiHealth === 'unhealthy'

    if (wasOffline !== this.isOfflineMode) {
      this.updateOfflineStatus()
    }

    if (!wasOffline && this.isOfflineMode) {
      this.handleNetworkLost()
    } else if (wasOffline && !this.isOfflineMode) {
      this.handleNetworkRestored()
    }
  }

  /**
   * Handle network lost
   */
  private handleNetworkLost(): void {
    productionLogger.warning('Network lost - entering offline mode')
    // Connection monitoring - toast notifications suppressed
    this.notifyListeners('offlineMode', { isOffline: true })
  }

  /**
   * Handle network restored
   */
  private handleNetworkRestored(): void {
    productionLogger.info('Network restored - exiting offline mode')
    // Connection monitoring - toast notifications suppressed
    this.notifyListeners('offlineMode', { isOffline: false })
    
    // Start syncing after a short delay
    setTimeout(() => {
      this.syncOfflineActions()
    }, 2000)
  }

  /**
   * Update offline status
   */
  private updateOfflineStatus(): void {
    this.notifyListeners('statusChange', { 
      isOffline: this.isOfflineMode,
      actionCount: this.offlineActions.length,
      canvasCount: this.offlineCanvases.size
    })
  }

  /**
   * Check if currently in offline mode
   */
  isOffline(): boolean {
    return this.isOfflineMode
  }

  /**
   * Add action to offline queue
   */
  addOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): string {
    const offlineAction: OfflineAction = {
      ...action,
      id: this.generateActionId(),
      timestamp: Date.now(),
      retryCount: 0
    }

    this.offlineActions.push(offlineAction)

    // Limit offline actions
    if (this.offlineActions.length > this.MAX_OFFLINE_ACTIONS) {
      this.offlineActions = this.offlineActions.slice(-this.MAX_OFFLINE_ACTIONS)
    }

    this.saveOfflineData()
    this.updateOfflineStatus()

    productionLogger.debug('Added offline action', { type: offlineAction.type, id: offlineAction.id })
    return offlineAction.id
  }

  /**
   * Create offline canvas
   */
  createOfflineCanvas(canvasId: string, title: string, objects: any[] = []): void {
    const offlineCanvas: OfflineCanvas = {
      id: canvasId,
      title,
      objects,
      lastModified: Date.now(),
      isOffline: true
    }

    this.offlineCanvases.set(canvasId, offlineCanvas)
    this.saveOfflineData()
    this.updateOfflineStatus()

    productionLogger.info('Created offline canvas', { canvasId })
  }

  /**
   * Update offline canvas
   */
  updateOfflineCanvas(canvasId: string, updates: Partial<OfflineCanvas>): void {
    const canvas = this.offlineCanvases.get(canvasId)
    if (canvas) {
      Object.assign(canvas, updates, { lastModified: Date.now() })
      this.saveOfflineData()
    }
  }

  /**
   * Get offline canvas
   */
  getOfflineCanvas(canvasId: string): OfflineCanvas | undefined {
    return this.offlineCanvases.get(canvasId)
  }

  /**
   * Get all offline canvases
   */
  getOfflineCanvases(): OfflineCanvas[] {
    return Array.from(this.offlineCanvases.values())
  }

  /**
   * Sync offline actions when network is restored
   */
  async syncOfflineActions(): Promise<SyncResult> {
    if (this.syncInProgress) {
      productionLogger.warning('Sync already in progress')
      return {
        success: false,
        syncedActions: 0,
        failedActions: 0,
        errors: ['Sync already in progress'],
        duration: 0
      }
    }

    if (this.offlineActions.length === 0) {
      productionLogger.info('No offline actions to sync')
      return {
        success: true,
        syncedActions: 0,
        failedActions: 0,
        errors: [],
        duration: 0
      }
    }

    this.syncInProgress = true
    const startTime = Date.now()
    let syncedActions = 0
    let failedActions = 0
    const errors: string[] = []

    productionLogger.info(`Starting sync of ${this.offlineActions.length} offline actions`)

    try {
      // Process actions in batches
      const batchSize = 10
      const batches = this.chunkArray(this.offlineActions, batchSize)

      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(action => this.syncAction(action))
        )

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            syncedActions++
            // Remove successful action
            this.removeOfflineAction(batch[index].id)
          } else {
            failedActions++
            errors.push(`Action ${batch[index].id}: ${result.reason}`)
            
            // Increment retry count
            batch[index].retryCount++
            
            // Remove action if max retries reached
            if (batch[index].retryCount >= batch[index].maxRetries) {
              this.removeOfflineAction(batch[index].id)
            }
          }
        })

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      this.saveOfflineData()
      this.updateOfflineStatus()

      const duration = Date.now() - startTime
      const success = failedActions === 0

      if (success) {
        toast.success(`Synced ${syncedActions} changes successfully`, { duration: 3000 })
      } else {
        toast.error(`Synced ${syncedActions} changes, ${failedActions} failed`, { duration: 5000 })
      }

      console.log(`Sync completed: ${syncedActions} synced, ${failedActions} failed in ${duration}ms`)

      return {
        success,
        syncedActions,
        failedActions,
        errors,
        duration
      }

    } catch (error) {
      const duration = Date.now() - startTime
      console.error('Sync failed:', error)
      
      errorLogger.logError(error, {
        operation: 'general',
        timestamp: Date.now(),
        additionalData: {
          actionCount: this.offlineActions.length,
          duration
        }
      })

      return {
        success: false,
        syncedActions,
        failedActions,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        duration
      }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Sync individual action
   */
  private async syncAction(action: OfflineAction): Promise<void> {
    // This would integrate with your actual API calls
    // For now, we'll simulate the sync process
    
    switch (action.type) {
      case 'create':
        await this.syncCreateAction(action)
        break
      case 'update':
        await this.syncUpdateAction(action)
        break
      case 'delete':
        await this.syncDeleteAction(action)
        break
      case 'move':
        await this.syncMoveAction(action)
        break
      case 'resize':
        await this.syncResizeAction(action)
        break
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Sync create action
   */
  private async syncCreateAction(action: OfflineAction): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('Synced create action:', action.id)
  }

  /**
   * Sync update action
   */
  private async syncUpdateAction(action: OfflineAction): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('Synced update action:', action.id)
  }

  /**
   * Sync delete action
   */
  private async syncDeleteAction(action: OfflineAction): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('Synced delete action:', action.id)
  }

  /**
   * Sync move action
   */
  private async syncMoveAction(action: OfflineAction): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('Synced move action:', action.id)
  }

  /**
   * Sync resize action
   */
  private async syncResizeAction(action: OfflineAction): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('Synced resize action:', action.id)
  }

  /**
   * Remove offline action
   */
  private removeOfflineAction(actionId: string): void {
    const index = this.offlineActions.findIndex(action => action.id === actionId)
    if (index > -1) {
      this.offlineActions.splice(index, 1)
    }
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Save offline data to localStorage
   */
  private saveOfflineData(): void {
    try {
      const data = {
        actions: this.offlineActions,
        canvases: Array.from(this.offlineCanvases.entries()),
        timestamp: Date.now()
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save offline data:', error)
    }
  }

  /**
   * Load offline data from localStorage
   */
  private loadOfflineData(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.offlineActions = parsed.actions || []
        this.offlineCanvases = new Map(parsed.canvases || [])
        
        console.log(`Loaded ${this.offlineActions.length} offline actions and ${this.offlineCanvases.size} offline canvases`)
      }
    } catch (error) {
      console.error('Failed to load offline data:', error)
      this.offlineActions = []
      this.offlineCanvases = new Map()
    }
  }

  /**
   * Clear all offline data
   */
  clearOfflineData(): void {
    this.offlineActions = []
    this.offlineCanvases.clear()
    localStorage.removeItem(this.STORAGE_KEY)
    this.updateOfflineStatus()
    console.log('Cleared all offline data')
  }

  /**
   * Get offline status
   */
  getOfflineStatus(): any {
    return {
      isOffline: this.isOfflineMode,
      actionCount: this.offlineActions.length,
      canvasCount: this.offlineCanvases.size,
      syncInProgress: this.syncInProgress,
      lastSync: this.offlineActions.length > 0 ? Math.min(...this.offlineActions.map(a => a.timestamp)) : null
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Notify event listeners
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in offline mode listener:', error)
        }
      })
    }
  }
}

// Create singleton instance
export const offlineModeService = new OfflineModeService()

// Export types and service
export default offlineModeService
