import type { MermaidAST, ParsedNode, ParsedEdge, ParsedSubgraph, Direction, Shape, EdgeType, ParseResult } from './types'

function normalizeEdgeLabels(text: string): string {
  return text.split('\n').map(line => {
    return line.replace(/--\s+([^>]+?)\s*-->/g, '-->|$1|');
  }).join('\n');
}

function extractId(raw: string): string | null {
  const m = raw.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)/);
  return m ? m[1] : null;
}

function ensureNode(
  raw: string,
  nodes: ParsedNode[],
  nodeIdSet: Set<string>,
  currentSubgraphId: string | null,
  subgraphs: ParsedSubgraph[],
): string | null {
  const id = extractId(raw);
  if (!id) return null;
  if (nodeIdSet.has(id)) return id;
  // If the ID is a subgraph, we do NOT want to create a duplicate leaf node for it
  if (subgraphs.some(s => s.id === id)) return id;
  const label = extractNodeLabel(raw) || id;
  const shape = detectShape(raw);
  nodeIdSet.add(id);
  nodes.push({ id, label, shape, subgraphId: currentSubgraphId });
  if (currentSubgraphId) {
    const sub = subgraphs.find(s => s.id === currentSubgraphId);
    if (sub) sub.nodeIds.push(id);
  }
  return id;
}

function detectDirection(text: string): Direction {
  const lines = text.split('\n')
  for (const rawLine of lines) {
    const cleanLine = rawLine.includes('%%') ? rawLine.split('%%')[0] : rawLine
    const line = cleanLine.trim()
    const m = line.match(/^(?:graph|flowchart)\s+(TD|LR|BT|RL|TB)\b/i)
    if (m) {
      const d = m[1].toUpperCase()
      if (d === 'TB') return 'TD'
      return d as Direction
    }
  }
  return 'TD'
}

function detectShape(line: string): Shape {
  if (line.includes('[(')) return 'cylinder'
  if (line.includes('((')) return 'circle'
  if (line.includes('{{')) return 'hexagon'
  if (line.includes('{')) return 'diamond'
  if (line.includes('([') || line.includes(')')) return 'rounded'
  if (line.includes('/"') || line.includes('["/>') || line.includes('[\\')) return 'parallelogram'
  if (line.includes('[')) return 'rectangle'
  return 'rectangle'
}

