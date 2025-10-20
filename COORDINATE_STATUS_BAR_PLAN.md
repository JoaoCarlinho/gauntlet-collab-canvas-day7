# Coordinate Status Bar - Implementation Plan

## Overview
Add a status bar that displays the X and Y coordinates for object placement and selection. The bar should be non-intrusive and only visible when relevant.

## Requirements
1. Show X and Y coordinates when:
   - Objects are being placed (drawing mode)
   - Objects are selected
   - Objects are being dragged/moved
2. Hide the status bar when no objects are selected or being placed
3. Position the bar to not interfere with object placement areas
4. Ensure the FloatingToolbar and toast messages also don't interfere with object placement

## Current Codebase Analysis

### Relevant Files
- `frontend/src/components/CanvasPage.tsx` - Main canvas component with drawing logic
- `frontend/src/components/ZoomableCanvas.tsx` - Handles stage events and zoom
- `frontend/src/components/toolbar/FloatingToolbar.tsx` - Positioned at z-50, draggable
- `frontend/src/utils/toastConfig.ts` - Toast notification configuration
- `frontend/src/components/SelectionIndicator.tsx` - Shows selection boxes around objects

### Current State Management
- `isDrawing` - Boolean indicating if user is actively drawing
- `newObject` - Temporary object being created
- `multiSelectionState.selectedObjectIds` - Set of currently selected object IDs
- Mouse position tracked in `handleStageMouseMove`
- Object properties include `x`, `y` coordinates

## Implementation Plan

### Phase 1: Create CoordinateStatusBar Component

#### 1.1 Component Structure
**File**: `frontend/src/components/CoordinateStatusBar.tsx`

```typescript
interface CoordinateStatusBarProps {
  coordinates: {
    x: number
    y: number
    width?: number
    height?: number
  } | null
  isVisible: boolean
  mode: 'placing' | 'selected' | 'moving' | 'resizing'
}
```

**Features**:
- Display primary coordinates (X, Y)
- Show additional dimensions when relevant (width, height for rectangles, radius for circles)
- Show delta values when moving/resizing (e.g., "ΔX: +50, ΔY: -20")
- Format coordinates to reasonable precision (e.g., rounded to integers or 1 decimal place)
- Smooth fade in/out transitions

