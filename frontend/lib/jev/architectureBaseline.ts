export type BaselineDecision = {
  type: 'choice' | 'noul' | 'score';
  confidence: number;
  rationale: string;
  choice?: string;
  noul?: number;
  score?: number;
};

export type BaselineAssessment = {
  answers: {
    primary_pattern: BaselineDecision;
    async_workload_fit: BaselineDecision;
    operational_complexity: BaselineDecision;
  };
  elapsedMs: number;
};

const MONOLITH_TERMS = [
  'monolith',
  'single application',
  'single deployable',
  'one application',
  'a single service',
  'single service',
  'one service',
  'single codebase',
  'one codebase',
  'small team',
  'no background workers',
  'no background',
  'few times per week',
];

const MICROSERVICE_TERMS = [
  'microservice',
  'micro-services',
  'micro services',
  'independently deployable',
  'separate services',
  'independent services',
  'each service',
  'per-service',
  'per service',
  'cross-service',
  'cross service',
  'separate deploys',
  'distributed',
  'service boundaries',
  'own database',
];

const EVENT_TERMS = [
  'queue',
  'kafka',
  'rabbitmq',
  'message broker',
  'event bus',
  'pub/sub',
  'pubsub',
  'dead-letter',
  'dead letter',
  'dlq',
  'event-driven',
  'event pipeline',
  'events per second',
  'stream',
  'consumer',
  'asynchronous events',
  'event stream',
  'replay',
];

const NEGATIONS: Array<{ phrase: string; excludes: string[] }> = [
  { phrase: 'no background workers', excludes: ['background worker', 'background workers', 'worker', 'workers', 'job', 'jobs'] },
  { phrase: 'no background jobs', excludes: ['background job', 'background jobs', 'job', 'jobs', 'worker', 'workers'] },
  { phrase: 'no background', excludes: ['background job', 'background jobs', 'background worker', 'background workers', 'worker', 'workers', 'job', 'jobs'] },
  { phrase: 'no queue', excludes: ['queue'] },
  { phrase: 'no cross-service', excludes: ['cross-service', 'cross service', 'service', 'services', 'micro-service'] },
  { phrase: 'no cross service', excludes: ['cross-service', 'cross service', 'service', 'services', 'micro-service'] },
  { phrase: 'or cross-service', excludes: ['cross-service', 'cross service', 'service', 'services', 'micro-service'] },
  { phrase: 'or cross service', excludes: ['cross-service', 'cross service', 'service', 'services', 'micro-service'] },
  { phrase: 'no async', excludes: ['asynchronous', 'asynchronously', 'queue', 'broker'] },
  { phrase: 'no workers', excludes: ['worker', 'workers'] },
  { phrase: 'no microservices', excludes: ['microservice', 'micro-services', 'micro services'] },
  { phrase: 'without a queue', excludes: ['queue'] },
];

const ASYNC_TERMS = [
  'background job',
  'background jobs',
  'background worker',
  'cron',
  'jobs',
  'queue',
  'broker',
  'dead-letter',
  'dead letter',
  'replay',
  'asynchronous',
  'asynchronously',
  'worker',
  'workers',
];

const WORKER_TERMS = [
  'background job',
  'background jobs',
  'background worker',
  'cron',
  'send email',
  'send emails',
  'send an email',
  'generate diagram',
  'generate diagrams',
  'job queue',
  'queued',
  'worker',
  'workers',
];

const QUEUE_TERMS = ['queue', 'kafka', 'rabbitmq', 'message broker', 'event bus', 'pub/sub', 'pubsub'];

const SPIKE_TERMS = ['spike', 'spikes', 'traffic', 'scale', 'scalability', 'growth', 'high volume', 'load burst', 'peak'];

const STORE_TERMS = [
  'postgres',
  'postgresql',
  'mysql',
  'mongo',
  'mongodb',
  'sqlite',
  'database',
  'redis',
  'cache',
  'data warehouse',
  'warehouse',
  's3',
  'blob storage',
  'object storage',
  'data store',
  'storage layer',
];

const COORDINATION_TERMS = [
  'multi-region',
  'multiple regions',
  'shard',
  'partition',
  'leader election',
  'consensus',
  'cluster',
  'failover',
  'failure recovery',
  'availability zones',
  'replica',
  'replicas',
  'autoscaling',
  'quorum',
];

const INGESTION_TERMS = [
  'events per second',
  'thousands of',
  'millions of',
  'per second',
  'high throughput',
  'high-throughput',
  'ingestion',
  'ingest',
];

const SERVICE_TERMS = ['service', 'services', 'application', 'api', 'worker', 'workers', 'consumer', 'gateway', 'database'];

