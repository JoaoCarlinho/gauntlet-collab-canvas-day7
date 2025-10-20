import React from 'react'
import { Rect } from 'react-konva'

interface SelectionBoxProps {
  startX: number
  startY: number
  endX: number
  endY: number
  visible: boolean
}

const SelectionBox: React.FC<SelectionBoxProps> = ({
  startX,
  startY,
  endX,
  endY,
  visible
}) => {
  if (!visible) return null

  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      stroke="#3b82f6"
      strokeWidth={1}
      dash={[5, 5]}
      fill="rgba(59, 130, 246, 0.1)"
      listening={false}
    />
  )
}

export default SelectionBox