#### 1.2 Positioning Strategy
**Location**: Bottom-center of viewport (fixed positioning)
- `position: fixed`
- `bottom: 20px` (safe distance from viewport edge)
- `left: 50%`
- `transform: translateX(-50%)` (centered)
- `z-index: 40` (below FloatingToolbar's z-50, but above canvas)

**Rationale**:
- Bottom-center is least likely to interfere with object placement (users typically work in center/upper areas)
- Stays visible during zoom/pan operations
- Doesn't conflict with FloatingToolbar (usually positioned in corners)
- Easy to reference without blocking view

**Alternative positions to consider**:
- Top-left corner (like zoom indicator)
- Could make position configurable in toolbar preferences

### Phase 2: Integration with CanvasPage

#### 2.1 State Management
Add to `CanvasPage.tsx`:

```typescript
const [coordinateDisplay, setCoordinateDisplay] = useState<{
  x: number
  y: number
  width?: number
  height?: number
  deltaX?: number
  deltaY?: number
  mode: 'placing' | 'selected' | 'moving' | 'resizing'
} | null>(null)
```

#### 2.2 Update Coordinate Display Logic

**During Object Placement** (in `handleStageMouseMove`):
- When `isDrawing === true` and `newObject` exists
- Extract coordinates from `newObject.properties`
- Calculate dimensions being drawn

**During Object Selection** (in object click handlers):
- When an object is selected via multi-selection
- Show initial coordinates of selected object(s)
- For multiple selections, show bounds of selection box

**During Object Movement** (in drag handlers):
- Track starting position when drag begins
- Calculate delta (current - start) during drag
- Update display in real-time

**During Object Resizing** (in resize handlers):
- Show current dimensions
- Calculate delta from original size

#### 2.3 Coordinate Updates
```typescript
// In handleStageMouseMove
if (isDrawing && newObject) {
  setCoordinateDisplay({
    x: point.x,
    y: point.y,
    width: newObject.properties.width,
    height: newObject.properties.height,
    mode: 'placing'
  })
}

// In object drag handler
const handleObjectDragMove = (objectId: string, x: number, y: number) => {
  setCoordinateDisplay({
    x: x,
    y: y,
    deltaX: x - dragStartPosition.x,
    deltaY: y - dragStartPosition.y,
    mode: 'moving'
  })
}

// Clear on deselection
useEffect(() => {
  if (!isDrawing && multiSelectionState.selectedObjectIds.size === 0) {
    setCoordinateDisplay(null)
  }
}, [isDrawing, multiSelectionState.selectedObjectIds.size])
```

### Phase 3: Toast Message Configuration

#### 3.1 Reposition Toast Container
**File**: `frontend/src/App.tsx` or where `<Toaster />` is configured

```typescript
<Toaster 
  position="top-right"  // Move to top-right corner
  toastOptions={{
    duration: 3000,
    style: {
      marginTop: '60px', // Below any top navigation
    }
  }}
/>
```

**Rationale**:
- Top-right keeps toasts out of central working area
- Standard position for notifications in many applications
- Doesn't interfere with coordinate bar (bottom-center) or typical object placement

#### 3.2 Custom Toast Positioning for Canvas Page
Consider adding canvas-specific toast positioning:
```typescript
// In CanvasPage.tsx
toast.success('Object created', {
  position: 'top-right',
  style: {
    marginRight: '20px' // Account for any right-side panels
  }
})
```

### Phase 4: FloatingToolbar Optimization

#### 4.1 Default Position Adjustment
**File**: `frontend/src/components/toolbar/FloatingToolbar.tsx` or toolbar state hook

**Current**: Toolbar can be positioned anywhere (draggable)

**Enhancement**: 
- Set default initial position to top-left corner
- Add "snap to corner" functionality
- Store preferred position in localStorage

```typescript
const DEFAULT_TOOLBAR_POSITIONS = {
  'top-left': { x: 20, y: 80 },
  'top-right': { x: window.innerWidth - 220, y: 80 },
  'bottom-left': { x: 20, y: window.innerHeight - 400 },
  'bottom-right': { x: window.innerWidth - 220, y: window.innerHeight - 400 }
}
```

#### 4.2 Collision Avoidance
Add logic to detect if toolbar is blocking common object placement areas:
- Track frequently used canvas areas
- Suggest repositioning if toolbar overlaps high-use zones
- Optional: Add "Auto-hide during drawing" preference

### Phase 5: Visual Design

#### 5.1 CoordinateStatusBar Styling
```css
.coordinate-status-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  
  background: rgba(30, 30, 30, 0.9);
  backdrop-filter: blur(8px);
  color: #ffffff;
  
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.coordinate-status-bar.hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
  pointer-events: none;
}

.coordinate-value {
  display: inline-block;
  margin: 0 8px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.coordinate-label {
  color: #888;
  font-weight: 600;
  margin-right: 4px;
}

.coordinate-delta {
  color: #fbbf24; /* Amber color for deltas */
}

.coordinate-mode {
  color: #60a5fa; /* Blue color for mode indicator */
  margin-left: 12px;
  font-size: 11px;
  text-transform: uppercase;
}
```

#### 5.2 Display Modes

**Placing Mode**:
```
📐 X: 245  Y: 380  W: 120  H: 80  [PLACING]
```

**Selected Mode**:
```
📍 X: 245  Y: 380  [1 SELECTED]
```

**Moving Mode**:
```
↔️ X: 295 (Δ+50)  Y: 360 (Δ-20)  [MOVING]
```

**Resizing Mode**:
```
⤢ W: 140 (Δ+20)  H: 100 (Δ+20)  [RESIZING]
```

### Phase 6: Accessibility & UX Enhancements

#### 6.1 Keyboard Shortcuts
Add shortcut to toggle coordinate display:
- `Ctrl/Cmd + I` - Toggle coordinate info display
- Include in keyboard shortcuts help

#### 6.2 Precision Controls
Add option to toggle coordinate precision:
- Integer coordinates (default)
- 1 decimal place
- 2 decimal places

#### 6.3 Coordinate System Options
- Canvas coordinates (default)
- Screen coordinates
- Relative coordinates (from selection start)

#### 6.4 Copy Coordinates
- Click on coordinate bar to copy values to clipboard
- Show brief toast: "Coordinates copied"

### Phase 7: Testing Strategy

#### 7.1 Unit Tests
- CoordinateStatusBar component rendering
- Coordinate formatting logic
- Show/hide logic based on state

#### 7.2 Integration Tests
- Coordinate updates during object placement
- Coordinate updates during object movement
- Coordinate updates during object resizing
- Multi-selection coordinate display
- Coordinate bar visibility states

#### 7.3 Manual Testing Checklist
- [ ] Status bar appears when placing objects
- [ ] Status bar shows correct coordinates during placement
- [ ] Status bar appears when selecting objects
- [ ] Status bar updates during object dragging
- [ ] Status bar updates during object resizing
- [ ] Status bar doesn't interfere with object placement in any viewport size
- [ ] Status bar doesn't overlap with FloatingToolbar
- [ ] Toast messages appear in non-intrusive location
- [ ] Status bar works correctly with zoom/pan
- [ ] Status bar handles multi-selection appropriately
- [ ] Status bar disappears when no objects selected

#### 7.4 Visual Regression Tests
- Screenshot tests for status bar in different modes
- Layout tests for different viewport sizes
- Overlap detection tests

## Implementation Checklist

### Milestone 1: Core Component (2-3 hours)
- [ ] Create `CoordinateStatusBar.tsx` component
- [ ] Create styling file or add styles
- [ ] Add prop types and basic rendering logic
- [ ] Implement show/hide transitions

### Milestone 2: Integration (3-4 hours)
- [ ] Add state management to `CanvasPage.tsx`
- [ ] Hook up coordinate updates during placement
- [ ] Hook up coordinate updates during selection
- [ ] Hook up coordinate updates during movement
- [ ] Hook up coordinate updates during resizing
- [ ] Implement visibility logic

### Milestone 3: Toast & Toolbar Optimization (1-2 hours)
- [ ] Adjust toast notification positioning
- [ ] Update FloatingToolbar default position
- [ ] Add toolbar position presets
- [ ] Test for UI element conflicts

### Milestone 4: Polish & Enhancements (2-3 hours)
- [ ] Add coordinate formatting options
- [ ] Implement copy-to-clipboard functionality
- [ ] Add keyboard shortcut
- [ ] Add mode-specific displays
- [ ] Implement smooth animations

### Milestone 5: Testing & Documentation (2-3 hours)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing across different scenarios
- [ ] Update user documentation
- [ ] Add to keyboard shortcuts help

**Total Estimated Time**: 10-15 hours

## Technical Considerations

### Performance
- Use `useMemo` for coordinate formatting to avoid unnecessary recalculations
- Debounce coordinate updates during rapid mouse movements (optional)
- Use CSS transforms for positioning (better performance than top/left)

### Browser Compatibility
- Test backdrop-filter support (fallback to solid background)
- Ensure fixed positioning works across browsers
- Test on different viewport sizes and device types

### State Management
- Consider using a custom hook `useCoordinateDisplay()` to encapsulate logic
- Keep coordinate state local to CanvasPage (no need for global state)
- Clear coordinate display on component unmount

### Zoom & Pan Handling
- Coordinates should show canvas coordinates, not screen coordinates
- Account for zoom level when displaying coordinates
- Ensure status bar remains visible during pan operations

## Future Enhancements (Post-MVP)

1. **Snap-to-Grid Display**
   - Show grid coordinates when snap-to-grid is enabled
   - Display nearest grid point

2. **Relative Coordinates**
   - Show coordinates relative to canvas origin
   - Show coordinates relative to first selected object (for multi-selection)

3. **Coordinate History**
   - Show last 3-5 coordinate positions
   - Helpful for retracing steps

4. **Mini-Map Integration**
   - Show object position on a mini-map
   - Highlight coordinate location visually

5. **Measurement Tools**
   - Distance between objects
   - Angle of lines/arrows
   - Area of shapes

6. **Customizable Position**
   - Let users drag the coordinate bar
   - Save preferred position in preferences

7. **Export Coordinates**
   - Export all object coordinates to JSON/CSV
   - Useful for documentation

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Status bar blocks object placement | High | Position at bottom-center, far from typical work areas |
| Performance impact from frequent updates | Medium | Use debouncing and React optimization techniques |
| Conflicts with existing UI elements | Medium | Careful z-index management and positioning |
| Coordinate accuracy with zoom/pan | Medium | Ensure proper coordinate transformation accounting for zoom/pan |
| Cluttered UI with too much information | Low | Start minimal, add progressive disclosure |

## Success Metrics

- Status bar visible when expected (100% of placement/selection scenarios)
- No reported UI conflicts with toolbar or toasts
- Positive user feedback on coordinate accuracy
- No performance degradation (maintain 60fps during drawing)
- Reduced user errors in precise object placement

## Questions for Review

1. Should coordinates be relative to canvas origin (0,0) or screen viewport?
   - **Recommendation**: Canvas origin for consistency with object properties
   
2. Should we show coordinates in zoomed scale or actual canvas coordinates?
   - **Recommendation**: Actual canvas coordinates (matches stored values)

3. Should the status bar be always visible (showing 0,0) or only when active?
   - **Recommendation**: Only when active (less clutter)

4. Should we show different coordinate systems (cartesian, polar)?
   - **Recommendation**: Start with cartesian (X,Y), add polar as enhancement

5. Should the bar be draggable like the FloatingToolbar?
   - **Recommendation**: Start with fixed position, add dragging as enhancement

## References

- React Konva Documentation: https://konvajs.org/docs/react/
- Existing SelectionIndicator implementation
- FloatingToolbar positioning logic
- Multi-selection implementation patterns
