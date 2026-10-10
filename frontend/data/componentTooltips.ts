// Typed wrapper over data/componentTooltips.json — keeps the public API
// (COMPONENT_TOOLTIPS / RichTooltipData) stable while storing the 134-entry
// tooltip corpus as pure data.
import tooltips from './componentTooltips.json';

export interface RichTooltipData {
  role?: string;
  whyItMatters?: string;
  realWorldFact?: string;
  tradeoff?: string;
  interviewTip?: string;
  concepts?: string[];
}

export const COMPONENT_TOOLTIPS: Record<string, RichTooltipData> = tooltips;
