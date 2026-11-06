/**
 * Link block placed at the TOP of every diagram tool reply.
 *
 * Diagrams are visual. Text-only agents (Claude Code, Cursor, Codex, …) cannot
 * render the inline widget, so without a URL the user has no way to see what
 * was generated. Agents relay what is prominent in the tool text, so the link
 * comes first with an explicit instruction to show it.
 */
export const IMAGE_STYLE_NAMES = ['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision'] as const;
export type ImageStyleName = (typeof IMAGE_STYLE_NAMES)[number];
const IMAGE_STYLE_LABEL: Record<ImageStyleName, string> = {
  sketch: 'hand-drawn',
  studio: 'clean',
  'studio-metallic': 'satin metal',
  neubrutalism: 'bold neubrutalist',
  precision: 'precise',
};

export interface PreviewLinkInput {
  shareUrl?: string;
  diagramUrl?: string;
  /** Why no link was created, when one was expected. */
  linkError?: string;
  /** True when the caller opted out with publish:false. */
  privateByRequest?: boolean;
  /** Look of the image links: hand-drawn (default) or clean. */
  imageStyle?: ImageStyleName;
}

/**
 * The image URLs for a published diagram, from its share link: the same session as a PNG or an
 * SVG, hand-drawn (`sketch`, the default) or clean (`studio`). Shareable anywhere an image can be.
 */
export function imageUrlsFor(shareUrl: string | undefined, style: ImageStyleName = 'sketch') {
  if (!shareUrl || !shareUrl.includes('/share/')) return undefined;
  const base = shareUrl.replace('/share/', '/api/diagram/image/');
  return { png: `${base}?style=${style}&format=png`, svg: `${base}?style=${style}&format=svg`, clean: `${base}?style=studio&format=png` };
}

export function formatPreviewLinks({ shareUrl, diagramUrl, linkError, privateByRequest, imageStyle }: PreviewLinkInput): string {
  if (shareUrl || diagramUrl) {
    const lines = ['Show these links to the user — this is how they see the diagram:'];
    if (shareUrl) lines.push(`🔗 Preview: ${shareUrl}`);
    if (diagramUrl) lines.push(`✏️ Open & edit in ArchDraw: ${diagramUrl}`);
    const images = imageUrlsFor(shareUrl, imageStyle);
    if (images) {
      lines.push(`🖼️ Image to share (PNG, ${IMAGE_STYLE_LABEL[imageStyle ?? 'sketch']}): ${images.png}`);
      lines.push(`   Markdown: ![diagram](${images.png})   SVG: ${images.svg}${imageStyle === 'studio' ? '' : `   Clean style: ${images.clean}`}`);
    }
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
