import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { reactFlowRef } from "@/lib/client/reactFlowRef";

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Normalize `#rgb` / `#rrggbb` / `#rrggbbaa` to lowercase `#rrggbb` so it is
 * safe for `hexToRgba`. Returns null for anything else (named colors, rgb(),
 * garbage) so callers can fall back instead of rendering `rgba(NaN,…)`.
 */
export function toHex6(color: string | null | undefined): string | null {
  if (typeof color !== 'string') return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1].toLowerCase();
  if (hex.length === 3) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  return `#${hex.slice(0, 6)}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Flow-coordinate center of the visible canvas.
 * Prefers React Flow's own screenToFlowPosition (always correct regardless of
 * zoom/pan/transform format); falls back to parsing the viewport transform.
 */
export function getViewportCenter(): { x: number; y: number } {
  const bounds = document.querySelector('.react-flow')?.getBoundingClientRect();

  if (bounds && reactFlowRef.instance) {
    return reactFlowRef.instance.screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
  }

  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!bounds || !viewport) return { x: 400, y: 300 };

  const style = viewport.style.transform;
  const match = style.match(/translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/);

  let vx = 0, vy = 0, zoom = 1;
  if (match) {
    vx = parseFloat(match[1]);
    vy = parseFloat(match[2]);
    zoom = parseFloat(match[3]);
  }

  const x = (bounds.width / 2 - vx) / zoom;
  const y = (bounds.height / 2 - vy) / zoom;

  return { x, y };
}
