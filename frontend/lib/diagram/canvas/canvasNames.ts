/**
 * Names the editor gives new canvases. A canvas still carrying one of these
 * was never named by the user, so it may be renamed automatically (e.g. to
 * the repository a live project is linked to).
 */
export const AUTO_CANVAS_NAMES = [
  'Elephant', 'Lion', 'Panda', 'Tiger', 'Falcon', 'Shark', 'Wolf', 'Fox', 'Bear', 'Eagle',
  'Owl', 'Hawk', 'Dolphin', 'Penguin', 'Zebra', 'Giraffe', 'Leopard', 'Jaguar', 'Panther', 'Cheetah',
] as const;

const AUTO_NAME = new RegExp(`^(?:${AUTO_CANVAS_NAMES.join('|')})(?: \\d+)?$`);

/** True for generated names ("Giraffe", "Wolf 2") and the schema default ("Canvas 1"). */
export function isAutoCanvasName(name: string): boolean {
  const trimmed = name.trim();
  return AUTO_NAME.test(trimmed) || /^Canvas \d+$/.test(trimmed);
}
