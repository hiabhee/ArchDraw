export interface DiagramCase {
  id: string;
  prompt: string;
  required: Record<string, string>;
  relationships: [string, string][];
  forbidden?: string[];
  mermaid: string;
  existingContext?: { nodes: { id: string; data: { label: string } }[]; edges: { id: string; source: string; target: string }[] };
}
export const diagramCorpus: DiagramCase[] = [
  { id: 'checkout-workflow', prompt: 'Draw a checkout workflow: Validate cart, check stock, Submit payment, and Confirm order. Show unavailable stock and declined payment outcomes.',
    required: { cart: 'cart', stock: 'stock|inventory', payment: 'payment', confirm: 'confirm|success', unavailable: 'unavailable|out.of.stock', declined: 'declin|reject|fail' },
    relationships: [['cart', 'stock'], ['stock', 'payment'], ['stock', 'unavailable'], ['payment', 'confirm'], ['payment', 'declined']], forbidden: ['load balancer', 'database'],
    mermaid: 'graph LR\n cart["Validate cart"] --> stock{"Check stock"}\n stock -->|available| payment["Submit payment"]\n stock -->|unavailable| unavailable["Out of stock"]\n payment -->|approved| confirm["Confirm order"]\n payment -->|declined| declined["Payment declined"]' },
  { id: 'kafka-concept', prompt: 'Explain Kafka architecture', required: { producer: 'producer', broker: 'broker|leader|partition', consumer: 'consumer' }, relationships: [['producer', 'broker']], forbidden: ['web browser', 'load balancer', 'postgres'],
    mermaid: 'graph LR\n producer["Producer"] -->|publishes records| broker["Kafka Broker"]\n consumer["Consumer"] -->|polls records| broker' },
  { id: 'login', prompt: 'Show a login architecture with a Browser, Auth Service, Redis session cache and PostgreSQL. Browser submits credentials to Auth Service, which checks Redis and queries PostgreSQL.',
    required: { browser: 'browser', auth: 'auth', cache: 'redis', db: 'postgres' }, relationships: [['browser', 'auth'], ['auth', 'cache'], ['auth', 'db']],
    mermaid: 'graph TD\n browser["Browser"] -->|submits credentials| auth["Auth Service"]\n auth -->|checks session| cache["Redis"]\n auth -->|queries users| db[("PostgreSQL")]' },
  { id: 'async-fanout', prompt: 'Architecture: Order Service publishes to Kafka, Kafka delivers events to Inventory Worker and Email Worker. Do not add a database.',
    required: { order: 'order', kafka: 'kafka', inventory: 'inventory', email: 'email' }, relationships: [['order', 'kafka'], ['kafka', 'inventory'], ['kafka', 'email']], forbidden: ['database', 'postgres'],
    mermaid: 'graph LR\n order["Order Service"] -.->|publishes event| kafka["Kafka"]\n kafka -.->|delivers event| inventory["Inventory Worker"]\n kafka -.->|delivers event| email["Email Worker"]' },
  { id: 'callback', prompt: 'Architecture with Browser and Notification Service. Browser subscribes to Notification Service. Notification Service pushes notifications back to Browser over WebSocket. Preserve both operations.',
    required: { browser: 'browser', notification: 'notification' }, relationships: [['browser', 'notification'], ['notification', 'browser']],
    mermaid: 'graph LR\n browser["Browser"] -->|subscribes| notification["Notification Service"]\n notification -->|pushes notifications| browser' },
];
const nodes = Array.from({ length: 14 }, (_, i) => ({ id: `s${i}`, data: { label: `Stage ${i}` } }));
const edges = nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: `s${i}`, target: n.id }));
diagramCorpus.push({ id: 'edit-tail', prompt: 'Keep this workflow unchanged and add Archive after Stage 13. Preserve every existing ID and step.',
  required: { ...Object.fromEntries(nodes.map(n => [n.id, `^${n.data.label}$`])), archive: 'archive' },
  relationships: [...edges.map(e => [e.source, e.target] as [string, string]), ['s13', 'archive']],
  existingContext: { nodes, edges },
  mermaid: `graph LR\n${nodes.map(n => `${n.id}["${n.data.label}"]`).join('\n')}\n${edges.map(e => `${e.source} --> ${e.target}`).join('\n')}\ns13 --> archive["Archive"]` });
