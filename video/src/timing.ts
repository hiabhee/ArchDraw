/**
 * Every start and length, in frames of the 30 fps authoring timeline. The video
 * renders at 60 fps: scenes read `useT()` (frame / SCALE), so a beat set here at
 * frame 150 still happens at 5 s, but moves in half-size steps.
 */
export const AUTHOR_FPS = 30;
export const FPS = 60;
export const SCALE = FPS / AUTHOR_FPS;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const SCENES = {
  problem: { from: 0, dur: 210 },
  map: { from: 150, dur: 1040 },
  command: { from: 1170, dur: 330 },
  close: { from: 1480, dur: 590 },
} as const;

/** Beats inside the map story, in frames from the start of the map scene. */
export const MAP = {
  bgIn: [0, 60],
  groupsIn: 30,
  nodesIn: 50,
  edgesIn: 100,
  agentsIn: 170,
  geckoWalk: [210, 340],
  fox: { waits: 360, queueIn: 372, answered: 650 },
  camToPayments: [450, 500],
  cursorIn: 500,
  click: 548,
  cardIn: 552,
  cardOut: 660,
  sitePlot: 700,
  mapped: 780,
  zoomOut: [850, 920],
} as const;

export const TOTAL = SCENES.close.from + SCENES.close.dur;
