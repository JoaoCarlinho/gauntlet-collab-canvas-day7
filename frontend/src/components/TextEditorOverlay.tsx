import React, { useEffect, useMemo, useRef, useState } from 'react'

interface TransformInfo {
  scale: number
  x: number
  y: number
}

interface TextEditorOverlayProps {
  containerRect: DOMRect | null
  transform: TransformInfo
  x: number
  y: number
  fontSize: number
  fontFamily: string
  fill: string
  initialText: string
  onCommit: (newText: string) => void
  onCancel: () => void
}

const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({
  containerRect,
  transform,
  x,
  y,
  fontSize,
  fontFamily,
  fill,
  initialText,
  onCommit,
  onCancel
}) => {
  const [value, setValue] = useState(initialText)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Reposition on resize/scroll in case viewport changes
  const [viewportCounter, setViewportCounter] = useState(0)
  useEffect(() => {
    const handler = () => setViewportCounter(c => c + 1)
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [])

  const style = useMemo((): React.CSSProperties => {
    const rect = containerRect
    const scale = transform.scale
    const translateX = transform.x
    const translateY = transform.y
    const left = (rect?.left || 0) + translateX + x * scale
    const top = (rect?.top || 0) + translateY + y * scale
    const computedFontSize = fontSize * scale

    return {
      position: 'fixed',
      left,
      top,
      transform: 'translate(-0px, -0px)',
      fontSize: computedFontSize,
      fontFamily,
      color: fill,
      padding: 0,
      margin: 0,
      border: '1px solid rgba(59,130,246,0.8)',
      background: 'rgba(255,255,255,0.95)',
      lineHeight: 1.2,
      zIndex: 1000,
    }
  }, [containerRect, transform.scale, transform.x, transform.y, x, y, fontSize, fontFamily, fill, viewportCounter])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onCommit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setValue(initialText)
      onCancel()
    }
  }

  const handleBlur = () => {
    onCommit(value)
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      aria-label="Edit text"
      role="textbox"
      style={style}
    />
  )
}

export default TextEditorOverlay


