export function titleDirective(title: string): string {
  const escaped = title.replace(/"/g, '\\"');
  return `  %% archdraw-text: {"id":"title","text":"${escaped}","size":"heading","anchor":"top"}`;
}

/** Insert the title directive on the line right after `graph …`. */
export function withTitleDirective(mermaidCode: string, title: string): string {
  if (mermaidCode.includes('%% archdraw-text:')) return mermaidCode;
  const [firstLine, ...rest] = mermaidCode.split('\n');
  return [firstLine, titleDirective(title), ...rest].join('\n');
}

/**
 * Drop trailing subgraphs (typically OPS / observability) so L1/L2 concept
 * templates stay within the FloatingAIBar detail budgets.
 */
export function trimMermaidByDetailLevel(mermaidCode: string, detailLevel: 1 | 2 | 3): string {
  if (detailLevel >= 3) return mermaidCode;

  const lines = mermaidCode.split('\n');
  type Block = { start: number; end: number };
  const blocks: Block[] = [];
  let depth = 0;
  let blockStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*subgraph\s+/i.test(lines[i])) {
      if (depth === 0) blockStart = i;
      depth += 1;
    } else if (/^\s*end\s*$/i.test(lines[i])) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && blockStart >= 0) {
        blocks.push({ start: blockStart, end: i });
        blockStart = -1;
      }
    }
  }
  if (blocks.length <= 2) return mermaidCode;

  const keepCount = detailLevel === 1
    ? Math.min(3, blocks.length)
    : Math.max(3, blocks.length - 1);
  if (keepCount >= blocks.length) return mermaidCode;

  const keptBlocks = blocks.slice(0, keepCount);
  const lastKeptEnd = keptBlocks[keptBlocks.length - 1].end;

  const header: string[] = [];
  for (let i = 0; i < (blocks[0]?.start ?? 0); i++) header.push(lines[i]);

  const body: string[] = [];
  for (const b of keptBlocks) {
    for (let i = b.start; i <= b.end; i++) body.push(lines[i]);
  }

  const keptIds = new Set<string>();
  for (const line of body) {
    const decl = line.match(/^\s*([A-Za-z0-9_]+)\s*[\[\(\{]/);
    if (decl) keptIds.add(decl[1]);
  }

  // Edges may appear after all subgraphs — keep only those still valid.
  const edgeLines: string[] = [];
  for (let i = lastKeptEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*subgraph\s+/i.test(line) || /^\s*end\s*$/i.test(line)) continue;
    const edgeMatch = line.match(
      /^\s*([A-Za-z0-9_]+)\s*-->\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/,
    );
    if (edgeMatch && keptIds.has(edgeMatch[1]) && keptIds.has(edgeMatch[2])) {
      edgeLines.push(line);
    }
  }

  // Also scan edges that were interleaved (rare) inside the original after first block
  for (let i = (blocks[0]?.start ?? 0); i <= lastKeptEnd; i++) {
    const line = lines[i];
    const edgeMatch = line.match(
      /^\s*([A-Za-z0-9_]+)\s*-->\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/,
    );
    if (edgeMatch && keptIds.has(edgeMatch[1]) && keptIds.has(edgeMatch[2])) {
      // Already in body if it was between nodes inside a kept subgraph — skip duplicates
      if (!body.includes(line) && !edgeLines.includes(line)) edgeLines.push(line);
    }
  }

  return [...header, ...body, ...edgeLines].join('\n').trim() + '\n';
}