function present(text: string, terms: string[]) {
  const matched = terms.filter((term) => text.includes(term));
  return matched.filter((term) => !matched.some((other) => other.length > term.length && other.includes(term)));
}

function applyNegations(text: string) {
  let excluded = new Set<string>();
  let negated = false;
  for (const { phrase, excludes } of NEGATIONS) {
    if (text.includes(phrase)) {
      negated = true;
      excluded = new Set([...excluded, ...excludes]);
    }
  }
  return { excluded, negated };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function primaryPattern(text: string, eventCount: number, microCount: number, monoCount: number, storeTerms: string[]) {
  let choice: BaselineDecision['choice'] = 'modular_monolith';
  let rationale: string;

  if (eventCount >= 2 && eventCount > microCount) {
    choice = 'event_driven';
    rationale = `Events dominate the description (${eventCount} async/event signals).`;
  } else if (microCount > monoCount && microCount >= 1) {
    choice = 'microservices';
    rationale = `Service-boundary language outweighs monolith hints (${microCount} vs ${monoCount}).`;
  } else if (eventCount >= 1 && (microCount >= 1 || storeTerms.length >= 2)) {
    choice = 'hybrid';
    rationale = `Synchronous services combined with ${eventCount} async signal(s) point to a deliberate hybrid.`;
  } else {
    rationale = 'No dominant distribution signals; a single deployable best fits this description.';
  }

  return { choice, rationale };
}

function noulFit(
  text: string,
  asyncTerms: string[],
  queueTerms: string[],
  workerTerms: string[],
  spikeTerms: string[],
  eventCount: number,
  monoCount: number,
  negated: boolean,
) {
  let p = 0.15;
  if (asyncTerms.length >= 1) p += 0.2;
  if (queueTerms.length >= 1) p += 0.2;
  if (eventCount >= 2) p += 0.2;
  if (workerTerms.length >= 1) p += 0.1;
  if (spikeTerms.length >= 1) p += 0.1;
  if (monoCount >= 1 && text.includes('small team')) p -= 0.15;
  if (negated) p = Math.min(p, 0.2);
  p = clamp(p, 0.05, 0.95);
  p = Math.round(p * 100) / 100;

  let rationale: string;
  if (queueTerms.length > 0) {
    rationale = `Detected ${queueTerms.slice(0, 3).join(', ')} — async already buffers work.`;
  } else if (negated) {
    rationale = 'Explicit negations (for example "no background workers") signal little async demand.';
  } else if (workerTerms.length > 0) {
    rationale = `Background workload (${workerTerms.slice(0, 2).join(', ')}) fits the described load.`;
  } else if (spikeTerms.length > 0) {
    rationale = `Load spikes (${spikeTerms.slice(0, 2).join(', ')}) would benefit from a queue.`;
  } else if (p <= 0.15) {
    rationale = 'Little async demand detected; a queue adds complexity without a clear benefit.';
  } else {
    rationale = 'Async work would materially improve reliability for this system.';
  }

  return { noul: p, rationale };
}

function complexity(
  microCount: number,
  storeTerms: string[],
  eventCount: number,
  asyncTerms: string[],
  workerTerms: string[],
  coordinationTerms: string[],
  ingestionTerms: string[],
  serviceTerms: string[],
) {
  const factors: string[] = [];
  let lift = 1;

  if (microCount >= 1) {
    lift++;
    factors.push('multiple deployable services');
  }
  if (storeTerms.length >= 2) {
    lift++;
    factors.push(`${storeTerms.length} data stores`);
  }
  if (eventCount >= 2 || asyncTerms.length >= 2 || workerTerms.length >= 1) {
    lift++;
    factors.push('async workers or event flows');
  }
  if (eventCount >= 2 && storeTerms.length >= 1) {
    lift++;
    factors.push('event-driven data pipeline');
  }
  if (coordinationTerms.length >= 1) {
    lift++;
    factors.push(`distributed coordination (${coordinationTerms.slice(0, 2).join(', ')})`);
  }
  if (ingestionTerms.length >= 1) {
    lift++;
    factors.push('high-throughput ingestion');
  }
  if (serviceTerms.length >= 3) {
    lift++;
    factors.push(`${serviceTerms.length} distinct components`);
  }

  const score = clamp(lift, 1, 5);

  const rationale =
    factors.length > 0
      ? `Operational load from: ${factors.join(', ')}.`
      : 'A single service with minimal operational dependencies.';

  return { score, rationale };
}

export function assessArchitectureBaseline(architecture: string): BaselineAssessment {
  const startedAt = performance.now();

  const text = ` ${architecture.toLowerCase().replace(/\s+/g, ' ')} `;
  const { excluded, negated } = applyNegations(text);

  const detect = (terms: string[]) => present(text, terms.filter((term) => !excluded.has(term)));

  const monolithTerms = detect(MONOLITH_TERMS);
  const microserviceTerms = detect(MICROSERVICE_TERMS);
  const eventTerms = detect(EVENT_TERMS);
  const asyncTerms = detect(ASYNC_TERMS);
  const workerTerms = detect(WORKER_TERMS);
  const queueTerms = detect(QUEUE_TERMS);
  const spikeTerms = detect(SPIKE_TERMS);
  const storeTerms = detect(STORE_TERMS);
  const coordinationTerms = detect(COORDINATION_TERMS);
  const ingestionTerms = detect(INGESTION_TERMS);
  const serviceTerms = detect(SERVICE_TERMS);

  const eventCount = eventTerms.length;
  const microCount = microserviceTerms.length;
  const monoCount = monolithTerms.length;

  const pattern = primaryPattern(text, eventCount, microCount, monoCount, storeTerms);
  const fit = noulFit(text, asyncTerms, queueTerms, workerTerms, spikeTerms, eventCount, monoCount, negated);
  const complexityResult = complexity(
    microCount,
    storeTerms,
    eventCount,
    asyncTerms,
    workerTerms,
    coordinationTerms,
    ingestionTerms,
    serviceTerms,
  );

  return {
    answers: {
      primary_pattern: {
        type: 'choice',
        choice: pattern.choice as string,
        confidence: clamp(0.7 + Math.min(0.05 * Math.max(eventCount, microCount, monoCount), 0.2), 0, 0.92),
        rationale: pattern.rationale,
      },
      async_workload_fit: {
        type: 'noul',
        noul: fit.noul,
        confidence: clamp(0.72 + Math.min(0.03 * asyncTerms.length, 0.15), 0, 0.9),
        rationale: fit.rationale,
      },
      operational_complexity: {
        type: 'score',
        score: complexityResult.score,
        confidence: clamp(0.7 + Math.min(0.05 * complexityResult.score, 0.2), 0, 0.9),
        rationale: complexityResult.rationale,
      },
    },
    elapsedMs: Math.max(0, performance.now() - startedAt),
  };
}

export type DetectedComponents = {
  webApp: boolean;
  api: boolean;
  stores: string[];
  queue: string | null;
  workers: boolean;
  email: boolean;
  thirdParty: string[];
};

const STORE_LABEL_RULES: Array<[RegExp, string]> = [
  [/postgres/i, 'PostgreSQL'],
  [/mysql/i, 'MySQL'],
  [/sqlite/i, 'SQLite'],
  [/redis/i, 'Redis'],
  [/mongo/i, 'MongoDB'],
  [/warehouse/i, 'Data Warehouse'],
  [/s3|object storage|blob storage/i, 'Object Storage'],
  [/cache/i, 'Cache'],
];

export function detectedComponents(architecture: string): DetectedComponents {
  const text = ` ${architecture.toLowerCase().replace(/\s+/g, ' ')} `;
  const { excluded } = applyNegations(text);
  const detect = (terms: string[]) => present(text, terms.filter((term) => !excluded.has(term)));

  const stores: string[] = [];
  for (const term of detect(STORE_TERMS)) {
    const rule = STORE_LABEL_RULES.find(([re]) => re.test(term));
    const label = rule ? rule[1] : 'Database';
    if (!stores.includes(label)) stores.push(label);
  }

  const webApp =
    detect(['application', 'react', 'next.js', 'web app', 'web ui', 'browser', 'frontend', 'interface']).length > 0;
  const api = detect(['api', 'rest', 'endpoint', 'graphql', 'gateway']).length > 0;
  const queueTerms = detect(QUEUE_TERMS);
  const queue = queueTerms.length
    ? /kafka/.test(text)
      ? 'Kafka'
      : /rabbit/.test(text)
        ? 'RabbitMQ'
        : /stream/.test(text)
          ? 'Event Stream'
          : 'Queue / Broker'
    : null;

  const workers = detect(['background job', 'background jobs', 'background worker', 'worker', 'workers', 'cron', 'consumer', 'jobs']).length > 0;
  const email = detect(['email provider', 'send email', 'sends email', 'send emails', 'send an email', 'smtp', 'mail provider']).length > 0;

  const thirdParty: string[] = [];
  if (email) thirdParty.push('Email provider');
  for (const [re, label] of [
    [/stripe/i, 'Stripe'],
    [/twilio/i, 'Twilio'],
    [/sendgrid/i, 'SendGrid'],
    [/openai/i, 'OpenAI'],
    [/paypal/i, 'PayPal'],
  ] as Array<[RegExp, string]>) {
    if (re.test(text)) thirdParty.push(label);
  }

  return { webApp, api, stores, queue, workers, email, thirdParty };
}