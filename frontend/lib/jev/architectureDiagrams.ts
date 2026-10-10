import { detectedComponents } from './architectureBaseline';

export type DiagramPattern = 'modular_monolith' | 'microservices' | 'event_driven' | 'hybrid';

const PATTERN_ALIASES: Record<string, DiagramPattern> = {
  modular_monolith: 'modular_monolith',
  microservices: 'microservices',
  event_driven: 'event_driven',
  hybrid: 'hybrid',
};

function clean(label: string) {
  return label.replace(/["\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildDiagramMermaid(architecture: string, rawPattern: string): string {
  const pattern = PATTERN_ALIASES[rawPattern] ?? 'modular_monolith';
  const d = detectedComponents(architecture);

  const storeIds: string[] = [];
  const storeLines: string[] = [];
  if (d.stores.length === 0) {
    storeLines.push('DB0[("Database")]');
    storeIds.push('DB0');
  } else {
    d.stores.forEach((label, index) => {
      const id = `DB${index}`;
      storeLines.push(`${id}[("${clean(label)}")]`);
      storeIds.push(id);
    });
  }
  const db = storeIds[0];

  const thirdParty = d.thirdParty.map((label, index) => ({ id: `TP${index}`, label }));
  const email = thirdParty.find((entry) => entry.label === 'Email provider') ?? null;
  const otherExternal = thirdParty.filter((entry) => entry.id !== email?.id);

  const queueId = 'Q';
  const queueLabel = d.queue ?? 'Queue / Broker';

  if (pattern === 'microservices') {
    const lines = [
      'graph LR',
      ...storeLines,
      '  subgraph CLIENTS["Clients"]',
      '    UI["Web UI / Client"]',
      '  end',
      '  UI --> GW["API Gateway"]',
      '  GW --> API["API Service"]',
      '  API --> ' + db,
    ];
    for (const id of storeIds.slice(1)) lines.push(`  API --> ${id}`);
    if (d.workers) {
      lines.push('  GW --> WJ["Worker Service"]');
      lines.push(`  WJ --> ${db}`);
      if (email) lines.push(`  WJ --> ${email.id}["${clean(email.label)}"]`);
    } else if (email) {
      lines.push(`  API --> ${email.id}["${clean(email.label)}"]`);
    }
    return lines.join('\n');
  }

  if (pattern === 'event_driven') {
    const lines = [
      'graph LR',
      ...storeLines,
      '  subgraph PRODUCERS["Producers"]',
      '    API["Ingestion / Producer API"]',
      '  end',
      `  API --> ${queueId}{{"${clean(queueLabel)}"}}`,
      `  ${queueId} --> WORK["Worker / Consumer"]`,
      `  WORK --> ${db}`,
    ];
    for (const id of storeIds.slice(1)) lines.push(`  WORK --> ${id}`);
    lines.push(`  ${queueId} -.-> DLQ{{"Dead-letter queue"}}`);
    for (const entry of [...(email ? [email] : []), ...otherExternal]) {
      lines.push(`  ${queueId} -.-> ${entry.id}["${clean(entry.label)}"]`);
    }
    return lines.join('\n');
  }

  if (pattern === 'hybrid') {
    const lines = [
      'graph LR',
      ...storeLines,
      '  UI["Web UI / Client"] --> API["API Service"]',
      '  subgraph SYNC["Synchronous path"]',
      `    API --> ${db}`,
    ];
    for (const id of storeIds.slice(1)) lines.push(`    API --> ${id}`);
    lines.push('  end');
    lines.push('  subgraph ASYNC["Asynchronous path"]');
    lines.push(`    API --> ${queueId}{{"${clean(queueLabel)}"}}`);
    lines.push(`    ${queueId} --> WORK["Worker / Consumer"]`);
    lines.push(`    WORK --> ${db}`);
    if (email) {
      lines.push(`    WORK --> ${email.id}["${clean(email.label)}"]`);
    }
    lines.push('  end');
    return lines.join('\n');
  }

  const lines = [
    'graph LR',
    ...storeLines,
    '  subgraph APP["Application — modular monolith"]',
    '    UI["Web UI / Client"]',
    '    API["API / modules"]',
  ];
  if (d.workers) lines.push('    JOBS["Background jobs"]');
  lines.push('  end');
  lines.push('  UI --> API');
  lines.push(`  API --> ${db}`);
  for (const id of storeIds.slice(1)) lines.push(`  API --> ${id}`);
  if (d.workers) {
    lines.push(`  JOBS --> ${db}`);
    if (email) lines.push(`  JOBS --> ${email.id}["${clean(email.label)}"]`);
  } else if (email) {
    lines.push(`  API --> ${email.id}["${clean(email.label)}"]`);
  }
  for (const entry of otherExternal) lines.push(`  API --> ${entry.id}["${clean(entry.label)}"]`);
  return lines.join('\n');
}