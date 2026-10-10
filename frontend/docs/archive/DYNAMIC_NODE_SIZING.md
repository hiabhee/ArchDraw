# Dynamic Node Sizing Implementation

## Overview
All nodes in ArchDraw now dynamically resize based on their content. Nodes start at their preferred size and can grow larger when content requires it, ensuring that all text is readable without being cut off.

## Key Changes

### 1. Two-Tier Maximum Width System

**Preferred Max Width** (soft limit):
- Default target size for typical content
- Keeps nodes compact and visually consistent
- Examples:
  - Rectangle/Rounded: 240px (SIZE_L)
  - Cache/Function: 200px (SIZE_M)
  - Document: 120px (SIZE_XS)

**Absolute Max Width** (hard limit):
- Only used when content is extensive (>8 wrapped lines)
- Prevents nodes from becoming excessively large
- Examples:
  - Rectangle/Rounded: 640px (SIZE_XXL * 2)
  - Cache/Function: 320px (SIZE_XXL)
  - Document: 240px (SIZE_L) - maintains portrait orientation

### 2. Dynamic Height System

**Three-Tier Height Ranges:**

```typescript
{
  min: number;      // Minimum height for the shape
  max: number;      // Preferred maximum for typical content
  absoluteMax: number;  // Hard limit for excessive content
}
```

**Behavior:**
- Content with ≤6 wrapped lines: uses `max`
- Content with >6 wrapped lines: expands to `absoluteMax`
- Allows nodes to grow vertically as needed

### 3. Shape-Specific Configurations

#### Standard Shapes
- **Rectangle/Rounded Rectangle**: Unlimited vertical growth
- **Diamond/Circle**: Limited by shape constraints (240-360px height)
- **Hexagon**: Limited to maintain recognizable shape
- **Cloud**: 96-200px height range
- **Actor/Monitor/Mobile**: Compact with moderate expansion

#### Architecture-Native Shapes
- **Queue**: Horizontal orientation, limited height (56-120px)
- **Cache**: Stacked layers, can grow (88-200px)
- **Function**: Angled corners, moderate growth (88-200px)
- **Container**: Nested cells, good expansion (96-240px)
- **Bucket**: Tapered shape, moderate height (96-200px)

#### Document Shapes (Portrait Orientation)
- **Document (Single)**:
  - Width: 100-240px (stays narrow)
  - Height: 140-400px (grows tall)
  - 12 content lines with curvy corners
  
- **Documents (Stacked)**:
  - Width: 120-240px (stays narrow)
  - Height: 180-500px (grows very tall)
  - Multiple stacked layers visible

## Implementation Details

### Content Measurement
```typescript
// Calculate ideal width based on longest line
const longestLineLength = Math.max(...lines.map(line => line.length));
const idealBandWidth = longestLineLength * AVG_CHAR_WIDTH + 16;
const idealBBoxWidth = idealBandWidth / band;
```

### Dynamic Expansion Logic
```typescript
// 1. Try preferred max first
let width = fitWidthToContent(idealBBoxWidth, minWidth, preferredMaxWidth);

// 2. Calculate wrapped lines
let wrappedLines = calculateWrappedLines(lines, width);

// 3. If too many wrapped lines (>8), expand to absolute max
if (wrappedLines > 8 && width < absoluteMaxWidth) {
  width = fitWidthToContent(idealBBoxWidth, width, absoluteMaxWidth);
  wrappedLines = recalculateWrappedLines(lines, width);
}

// 4. Calculate height based on wrapped lines
let height = wrappedLines * LINE_HEIGHT + PADDING_Y + iconStack;

// 5. Use dynamic max height based on content
const effectiveMaxHeight = wrappedLines > 6 
  ? heightRange.absoluteMax 
  : heightRange.max;
```

### Text Wrapping
Each shape has a "text band" - the usable portion of the width for text:
- Rectangle/Rounded: 88% of width
- Diamond/Circle: 42% of width (limited by shape)
- Hexagon: 52% of width
- Document: 78% of width
- Container: 76% of width

## Benefits

### For Users
✓ **No More Cut-Off Text**: All content is always visible
✓ **Compact by Default**: Typical nodes stay small and clean
✓ **Smart Expansion**: Only grows when necessary
✓ **Shape Preservation**: Each shape maintains its characteristic appearance

### For Content
✓ **Short Labels**: Stay compact (e.g., "API" → 120px wide)
✓ **Medium Labels**: Fit comfortably with wrapping
✓ **Long Labels**: Expand to accommodate without extreme wrapping
✓ **Multi-line Content**: Height grows naturally

### For Layout
✓ **Visual Consistency**: Most nodes stay within preferred sizes
✓ **Readable Diagrams**: Important details aren't hidden
✓ **Balanced Proportions**: Shapes maintain their character
✓ **Document Nodes**: Clear portrait orientation (height > width)

## Examples

### Example 1: API Service (Short Content)
```
Label: "API Service"
Shape: rectangle
Result: 120px × 102px
Behavior: Stays compact, no expansion needed
```

### Example 2: Authentication Service (Medium Content)
```
Label: "User Authentication Service with JWT"
Shape: rounded-rectangle
Result: 240px × 120px
Behavior: Fits in preferred max, wraps to 2 lines
```

### Example 3: ML Pipeline (Long Content)
```
Label: "Advanced ML Model Training Pipeline with Distributed Computing"
Shape: rounded-rectangle
Result: 380px × 192px
Behavior: Expanded beyond preferred max, wraps to 4 lines
```

### Example 4: Configuration Document (Portrait)
```
Label: "Comprehensive System Configuration"
Shape: document
Result: 120px × 240px
Behavior: Narrow width, tall height, 12 visible lines
```

### Example 5: Database with Long Name
```
Label: "PostgreSQL User Authentication Database with Replication"
Shape: cylinder (vertical)
Result: 280px × 140px
Behavior: Expanded to accommodate text
```

## Technical Constants

```typescript
AVG_CHAR_WIDTH = 7.2px    // Average character width
LINE_HEIGHT = 18px        // Line spacing
PADDING_Y = 36px          // Vertical padding
ICON_STACK = 48px         // Space for icon above text

SIZE_XS = 120px
SIZE_S = 160px
SIZE_M = 200px
SIZE_L = 240px
SIZE_XL = 280px
SIZE_XXL = 320px
```

## Thresholds

- **Width Expansion Trigger**: >8 wrapped lines
- **Height Expansion Trigger**: >6 wrapped lines
- **Minimum Wrapping**: Always at least 1 line
- **Grid Snapping**: 40px increments for consistency

## Testing

To test dynamic sizing behavior:
1. Create nodes with various label lengths
2. Add subtitle text to increase content
3. Use multi-line labels (with \n)
4. Compare document nodes vs regular shapes

Expected behavior:
- Short labels: compact size
- Medium labels: wraps within preferred max
- Long labels: expands to absolute max
- Very long labels: wraps at absolute max

---

**Last Updated**: 2026-08-17
**Related Files**:
- `/lib/utils/nodeSizing.ts` - Core sizing logic
- `/lib/theme/shapeGeometry/index.ts` - Shape rendering
- `/lib/shapeRegistry.ts` - Shape type definitions
