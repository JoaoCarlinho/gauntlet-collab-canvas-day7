import React, { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export type CoordinateMode = 'placing' | 'selected' | 'moving' | 'resizing'

export interface CoordinateData {
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  deltaX?: number
  deltaY?: number
  deltaWidth?: number
  deltaHeight?: number
  deltaRadius?: number
  mode: CoordinateMode
  objectCount?: number
  objectType?: string
}

interface CoordinateStatusBarProps {
  coordinates: CoordinateData | null
  isVisible: boolean
  precision?: number
  forceHide?: boolean
}

const CoordinateStatusBar: React.FC<CoordinateStatusBarProps> = ({
  coordinates,
  isVisible,
  precision = 0,
  forceHide = false
}) => {
  const [copied, setCopied] = useState(false)

  const formatValue = useCallback((value: number): string => {
    return value.toFixed(precision)
  }, [precision])

  const formatDelta = useCallback((delta: number): string => {
    const sign = delta >= 0 ? '+' : ''
    return `${sign}${formatValue(delta)}`
  }, [formatValue])

  const handleCopyCoordinates = useCallback(() => {
    if (!coordinates) return

    const coordText: string[] = []
    coordText.push(`X: ${formatValue(coordinates.x)}`)
    coordText.push(`Y: ${formatValue(coordinates.y)}`)
    
    if (coordinates.width !== undefined) {
      coordText.push(`W: ${formatValue(coordinates.width)}`)
    }
    if (coordinates.height !== undefined) {
      coordText.push(`H: ${formatValue(coordinates.height)}`)
    }
    if (coordinates.radius !== undefined) {
      coordText.push(`R: ${formatValue(coordinates.radius)}`)
    }

    const text = coordText.join(', ')
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success('Coordinates copied to clipboard', {
        duration: 2000,
        position: 'top-right'
      })
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error('Failed to copy coordinates', {
        position: 'top-right'
      })
    })
  }, [coordinates, formatValue])

  const getModeIcon = (mode: CoordinateMode): string => {
    switch (mode) {
      case 'placing':
        return '📐'
      case 'selected':
        return '📍'
      case 'moving':
        return '↔️'
      case 'resizing':
        return '⤢'
      default:
        return '📍'
    }
  }

  const getModeLabel = (mode: CoordinateMode, count?: number): string => {
    switch (mode) {
      case 'placing':
        return 'PLACING'
      case 'selected':
        return count && count > 1 ? `${count} SELECTED` : 'SELECTED'
      case 'moving':
        return 'MOVING'
      case 'resizing':
        return 'RESIZING'
      default:
        return 'SELECTED'
    }
  }

  if (!isVisible || !coordinates || forceHide) {
    return null
  }

  return (
    <div
      className={`
        coordinate-status-bar
        fixed bottom-5 left-1/2 -translate-x-1/2
        z-40
        px-4 py-2
        bg-gray-900/90 backdrop-blur-md
        text-white text-sm
        rounded-lg
        border border-white/10
        shadow-lg
        transition-all duration-200 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
      `}
      data-testid="coordinate-status-bar"
    >
      <div className="flex items-center gap-3">
        {/* Mode Icon */}
        <span className="text-lg" role="img" aria-label={coordinates.mode}>
          {getModeIcon(coordinates.mode)}
        </span>

        {/* Coordinates Display */}
        <div className="flex items-center gap-2 font-mono">
          {/* X Coordinate */}
          <div className="coordinate-value">
            <span className="text-gray-400 font-semibold">X:</span>{' '}
            <span className="text-white">{formatValue(coordinates.x)}</span>
            {coordinates.deltaX !== undefined && coordinates.deltaX !== 0 && (
              <span className="text-amber-400 ml-1 text-xs">
                ({formatDelta(coordinates.deltaX)})
              </span>
            )}
          </div>

          {/* Y Coordinate */}
          <div className="coordinate-value">
            <span className="text-gray-400 font-semibold">Y:</span>{' '}
            <span className="text-white">{formatValue(coordinates.y)}</span>
            {coordinates.deltaY !== undefined && coordinates.deltaY !== 0 && (
              <span className="text-amber-400 ml-1 text-xs">
                ({formatDelta(coordinates.deltaY)})
              </span>
            )}
          </div>

          {/* Width (for rectangles, etc.) */}
          {coordinates.width !== undefined && (
            <div className="coordinate-value">
              <span className="text-gray-400 font-semibold">W:</span>{' '}
              <span className="text-white">{formatValue(coordinates.width)}</span>
              {coordinates.deltaWidth !== undefined && coordinates.deltaWidth !== 0 && (
                <span className="text-amber-400 ml-1 text-xs">
                  ({formatDelta(coordinates.deltaWidth)})
                </span>
              )}
            </div>
          )}

          {/* Height (for rectangles, etc.) */}
          {coordinates.height !== undefined && (
            <div className="coordinate-value">
              <span className="text-gray-400 font-semibold">H:</span>{' '}
              <span className="text-white">{formatValue(coordinates.height)}</span>
              {coordinates.deltaHeight !== undefined && coordinates.deltaHeight !== 0 && (
                <span className="text-amber-400 ml-1 text-xs">
                  ({formatDelta(coordinates.deltaHeight)})
                </span>
              )}
            </div>
          )}

          {/* Radius (for circles) */}
          {coordinates.radius !== undefined && (
            <div className="coordinate-value">
              <span className="text-gray-400 font-semibold">R:</span>{' '}
              <span className="text-white">{formatValue(coordinates.radius)}</span>
              {coordinates.deltaRadius !== undefined && coordinates.deltaRadius !== 0 && (
                <span className="text-amber-400 ml-1 text-xs">
                  ({formatDelta(coordinates.deltaRadius)})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mode Label */}
        <div className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold uppercase">
          {getModeLabel(coordinates.mode, coordinates.objectCount)}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopyCoordinates}
          className="
            ml-1 p-1.5 
            hover:bg-white/10 
            rounded 
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-400
          "
          title="Copy coordinates to clipboard"
          aria-label="Copy coordinates"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
    </div>
  )
}

export default CoordinateStatusBar
