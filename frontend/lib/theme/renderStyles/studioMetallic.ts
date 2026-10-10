import type { RenderStylePack } from './types';
import { STUDIO_MINIMAL_RENDER_STYLE } from './studioMinimal';

/** Studio Minimal's visual language with a subtle satin-metal node surface. */
export const STUDIO_METALLIC_RENDER_STYLE: RenderStylePack = {
  ...STUDIO_MINIMAL_RENDER_STYLE,
  id: 'studio-metallic',
  label: 'Studio Metallic',
  description: 'Studio Minimal styling with a satin, polished-metal node finish.',
  nodeMaterial: 'metallic',
};

export function metallicSurfaceOverlayCss(isDark: boolean): string {
  return isDark
    ? 'linear-gradient(112deg, rgba(255,255,255,.17) 0%, rgba(255,255,255,.055) 28%, transparent 56%, rgba(0,0,0,.24) 100%), linear-gradient(180deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.025) 3px, transparent 14px, transparent calc(100% - 3px), rgba(0,0,0,.18) 100%)'
    : 'linear-gradient(112deg, rgba(255,255,255,.88) 0%, rgba(203,213,225,.43) 30%, rgba(248,250,252,.18) 60%, rgba(100,116,139,.2) 100%), linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.16) 3px, transparent 14px, transparent calc(100% - 3px), rgba(100,116,139,.18) 100%)';
}

export function metallicSurfaceElevation(isDark: boolean): string {
  return isDark
    ? '0 8px 24px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.2)'
    : '0 5px 16px rgba(15,23,42,.1), 0 1px 3px rgba(15,23,42,.06)';
}

export function metallicSurfaceInset(isDark: boolean): string {
  return isDark
    ? 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -1px 0 rgba(0,0,0,.28)'
    : 'inset 0 1px 0 rgba(255,255,255,.94), inset 0 -1px 0 rgba(100,116,139,.22)';
}

export function metallicSurfaceGradientSvgDefs(isDark: boolean): string {
  const stops = isDark
    ? '<stop offset="0%" stop-color="white" stop-opacity="0.17"/><stop offset="28%" stop-color="white" stop-opacity="0.055"/><stop offset="56%" stop-color="white" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.24"/>'
    : '<stop offset="0%" stop-color="white" stop-opacity="0.88"/><stop offset="30%" stop-color="#cbd5e1" stop-opacity="0.43"/><stop offset="60%" stop-color="#f8fafc" stop-opacity="0.18"/><stop offset="100%" stop-color="#64748b" stop-opacity="0.2"/>';
  const edgeStops = isDark
    ? '<stop offset="0%" stop-color="white" stop-opacity="0.13"/><stop offset="10%" stop-color="white" stop-opacity="0"/><stop offset="94%" stop-color="white" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.18"/>'
    : '<stop offset="0%" stop-color="white" stop-opacity="0.92"/><stop offset="10%" stop-color="white" stop-opacity="0"/><stop offset="94%" stop-color="white" stop-opacity="0"/><stop offset="100%" stop-color="#64748b" stop-opacity="0.18"/>';
  const shadowOpacity = isDark ? '0.3' : '0.12';
  return `<defs><linearGradient id="archdraw-metallic-sheen" x1="0" y1="1" x2="1" y2="0">${stops}</linearGradient><linearGradient id="archdraw-metallic-edge" x1="0" y1="0" x2="0" y2="1">${edgeStops}</linearGradient><filter id="archdraw-metallic-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0f172a" flood-opacity="${shadowOpacity}"/></filter></defs>`;
}
