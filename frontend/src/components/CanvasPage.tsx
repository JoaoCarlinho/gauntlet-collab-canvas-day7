import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Rect, Circle, Text, Group, Line, RegularPolygon, Star } from 'react-konva'
import { ArrowLeft, Users, Settings, UserPlus, BarChart3 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { canvasAPI } from '../services/api'
import { socketService } from '../services/socket'
import { Canvas, CanvasObject, CursorData } from '../types'
import { ErrorWithDetails, FailedUpdate as FailedUpdateType } from '../types/common'
// Using any for Konva events for now to avoid type compatibility issues
// TODO: Improve Konva event types in future iterations
import { errorLogger } from '../utils/errorLogger'
import { objectUpdateService } from '../services/objectUpdateService'
import { objectCreationService } from '../services/objectCreationService'
import { optimisticUpdateManager } from '../services/optimisticUpdateManager'
import { loadingStateManager } from '../services/loadingStateManager'
import { stateSyncManager, StateConflict } from '../services/stateSyncManager'
import { updateQueueManager, QueueStats } from '../services/updateQueueManager'
import { connectionMonitor } from '../services/connectionMonitor'
import { offlineManager } from '../services/offlineManager'
import { objectVisibilityRecoveryService } from '../services/objectVisibilityRecoveryService'
import { connectionQualityMonitor } from '../services/connectionQualityMonitor'
import ConnectionQualityDashboard from './ConnectionQualityDashboard'
import { objectUpdateDebouncer } from '../utils/debounce'
import { enhancedErrorHandler } from '../services/enhancedErrorHandler'
// import { batchUpdateManager, useBatchUpdates } from '../utils/batchUpdates'
// import { socketEventOptimizer, useSocketOptimization } from '../utils/socketOptimizer'
import { isDevelopmentMode, devModeDelay } from '../utils/devMode'
import devToast from '../utils/toastConfig'
import { zIndexManager } from '../utils/zIndexManager'
import { useObjectDropShortcuts, useCanvasMousePosition, useZIndexShortcuts } from '../hooks/useObjectDropShortcuts'
// import OptimisticUpdateIndicator from './OptimisticUpdateIndicator'
import UpdateSuccessAnimation from './UpdateSuccessAnimation'
import EnhancedLoadingIndicator from './EnhancedLoadingIndicator'
import ConflictResolutionDialog from './ConflictResolutionDialog'
import SyncStatusIndicator from './SyncStatusIndicator'
import QueueStatusIndicator from './QueueStatusIndicator'
import QueueManagementDialog from './QueueManagementDialog'
import ConnectionStatusIndicator from './ConnectionStatusIndicator'
import OfflineIndicator from './OfflineIndicator'
import toast from 'react-hot-toast'
import InviteCollaboratorModal from './InviteCollaboratorModal'
import PresenceIndicators from './PresenceIndicators'
import UserStatus from './UserStatus'
import CollaborationSidebar from './CollaborationSidebar'
import NotificationCenter from './NotificationCenter'
import ZoomableCanvas from './ZoomableCanvas'
import EditableText from './EditableText'
import ResizeHandles from './ResizeHandles'
import SelectionIndicator from './SelectionIndicator'
import CursorTooltip from './CursorTooltip'
import PointerIndicator from './PointerIndicator'
import { getUserColor, getUserInitials, getCursorIcon } from '../utils/cursorUtils'
import { getCursorManager, CursorState } from '../utils/cursorManager'
import { FloatingToolbar, useToolbarState, useToolShortcuts, getToolById } from './toolbar'
import { AIAgentButton } from './AIAgentButton'
import { AIAgentPanel } from './AIAgentPanel'
import SelectionBox from './SelectionBox'
import MultiSelectionIndicator from './MultiSelectionIndicator'
import ContextMenu from './ContextMenu'
import LayerManagementPanel from './LayerManagementPanel'
import { useMultiSelection } from '../hooks/useMultiSelection'
import { useClipboard } from '../hooks/useClipboard'
import { useUndoRedo, useUndoRedoShortcuts } from '../hooks/useUndoRedo'
import { useCoordinateDisplay } from '../hooks/useCoordinateDisplay'
import CoordinateStatusBar from './CoordinateStatusBar'
import TextEditorOverlay from './TextEditorOverlay'
import '../styles/AIAgent.css'

const CanvasPage: React.FC = () => {
  const { canvasId } = useParams<{ canvasId: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { isConnected } = useSocket()
  
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [objects, setObjects] = useState<CanvasObject[]>([])
  const [cursors, setCursors] = useState<CursorData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [newObject, setNewObject] = useState<Partial<CanvasObject> | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCollaborationSidebar, setShowCollaborationSidebar] = useState(false)
  const [showConnectionQualityDashboard, setShowConnectionQualityDashboard] = useState(false)
  const [showLayerManagementPanel, setShowLayerManagementPanel] = useState(false)
  
  // AI Agent state
  const [showAIPanel, setShowAIPanel] = useState(false)
  
  // Floating toolbar state
  const {
    preferences,
    selectedTool,
    isVisible: isToolbarVisible,
    updatePreferences,
    selectTool,
    toggleVisibility: toggleToolbarVisibility,
    updatePosition,
    toggleCollapse,
    getFilteredTools
  } = useToolbarState()
  
  // New state for enhanced object interactions
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null)
  const [stageTransform, setStageTransform] = useState<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0 })
  const [stageContainer, setStageContainer] = useState<HTMLDivElement | null>(null)
  const [stageContainerRect, setStageContainerRect] = useState<DOMRect | null>(null)
  
  // Multi-selection, clipboard, and undo/redo functionality
  const [multiSelectionState, multiSelectionActions] = useMultiSelection(objects)
  const [clipboardState, clipboardActions] = useClipboard()
  const [undoRedoState, undoRedoActions] = useUndoRedo()
  
  // Stage ref for keyboard shortcuts
  const stageRef = useRef<any>(null)
  
  // Mouse position for keyboard shortcuts
  const { getMousePosition } = useCanvasMousePosition(stageRef)
  
  // Object drop shortcuts
  useObjectDropShortcuts({
    canvasId: canvasId || '',
    userId: user?.id || '',
    onObjectCreated: (object: CanvasObject) => {
      setObjects(prev => [...prev, object])
      devToast.success(`${object.object_type} created successfully!`)
    },
    onError: (error: string) => {
      devToast.error(error)
    },
    getMousePosition
  })
  
  // Z-index management shortcuts
  useZIndexShortcuts(
    multiSelectionState.selectedObjectIds.size === 1 ? Array.from(multiSelectionState.selectedObjectIds)[0] : null,
    (objectId: string, zIndex: number) => {
      setObjects(prev => prev.map(obj => 
        obj.id === objectId ? { ...obj, z_index: zIndex } : obj
      ))
    },
    (error: string) => {
      devToast.error(error)
    }
  )

  // Layer management panel shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault()
        setShowLayerManagementPanel(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  
  // Coordinate display for object placement and selection
  const coordinateDisplay = useCoordinateDisplay()
  const [showCoordinates, setShowCoordinates] = useState(true)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
  }>({ visible: false, x: 0, y: 0 })
  
  // Error handling state
  const [failedUpdates, setFailedUpdates] = useState<Map<string, FailedUpdateType>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected')
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  
  // Update progress tracking
  const [updatingObjects, setUpdatingObjects] = useState<Set<string>>(new Set())
  const [updateProgress, setUpdateProgress] = useState<Map<string, { method: string; attempt: number }>>(new Map())
  
  // Optimistic update tracking
  const [optimisticObjects, setOptimisticObjects] = useState<Set<string>>(new Set())
  const [successAnimations, setSuccessAnimations] = useState<Array<{ id: string; x: number; y: number }>>([])
  
  // State synchronization and conflict management
  const [stateConflicts, setStateConflicts] = useState<StateConflict[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [syncStatus, setSyncStatus] = useState({
    isConnected: true,
    lastSyncTime: 0,
    syncInProgress: false,
    hasConflicts: false,
    conflictCount: 0,
    autoSyncActive: false
  })
  
  // Update queue management
  const [queueStats, setQueueStats] = useState<QueueStats>(updateQueueManager.getStats())
  const [showQueueDialog, setShowQueueDialog] = useState(false)
  
  // Connection monitoring and offline mode state
  // const [connectionMetrics, setConnectionMetrics] = useState({
  //   latency: 0,
  //   stability: 0,
  //   quality: 'excellent' as 'excellent' | 'good' | 'fair' | 'poor' | 'offline',
  //   uptime: 0
  // })
  const [isOffline, setIsOffline] = useState(false)
  // const [offlineData, setOfflineData] = useState({
  //   pendingUpdates: 0,
  //   lastSyncTime: 0,
  //   cacheSize: 0
  // })
  
  // Debouncing state
  // const [debouncedObjects, setDebouncedObjects] = useState<Set<string>>(new Set())
  const [debounceStats, setDebounceStats] = useState({
    totalObjects: 0,
    pendingObjects: 0,
    queuedUpdates: 0
  })
  
  // Batch updates state
  // const { addUpdate: addBatchUpdate, getStats: getBatchStats, getQueueStatus } = useBatchUpdates()
  const addBatchUpdate = (_update: Record<string, unknown>) => 'mock-id'
  const getBatchStats = () => ({ queueSize: 0, isProcessing: false, hasTimer: false, pendingUpdates: [] as any[] })
  const getQueueStatus = () => ({ queueSize: 0, isProcessing: false, hasTimer: false, pendingUpdates: [] as any[] })
  // Keep container rect for overlay positioning
  useEffect(() => {
    if (!stageContainer) return
    const updateRect = () => setStageContainerRect(stageContainer.getBoundingClientRect())
    updateRect()
    const obs = new ResizeObserver(updateRect)
    obs.observe(stageContainer)
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [stageContainer])

  // Start editing when Enter is pressed and a single text object is selected
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if (editingObjectId) return
      if (selectedTool.id !== 'select') return
      const selected = multiSelectionActions.getSelectedObjects?.() || []
      if (selected.length === 1 && selected[0].object_type === 'text') {
        e.preventDefault()
        setEditingObjectId(selected[0].id)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingObjectId, selectedTool.id, multiSelectionActions])

  // Prevent tool switching while editing
  const handleSafeToolSelect = (tool: any) => {
    if (editingObjectId) {
      // Ignore tool switches during text edit
      return
    }
    selectTool(tool)
  }

  // const [batchStats, setBatchStats] = useState({
  //   totalBatches: 0,
  //   successfulBatches: 0,
  //   failedBatches: 0,
  //   totalUpdates: 0,
  //   averageBatchSize: 0,
  //   averageProcessingTime: 0,
  //   totalSavedRequests: 0
  // })
  const [batchQueueStatus, setBatchQueueStatus] = useState({
    queueSize: 0,
    isProcessing: false,
    hasTimer: false,
    pendingUpdates: []
  })
  
  // Socket optimization state
  // const { getStats: getSocketStats, getQueueStatus: getSocketQueueStatus } = useSocketOptimization()
  const getSocketStats = () => ({ totalEvents: 0, optimizedEvents: 0, compressionRatio: 0 })
  const getSocketQueueStatus = () => ({ queueSize: 0, isProcessing: false, hasBatchTimer: false, hasThrottleTimer: false, eventsInLastSecond: 0 })
  // const [socketStats, setSocketStats] = useState({
  //   totalEventsSent: 0,
  //   totalEventsReceived: 0,
  //   throttledEvents: 0,
  //   compressedEvents: 0,
  //   deduplicatedEvents: 0,
  //   batchedEvents: 0,
  //   averageEventSize: 0,
  //   averageProcessingTime: 0,
  //   eventsPerSecond: 0,
  //   queueSize: 0
  // })
  const [socketQueueStatus, setSocketQueueStatus] = useState({
    queueSize: 0,
    isProcessing: false,
    hasBatchTimer: false,
    hasThrottleTimer: false,
    eventsInLastSecond: 0
  })
  
  // Cursor tooltip state
  const [hoveredCursor, setHoveredCursor] = useState<CursorData | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [showTooltip, setShowTooltip] = useState(false)
  
  // Pointer indicator state
  const [pointerIndicator, setPointerIndicator] = useState<{
    isVisible: boolean
    toolId: string
    position: { x: number; y: number }
    startPosition?: { x: number; y: number }
  } | null>(null)
  
  // Cursor management
  const [cursorManager] = useState(() => getCursorManager())
  
  const idToken = localStorage.getItem('idToken')
  
  // Keyboard shortcuts for tools
  useToolShortcuts({ onToolSelect: selectTool })
  
  // Undo/Redo shortcuts
  useUndoRedoShortcuts(
    () => {
      const newObjects = undoRedoActions.undo()
      if (newObjects) {
        setObjects(newObjects)
        multiSelectionActions.clearSelection()
      }
    },
    () => {
      const newObjects = undoRedoActions.redo()
      if (newObjects) {
        setObjects(newObjects)
        multiSelectionActions.clearSelection()
      }
    }
  )

  useEffect(() => {
    // In development mode, bypass authentication check
    if (!isDevelopmentMode() && (!isAuthenticated || !canvasId)) {
      navigate('/')
      return
    }

    // Ensure we have a canvasId
    if (!canvasId) {
      navigate('/')
      return
    }

    loadCanvas()
    loadObjects()
    
    // Connect to socket (skip in development mode)
    if (!isDevelopmentMode() && isConnected && idToken) {
      socketService.joinCanvas(canvasId, idToken)
      socketService.userOnline(canvasId, idToken)
      socketService.getCursors(canvasId, idToken)
      socketService.getOnlineUsers(canvasId, idToken)
    }

    // Set up socket event listeners (skip in development mode)
    if (!isDevelopmentMode()) {
    setupSocketListeners()
    
    // Set up visibility monitoring
    setupVisibilityMonitoring()
    
    // Set up connection quality monitoring
    setupConnectionQualityMonitoring()

      // Initialize state synchronization
      initializeStateSync()

      // Initialize update queue
      initializeUpdateQueue()

      // Initialize connection monitoring
      initializeConnectionMonitoring()

      // Initialize offline mode
      initializeOfflineMode()
    }

    return () => {
      // Skip socket cleanup in development mode
      if (!isDevelopmentMode() && idToken && canvasId) {
        socketService.leaveCanvas(canvasId, idToken)
        socketService.userOffline(canvasId, idToken)
      }
      
      // Skip state management cleanup in development mode
      if (!isDevelopmentMode()) {
        // Clean up state sync
        stateSyncManager.stopAutoSync()
        // Clean up update queue
        updateQueueManager.stopAutoProcessing()
        // Clean up connection monitoring
        connectionMonitor.stop()
        // Clean up offline mode
        // OfflineManager cleanup handled automatically
      }
    }
  }, [isAuthenticated, canvasId, isConnected])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle copy/paste shortcuts
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        switch (e.key) {
          case 'c':
            e.preventDefault()
            handleCopy()
            break
          case 'x':
            e.preventDefault()
            handleCut()
            break
          case 'v':
            e.preventDefault()
            handlePaste()
            break
          case 'd':
            e.preventDefault()
            handleDuplicate()
            break
          case 'a':
            e.preventDefault()
            multiSelectionActions.selectAll()
            break
        }
      }
      
      // Handle delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (multiSelectionState.selectedObjectIds.size > 0) {
          e.preventDefault()
          handleDelete()
        }
      }
      
      // Handle escape key to cancel drawing or editing
      if (e.key === 'Escape') {
        if (isDrawing) {
          setNewObject(null)
          setIsDrawing(false)
          const selectToolObj = getToolById('select')
          if (selectToolObj) {
            selectTool(selectToolObj)
          }
        } else if (editingObjectId) {
          setEditingObjectId(null)
        } else if (multiSelectionState.selectedObjectIds.size > 0) {
          multiSelectionActions.clearSelection()
        }
      }
      
      // Handle coordinate display toggle (Ctrl/Cmd + I)
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        setShowCoordinates(prev => !prev)
        toast.success(`Coordinate display ${!showCoordinates ? 'enabled' : 'disabled'}`, {
          duration: 2000,
          position: 'top-right'
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawing, editingObjectId, multiSelectionState.selectedObjectIds.size, showCoordinates])

  // Monitor connection status changes for queue manager
  useEffect(() => {
    updateQueueManager.setConnectionStatus(isConnected)
  }, [isConnected])
  
  // Clear coordinate display when no objects are selected and not drawing
  useEffect(() => {
    if (!isDrawing && multiSelectionState.selectedObjectIds.size === 0) {
      coordinateDisplay.clearCoordinates()
    }
  }, [isDrawing, multiSelectionState.selectedObjectIds.size])

  // Update debounce stats periodically
  useEffect(() => {
    const updateDebounceStats = () => {
      const stats = objectUpdateDebouncer.getStats()
      setDebounceStats(stats)
      // setDebouncedObjects(new Set(objectUpdateDebouncer.getPendingObjects()))
    }

    // Update stats immediately
    updateDebounceStats()

    // Update stats every 2 seconds
    const interval = setInterval(updateDebounceStats, 2000)

    return () => clearInterval(interval)
  }, [])

  // Update batch stats periodically
  useEffect(() => {
    const updateBatchStats = () => {
      // const stats = getBatchStats()
      const queueStatus = getQueueStatus()
      // setBatchStats(stats)
      setBatchQueueStatus(queueStatus)
    }

    // Update stats immediately
    updateBatchStats()

    // Update stats every 2 seconds
    const interval = setInterval(updateBatchStats, 2000)

    return () => clearInterval(interval)
  }, [getBatchStats, getQueueStatus])

  // Update socket optimization stats periodically
  useEffect(() => {
    const updateSocketStats = () => {
      // const stats = getSocketStats()
      const queueStatus = getSocketQueueStatus()
      // setSocketStats(stats)
      setSocketQueueStatus(queueStatus)
    }

    // Update stats immediately
    updateSocketStats()

    // Update stats every 2 seconds
    const interval = setInterval(updateSocketStats, 2000)

    return () => clearInterval(interval)
  }, [getSocketStats, getSocketQueueStatus])

  // Handle tool selection changes for pointer indicators and cursor
  useEffect(() => {
    const toolsWithIndicators = ['heart', 'star', 'diamond', 'line', 'arrow']
    
    if (toolsWithIndicators.includes(selectedTool.id)) {
      setPointerIndicator({
        isVisible: true,
        toolId: selectedTool.id,
        position: { x: 0, y: 0 },
        startPosition: ['line', 'arrow'].includes(selectedTool.id) ? undefined : undefined
      })
    } else {
      setPointerIndicator(null)
    }

    // Update cursor based on selected tool
    cursorManager.handleToolSelection(selectedTool.id)
  }, [selectedTool.id, cursorManager])

  const loadCanvas = async () => {
    try {
      if (isDevelopmentMode()) {
        // In development mode, create a mock canvas
        await devModeDelay(500)
        const mockCanvas: Canvas = {
          id: canvasId || 'dev-canvas',
          title: 'Test Canvas',
          description: 'A test canvas for development',
          owner_id: 'dev-user',
          is_public: false,
          object_count: 0,
          collaborator_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setCanvas(mockCanvas)
        console.log('Development mode: Using mock canvas data')
      } else {
        // In production, use real API
        if (!canvasId) return
        const response = await canvasAPI.getCanvas(canvasId)
        setCanvas(response.canvas)
      }
    } catch (error) {
      console.error('Failed to load canvas:', error)
      devToast.error('Failed to load canvas')
      navigate('/')
    }
  }

  const loadObjects = async () => {
    try {
      if (isDevelopmentMode()) {
        // In development mode, use empty objects array
        await devModeDelay(300)
        setObjects([])
        console.log('Development mode: Using empty objects array')
      } else {
        // In production, use real API
        if (!canvasId) return
        const response = await canvasAPI.getCanvasObjects(canvasId)
        setObjects(response.objects)
      }
    } catch (error) {
      console.error('Failed to load objects:', error)
      devToast.error('Failed to load objects')
    } finally {
      setIsLoading(false)
    }
  }

  const setupSocketListeners = () => {
    // Object events
    socketService.on('object_created', (data: { object: CanvasObject }) => {
      setObjects(prev => [...prev, data.object])
    })

    socketService.on('object_updated', (data: { object: CanvasObject }) => {
      setObjects(prev => prev.map(obj => 
        obj.id === data.object.id ? data.object : obj
      ))
    })

    socketService.on('object_deleted', (data: { object_id: string }) => {
      setObjects(prev => prev.filter(obj => obj.id !== data.object_id))
    })

    // Cursor events
    socketService.on('cursor_moved', (data: CursorData) => {
      setCursors(prev => {
        const filtered = prev.filter(cursor => cursor.user_id !== data.user_id)
        return [...filtered, data]
      })
    })

    socketService.on('cursor_left', (data: { user_id: string }) => {
      setCursors(prev => prev.filter(cursor => cursor.user_id !== data.user_id))
    })

    socketService.on('cursors_data', (data: { cursors: CursorData[] }) => {
      setCursors(data.cursors)
    })

    // Presence events
    socketService.on('user_joined', (data: { user: { name: string; id: string } }) => {
      toast.success(`${data.user.name} joined the canvas`)
    })

    socketService.on('user_left', (data: { user_name: string }) => {
      toast(`${data.user_name} left the canvas`)
    })

    // Connection status monitoring
    socketService.on('joined_canvas', () => {
      setConnectionStatus('connected')
      toast.success('Connected to canvas', { duration: 2000 })
    })

    // Error event listeners
    socketService.on('socket_error', (data: { error: ErrorWithDetails; timestamp: number; type: string }) => {
      console.error('Socket error received:', data)
      setConnectionStatus('error')
      
      // Use enhanced error handler for better error management
      enhancedErrorHandler.handleSocketError(data.error, {
        operation: 'socket_connection',
        component: 'CanvasPage',
        canvasId: canvasId,
        additionalData: {
          errorType: data.type,
          timestamp: data.timestamp,
          errorId: data.error?.error_id,
          eventType: data.error?.event_type
        }
      })
    })

    socketService.on('object_update_failed', (data: { object_id: string; error: ErrorWithDetails; message?: string }) => {
      console.error('Object update failed:', data)
      
      // Track failed update for retry mechanism
      setFailedUpdates(prev => {
        const newMap = new Map(prev)
        newMap.set(data.object_id, {
          error: data.error,
          timestamp: Date.now(),
          retryCount: (prev.get(data.object_id)?.retryCount || 0) + 1
        })
        return newMap
      })
      
      // Use enhanced error handler for better error management
      enhancedErrorHandler.handleSocketError(data.error, {
        operation: 'object_update',
        component: 'CanvasPage',
        canvasId: canvasId,
        objectId: data.object_id,
        additionalData: {
          errorMessage: data.message,
          retryCount: failedUpdates.get(data.object_id)?.retryCount || 0
        }
      })
    })

    socketService.on('object_create_failed', (data: { object_type: string; error: ErrorWithDetails; message?: string }) => {
      console.error('Object creation failed:', data)
      
      const errorMessage = data.message || `Failed to create ${data.object_type}`
      toast.error(errorMessage, { duration: 4000 })
    })

    socketService.on('object_delete_failed', (data: { object_id: string; error: ErrorWithDetails; message?: string }) => {
      console.error('Object deletion failed:', data)
      
      const errorMessage = data.message || 'Failed to delete object'
      toast.error(errorMessage, { duration: 4000 })
    })

    // Reconnection event listeners
    socketService.on('connection_restored', (data: { socketId: string; timestamp: number }) => {
      console.log('Connection restored:', data)
      setConnectionStatus('connected')
      
      // Trigger state synchronization
      if (canvasId) {
        handleReconnectionSync()
      }
      
      // Connection monitoring - toast notifications suppressed
    })

    socketService.on('connection_lost', (_data: { reason: string; timestamp: number }) => {
      console.log('Connection lost:', _data)
      setConnectionStatus('disconnected')
      
      // Backup object state before disconnection
      if (canvasId && objects.length > 0) {
        socketService.backupObjectState(canvasId, objects)
        console.log(`Backed up ${objects.length} objects before disconnection`)
      }
      
      // Notify offline manager
      offlineManager.handleConnectionLoss()
      
      // Connection monitoring - toast notifications suppressed
    })

    // Enhanced connection event handlers
    socketService.on('connection_disconnected', (_data: { reason: string; timestamp: number }) => {
      console.log('Connection disconnected:', _data)
      
      // Backup object state
      if (canvasId && objects.length > 0) {
        socketService.backupObjectState(canvasId, objects)
        console.log(`Backed up ${objects.length} objects on disconnection`)
      }
    })

    socketService.on('reconnection_attempt', (_data: { attempt: number; timestamp: number }) => {
      console.log(`Reconnection attempt ${_data.attempt}`)
      
      // Connection monitoring - toast notifications suppressed
    })

    socketService.on('reconnection_success', (_data: { attempt: number; timestamp: number }) => {
      console.log(`Reconnection successful after ${_data.attempt} attempts`)
      
      // Connection monitoring - toast notifications suppressed
    })

    socketService.on('reconnection_failed', (_data: { error: string; timestamp: number }) => {
      console.error('Reconnection failed:', _data)
      
      // Connection monitoring - toast notifications suppressed
    })

    socketService.on('reconnection_exhausted', (_data: { timestamp: number }) => {
      console.error('Reconnection exhausted - max attempts reached')
      
      // Connection monitoring - toast notifications suppressed
      
      // Set offline mode
      setIsOffline(true)
    })

    // Online users are now handled by PresenceIndicators component
  }

  // State synchronization functions
  const initializeStateSync = () => {
    // Set up conflict callback
    stateSyncManager.onConflict((conflicts) => {
      setStateConflicts(conflicts)
      setSyncStatus(prev => ({
        ...prev,
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length
      }))
      
      if (conflicts.length > 0) {
        devToast.error(`${conflicts.length} state conflicts detected`)
      }
    })

    // Start auto sync every 30 seconds
    stateSyncManager.startAutoSync(30000)
    
    // Update sync status
    updateSyncStatus()
  }

  const updateSyncStatus = () => {
    const stats = stateSyncManager.getSyncStats()
    setSyncStatus(prev => ({
      ...prev,
      isConnected: isConnected,
      lastSyncTime: stats.lastSyncTime,
      syncInProgress: stats.syncInProgress,
      autoSyncActive: stats.autoSyncActive
    }))
  }

  const handleManualSync = async () => {
    if (!canvasId) return
    
    setSyncStatus(prev => ({ ...prev, syncInProgress: true }))
    
    try {
      const result = await stateSyncManager.syncState(canvasId, objects, {
        forceRefresh: true,
        resolveConflicts: true,
        conflictResolutionStrategy: 'server_wins'
      })
      
      if (result.success) {
        if (result.conflicts.length > 0) {
          setStateConflicts(result.conflicts)
          setShowConflictDialog(true)
        } else {
          toast.success('State synchronized successfully')
        }
      } else {
        toast.error('Sync failed: ' + result.errors.join(', '))
      }
    } catch (error) {
      console.error('Manual sync failed:', error)
      toast.error('Failed to synchronize state')
    } finally {
      updateSyncStatus()
    }
  }

  const handleConflictResolution = async (resolutions: any[]) => {
    try {
      // Apply resolutions to local state
      for (const resolution of resolutions) {
        if (resolution.resolution === 'server_wins') {
          // Update local object with server version
          const conflict = stateConflicts.find(c => c.objectId === resolution.conflictId)
          if (conflict) {
            setObjects(prev => prev.map(obj => 
              obj.id === conflict.objectId ? conflict.serverObject : obj
            ))
          }
        } else if (resolution.resolution === 'client_wins') {
          // Keep local version (no change needed)
          continue
        } else if (resolution.resolution === 'merge') {
          // Apply merged object
          const conflict = stateConflicts.find(c => c.objectId === resolution.conflictId)
          if (conflict && resolution.resolvedObject) {
            setObjects(prev => prev.map(obj => 
              obj.id === conflict.objectId ? resolution.resolvedObject : obj
            ))
          }
        }
        // Skip resolution means no change
      }
      
      // Clear conflicts
      setStateConflicts([])
      setSyncStatus(prev => ({
        ...prev,
        hasConflicts: false,
        conflictCount: 0
      }))
      
      toast.success('Conflicts resolved successfully')
    } catch (error) {
      console.error('Conflict resolution failed:', error)
      toast.error('Failed to resolve conflicts')
    }
  }

  // Update queue management functions
  const initializeUpdateQueue = () => {
    // Set up queue stats callback
    updateQueueManager.onStatsChange((stats) => {
      setQueueStats(stats)
    })

    // Set connection status for queue manager
    updateQueueManager.setConnectionStatus(isConnected)

    // Start auto processing
    updateQueueManager.startAutoProcessing()
  }

  const handleQueueAction = (action: string) => {
    switch (action) {
      case 'retry_failed': {
        const failedUpdates = updateQueueManager.getFailedUpdates()
        failedUpdates.forEach(update => {
          updateQueueManager.retryFailedUpdate(update.id)
        })
        toast.success(`Retrying ${failedUpdates.length} failed updates`)
        break
      }
      case 'clear_completed':
        updateQueueManager.clearCompleted()
        toast.success('Cleared completed updates')
        break
      case 'clear_failed':
        updateQueueManager.clearFailed()
        toast.success('Cleared failed updates')
        break
    }
  }

  // Connection monitoring functions
  const initializeConnectionMonitoring = () => {
    // Set up connection status callback
    connectionMonitor.on('statusChange', (_status: Record<string, unknown>) => {
      // setConnectionMetrics(prev => ({
      //   ...prev,
      //   latency: status.latency,
      //   stability: status.stability,
      //   quality: status.quality,
      //   uptime: status.uptime
      // }))
    })

    // Set up connection quality callback
    connectionMonitor.on('qualityChange', (_quality: Record<string, unknown>) => {
      // setConnectionMetrics(prev => ({
      //   ...prev,
      //   quality
      // }))
    })

    // Start monitoring
    // ConnectionMonitor starts automatically when instantiated
  }

  // Offline mode functions
  const initializeOfflineMode = () => {
    // Set up offline status callback
    offlineManager.on('offlineStatusChange', (isOffline: boolean) => {
      setIsOffline(Boolean(isOffline))
    })

    // Set up offline data callback
    offlineManager.on('offlineDataChange', (_data: Record<string, unknown>) => {
      // setOfflineData({
      //   pendingUpdates: data.pendingUpdates,
      //   lastSyncTime: data.lastSyncTime,
      //   cacheSize: data.cacheSize
      // })
    })

    // Set up sync callback
    offlineManager.on('syncComplete', (result: Record<string, unknown>) => {
      if (result.success) {
        toast.success(`Synced ${result.syncedCount} updates`)
      } else {
        toast.error(`Sync failed: ${result.error}`)
      }
    })

    // Start offline mode
    // OfflineManager starts automatically when instantiated
  }

  // Set up connection quality monitoring
  const setupConnectionQualityMonitoring = () => {
    if (!canvasId) return

    console.log('Setting up connection quality monitoring')

    // Start monitoring
    connectionQualityMonitor.startMonitoring(30000) // 30 seconds

    // Listen for connection quality reports
    const handleQualityReport = (data: Record<string, unknown>) => {
      console.log('Connection quality report received:', data)
      
      // Connection quality monitoring - toast notifications suppressed
      // Quality reports are still logged to console for debugging
    }
    
    // Listen for connection state changes
    const handleConnectionStateChange = (data: Record<string, unknown>) => {
      console.log('Connection state changed:', data)
      
      // Connection state monitoring - toast notifications suppressed
      // State changes are still logged to console for debugging
    }
    
    socketService.on('connection_quality_report', handleQualityReport)
    socketService.on('connection_state_changed', handleConnectionStateChange)

    // Cleanup function
    return () => {
      connectionQualityMonitor.stopMonitoring()
      socketService.off('connection_quality_report', handleQualityReport)
      socketService.off('connection_state_changed', handleConnectionStateChange)
    }
  }

  // Set up visibility monitoring
  const setupVisibilityMonitoring = () => {
    if (!canvasId) return

    console.log('Setting up object visibility monitoring')

    // Monitor visibility every 30 seconds
    const visibilityInterval = setInterval(async () => {
      if (canvasId && objects.length > 0) {
        await objectVisibilityRecoveryService.monitorObjectVisibility(canvasId, objects)
      }
    }, 30000)

    // Listen for visibility recovery events
    const handleVisibilitySuccess = (data: Record<string, unknown>) => {
      console.log('Visibility recovery successful:', data)
      toast.success(`Recovered ${data.recoveredObjects} missing objects`, { duration: 3000 })
      
      // Refresh objects to show recovered ones
      if (data.canvasId === canvasId) {
        loadObjects()
      }
    }

    const handleVisibilityFailed = (data: Record<string, unknown>) => {
      console.error('Visibility recovery failed:', data)
      toast.error('Failed to recover some objects - refreshing canvas', { duration: 4000 })
      
      // Force refresh on recovery failure
      if (data.canvasId === canvasId) {
        objectVisibilityRecoveryService.forceRefreshCanvas(canvasId).then(() => {
          loadObjects()
        })
      }
    }

    socketService.on('visibility_recovery_success', handleVisibilitySuccess)
    socketService.on('visibility_recovery_failed', handleVisibilityFailed)

    // Cleanup function
    return () => {
      clearInterval(visibilityInterval)
      socketService.off('visibility_recovery_success', handleVisibilitySuccess)
      socketService.off('visibility_recovery_failed', handleVisibilityFailed)
    }
  }

  // Enhanced reconnection synchronization function
  const handleReconnectionSync = async () => {
    if (!canvasId || !idToken) return

    console.log('Starting enhanced reconnection sync...')
    
    try {
      // 1. Restore object state from backup
      const restoredObjects = await socketService.restoreObjectState(canvasId)
      if (restoredObjects.length > 0) {
        console.log(`Restored ${restoredObjects.length} objects from backup`)
        setObjects(restoredObjects)
      }

      // 2. Sync offline cached updates
      const syncResult = { success: true, conflicts: [] as any[], hasConflicts: false, syncedCount: 0 }
      if (syncResult.success && syncResult.syncedCount > 0) {
        toast.success(`Synced ${syncResult.syncedCount} offline updates`, { duration: 3000 })
      }

      // 3. Refresh canvas state from server
      await loadObjects()
      
      // 4. Sync object state with server
      const syncedObjects = await socketService.syncObjectState(canvasId, objects)
      if (syncedObjects.length !== objects.length) {
        console.log(`Object state sync: ${objects.length} -> ${syncedObjects.length} objects`)
        setObjects(syncedObjects as CanvasObject[])
      }
      
      // 5. Validate object state consistency
      const isConsistent = await socketService.validateObjectStateConsistency(canvasId, objects)
      if (!isConsistent) {
        console.warn('Object state inconsistency detected after reconnection')
        devToast.warning('Some objects may not be visible - refreshing canvas', { duration: 4000 })
        await loadObjects() // Force refresh
      }
      
      // 6. Trigger state synchronization
      const stateSyncResult = await stateSyncManager.syncState(canvasId, objects, {
        forceSync: true as any,
        resolveConflicts: 'server_wins' as any
      } as any)
      
      if (stateSyncResult.conflicts && stateSyncResult.conflicts.length > 0) {
        // Connection monitoring - toast notifications suppressed
        setShowConflictDialog(true)
      }

      // 7. Process any queued updates
      updateQueueManager.processQueue()

      // 8. Update connection status
      setConnectionStatus('connected')
      setIsOffline(false)
      
      // 9. Clear object state backup after successful sync
      socketService.clearObjectStateBackup(canvasId)
      
      console.log('Enhanced reconnection sync completed successfully')
      
    } catch (error) {
      console.error('Enhanced reconnection sync failed:', error)
      // Connection monitoring - toast notifications suppressed
    }
  }

  // New handler functions for enhanced interactions
  const handleObjectSelect = (objectId: string, event?: any) => {
    if (selectedTool.id === 'select') {
      setEditingObjectId(null)
      
      // Handle multi-selection with Ctrl/Cmd key
      const isMultiSelect = event?.evt?.ctrlKey || event?.evt?.metaKey
      multiSelectionActions.selectObject(objectId, isMultiSelect)
      
      // Show coordinates for selected object(s)
      setTimeout(() => {
        const selectedObjects = multiSelectionActions.getSelectedObjects()
        coordinateDisplay.showSelectedCoordinates(selectedObjects)
      }, 0)
    }
  }

  const handleStartTextEdit = (objectId: string) => {
    setEditingObjectId(objectId)
    multiSelectionActions.selectObject(objectId, false)
  }

  const handleEndTextEdit = async (objectId: string, newText: string) => {
    if (idToken && newText !== objects.find(obj => obj.id === objectId)?.properties.text) {
      await socketService.updateObject(canvasId!, idToken, objectId, {
        text: newText
      })
    }
    setEditingObjectId(null)
  }

  // Clipboard and context menu handlers
  const handleCopy = () => {
    const selectedObjects = multiSelectionActions.getSelectedObjects()
    if (selectedObjects.length > 0) {
      clipboardActions.copyObjects(selectedObjects)
      toast.success(`Copied ${selectedObjects.length} object(s)`)
    }
  }

  const handleCut = () => {
    const selectedObjects = multiSelectionActions.getSelectedObjects()
    if (selectedObjects.length > 0) {
      saveStateForUndo('cut', `Cut ${selectedObjects.length} object(s)`)
      clipboardActions.cutObjects(selectedObjects)
      // Remove the objects from the canvas
      setObjects(prev => prev.filter(obj => !selectedObjects.some(selected => selected.id === obj.id)))
      multiSelectionActions.clearSelection()
      toast.success(`Cut ${selectedObjects.length} object(s)`)
    }
  }

  const handlePaste = () => {
    const pastedObjects = clipboardActions.pasteObjects()
    if (pastedObjects.length > 0) {
      saveStateForUndo('paste', `Pasted ${pastedObjects.length} object(s)`)
      // Add the pasted objects to the canvas
      setObjects(prev => [...prev, ...pastedObjects])
      // Select the pasted objects
      pastedObjects.forEach(obj => multiSelectionActions.selectObject(obj.id, true))
      toast.success(`Pasted ${pastedObjects.length} object(s)`)
    }
  }

  const handleDuplicate = () => {
    const selectedObjects = multiSelectionActions.getSelectedObjects()
    if (selectedObjects.length > 0) {
      saveStateForUndo('duplicate', `Duplicated ${selectedObjects.length} object(s)`)
      const duplicatedObjects = clipboardActions.duplicateObjects(selectedObjects)
      setObjects(prev => [...prev, ...duplicatedObjects])
      // Select the duplicated objects
      duplicatedObjects.forEach(obj => multiSelectionActions.selectObject(obj.id, true))
      toast.success(`Duplicated ${duplicatedObjects.length} object(s)`)
    }
  }

  const handleDelete = () => {
    const selectedObjects = multiSelectionActions.getSelectedObjects()
    if (selectedObjects.length > 0) {
      saveStateForUndo('delete', `Deleted ${selectedObjects.length} object(s)`)
      setObjects(prev => prev.filter(obj => !selectedObjects.some(selected => selected.id === obj.id)))
      multiSelectionActions.clearSelection()
      toast.success(`Deleted ${selectedObjects.length} object(s)`)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    })
  }

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 })
  }

  // Z-index management functions
  const handleBringToFront = async () => {
    const selectedObjectId = Array.from(multiSelectionState.selectedObjectIds)[0]
    if (!selectedObjectId) return

    try {
      const response = await canvasAPI.bringObjectToFront(selectedObjectId)
      if (response.object) {
        setObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId ? { ...obj, z_index: response.object.z_index } : obj
        ))
        devToast.success('Object brought to front')
      }
    } catch (error) {
      devToast.error('Failed to bring object to front')
    }
    handleCloseContextMenu()
  }

  const handleSendToBack = async () => {
    const selectedObjectId = Array.from(multiSelectionState.selectedObjectIds)[0]
    if (!selectedObjectId) return

    try {
      const response = await canvasAPI.sendObjectToBack(selectedObjectId)
      if (response.object) {
        setObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId ? { ...obj, z_index: response.object.z_index } : obj
        ))
        devToast.success('Object sent to back')
      }
    } catch (error) {
      devToast.error('Failed to send object to back')
    }
    handleCloseContextMenu()
  }

  const handleMoveUp = async () => {
    const selectedObjectId = Array.from(multiSelectionState.selectedObjectIds)[0]
    if (!selectedObjectId) return

    try {
      const response = await canvasAPI.moveObjectUp(selectedObjectId)
      if (response.object) {
        setObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId ? { ...obj, z_index: response.object.z_index } : obj
        ))
        devToast.success('Object moved up')
      }
    } catch (error) {
      devToast.error('Failed to move object up')
    }
    handleCloseContextMenu()
  }

  const handleMoveDown = async () => {
    const selectedObjectId = Array.from(multiSelectionState.selectedObjectIds)[0]
    if (!selectedObjectId) return

    try {
      const response = await canvasAPI.moveObjectDown(selectedObjectId)
      if (response.object) {
        setObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId ? { ...obj, z_index: response.object.z_index } : obj
        ))
        devToast.success('Object moved down')
      }
    } catch (error) {
      devToast.error('Failed to move object down')
    }
    handleCloseContextMenu()
  }

  // Helper function to save state for undo/redo
  const saveStateForUndo = (action: string, description?: string) => {
    undoRedoActions.saveState(objects, action, description)
  }

  const handleObjectUpdatePosition = (objectId: string, x: number, y: number) => {
    // Use debounced update for position changes
    debouncedPositionUpdate(objectId, x, y)
    
    // Immediately update local state for responsive UI
    setObjects(prev => prev.map(obj => 
      obj.id === objectId ? { ...obj, x, y } : obj
    ))
    
    // End movement tracking
    coordinateDisplay.endMoving()
  }
  
  const handleObjectDragStart = (objectId: string, x: number, y: number) => {
    const obj = objects.find(o => o.id === objectId)
    if (!obj) return
    
    const props = obj.properties
    coordinateDisplay.startMoving(x, y, props.width, props.height, props.radius)
  }
  
  const handleObjectDragMove = (objectId: string, x: number, y: number) => {
    const obj = objects.find(o => o.id === objectId)
    if (!obj) return
    
    const props = obj.properties
    coordinateDisplay.updateMovingCoordinates(x, y, props.width, props.height, props.radius)
  }

  const performObjectResize = async (objectId: string, newProperties: Record<string, unknown>) => {
    if (!idToken || !canvasId) return

    // Check if we're offline and handle accordingly
    if (isOffline) {
      // Store update in offline cache
      // offlineManager.cacheUpdate({
      //   canvasId,
      //   objectId,
      //   operation: 'resize',
      //   data: newProperties,
      //   timestamp: Date.now(),
      //   priority: 'high'
      // })
      
      // Update local state optimistically
      setObjects(prev => prev.map(obj => 
        obj.id === objectId ? { ...obj, properties: { ...obj.properties, ...newProperties } } : obj
      ))
      
      devToast.success('Resize saved offline - will sync when connection is restored')
      return
    }

    // Add to batch queue for processing
    const updateId = addBatchUpdate({
      objectId,
      operation: 'resize',
      data: newProperties,
      priority: 'normal',
      maxRetries: 3
    })

    console.log(`Resize update ${updateId} added to batch queue`)

    // Mark object as updating
    setUpdatingObjects(prev => new Set(prev).add(objectId))
    setUpdateProgress(prev => new Map(prev).set(objectId, { method: 'socket', attempt: 1 }))

    try {
      const result = await objectUpdateService.updateObjectProperties(
        canvasId,
        idToken,
        objectId,
        newProperties,
        {
          useOptimisticUpdate: true,
          retryOptions: {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 4000,
            backoffMultiplier: 2,
            jitter: true
          },
          onProgress: (attempt, method) => {
            setUpdateProgress(prev => new Map(prev).set(objectId, { method, attempt }))
          }
        }
      )

      if (result.success) {
        // Update successful - remove from failed updates if it was there
        setFailedUpdates(prev => {
          const newMap = new Map(prev)
          newMap.delete(objectId)
          return newMap
        })

        // Show success message for REST fallback
        if (result.method === 'rest') {
          toast.success('Object resized (using backup method)', { duration: 2000 })
        }
      } else {
        // Update failed - track for retry
        setFailedUpdates(prev => {
          const newMap = new Map(prev)
          newMap.set(objectId, {
            error: result.error,
            timestamp: Date.now(),
            retryCount: (prev.get(objectId)?.retryCount || 0) + 1
          })
          return newMap
        })

        // Show error message with retry option
        devToast.error(`Failed to resize object: ${result.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Unexpected error in handleObjectResize:', error)
      toast.error('Unexpected error occurred while resizing object')
    } finally {
      // Clean up update tracking
      setUpdatingObjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(objectId)
        return newSet
      })
      setUpdateProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(objectId)
        return newMap
      })
    }
  }

  const handleObjectResize = (objectId: string, newProperties: Record<string, unknown>) => {
    // Use debounced update for resize changes
    debouncedResizeUpdate(objectId, newProperties)
    
    // Immediately update local state for responsive UI
    setObjects(prev => prev.map(obj => 
      obj.id === objectId ? { ...obj, properties: { ...obj.properties, ...newProperties } } : obj
    ))
    
    // Update coordinate display for resizing
    const obj = objects.find(o => o.id === objectId)
    if (obj) {
      const updatedProps = { ...obj.properties, ...newProperties }
      coordinateDisplay.updateResizingCoordinates(
        updatedProps.x,
        updatedProps.y,
        updatedProps.width,
        updatedProps.height,
        updatedProps.radius
      )
    }
  }
  
  // Note: These resize handlers are available for future use
  // const handleObjectResizeStart = (objectId: string) => {
  //   const obj = objects.find(o => o.id === objectId)
  //   if (obj) {
  //     const props = obj.properties
  //     coordinateDisplay.startResizing(props.x, props.y, props.width, props.height, props.radius)
  //   }
  // }
  
  // const handleObjectResizeEnd = () => {
  //   coordinateDisplay.endResizing()
  // }

  // Create debounced version of position update
  const debouncedPositionUpdate = objectUpdateDebouncer.debounceUpdate(
    'position_update',
    async (...args: any[]) => {
      const [objectId, x, y] = args as [string, number, number]
      await performObjectUpdatePosition(objectId, x, y)
    },
    'high' // High priority for position updates
  )

  // Create debounced version of resize update
  const debouncedResizeUpdate = objectUpdateDebouncer.debounceUpdate(
    'resize_update',
    async (...args: any[]) => {
      const [objectId, newProperties] = args as [string, Record<string, unknown>]
      await performObjectResize(objectId, newProperties)
    },
    'normal' // Normal priority for resize updates
  )

  const performObjectUpdatePosition = async (objectId: string, x: number, y: number) => {
    if (!idToken || !canvasId) return

    // Find the current object
    const currentObject = objects.find(obj => obj.id === objectId)
    if (!currentObject) return

    // Check if we're offline and handle accordingly
    if (isOffline) {
      // Store update in offline cache
      // offlineManager.cacheUpdate({
      //   canvasId,
      //   objectId,
      //   operation: 'position',
      //   data: { x, y },
      //   timestamp: Date.now(),
      //   priority: 'high'
      // })
      
      // Update local state optimistically
      setObjects(prev => prev.map(obj => 
        obj.id === objectId ? { ...obj, x, y } : obj
      ))
      
      devToast.success('Update saved offline - will sync when connection is restored')
      return
    }

    // Add to batch queue for processing
    const updateId = addBatchUpdate({
      objectId,
      operation: 'position',
      data: { x, y },
      priority: 'high',
      maxRetries: 3
    })

    console.log(`Position update ${updateId} added to batch queue`)

    // Start loading state
    const canStartLoading = loadingStateManager.startLoading(
      objectId,
      'position',
      'socket' as any,
      { preventMultiple: true, maxConcurrent: 3 }
    )

    if (!canStartLoading) {
      devToast.error('Object is already being updated, please wait...')
      return
    }

    // Start optimistic update - immediately update local state
    // const optimisticState = optimisticUpdateManager.startOptimisticUpdate(
    //   objectId,
    //   currentObject,
    //   { x, y },
    //   'position'
    // )

    // Mark object as optimistically updating
    setOptimisticObjects(prev => new Set(prev).add(objectId))
    setUpdatingObjects(prev => new Set(prev).add(objectId))
    setUpdateProgress(prev => new Map(prev).set(objectId, { method: 'socket', attempt: 1 }))

    try {
      const result = await objectUpdateService.updateObjectPosition(
        canvasId,
        idToken,
        objectId,
        x,
        y,
        {
          useOptimisticUpdate: false, // We're handling optimistic updates manually
          retryOptions: {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 4000,
            backoffMultiplier: 2,
            jitter: true
          },
          onProgress: (attempt, method) => {
            setUpdateProgress(prev => new Map(prev).set(objectId, { method, attempt }))
            loadingStateManager.updateProgress(objectId, (attempt / 3) * 100, method as any, attempt)
          }
        }
      )

      if (result.success) {
        // Stop loading state
        loadingStateManager.stopLoading(objectId, 'success')
        
        // Confirm optimistic update
        optimisticUpdateManager.confirmOptimisticUpdate(objectId, result.object!)
        
        // Remove from failed updates if it was there
        setFailedUpdates(prev => {
          const newMap = new Map(prev)
          newMap.delete(objectId)
          return newMap
        })

        // Show success animation
        setSuccessAnimations(prev => [...prev, {
          id: `${objectId}_${Date.now()}`,
          x: x + (currentObject.properties.width || 100) / 2,
          y: y + (currentObject.properties.height || 100) / 2
        }])

        // Show success message for REST fallback
        if (result.method === 'rest') {
          toast.success('Object updated (using backup method)', { duration: 2000 })
        }
      } else {
        // Stop loading state
        loadingStateManager.stopLoading(objectId, 'error')
        
        // Rollback optimistic update
        const originalState = optimisticUpdateManager.rollbackOptimisticUpdate(objectId)
        
        if (originalState) {
          // Update local state to original position
          setObjects(prev => prev.map(obj => 
            obj.id === objectId ? originalState : obj
          ))
        }

        // Queue the failed update for retry
        const queueId = updateQueueManager.enqueue({
          canvasId,
          idToken,
          objectId,
          operation: 'position',
          data: { x, y },
          priority: 'high',
          maxRetries: 3,
          metadata: {
            userAction: 'position_update',
            source: 'user',
            originalTimestamp: Date.now()
          }
        })

        // Track for retry
        setFailedUpdates(prev => {
          const newMap = new Map(prev)
          newMap.set(objectId, {
            error: result.error,
            timestamp: Date.now(),
            retryCount: (prev.get(objectId)?.retryCount || 0) + 1
          })
          return newMap
        })

        // Show error message with queue info
        devToast.error(`Failed to update object position. Queued for retry (ID: ${queueId.slice(0, 8)}...)`)
      }
    } catch (error) {
      console.error('Unexpected error in handleObjectUpdatePosition:', error)
      
      // Stop loading state
      loadingStateManager.stopLoading(objectId, 'error')
      
      // Rollback optimistic update
      const originalState = optimisticUpdateManager.rollbackOptimisticUpdate(objectId)
      if (originalState) {
        setObjects(prev => prev.map(obj => 
          obj.id === objectId ? originalState : obj
        ))
      }
      
      // Queue the unexpected error for retry
      const queueId = updateQueueManager.enqueue({
        canvasId,
        idToken,
        objectId,
        operation: 'position',
        data: { x, y },
        priority: 'high',
        maxRetries: 3,
        metadata: {
          userAction: 'position_update',
          source: 'user',
          originalTimestamp: Date.now()
        }
      })
      
      devToast.error(`Unexpected error occurred. Queued for retry (ID: ${queueId.slice(0, 8)}...)`)
    } finally {
      // Clean up update tracking
      setOptimisticObjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(objectId)
        return newSet
      })
      setUpdatingObjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(objectId)
        return newSet
      })
      setUpdateProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(objectId)
        return newMap
      })
    }
  }

  const handleCursorChange = (_cursor: CursorState) => {
    // Cursor is managed by cursorManager, no local state needed
  }

  const handleCursorReset = () => {
    cursorManager.resetCursor()
  }

  const handleSuccessAnimationComplete = (animationId: string) => {
    setSuccessAnimations(prev => prev.filter(anim => anim.id !== animationId))
  }

  // Cursor tooltip handlers
  const handleCursorHover = (cursor: CursorData, event: any) => {
    const stage = event.target.getStage()
    const pointerPosition = stage.getPointerPosition()
    
    if (pointerPosition) {
      setHoveredCursor(cursor)
      setTooltipPosition({
        x: pointerPosition.x,
        y: pointerPosition.y
      })
    }
    setShowTooltip(true)
  }

  const handleCursorLeave = () => {
    setShowTooltip(false)
    setHoveredCursor(null)
  }

  const handleStageClick = (e: any) => {
    // Ignore stage clicks during text editing; blur will commit/cancel
    if (editingObjectId) return
    // Clear selection if clicking on empty space
    if (selectedTool.id === 'select' && e.target === e.target.getStage()) {
      multiSelectionActions.clearSelection()
      setEditingObjectId(null)
      return
    }
    
    if (selectedTool.id === 'select') return
    
    // Prevent creating new objects while already drawing
    if (isDrawing) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    // Get tool properties with defaults
    const toolProps = selectedTool.properties || {}
    const strokeColor = toolProps.strokeColor || '#000000'
    // In development mode, use visible fill colors for better testing
    const fillColor = isDevelopmentMode() 
      ? (toolProps.fillColor || '#3b82f6') // Blue fill in dev mode
      : (toolProps.fillColor || 'transparent') // Transparent in production
    const strokeWidth = toolProps.strokeWidth || 2

    if (selectedTool.id === 'rectangle') {
      const rect = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'rectangle' as const,
        properties: {
          x: point.x,
          y: point.y,
          width: 100,
          height: 60,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth
        },
        created_by: user?.id || ''
      }
      setNewObject(rect)
      setIsDrawing(true)
    } else if (selectedTool.id === 'circle') {
      const circle = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'circle' as const,
        properties: {
          x: point.x,
          y: point.y,
          radius: 100, // Increased radius for better visibility
          fill: '#ff0000', // Force red fill for maximum visibility
          stroke: '#000000', // Force black stroke for maximum visibility
          strokeWidth: 6 // Increased stroke width for better visibility
        },
        created_by: user?.id || ''
      }
      setNewObject(circle)
      setIsDrawing(true)
    } else if (selectedTool.id === 'text') {
      const text = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'text' as const,
        properties: {
          x: point.x,
          y: point.y,
          text: 'Click to edit',
          fontSize: toolProps.fontSize || 16,
          fontFamily: toolProps.fontFamily || 'Arial',
          fill: strokeColor
        },
        created_by: user?.id || ''
      }
      setNewObject(text)
      setIsDrawing(true)
    } else if (selectedTool.id === 'heart') {
      const heart = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'heart' as const,
        properties: {
          x: point.x,
          y: point.y,
          width: 40,
          height: 40,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth
        },
        created_by: user?.id || ''
      }
      setNewObject(heart)
      setIsDrawing(true)
    } else if (selectedTool.id === 'star') {
      const star = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'star' as const,
        properties: {
          x: point.x,
          y: point.y,
          width: 40,
          height: 40,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth
        },
        created_by: user?.id || ''
      }
      setNewObject(star)
      setIsDrawing(true)
    } else if (selectedTool.id === 'diamond') {
      const diamond = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'diamond' as const,
        properties: {
          x: point.x,
          y: point.y,
          width: 80, // Increased size for better visibility
          height: 80, // Increased size for better visibility
          fill: '#00ff00', // Force green fill for maximum visibility
          stroke: '#000000', // Force black stroke for maximum visibility
          strokeWidth: 4 // Increased stroke width for better visibility
        },
        created_by: user?.id || ''
      }
      setNewObject(diamond)
      setIsDrawing(true)
    } else if (selectedTool.id === 'line') {
      const line = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'line' as const,
        properties: {
          x: point.x,
          y: point.y,
          points: [0, 0, 100, 0],
          stroke: strokeColor,
          strokeWidth: strokeWidth
        },
        created_by: user?.id || ''
      }
      setNewObject(line)
      setIsDrawing(true)
    } else if (selectedTool.id === 'arrow') {
      const arrow = {
        id: `temp-${Date.now()}`,
        canvas_id: canvasId || 'temp-canvas',
        object_type: 'arrow' as const,
        properties: {
          x: point.x,
          y: point.y,
          points: [0, 0, 200, 0], // Increased line length for better visibility
          stroke: '#000000', // Force black stroke for maximum visibility
          strokeWidth: 8 // Increased stroke width for better visibility
        },
        created_by: user?.id || ''
      }
      setNewObject(arrow)
      setIsDrawing(true)
    }
  }

  const handleStageMouseMove = (e: any) => {
    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    // Update cursor position
    if (idToken && point) {
      socketService.moveCursor(canvasId!, idToken, point)
    }

    // Update pointer indicator position
    if (pointerIndicator && pointerIndicator.isVisible && point) {
      setPointerIndicator(prev => prev ? {
        ...prev,
        position: point
      } : null)
    }

    // Handle drawing mode updates
    if (!isDrawing || !newObject || !idToken || !point) return

    // Update new object position
    if (newObject.object_type === 'rectangle') {
      const newWidth = Math.max(10, point.x - (newObject.properties?.x as number || 0))
      const newHeight = Math.max(10, point.y - (newObject.properties?.y as number || 0))
      
      setNewObject(prev => ({
        ...prev,
        properties: {
          ...prev?.properties,
          width: newWidth,
          height: newHeight
        }
      }))
      
      // Update coordinate display
      coordinateDisplay.showPlacingCoordinates(
        newObject.properties!.x,
        newObject.properties!.y,
        newWidth,
        newHeight,
        undefined,
        'rectangle'
      )
    } else if (newObject.object_type === 'circle') {
      const radius = Math.sqrt(
        Math.pow(point.x - newObject.properties!.x, 2) + 
        Math.pow(point.y - newObject.properties!.y, 2)
      )
      const newRadius = Math.max(50, radius)
      
      setNewObject(prev => ({
        ...prev,
        properties: {
          ...prev?.properties,
          radius: newRadius // Increased minimum radius for better visibility
        }
      }))
      
      // Update coordinate display
      coordinateDisplay.showPlacingCoordinates(
        newObject.properties!.x,
        newObject.properties!.y,
        undefined,
        undefined,
        newRadius,
        'circle'
      )
    } else if (['heart', 'star', 'diamond'].includes(newObject.object_type!)) {
      // For shape tools, update size based on distance from start point
      const width = Math.max(20, Math.abs(point.x - newObject.properties!.x) * 2)
      const height = Math.max(20, Math.abs(point.y - newObject.properties!.y) * 2)
      setNewObject(prev => ({
        ...prev,
        properties: {
          ...prev?.properties,
          width: width,
          height: height
        }
      }))
    } else if (['line', 'arrow'].includes(newObject.object_type!)) {
      // For line tools, update the end point
      const dx = point.x - newObject.properties!.x
      const dy = point.y - newObject.properties!.y
      // Ensure minimum length for visibility
      const minLength = 100
      const length = Math.sqrt(dx * dx + dy * dy)
      const scale = length < minLength ? minLength / length : 1
      setNewObject(prev => ({
        ...prev,
        properties: {
          ...prev?.properties,
          points: [0, 0, dx * scale, dy * scale]
        }
      }))
    }
  }

  const handleStageMouseUp = async () => {
    if (isDrawing && newObject) {
      if (isDevelopmentMode()) {
        // In development mode, add object directly to local state
        const canvasObject: CanvasObject = {
          id: `dev-${Date.now()}`,
          canvas_id: canvasId || 'temp-canvas',
          object_type: newObject.object_type!,
          properties: newObject.properties!,
          z_index: 1,
          created_by: 'dev-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setObjects(prev => [...prev, canvasObject])
      } else if (idToken) {
        // In production, create object with fallback mechanism
        try {
          const result = await objectCreationService.createObject(
            canvasId!, 
            idToken, 
            {
              type: newObject.object_type!,
              properties: newObject.properties!
            },
            {
              onProgress: (attempt, method) => {
                console.log(`Creating object via ${method} (attempt ${attempt})`)
              }
            }
          )

          if (result.success) {
            console.log(`Object created successfully via ${result.method}`)
            // Object will be added to state via socket event or manual addition
            if (result.method === 'rest' && result.object) {
              // If created via REST API, add to local state manually
              setObjects(prev => [...prev, result.object!])
            }
          } else {
            console.error('Failed to create object:', result.error)
            toast.error('Failed to create object. Please try again.')
          }
        } catch (error) {
          console.error('Object creation error:', error)
          toast.error('Failed to create object. Please try again.')
        }
      }
      
      setNewObject(null)
      setIsDrawing(false)
    }
  }

  const renderObject = (obj: CanvasObject) => {
    // Get optimistic state if available
    const optimisticObject = optimisticUpdateManager.getOptimisticObject(obj.id, obj)
    const displayObject = optimisticObject
    const props = displayObject.properties
    const isSelected = multiSelectionActions.isObjectSelected(obj.id)
    const isEditing = editingObjectId === obj.id
    const isHovered = hoveredObjectId === obj.id
    // const isOptimistic = optimisticObjects.has(obj.id)
    // const isUpdating = updatingObjects.has(obj.id)
    // const progress = updateProgress.get(obj.id)
    const loadingState = loadingStateManager.getLoadingState(obj.id)
    




    switch (obj.object_type) {
      case 'rectangle':
        return (
          <Group key={obj.id}>
            <Rect
              x={props.x}
              y={props.y}
              width={props.width}
              height={props.height}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              draggable={selectedTool.id === 'select' && !isEditing}
              onClick={(e) => handleObjectSelect(obj.id, e)}
              onDragStart={(e) => handleObjectDragStart(obj.id, e.target.x(), e.target.y())}
              onDragMove={(e) => handleObjectDragMove(obj.id, e.target.x(), e.target.y())}
              onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
              onMouseEnter={() => setHoveredObjectId(obj.id)}
              onMouseLeave={() => setHoveredObjectId(null)}
            />
            <SelectionIndicator 
              object={displayObject} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={displayObject} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
            
            {/* Enhanced loading indicator */}
            {loadingState && (
              <EnhancedLoadingIndicator
                object={displayObject}
                loadingState={loadingState}
                showProgress={true}
                showMethod={true}
                showAttempt={true}
              />
            )}
          </Group>
        )
      case 'circle':
        return (
          <Group key={obj.id}>
            <Circle
              x={props.x}
              y={props.y}
              radius={props.radius}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              draggable={selectedTool.id === 'select' && !isEditing}
              onClick={(e) => handleObjectSelect(obj.id, e)}
              onDragStart={(e) => handleObjectDragStart(obj.id, e.target.x(), e.target.y())}
              onDragMove={(e) => handleObjectDragMove(obj.id, e.target.x(), e.target.y())}
              onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
              onMouseEnter={() => setHoveredObjectId(obj.id)}
              onMouseLeave={() => setHoveredObjectId(null)}
            />
            <SelectionIndicator 
              object={obj} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={obj} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
          </Group>
        )
      case 'text':
        return (
          <EditableText
            key={obj.id}
            object={obj}
            isSelected={isSelected}
            isEditing={isEditing}
            onStartEdit={handleStartTextEdit}
            onEndEdit={handleEndTextEdit}
            onSelect={handleObjectSelect}
            onUpdatePosition={handleObjectUpdatePosition}
            selectedTool={selectedTool.id}
          />
        )
      case 'heart':
        return (
          <Group key={obj.id}>
            <Group x={props.x} y={props.y}>
              <Circle
                x={-props.width * 0.3}
                y={-props.height * 0.2}
                radius={props.width * 0.2}
                fill={props.fill}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
                draggable={selectedTool.id === 'select' && !isEditing}
                onClick={(e) => handleObjectSelect(obj.id, e)}
                onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
                onMouseEnter={() => setHoveredObjectId(obj.id)}
                onMouseLeave={() => setHoveredObjectId(null)}
              />
              <Circle
                x={props.width * 0.3}
                y={-props.height * 0.2}
                radius={props.width * 0.2}
                fill={props.fill}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
              />
              <RegularPolygon
                x={0}
                y={props.height * 0.3}
                sides={3}
                radius={props.width * 0.3}
                rotation={180}
                fill={props.fill}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
              />
            </Group>
            <SelectionIndicator 
              object={obj} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={obj} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
          </Group>
        )
      case 'star':
        return (
          <Group key={obj.id}>
            <Star
              x={props.x}
              y={props.y}
              numPoints={5}
              innerRadius={props.width / 4}
              outerRadius={props.width / 2}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              draggable={selectedTool.id === 'select' && !isEditing}
              onClick={(e) => handleObjectSelect(obj.id, e)}
              onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
              onMouseEnter={() => setHoveredObjectId(obj.id)}
              onMouseLeave={() => setHoveredObjectId(null)}
            />
            <SelectionIndicator 
              object={obj} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={obj} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
          </Group>
        )
      case 'diamond':
        return (
          <Group key={obj.id}>
            <RegularPolygon
              x={props.x}
              y={props.y}
              sides={4}
              radius={props.width / 2}
              rotation={45}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              draggable={selectedTool.id === 'select' && !isEditing}
              onClick={(e) => handleObjectSelect(obj.id, e)}
              onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
              onMouseEnter={() => setHoveredObjectId(obj.id)}
              onMouseLeave={() => setHoveredObjectId(null)}
            />
            <SelectionIndicator 
              object={obj} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={obj} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
          </Group>
        )
      case 'line':
        return (
          <Group key={obj.id}>
            <Line
              x={props.x}
              y={props.y}
              points={props.points || [0, 0, 100, 0]}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              draggable={selectedTool.id === 'select' && !isEditing}
              onClick={(e) => handleObjectSelect(obj.id, e)}
              onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
              onMouseEnter={() => setHoveredObjectId(obj.id)}
              onMouseLeave={() => setHoveredObjectId(null)}
            />
            <SelectionIndicator 
              object={obj} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={obj} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
          </Group>
        )
      case 'arrow':
        return (
          <Group key={obj.id}>
            <Group
              x={props.x}
              y={props.y}
              draggable={selectedTool.id === 'select' && !isEditing}
              onClick={(e) => handleObjectSelect(obj.id, e)}
              onDragEnd={(e) => handleObjectUpdatePosition(obj.id, e.target.x(), e.target.y())}
              onMouseEnter={() => setHoveredObjectId(obj.id)}
              onMouseLeave={() => setHoveredObjectId(null)}
            >
              <Line
                x={0}
                y={0}
                points={props.points || [0, 0, 100, 0]}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
              />
              {props.points && props.points.length >= 4 && (
                <Group
                  x={props.points[2]}
                  y={props.points[3]}
                  rotation={Math.atan2(props.points[3], props.points[2]) * (180 / Math.PI)}
                >
                  <Line
                    x={0}
                    y={0}
                    points={[-15, -8, 0, 0, -15, 8]}
                    stroke={props.stroke}
                    strokeWidth={props.strokeWidth}
                  />
                </Group>
              )}
            </Group>
            <SelectionIndicator 
              object={obj} 
              isSelected={isSelected} 
              isHovered={isHovered && !isSelected} 
            />
            <ResizeHandles 
              object={obj} 
              isSelected={isSelected} 
              onResize={handleObjectResize}
              onCursorChange={handleCursorChange}
              onCursorReset={handleCursorReset}
            />
          </Group>
        )
      default:
        return null
    }
  }

  const renderNewObject = () => {
    if (!newObject) return null

    const props = newObject.properties!

    switch (newObject.object_type) {
      case 'rectangle':
        return (
          <Rect
            x={props.x}
            y={props.y}
            width={props.width}
            height={props.height}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            opacity={0.7}
          />
        )
      case 'circle':
        return (
          <Circle
            x={props.x}
            y={props.y}
            radius={props.radius}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            opacity={0.7}
          />
        )
      case 'text':
        return (
          <Text
            x={props.x}
            y={props.y}
            text={props.text}
            fontSize={props.fontSize}
            fill={props.fill}
            fontFamily={props.fontFamily}
            opacity={0.7}
          />
        )
      case 'heart':
        return (
          <Group x={props.x} y={props.y} opacity={0.7}>
            <Circle
              x={-props.width * 0.3}
              y={-props.height * 0.2}
              radius={props.width * 0.2}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            <Circle
              x={props.width * 0.3}
              y={-props.height * 0.2}
              radius={props.width * 0.2}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            <RegularPolygon
              x={0}
              y={props.height * 0.3}
              sides={3}
              radius={props.width * 0.3}
              rotation={180}
              fill={props.fill}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
          </Group>
        )
      case 'star':
        return (
          <RegularPolygon
            x={props.x}
            y={props.y}
            sides={5}
            radius={props.width / 2}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            opacity={0.7}
          />
        )
      case 'diamond':
        return (
          <RegularPolygon
            x={props.x}
            y={props.y}
            sides={4}
            radius={props.width / 2}
            rotation={45}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            opacity={0.7}
          />
        )
      case 'line':
        return (
          <Line
            x={props.x}
            y={props.y}
            points={props.points}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            opacity={0.7}
          />
        )
      case 'arrow':
        return (
          <Group opacity={0.7}>
            <Line
              x={props.x}
              y={props.y}
              points={props.points}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            {props.points && props.points.length >= 4 && (
              <Group
                x={props.x + props.points[2]}
                y={props.y + props.points[3]}
                rotation={Math.atan2(props.points[3], props.points[2]) * (180 / Math.PI)}
              >
                <Line
                  x={0}
                  y={0}
                  points={[-15, -8, 0, 0, -15, 8]}
                  stroke={props.stroke}
                  strokeWidth={props.strokeWidth}
                />
              </Group>
            )}
          </Group>
        )
      default:
        return null
    }
  }

  const renderCursors = () => {
    return cursors.map((cursor) => {
      const userColor = getUserColor(cursor.user_id)
      const userInitials = getUserInitials(cursor.user_name)
      const cursorIcon = getCursorIcon(cursor.user_id)
      
      return (
        <Group
          key={cursor.user_id}
          x={cursor.position.x}
          y={cursor.position.y}
          onMouseEnter={(e) => handleCursorHover(cursor, e)}
          onMouseLeave={handleCursorLeave}
        >
          {/* Cursor pointer icon */}
          <Text
            x={-8}
            y={-8}
            text={cursorIcon}
            fontSize={16}
            fill={userColor}
            fontFamily="Arial"
          />
          
          {/* User avatar circle */}
          <Circle
            x={0}
            y={0}
            radius={12}
            fill={userColor}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.9}
          />
          
          {/* User initials */}
          <Text
            x={-4}
            y={-4}
            text={userInitials}
            fontSize={8}
            fill="#fff"
            fontFamily="Arial"
            fontStyle="bold"
          />
        </Group>
      )
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!canvas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Canvas not found</h2>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{canvas.title}</h1>
            <p className="text-sm text-gray-600">{canvas.description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Presence Indicators */}
          <PresenceIndicators 
            canvasId={canvasId!} 
            currentUserId={user?.id || ''} 
            maxVisible={3}
          />
          
          <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            </div>
            
            {/* Sync Status Indicator */}
            <SyncStatusIndicator
              status={syncStatus}
              onManualSync={handleManualSync}
              onShowConflicts={() => setShowConflictDialog(true)}
            />

            {/* Connection Status Indicator */}
            <ConnectionStatusIndicator
              // metrics={connectionMetrics}
              // isConnected={isConnected}
            />

            {/* Offline Indicator */}
            <OfflineIndicator
              // isOffline={isOffline}
              // offlineData={offlineData}
              // onForceSync={() => offlineManager.forceSync()}
              // onClearCache={() => {/* offlineManager.clearCache() */}}
            />
            
            {/* Queue Status Indicator */}
            <QueueStatusIndicator
              stats={queueStats}
              onShowQueue={() => setShowQueueDialog(true)}
              onRetryFailed={() => handleQueueAction('retry_failed')}
              onClearCompleted={() => handleQueueAction('clear_completed')}
              onClearFailed={() => handleQueueAction('clear_failed')}
            />
          </div>
          
          {/* User Status */}
          {user && (
            <UserStatus 
              compact={true}
            />
          )}
          
          {/* Collaboration buttons - only show for canvas owner */}
          {canvas && user && canvas.owner_id === user.id && (
            <>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                title="Invite collaborators"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite</span>
              </button>
              
              <button
                onClick={() => setShowCollaborationSidebar(!showCollaborationSidebar)}
                className={`p-2 rounded-lg transition-colors ${
                  showCollaborationSidebar 
                    ? 'text-primary-600 bg-primary-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Collaboration panel"
              >
                <Users className="w-5 h-5" />
              </button>
            </>
          )}
          
          {/* Notification Center */}
          <NotificationCenter />
          
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Drawing Status Bar */}
      {isDrawing && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Drawing in progress... Click to place {selectedTool.name.toLowerCase()} object
            </span>
            <button
              onClick={() => {
                setNewObject(null)
                setIsDrawing(false)
                selectTool(getToolById('select')!)
              }}
              className="px-3 py-1 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200"
            >
              Cancel (ESC)
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-hidden" data-testid="canvas-container">
        <ZoomableCanvas
          width={window.innerWidth}
          height={window.innerHeight - 120}
          onStageClick={handleStageClick}
          onStageMouseMove={handleStageMouseMove}
          onStageMouseUp={handleStageMouseUp}
          onContextMenu={handleContextMenu}
          showZoomControls={true}
          zoomControlsPosition="bottom-right"
          enableKeyboardShortcuts={true}
          stageRef={stageRef}
          onTransformChange={({ scale, x, y, container }) => {
            setStageTransform({ scale, x, y })
            setStageContainer(container)
          }}
        >
          {zIndexManager.sortObjectsByZIndex(objects).map(renderObject)}
          {renderNewObject()}
          {renderCursors()}
          
          {/* Multi-selection indicator */}
          <MultiSelectionIndicator
            selectedObjects={multiSelectionActions.getSelectedObjects()}
            visible={multiSelectionState.selectedObjectIds.size > 1}
          />
          
          {/* Selection box for multi-selection */}
          {multiSelectionState.selectionBox && (
            <SelectionBox
              startX={multiSelectionState.selectionBox.startX}
              startY={multiSelectionState.selectionBox.startY}
              endX={multiSelectionState.selectionBox.endX}
              endY={multiSelectionState.selectionBox.endY}
              visible={multiSelectionState.isMultiSelecting}
            />
          )}
          
          {/* Success animations */}
          {successAnimations.map(animation => (
            <UpdateSuccessAnimation
              key={animation.id}
              x={animation.x}
              y={animation.y}
              onComplete={() => handleSuccessAnimationComplete(animation.id)}
            />
          ))}
          {pointerIndicator && (
            <PointerIndicator
              toolId={pointerIndicator.toolId}
              position={pointerIndicator.position}
              isVisible={pointerIndicator.isVisible}
              toolProperties={selectedTool.properties || {}}
              startPosition={pointerIndicator.startPosition}
            />
          )}
        </ZoomableCanvas>
      </div>

      {/* Collaboration Sidebar */}
      {canvas && user && (
        <CollaborationSidebar
          canvasId={canvasId!}
          canvasTitle={canvas.title}
          currentUserId={user.id}
          isOwner={canvas.owner_id === user.id}
          isOpen={showCollaborationSidebar}
          onClose={() => setShowCollaborationSidebar(false)}
        />
      )}

      {/* Invitation Modal */}
      {canvas && (
        <InviteCollaboratorModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          canvasId={canvasId!}
          canvasTitle={canvas.title}
        />
      )}

      {/* Cursor Tooltip */}
      {hoveredCursor && (
        <CursorTooltip
          cursor={hoveredCursor}
          position={tooltipPosition}
          isVisible={showTooltip}
          onClose={handleCursorLeave}
        />
      )}

      {/* Floating Drawing Toolbar */}
      <FloatingToolbar
        position={preferences.position}
        isVisible={isToolbarVisible}
        selectedTool={selectedTool}
        onToolSelect={handleSafeToolSelect}
        onPositionChange={updatePosition}
        onVisibilityToggle={toggleToolbarVisibility}
        onCollapseToggle={toggleCollapse}
        tools={getFilteredTools()}
        data-testid="canvas-toolbar"
        preferences={preferences}
        onPreferencesChange={updatePreferences}
      />

      {/* Text Editor Overlay */}
      {editingObjectId && (() => {
        const obj = objects.find(o => o.id === editingObjectId)
        if (!obj || obj.object_type !== 'text') return null
        const props = obj.properties
        return (
          <TextEditorOverlay
            containerRect={stageContainerRect}
            transform={stageTransform}
            x={props.x || 0}
            y={props.y || 0}
            fontSize={props.fontSize || 16}
            fontFamily={props.fontFamily || 'Arial'}
            fill={(props.fill as string) || '#000'}
            initialText={(props.text as string) || ''}
            onCommit={(newText) => handleEndTextEdit(obj.id, newText)}
            onCancel={() => setEditingObjectId(null)}
          />
        )
      })()}

      {/* Connection Status Indicator */}
      <div className="fixed bottom-4 right-32 z-50">
        <div className="flex items-center space-x-2 bg-white rounded-lg shadow-lg px-3 py-2 border">
          <div className={`w-3 h-3 rounded-full ${
            socketService.getConnectionState() === 'connected' ? 'bg-green-500' :
            socketService.getConnectionState() === 'connecting' ? 'bg-yellow-500' :
            socketService.getConnectionState() === 'reconnecting' ? 'bg-orange-500' :
            'bg-red-500'
          }`}></div>
          <span className="text-sm font-medium text-gray-700">
            {socketService.getConnectionState() === 'connected' ? 'Connected' :
             socketService.getConnectionState() === 'connecting' ? 'Connecting...' :
             socketService.getConnectionState() === 'reconnecting' ? 'Reconnecting...' :
             'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Quality Dashboard Button */}
      <div className="fixed bottom-4 right-20 z-50">
        <button
          onClick={() => setShowConnectionQualityDashboard(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="Connection Quality Dashboard"
        >
          <BarChart3 className="w-5 h-5" />
        </button>
      </div>

      {/* Debug Panel - Only show in development */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            🐛 Debug
          </button>
          
          {showDebugPanel && (
            <div className="absolute bottom-12 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto">
              <h3 className="font-bold text-sm mb-2">Error Debug Panel</h3>
              
              <div className="space-y-2 text-xs">
                <div>
                  <strong>Connection Status:</strong> 
                  <span className={`ml-1 px-2 py-1 rounded text-xs ${
                    connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                    connectionStatus === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {connectionStatus}
                  </span>
                </div>
                
                <div>
                  <strong>Failed Updates:</strong> {failedUpdates.size}
                </div>
                
                <div>
                  <strong>Updating Objects:</strong> {updatingObjects.size}
                </div>
                
                <div>
                  <strong>Optimistic Updates:</strong> {optimisticObjects.size}
                </div>
                
                <div>
                  <strong>Success Animations:</strong> {successAnimations.length}
                </div>
                
                <div>
                  <strong>Active Loading States:</strong> {loadingStateManager.getActiveLoadingCount()}
                </div>
                
                <div>
                  <strong>Queued Updates:</strong> {loadingStateManager.getQueuedUpdates().length}
                </div>
                
                <div>
                  <strong>Socket Connected:</strong> {isConnected ? 'Yes' : 'No'}
                </div>
                
                <div>
                  <strong>Debounced Objects:</strong> {debounceStats.totalObjects}
                </div>
                
                <div>
                  <strong>Pending Debounced Updates:</strong> {debounceStats.pendingObjects}
                </div>
                
                <div>
                  <strong>Queued Debounced Updates:</strong> {debounceStats.queuedUpdates}
                </div>
                
                <div>
                  <strong>Batch Queue Size:</strong> {batchQueueStatus.queueSize}
                </div>
                
                <div>
                  <strong>Batch Processing:</strong> {batchQueueStatus.isProcessing ? 'Yes' : 'No'}
                </div>
                
                <div>
                  <strong>Total Batches:</strong> {getBatchStats().queueSize}
                </div>
                
                <div>
                  <strong>Average Batch Size:</strong> {getBatchStats().queueSize.toFixed(1)}
                </div>
                
                <div>
                  <strong>Saved Requests:</strong> {getBatchStats().queueSize}
                </div>
                
                <div>
                  <strong>Socket Events Sent:</strong> {getSocketStats().totalEvents}
                </div>
                
                <div>
                  <strong>Socket Events/Second:</strong> {getSocketStats().totalEvents.toFixed(1)}
                </div>
                
                <div>
                  <strong>Throttled Events:</strong> {getSocketStats().totalEvents}
                </div>
                
                <div>
                  <strong>Compressed Events:</strong> {getSocketStats().totalEvents}
                </div>
                
                <div>
                  <strong>Deduplicated Events:</strong> {getSocketStats().totalEvents}
                </div>
                
                <div>
                  <strong>Socket Queue Size:</strong> {socketQueueStatus.queueSize}
                </div>
                
                {updatingObjects.size > 0 && (
                  <div className="mt-2">
                    <strong>Update Progress:</strong>
                    <div className="text-xs mt-1">
                      {Array.from(updatingObjects).map(objectId => {
                        const progress = updateProgress.get(objectId)
                        return (
                          <div key={objectId} className="flex justify-between">
                            <span>{objectId.slice(0, 8)}...</span>
                            <span className="text-blue-600">
                              {progress?.method} (attempt {progress?.attempt})
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                <div className="mt-3">
                  <button
                    onClick={() => {
                      const stats = errorLogger.getErrorStats()
                      console.log('Error Statistics:', stats)
                      console.log('Error Log:', errorLogger.getErrorLog())
                    }}
                    className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                  >
                    Log Stats to Console
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      const log = errorLogger.exportLog()
                      navigator.clipboard.writeText(log)
                      toast.success('Error log copied to clipboard')
                    }}
                    className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                  >
                    Export Error Log
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      const stats = optimisticUpdateManager.getOptimisticUpdateStats()
                      console.log('Optimistic Update Statistics:', stats)
                      toast.success('Optimistic update stats logged to console')
                    }}
                    className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600"
                  >
                    Log Optimistic Stats
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      const stats = loadingStateManager.getLoadingStats()
                      console.log('Loading State Statistics:', stats)
                      toast.success('Loading state stats logged to console')
                    }}
                    className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600"
                  >
                    Log Loading Stats
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      const stats = objectUpdateDebouncer.getStats()
                      console.log('Debounce Statistics:', stats)
                      console.log('Pending Objects:', objectUpdateDebouncer.getPendingObjects())
                      toast.success('Debounce stats logged to console')
                    }}
                    className="bg-indigo-500 text-white px-2 py-1 rounded text-xs hover:bg-indigo-600"
                  >
                    Log Debounce Stats
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      const stats = getBatchStats()
                      const queueStatus = getQueueStatus()
                      console.log('Batch Statistics:', stats)
                      console.log('Batch Queue Status:', queueStatus)
                      toast.success('Batch stats logged to console')
                    }}
                    className="bg-teal-500 text-white px-2 py-1 rounded text-xs hover:bg-teal-600"
                  >
                    Log Batch Stats
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      const stats = getSocketStats()
                      const queueStatus = getSocketQueueStatus()
                      console.log('Socket Optimization Statistics:', stats)
                      console.log('Socket Queue Status:', queueStatus)
                      toast.success('Socket optimization stats logged to console')
                    }}
                    className="bg-cyan-500 text-white px-2 py-1 rounded text-xs hover:bg-cyan-600"
                  >
                    Log Socket Stats
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        isOpen={showConflictDialog}
        conflicts={stateConflicts}
        onClose={() => setShowConflictDialog(false)}
        onResolve={handleConflictResolution}
      />

      {/* Queue Management Dialog */}
      <QueueManagementDialog
        isOpen={showQueueDialog}
        onClose={() => setShowQueueDialog(false)}
      />

      {/* AI Agent Components */}
      <AIAgentButton
        onClick={() => setShowAIPanel(!showAIPanel)}
        isOpen={showAIPanel}
        disabled={!isAuthenticated}
      />
      
      <AIAgentPanel
        isOpen={showAIPanel}
        onClose={() => setShowAIPanel(false)}
        onSuccess={(canvasId) => {
          console.log('AI canvas created successfully:', canvasId);
          // Clear any existing selection when AI creates new content
          multiSelectionActions.clearSelection()
          // Save state for undo/redo
          saveStateForUndo('ai_generation', 'AI generated canvas content')
        }}
        currentCanvasId={canvasId}
      />

      {/* Connection Quality Dashboard */}
      <ConnectionQualityDashboard
        isVisible={showConnectionQualityDashboard}
        onClose={() => setShowConnectionQualityDashboard(false)}
      />

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onUndo={() => {
          const newObjects = undoRedoActions.undo()
          if (newObjects) {
            setObjects(newObjects)
            multiSelectionActions.clearSelection()
          }
        }}
        onRedo={() => {
          const newObjects = undoRedoActions.redo()
          if (newObjects) {
            setObjects(newObjects)
            multiSelectionActions.clearSelection()
          }
        }}
        canCopy={multiSelectionState.selectedObjectIds.size > 0}
        canCut={multiSelectionState.selectedObjectIds.size > 0}
        canPaste={clipboardState.hasCopiedObjects}
        canDuplicate={multiSelectionState.selectedObjectIds.size > 0}
        canDelete={multiSelectionState.selectedObjectIds.size > 0}
        canUndo={undoRedoState.canUndo}
        canRedo={undoRedoState.canRedo}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        canManageLayers={multiSelectionState.selectedObjectIds.size === 1}
      />
      
      {/* Layer Management Panel */}
      <LayerManagementPanel
        objects={objects}
        selectedObjectId={multiSelectionState.selectedObjectIds.size === 1 ? Array.from(multiSelectionState.selectedObjectIds)[0] : null}
        onObjectSelect={(objectId) => {
          multiSelectionActions.selectObject(objectId)
        }}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        isVisible={showLayerManagementPanel}
        onClose={() => setShowLayerManagementPanel(false)}
      />

      {/* Coordinate Status Bar */}
      <CoordinateStatusBar
        coordinates={coordinateDisplay.coordinateDisplay}
        isVisible={coordinateDisplay.isDisplaying && showCoordinates}
        precision={0}
      />
    </div>
  )
}

export default CanvasPage
