// Barrel re-export — implementation lives in concept-templates/ (split by
// concern: types, triggers, templateMermaid, trimming, index).
export type { ConceptTemplatePlan, ConceptDomain, ImplicitConcept } from './concept-templates/types';
export { detectImplicitConceptPrompt } from './concept-templates/triggers';
export { getConceptTemplatePlan } from './concept-templates';
export { trimMermaidByDetailLevel } from './concept-templates/trimming';
