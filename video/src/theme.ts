import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const FONT = inter.fontFamily;
export const MONO = mono.fontFamily;

/** Bright SaaS-film palette. Surfaces are white cards on a cool grey page; ink is near-black navy. */
export const C = {
  page: "#eef1f7",
  panel: "#ffffff",
  card: "#f6f7f9",
  line: "#e3e7ef",
  lineStrong: "#cfd5e1",
  ink: "#0b1020",
  inkSoft: "#2b3347",
  muted: "#6b7487",
  attention: "#d97706",
  blue: "rgb(30, 144, 255)",
  /** Agent canvas ink (AgentAtlasLayer, light). */
  atlasInk: "#1d2026",
  atlasMuted: "rgba(29,32,38,0.55)",
  tagBg: "rgba(255,255,255,0.94)",
  site: "#f59e0b",
} as const;

/** Terminals stay dark inside the bright film, as they do in the product. */
export const T = {
  page: "#07080a",
  panel: "#0c0e11",
  card: "#131518",
  line: "#1f2124",
  lineStrong: "#3a3c40",
  ink: "#ece9e2",
  inkSoft: "#c9c5bc",
  muted: "#94918a",
  attention: "#f5a524",
} as const;

/** SESSION_COLORS in lib/diagram/projects/liveActivity.ts. */
export const AGENT = {
  otter: { name: "Otter", color: "#f97316" },
  gecko: { name: "Gecko", color: "#10b981" },
  fox: { name: "Fox", color: "#ec4899" },
} as const;

export const W = 1920;
export const H = 1080;
