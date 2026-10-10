/**
 * Link block placed at the TOP of every diagram tool reply.
 *
 * Diagrams are visual. Text-only agents (Claude Code, Cursor, Codex, …) cannot
 * render the inline widget, so without a URL the user has no way to see what
 * was generated. Agents relay what is prominent in the tool text, so the link
 * comes first with an explicit instruction to show it.
 */
export interface PreviewLinkInput {
  shareUrl?: string;
  diagramUrl?: string;
  /** Why no link was created, when one was expected. */
  linkError?: string;
  /** True when the caller opted out with publish:false. */
  privateByRequest?: boolean;
}

export function formatPreviewLinks({ shareUrl, diagramUrl, linkError, privateByRequest }: PreviewLinkInput): string {
  if (shareUrl || diagramUrl) {
    const lines = ['Show these links to the user — this is how they see the diagram:'];
    if (shareUrl) lines.push(`🔗 Preview: ${shareUrl}`);
    if (diagramUrl) lines.push(`✏️ Open & edit in ArchDraw: ${diagramUrl}`);
    lines.push('(Anyone with the link can view it; it expires after 7 days.)');
    return lines.join('\n');
  }
  if (privateByRequest) {
    return 'No preview link was created (publish:false). The diagram exists only in this MCP session; call again with publish:true if the user wants to view it in a browser.';
  }
  return `⚠️ No preview link could be created${linkError ? `: ${linkError}` : ''}. Tell the user the diagram was generated but cannot be viewed in a browser yet.`;
}

/** User-facing reason for a failed preview save. */
export function describeSaveFailure(status: number): string {
  if (status === 429) return 'the ArchDraw preview-link rate limit was reached; try again in a while';
  return `ArchDraw could not save the preview (HTTP ${status})`;
}
