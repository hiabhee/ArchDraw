/** Shared by scoring and validation; uncertain intent must not trigger architecture-only rules. */
export type DiagramKind = 'architecture' | 'workflow';

export function inferDiagramKind(prompt: string): DiagramKind {
  if (/\b(flowchart|workflow|process|sequence|interaction diagram|data flow|data pipeline|steps|algorithm|loop)\b/i.test(prompt)) return 'workflow';
  return 'architecture';
}

export function isReturnInteraction(label: string): boolean {
  return /\b(return\w*|respons\w*|repl(?:y|ies)|ack\w*|callback|webhook|push|notif\w*|stream\w*|control|configur\w*|register\w*|health|cache\s+(?:hit|miss))\b/i.test(label);
}