function extractNodeLabel(line: string): string | null {
  const patterns = [
    /\[\(\(\"?([^\"]*)\"?\)\)\]/, // Double circle
    /\[\(\"?([^\"]*)\"?\)\]/,     // Cylinder (Database/Cache)
    /\(\(\"?([^\"]*)\"?\)\)/,     // Circle
    /\(\"?([^\"]*)\"?\)/,         // Rounded
    /\{\{\"?([^\"]*)\"?\}\}/,     // Hexagon
    /\{\"?([^\"]*)\"?\}/,         // Diamond
    /\[\/\"?([^\"]*)\"?\/\]/,     // Parallelogram Left
    /\[\\\"?([^\"]*)\"?\\\]/,     // Parallelogram Right
    /\[\"([^\"]*)\"\]/,           // Double-quoted rectangle
    /\[\"?([^\"]*)\"?\]/,         // Generic rectangle
  ]
  for (const p of patterns) {
    const m = line.match(p)
    if (m) return m[1]
  }
  return null
}

export function parseMermaid(mermaidText: string): ParseResult {
  const errors: { line: number; reason: string }[] = []
  const normalized = normalizeEdgeLabels(mermaidText)
  const direction = detectDirection(normalized)
  const subgraphs: ParsedSubgraph[] = []
  const nodes: ParsedNode[] = []
  const edges: ParsedEdge[] = []
  const nodeIdSet = new Set<string>()

  let currentSubgraphId: string | null = null
  const subgraphStack: string[] = []
  const lines = normalized.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    // Strip trailing or standalone comments
    const commentIdx = rawLine.indexOf('%%')
    const cleanLine = commentIdx !== -1 ? rawLine.slice(0, commentIdx) : rawLine
    const line = cleanLine.trim()
    if (!line || line.startsWith('graph') || line.startsWith('flowchart') || /^direction\s+(TD|LR|BT|RL|TB)\b/i.test(line)) {
      continue
    }

    const lineNum = i + 1

    // Subgraph start
    // Matches: subgraph ID ["label"], subgraph ID ['label'], subgraph ID [label], subgraph ID
    // ID can contain spaces which we will normalize to underscores
    const subgraphMatch = line.match(/^subgraph\s+([A-Za-z0-9_\-\s]+?)(?:\s*(?:\[\s*"(.*?)"\s*\]|\[\s*'(.*?)'\s*\]|\[\s*(.*?)\s*\]))?$/i)
    if (subgraphMatch) {
      const rawId = subgraphMatch[1].trim()
      const label = subgraphMatch[2] ?? subgraphMatch[3] ?? subgraphMatch[4] ?? rawId
      const id = rawId.replace(/\s+/g, '_')
      const parentId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : undefined
      
      // If a node was already declared with this ID, remove it to avoid duplicate ID issues
      if (nodeIdSet.has(id)) {
        nodeIdSet.delete(id)
        const idx = nodes.findIndex(n => n.id === id)
        if (idx !== -1) nodes.splice(idx, 1)
      }

      subgraphStack.push(id)
      currentSubgraphId = id
      subgraphs.push({ id, label: label.trim(), nodeIds: [], parentId })
      continue
    }

    // Subgraph end
    if (line.toLowerCase() === 'end') {
      subgraphStack.pop()
      currentSubgraphId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null
      continue
    }

    // Edge: check for arrow syntax (supporting chained arrows, e.g. A --> B --> C)
    const arrowRegex = /(<-->|-->|-\.->|===>)/g
    const matches = [...line.matchAll(arrowRegex)]
    if (matches.length > 0) {
      const segmentNodes: string[] = []
      const edgeSpecs: Array<{ sourceIdx: number; targetIdx: number; label: string | null; type: EdgeType }> = []

      let lastIndex = 0
      for (let mIdx = 0; mIdx < matches.length; mIdx++) {
        const match = matches[mIdx]
        const arrowIdx = match.index!
        const fullArrow = match[1]

        // Segment before this arrow
        const segment = line.slice(lastIndex, arrowIdx).trim()
        
        let edgeType: EdgeType = 'arrow'
        if (fullArrow === '<-->') edgeType = 'arrow'
        else if (fullArrow === '-.->') edgeType = 'dotted'
        else if (fullArrow === '===>') edgeType = 'thick'

        // Check if there is an inline label directly on this arrow (only if we're not at the very end)
        // Wait, standard mermaid can have labels inside pipes, e.g. -->|label|
        // But since we split, let's see where the label resides.
        // In A -->|sends| B -->|receives| C:
        // Match 1 is "-->" at index 2. The text after it starts with "|sends| B"
        // Let's extract the label from the text following this arrow (before the next arrow if any, or end of line)
        const nextMatch = matches[mIdx + 1]
        const nextArrowIdx = nextMatch ? nextMatch.index! : line.length
        let targetPart = line.slice(arrowIdx + fullArrow.length, nextArrowIdx).trim()

        let edgeLabel: string | null = null
        const pipeLabelMatch = targetPart.match(/^\|"?([^"|]*)"?\|\s*(.*)$/)
        if (pipeLabelMatch) {
          edgeLabel = pipeLabelMatch[1]
          targetPart = pipeLabelMatch[2].trim()
        }

        // Register source node (before the arrow)
        const sourceId = ensureNode(segment, nodes, nodeIdSet, currentSubgraphId, subgraphs)
        if (sourceId) {
          segmentNodes.push(sourceId)
        }

        edgeSpecs.push({
          sourceIdx: segmentNodes.length - 1,
          targetIdx: segmentNodes.length, // Will be resolved when final node is added
          label: edgeLabel,
          type: edgeType,
        })

        // Move lastIndex past the arrow and its label (but not past the target node!)
        // The text we parsed as label was at the start of the next segment.
        // So lastIndex should point to the target node's text.
        if (pipeLabelMatch) {
          // The pipeLabelMatch matched "|label|" at start of targetPart.
          // The length of "|label|" is pipeLabelMatch[0].length (minus trailing spaces).
          // We can find where the target node actually starts.
          const labelOffset = line.slice(arrowIdx + fullArrow.length).indexOf(pipeLabelMatch[2])
          lastIndex = arrowIdx + fullArrow.length + labelOffset
        } else {
          lastIndex = arrowIdx + fullArrow.length
        }
      }

      // Final segment after the last arrow
      const finalSegment = line.slice(lastIndex).trim()
      const finalNodeId = ensureNode(finalSegment, nodes, nodeIdSet, currentSubgraphId, subgraphs)
      if (finalNodeId) {
        segmentNodes.push(finalNodeId)
      }

      // Build edges between adjacent nodes in the chain
      for (const spec of edgeSpecs) {
        const sourceId = segmentNodes[spec.sourceIdx]
        const targetId = segmentNodes[spec.targetIdx]
        if (sourceId && targetId) {
          edges.push({
            id: `${sourceId}-${targetId}-${spec.label ?? 'nolabel'}`,
            source: sourceId,
            target: targetId,
            label: spec.label,
            type: spec.type,
          })
        }
      }
      continue
    }

    // Node declaration
    const idMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)\s*(.*)$/)
    if (idMatch) {
      const id = idMatch[1]
      const rest = idMatch[2].trim()
      const label = extractNodeLabel(line)
      const shape = rest ? detectShape(rest) : null

      if (subgraphs.some(s => s.id === id)) {
        // ID is already a subgraph. Update the subgraph's label if specified,
        // but do NOT create a duplicate leaf node.
        const sub = subgraphs.find(s => s.id === id)
        if (sub && label) {
          sub.label = label
        }
        continue
      }

      if (nodeIdSet.has(id)) {
        // Node was already created (e.g. implicitly via an edge).
        // Update its properties instead of throwing a duplicate error.
        const existingNode = nodes.find(n => n.id === id)
        if (existingNode) {
          if (label) existingNode.label = label
          if (shape) existingNode.shape = shape
          if (currentSubgraphId) {
            existingNode.subgraphId = currentSubgraphId
            const sub = subgraphs.find(s => s.id === currentSubgraphId)
            if (sub && !sub.nodeIds.includes(id)) {
              sub.nodeIds.push(id)
            }
          }
        }
        continue
      }
      nodeIdSet.add(id)

      const node: ParsedNode = {
        id,
        label: label || id,
        shape: shape || 'rectangle',
        subgraphId: currentSubgraphId,
      }
      nodes.push(node)

      if (currentSubgraphId) {
        const sub = subgraphs.find(s => s.id === currentSubgraphId)
        if (sub) sub.nodeIds.push(id)
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    ast: { direction, nodes, edges, subgraphs },
  }
}
