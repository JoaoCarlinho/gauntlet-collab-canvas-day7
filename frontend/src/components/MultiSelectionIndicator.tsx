import React from 'react'
import { Rect, Group } from 'react-konva'
import { CanvasObject } from '../types'

interface MultiSelectionIndicatorProps {
  selectedObjects: CanvasObject[]
  visible: boolean
}

const MultiSelectionIndicator: React.FC<MultiSelectionIndicatorProps> = ({
  selectedObjects,
  visible
}) => {
  if (!visible || selectedObjects.length === 0) return null

  // Calculate the bounding box of all selected objects
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  selectedObjects.forEach(obj => {
    const props = obj.properties
    let bounds = { x: 0, y: 0, width: 0, height: 0 }

    switch (obj.object_type) {
      case 'rectangle':
        bounds = { x: props.x, y: props.y, width: props.width, height: props.height }
        break
      case 'circle':
        bounds = {
          x: props.x - props.radius,
          y: props.y - props.radius,
          width: props.radius * 2,
          height: props.radius * 2
        }
        break
      case 'text':
        const textWidth = props.text.length * props.fontSize * 0.6
        const textHeight = props.fontSize * 1.2
        bounds = { x: props.x, y: props.y, width: textWidth, height: textHeight }
        break
      default:
        return
    }

    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  })

  const width = maxX - minX
  const height = maxY - minY

  return (
    <Group>
      {/* Main selection border */}
      <Rect
        x={minX - 5}
        y={minY - 5}
        width={width + 10}
        height={height + 10}
        stroke="#3b82f6"
        strokeWidth={2}
        dash={[5, 5]}
        fill="transparent"
        listening={false}
      />
      
      {/* Corner handles for multi-selection resize */}
      {selectedObjects.length > 1 && (
        <>
          {/* Top-left handle */}
          <Rect
            x={minX - 8}
            y={minY - 8}
            width={6}
            height={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1}
            listening={false}
          />
          
          {/* Top-right handle */}
          <Rect
            x={maxX + 2}
            y={minY - 8}
            width={6}
            height={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1}
            listening={false}
          />
          
          {/* Bottom-left handle */}
          <Rect
            x={minX - 8}
            y={maxY + 2}
            width={6}
            height={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1}
            listening={false}
          />
          
          {/* Bottom-right handle */}
          <Rect
            x={maxX + 2}
            y={maxY + 2}
            width={6}
            height={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1}
            listening={false}
          />
        </>
      )}
    </Group>
  )
}

export default MultiSelectionIndicator
