import type { TutorialDefinition, ValidationRule } from './schema';
import logger from '@/lib/logger';

export function warnMissingNodeTypes(tutorials: TutorialDefinition[]): void {
  if (process.env.NODE_ENV !== 'development') return;
  import('@/lib/componentRegistry').then(({ CORE_COMPONENTS }) => {
    const ids = new Set((CORE_COMPONENTS as { id: string }[]).map(c => c.id));
    for (const t of tutorials)
      for (const lv of t.levels)
        for (const s of lv.steps)
          checkRules(s.validation, t.id, s.id, ids);
  });
}

function checkRules(rules: ValidationRule[], tid: string, sid: string, ids: Set<string>): void {
  for (const r of rules) {
    if (r.type === 'node_exists' && !ids.has(r.nodeType))
      logger.warn(`[Tutorial] "${tid}/${sid}": nodeType "${r.nodeType}" not in registry — always fails.`);
    if (r.type === 'all_of' || r.type === 'any_of')
      checkRules(r.rules, tid, sid, ids);
  }
}
