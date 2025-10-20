import { useState, useCallback, useRef } from 'react'
import { CoordinateData } from '../components/CoordinateStatusBar'
import { CanvasObject } from '../types'

interface DragStartPosition {
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
}

export const useCoordinateDisplay = () => {
  const [coordinateDisplay, setCoordinateDisplay] = useState<CoordinateData | null>(null)
  const dragStartRef = useRef<DragStartPosition | null>(null)

  /**
   * Show coordinates during object placement
   */
  const showPlacingCoordinates = useCallback((
    x: number,
    y: number,
    width?: number,
    height?: number,
    radius?: number,
    objectType?: string
  ) => {
    setCoordinateDisplay({
      x,
      y,
      width,
      height,
      radius,
      mode: 'placing',
      objectType
    })
  }, [])

  /**
   * Show coordinates for selected object(s)
   */
  const showSelectedCoordinates = useCallback((
    objects: CanvasObject[]
  ) => {
    if (objects.length === 0) {
      setCoordinateDisplay(null)
      return
    }

    // For single selection, show the object's coordinates
    if (objects.length === 1) {
      const obj = objects[0]
      const props = obj.properties

      setCoordinateDisplay({
        x: props.x,
        y: props.y,
        width: props.width,
        height: props.height,
        radius: props.radius,
        mode: 'selected',
        objectCount: 1,
        objectType: obj.object_type
      })
    } else {
      // For multiple selection, show the bounding box coordinates
      const bounds = calculateBounds(objects)
      
      setCoordinateDisplay({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        mode: 'selected',
        objectCount: objects.length
      })
    }
  }, [])

  /**
   * Start tracking movement (store initial position)
   */
  const startMoving = useCallback((
    x: number,
    y: number,
    width?: number,
    height?: number,
    radius?: number
  ) => {
    dragStartRef.current = { x, y, width, height, radius }
    
    setCoordinateDisplay({
      x,
      y,
      width,
      height,
      radius,
      mode: 'moving',
      deltaX: 0,
      deltaY: 0
    })
  }, [])

  /**
   * Update coordinates during movement
   */
  const updateMovingCoordinates = useCallback((
    x: number,
    y: number,
    width?: number,
    height?: number,
    radius?: number
  ) => {
    const start = dragStartRef.current
    if (!start) {
      startMoving(x, y, width, height, radius)
      return
    }

    setCoordinateDisplay({
      x,
      y,
      width,
      height,
      radius,
      mode: 'moving',
      deltaX: x - start.x,
      deltaY: y - start.y
    })
  }, [startMoving])

  /**
   * End movement tracking
   */
  const endMoving = useCallback(() => {
    dragStartRef.current = null
  }, [])

  /**
   * Start tracking resize (store initial dimensions)
   */
  const startResizing = useCallback((
    x: number,
    y: number,
    width?: number,
    height?: number,
    radius?: number
  ) => {
    dragStartRef.current = { x, y, width, height, radius }
    
    setCoordinateDisplay({
      x,
      y,
      width,
      height,
      radius,
      mode: 'resizing',
      deltaWidth: 0,
      deltaHeight: 0,
      deltaRadius: 0
    })
  }, [])

  /**
   * Update coordinates during resize
   */
  const updateResizingCoordinates = useCallback((
    x: number,
    y: number,
    width?: number,
    height?: number,
    radius?: number
  ) => {
    const start = dragStartRef.current
    if (!start) {
      startResizing(x, y, width, height, radius)
      return
    }

    setCoordinateDisplay({
      x,
      y,
      width,
      height,
      radius,
      mode: 'resizing',
      deltaWidth: width !== undefined && start.width !== undefined ? width - start.width : undefined,
      deltaHeight: height !== undefined && start.height !== undefined ? height - start.height : undefined,
      deltaRadius: radius !== undefined && start.radius !== undefined ? radius - start.radius : undefined
    })
  }, [startResizing])

  /**
   * End resize tracking
   */
  const endResizing = useCallback(() => {
    dragStartRef.current = null
  }, [])

  /**
   * Clear coordinate display
   */
  const clearCoordinates = useCallback(() => {
    setCoordinateDisplay(null)
    dragStartRef.current = null
  }, [])

  /**
   * Check if coordinates are currently being displayed
   */
  const isDisplaying = coordinateDisplay !== null

  return {
    coordinateDisplay,
    isDisplaying,
    showPlacingCoordinates,
    showSelectedCoordinates,
    startMoving,
    updateMovingCoordinates,
    endMoving,
    startResizing,
    updateResizingCoordinates,
    endResizing,
    clearCoordinates
  }
}

/**
 * Calculate bounding box for multiple objects
 */
function calculateBounds(objects: CanvasObject[]): {
  x: number
  y: number
  width: number
  height: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  objects.forEach(obj => {
    const props = obj.properties
    let objMinX = props.x
    let objMinY = props.y
    let objMaxX = props.x
    let objMaxY = props.y

    switch (obj.object_type) {
      case 'rectangle':
        objMaxX = props.x + (props.width || 0)
        objMaxY = props.y + (props.height || 0)
        break
      case 'circle':
        objMinX = props.x - (props.radius || 0)
        objMinY = props.y - (props.radius || 0)
        objMaxX = props.x + (props.radius || 0)
        objMaxY = props.y + (props.radius || 0)
        break
      case 'text':
        // Approximate text bounds
        const textWidth = (props.text?.length || 0) * (props.fontSize || 16) * 0.6
        const textHeight = (props.fontSize || 16) * 1.2
        objMaxX = props.x + textWidth
        objMaxY = props.y + textHeight
        break
      default:
        // For other shapes, approximate with width/height if available
        if (props.width) objMaxX = props.x + props.width
        if (props.height) objMaxY = props.y + props.height
    }

    minX = Math.min(minX, objMinX)
    minY = Math.min(minY, objMinY)
    maxX = Math.max(maxX, objMaxX)
    maxY = Math.max(maxY, objMaxY)
  })

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}
