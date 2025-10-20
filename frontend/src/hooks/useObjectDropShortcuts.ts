import { useEffect, useCallback } from 'react'
import { CanvasObject } from '../types'
import { zIndexManager, ZIndexBehavior, createObjectWithZIndex } from '../utils/zIndexManager'
import { canvasAPI } from '../services/api'

export interface ObjectDropShortcutsConfig {
  canvasId: string
  userId: string
  onObjectCreated: (object: CanvasObject) => void
  onError: (error: string) => void
  getMousePosition: () => { x: number; y: number } | null
}

export interface ObjectDropShortcuts {
  isEnabled: boolean
  enable: () => void
  disable: () => void
}

const SHORTCUT_MAP = {
  // Rectangle shortcuts
  'KeyR': { type: 'rectangle', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyR': { type: 'rectangle', behavior: 'bottom' as ZIndexBehavior },
  
  // Circle shortcuts
  'KeyC': { type: 'circle', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyC': { type: 'circle', behavior: 'bottom' as ZIndexBehavior },
  
  // Text shortcuts (always top)
  'KeyT': { type: 'text', behavior: 'top' as ZIndexBehavior },
  
  // Heart shortcuts
  'KeyH': { type: 'heart', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyH': { type: 'heart', behavior: 'bottom' as ZIndexBehavior },
  
  // Star shortcuts
  'KeyS': { type: 'star', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyS': { type: 'star', behavior: 'bottom' as ZIndexBehavior },
  
  // Diamond shortcuts
  'KeyD': { type: 'diamond', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyD': { type: 'diamond', behavior: 'bottom' as ZIndexBehavior },
  
  // Line shortcuts
  'KeyL': { type: 'line', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyL': { type: 'line', behavior: 'bottom' as ZIndexBehavior },
  
  // Arrow shortcuts
  'KeyA': { type: 'arrow', behavior: 'top' as ZIndexBehavior },
  'Shift+KeyA': { type: 'arrow', behavior: 'bottom' as ZIndexBehavior },
}

const DEFAULT_PROPERTIES = {
  rectangle: { width: 100, height: 60, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 },
  circle: { radius: 50, fill: '#10b981', stroke: '#059669', strokeWidth: 2 },
  text: { text: 'Text', fontSize: 16, fill: '#374151', fontFamily: 'Arial' },
  heart: { width: 60, height: 60, fill: '#ef4444', stroke: '#dc2626', strokeWidth: 2 },
  star: { width: 60, height: 60, fill: '#f59e0b', stroke: '#d97706', strokeWidth: 2 },
  diamond: { width: 60, height: 60, fill: '#8b5cf6', stroke: '#7c3aed', strokeWidth: 2 },
  line: { x1: 0, y1: 0, x2: 100, y2: 0, stroke: '#6b7280', strokeWidth: 3 },
  arrow: { x1: 0, y1: 0, x2: 100, y2: 0, stroke: '#6b7280', strokeWidth: 3 },
}

export const useObjectDropShortcuts = (config: ObjectDropShortcutsConfig): ObjectDropShortcuts => {
  const { canvasId, userId, onObjectCreated, onError, getMousePosition } = config

  const createObject = useCallback(async (
    objectType: string, 
    position: { x: number; y: number }, 
    behavior: ZIndexBehavior,
    existingObjects: CanvasObject[] = []
  ) => {
    try {
      const defaultProps = DEFAULT_PROPERTIES[objectType as keyof typeof DEFAULT_PROPERTIES] || {}
      const objectData = createObjectWithZIndex(
        objectType,
        position,
        defaultProps,
        behavior,
        existingObjects
      )

      const response = await canvasAPI.createObject({
        canvas_id: canvasId,
        object_type: objectType,
        properties: objectData.properties,
        z_index_behavior: behavior
      })

      if (response.data) {
        onObjectCreated(response.data.object)
      } else {
        onError(response.error || 'Failed to create object')
      }
    } catch (error) {
      onError(`Failed to create ${objectType}: ${error}`)
    }
  }, [canvasId, userId, onObjectCreated, onError])

  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    // Check if Ctrl/Cmd is pressed
    const isModifierPressed = event.ctrlKey || event.metaKey
    
    if (!isModifierPressed) return

    // Build shortcut key
    const shiftKey = event.shiftKey ? 'Shift+' : ''
    const shortcutKey = `${shiftKey}${event.code}`
    
    const shortcut = SHORTCUT_MAP[shortcutKey as keyof typeof SHORTCUT_MAP]
    
    if (!shortcut) return

    event.preventDefault()
    event.stopPropagation()

    // Get current mouse position
    const mousePosition = getMousePosition()
    if (!mousePosition) {
      onError('Unable to determine drop position')
      return
    }

    // Create the object
    await createObject(shortcut.type, mousePosition, shortcut.behavior)
  }, [createObject, getMousePosition, onError])

  const enable = useCallback(() => {
    document.addEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const disable = useCallback(() => {
    document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    // Auto-enable shortcuts when hook is mounted
    enable()
    
    return () => {
      disable()
    }
  }, [enable, disable])

  return {
    isEnabled: true, // Always enabled when hook is active
    enable,
    disable
  }
}

// Utility function to get current mouse position from canvas
export const useCanvasMousePosition = (stageRef: React.RefObject<any>) => {
  const getMousePosition = useCallback((): { x: number; y: number } | null => {
    if (!stageRef.current) return null
    
    const stage = stageRef.current
    const pointerPosition = stage.getPointerPosition()
    
    if (!pointerPosition) return null
    
    // Convert stage coordinates to canvas coordinates
    const transform = stage.getAbsoluteTransform().copy().invert()
    const canvasPosition = transform.point(pointerPosition)
    
    return {
      x: canvasPosition.x,
      y: canvasPosition.y
    }
  }, [stageRef])

  return { getMousePosition }
}

// Hook for z-index management shortcuts
export const useZIndexShortcuts = (
  selectedObjectId: string | null,
  onZIndexUpdate: (objectId: string, zIndex: number) => void,
  onError: (error: string) => void
) => {
  const handleZIndexKeyDown = useCallback((event: KeyboardEvent) => {
    if (!selectedObjectId) return

    const isModifierPressed = event.ctrlKey || event.metaKey
    if (!isModifierPressed) return

    let action: string | null = null

    switch (event.code) {
      case 'BracketRight': // Ctrl/Cmd + ]
        action = 'bring-to-front'
        break
      case 'BracketLeft': // Ctrl/Cmd + [
        action = 'send-to-back'
        break
      case 'Equal': // Ctrl/Cmd + =
        action = 'move-up'
        break
      case 'Minus': // Ctrl/Cmd + -
        action = 'move-down'
        break
      default:
        return
    }

    if (action) {
      event.preventDefault()
      event.stopPropagation()
      
      // Call the appropriate z-index management API
      handleZIndexAction(selectedObjectId, action, onZIndexUpdate, onError)
    }
  }, [selectedObjectId, onZIndexUpdate, onError])

  useEffect(() => {
    document.addEventListener('keydown', handleZIndexKeyDown)
    return () => {
      document.removeEventListener('keydown', handleZIndexKeyDown)
    }
  }, [handleZIndexKeyDown])
}

const handleZIndexAction = async (
  objectId: string,
  action: string,
  onZIndexUpdate: (objectId: string, zIndex: number) => void,
  onError: (error: string) => void
) => {
  try {
    let response
    
    switch (action) {
      case 'bring-to-front':
        response = await canvasAPI.bringObjectToFront(objectId)
        break
      case 'send-to-back':
        response = await canvasAPI.sendObjectToBack(objectId)
        break
      case 'move-up':
        response = await canvasAPI.moveObjectUp(objectId)
        break
      case 'move-down':
        response = await canvasAPI.moveObjectDown(objectId)
        break
      default:
        return
    }

    if (response.data) {
      onZIndexUpdate(objectId, response.data.object.z_index)
    } else {
      onError(response.error || `Failed to ${action.replace('-', ' ')} object`)
    }
  } catch (error) {
    onError(`Failed to ${action.replace('-', ' ')} object: ${error}`)
  }
}
