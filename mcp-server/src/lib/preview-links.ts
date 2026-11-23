/** The preview and edit links also work in clients without an inline canvas. */
export const IMAGE_STYLE_NAMES = ['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision'] as const;
export type ImageStyleName = (typeof IMAGE_STYLE_NAMES)[number];
export const DEFAULT_MCP_IMAGE_STYLE = 'studio' satisfies ImageStyleName;

export function previewOptions(style: ImageStyleName = DEFAULT_MCP_IMAGE_STYLE) {
  return {
    preview: true,
    previewStyle: style,
    ...(style === 'studio' || style === 'studio-metallic' ? { previewTheme: 'dark', previewSurface: 'canvas' } : {}),
  };
}

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
    const lines = ['Show these links to the user. Use the canvas for the diagram and avoid repeating it as an image:'];
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
