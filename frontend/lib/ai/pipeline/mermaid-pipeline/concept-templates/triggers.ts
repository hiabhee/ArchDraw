import type { ImplicitConcept } from './types';

const CONCEPT_MARKERS = /\b(describe|explain|overview|architecture|diagram|what is|how does)\b/i;
const DETAIL_MARKERS = /\b(for|where|when|using|use|uses|with my|for my|ecommerce|e-commerce|payment|chat|social|microservice|microservices|frontend|backend|database per|multi-tenant|swarm|kubernetes|k8s|compose|orchestrat|cluster|multi-host|deployment|ci\/cd|cicd|agent|loop|coding|compiler|interpreter|framework|library|module|design pattern|algorithm|state machine|middleware|handler|callback|event loop)\b/i;

export function detectImplicitConceptPrompt(prompt: string): ImplicitConcept | null {
  const lower = prompt.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  if (!CONCEPT_MARKERS.test(lower) || DETAIL_MARKERS.test(lower) || wordCount > 12) {
    return null;
  }

  const subject = extractConceptSubject(prompt);
  if (!subject) return null;

  return classifyImplicitConcept(subject);
}

function extractConceptSubject(prompt: string): string {
  let subject = prompt.trim().replace(/[?.!]+$/g, '');

  // Strip conversational request prefixes ("can you …", "i want …",
  // "could you please describe …", "how does … work"). Without this the
  // whole prompt becomes the subject and leaks into template node labels
  // (e.g. "Can You Describe Redis In Detail Endpoint").
  subject = subject.replace(
    /^(?:please\s+)?(?:can|could|would|will|do|did|should|shall)\s+(?:you|we|i)\s+(?:please\s+)?/i,
    '',
  );
  subject = subject.replace(
    /^(?:i\s+(?:'d|would)?\s*(?:like|want|need)\s+(?:a|an|to|the)?|i\s+(?:want|need))\s+/i,
    '',
  );
  subject = subject.replace(
    /^(?:give|show|tell|help|make|draw|build|create|describe|explain|generate|produce|walk|see|get)\s+(?:me|us)?\s+(?:the\s+)?/i,
    '',
  );
  subject = subject.replace(
    /^(?:what\s+is|what\s+are|what\s+does|how\s+does|how\s+do|how\s+would|how\s+can|how\s+to)\s+(?:the\s+)?/i,
    '',
  );
  subject = subject.replace(/^(?:please\s+)?(?:describe|explain|show|draw|create|generate)\s+(?:the\s+)?/i, '');

  // Trailing politeness / detail phrasings ("… in detail", "… for me").
  subject = subject.replace(/\s+(?:please|for me|for us|for our team)\s*$/i, '');
  subject = subject.replace(/\s+(?:in detail|in depth)\s*$/i, '');

  subject = subject.replace(/\b(work|works)\b$/i, '');
  subject = subject.replace(/\b(architecture|architectural|diagram|overview|component map|system design)\b/gi, '');
  subject = subject.replace(/\b(of|for|the|a|an)\b/gi, ' ');
  subject = subject.replace(/\s+/g, ' ').trim();
  return titleCaseConcept(subject);
}

function titleCaseConcept(subject: string): string {
  const upperWords = new Set(['api', 'cdn', 'dns', 'waf', 'iam', 'jwt', 'oauth', 'sso', 'tls', 'ssl', 'sql', 'db', 'os', 'vm', 'jvm', 'http', 'grpc']);
  return subject
    .split(/\s+/)
    .map((word) => upperWords.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function classifyImplicitConcept(subject: string): ImplicitConcept | null {
  const lower = subject.toLowerCase();

  if (/\bdocker\b/.test(lower)) return { subject: 'Docker', domain: 'container-runtime', template: 'docker' };
  if (/\b(api gateway|apigateway|gateway)\b/.test(lower)) return { subject: 'API Gateway', domain: 'api-edge', template: 'api-gateway' };
  if (/\b(kafka|apache kafka)\b/.test(lower)) return { subject: 'Kafka', domain: 'messaging', template: 'kafka' };
  if (/\b(linux|linux kernel|operating system)\b/.test(lower)) return { subject: 'Linux', domain: 'operating-system', template: 'linux' };

  if (/\b(kubernetes|k8s|ecs|nomad|orchestrat|scheduler)\b/.test(lower)) return { subject, domain: 'orchestration' };
  if (/\b(redis|memcached|cache)\b/.test(lower)) return { subject, domain: 'cache' };
  if (/\b(postgres|postgresql|mysql|mariadb|mongodb|dynamodb|cassandra|database|db|sql)\b/.test(lower)) return { subject, domain: 'database' };
  if (/\b(rabbitmq|sqs|sns|nats|pubsub|pub\/sub|queue|broker|streaming|event bus)\b/.test(lower)) return { subject, domain: 'messaging' };
  if (/\b(load balancer|nginx|haproxy|traefik|cdn|dns|waf|reverse proxy|proxy|ingress)\b/.test(lower)) return { subject, domain: 'api-edge' };
  if (/\b(prometheus|grafana|datadog|opentelemetry|otel|jaeger|logging|monitoring|observability|tracing)\b/.test(lower)) return { subject, domain: 'observability' };
  if (/\b(oauth|oidc|openid|iam|auth|sso|jwt|vault|secrets|security|waf)\b/.test(lower)) return { subject, domain: 'security' };
  if (/\b(elasticsearch|opensearch|solr|search)\b/.test(lower)) return { subject, domain: 'search' };
  if (/\b(s3|object storage|blob storage|file system|filesystem|storage)\b/.test(lower)) return { subject, domain: 'storage' };
  if (/\b(jvm|nodejs|node.js|python|runtime|react|nextjs|next.js)\b/.test(lower)) return { subject, domain: 'runtime' };

  return null;
}
