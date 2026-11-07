/**
 * The system design glossary (`/system-design`, `/system-design/<slug>`): one entry per
 * building block that appears in the templates and tutorials. `match` finds the
 * components that are this thing (tested against each component's label and subtitle,
 * lower-cased), which is how a term page lists every template and tutorial using it and
 * how template pages link their components here (`lib/site/glossary.ts`).
 */

export interface GlossaryTerm {
  slug: string;
  name: string;
  /** One sentence, also the meta description (≤ 160 characters). */
  summary: string;
  /** What it is, two short paragraphs. */
  intro: string[];
  howItWorks: string[];
  whenToUse: string[];
  tradeoffs: string[];
  /** Common implementations, e.g. "NGINX", "Redis". */
  examples: string[];
  faq: Array<{ question: string; answer: string }>;
  match: RegExp;
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: 'load-balancer',
    name: 'Load Balancer',
    summary: 'A load balancer spreads incoming requests across several servers so no single server is overloaded and the service stays up when one fails.',
    intro: [
      'A load balancer sits in front of a group of servers and decides which one handles each request. Clients talk to one address; the load balancer hides how many servers are behind it.',
      'It is what lets a service scale horizontally: add servers behind the load balancer and traffic spreads across them. It also stops sending traffic to servers that fail health checks.',
    ],
    howItWorks: [
      'Clients connect to the load balancer\'s address (often through DNS).',
      'It picks a healthy backend using a policy such as round robin, least connections or a hash of the client or URL.',
      'Layer 4 balancers forward TCP or UDP connections; layer 7 balancers read HTTP and can route by path, header or cookie.',
      'Health checks remove failing servers from rotation and add them back when they recover.',
    ],
    whenToUse: [
      'Any service running on more than one server.',
      'To deploy without downtime, by draining servers one at a time.',
      'To terminate TLS in one place instead of on every server.',
    ],
    tradeoffs: [
      'It is another hop and a potential single point of failure, so load balancers are themselves run in pairs or as a managed service.',
      'Sticky sessions (sending a user to the same server) make stateful apps work but spread load less evenly; stateless servers avoid the need.',
    ],
    examples: ['NGINX', 'HAProxy', 'Envoy', 'AWS Elastic Load Balancing', 'Google Cloud Load Balancing'],
    faq: [
      { question: 'What is the difference between a load balancer and an API gateway?', answer: 'A load balancer spreads traffic across copies of a service. An API gateway routes requests to different services and adds authentication, rate limiting and request shaping. Many systems use both.' },
      { question: 'What is the difference between layer 4 and layer 7 load balancing?', answer: 'Layer 4 balancing works on TCP or UDP connections without reading their contents. Layer 7 balancing understands HTTP, so it can route by URL, header or cookie and terminate TLS.' },
    ],
    match: /load balancer|\bnginx\b|haproxy/,
  },
  {
    slug: 'api-gateway',
    name: 'API Gateway',
    summary: 'An API gateway is the single entry point for client requests: it authenticates them, applies rate limits and routes each one to the right backend service.',
    intro: [
      'An API gateway sits between clients and backend services. Instead of calling each service directly, clients call the gateway, which forwards the request to the service that handles it.',
      'Because every request passes through it, the gateway is where cross-cutting concerns live: authentication, rate limiting, request logging, and translating between public APIs and internal ones.',
    ],
    howItWorks: [
      'The client sends a request to the gateway\'s public address.',
      'The gateway verifies the caller (API key, session or JWT) and checks rate limits.',
      'It matches the path or method to a route and forwards the request to that service, often through a load balancer.',
      'It can combine responses from several services, transform formats and add headers before replying.',
    ],
    whenToUse: [
      'Systems with several backend services behind one public API.',
      'Public APIs that need authentication, quotas and usage tracking in one place.',
      'Mobile and web clients that need different shapes of the same data (backend-for-frontend).',
    ],
    tradeoffs: [
      'A slow or failing gateway affects every request, so it must be fast, redundant and well monitored.',
      'Putting business logic in the gateway couples services to it; keep it to routing and cross-cutting concerns.',
    ],
    examples: ['Kong', 'Amazon API Gateway', 'Apigee', 'Envoy', 'Traefik'],
    faq: [
      { question: 'Do microservices need an API gateway?', answer: 'Usually. Without one, every client must know every service\'s address and each service must implement authentication and rate limiting itself.' },
      { question: 'Is an API gateway a reverse proxy?', answer: 'Yes, it is a specialised reverse proxy: it forwards requests to backends like any reverse proxy, and adds API features such as authentication, rate limiting and request transformation.' },
    ],
    match: /api gateway|\bgateway \(kong|\bkong\b/,
  },
  {
    slug: 'cdn',
    name: 'CDN (Content Delivery Network)',
    summary: 'A CDN caches static files and media on servers around the world, so users download them from a nearby location instead of from your origin servers.',
    intro: [
      'A content delivery network is a network of edge servers in many cities. It stores copies of files such as images, video, scripts and stylesheets close to users.',
      'When a user requests a file, the nearest edge server answers from its cache, which is faster for the user and keeps most traffic away from your own servers.',
    ],
    howItWorks: [
      'DNS or anycast routing sends the user to a nearby edge server.',
      'If the edge has the file cached, it returns it immediately.',
      'On a miss, it fetches the file from the origin (for example object storage), caches it for its time-to-live and returns it.',
      'Popular content can also be pushed to the edge ahead of time.',
    ],
    whenToUse: [
      'Images, video, audio, downloads and front-end assets.',
      'Any audience spread across regions.',
      'Absorbing traffic spikes and some denial-of-service attacks at the edge.',
    ],
    tradeoffs: [
      'Cached content can be stale until it expires or is purged, so versioned file names are the usual way to update assets.',
      'Personalised or private responses need care to avoid being cached for the wrong user.',
    ],
    examples: ['Cloudflare', 'Amazon CloudFront', 'Fastly', 'Akamai', 'Netflix Open Connect'],
    faq: [
      { question: 'How does a CDN make a website faster?', answer: 'It serves files from a server close to the user, cutting network round-trip time, and it keeps that traffic off your origin servers so they respond faster to the requests that do reach them.' },
      { question: 'What is a CDN origin?', answer: 'The server or storage bucket that holds the original copy of the content. The CDN fetches from the origin when its cache does not have a file.' },
    ],
    match: /\bcdn\b|cloudfront|open connect|fastly/,
  },
  {
    slug: 'cache',
    name: 'Cache',
    summary: 'A cache keeps frequently read data in fast memory, such as Redis, so requests skip the slower database and respond in milliseconds.',
    intro: [
      'A cache stores copies of data that is expensive to compute or slow to fetch, usually in memory, so the next request can be answered quickly.',
      'In most systems, a small share of the data receives most of the reads. Caching that share takes most of the load off the database.',
    ],
    howItWorks: [
      'Cache-aside: the application checks the cache first; on a miss it reads the database and writes the result to the cache.',
      'Write-through: writes go to the cache and the database together, so the cache is always current.',
      'Each entry has a time-to-live, and an eviction policy such as least-recently-used frees memory when the cache is full.',
    ],
    whenToUse: [
      'Read-heavy data that changes rarely: profiles, product pages, sessions, timelines.',
      'Results of expensive queries or computations.',
      'Shared counters and short-lived state such as rate limits and presence.',
    ],
    tradeoffs: [
      'Cached data can be stale; deciding when to invalidate it is the hard part.',
      'A cold or failed cache sends all traffic to the database at once (a thundering herd), so warm-up and request coalescing matter.',
    ],
    examples: ['Redis', 'Memcached', 'Amazon ElastiCache', 'Varnish'],
    faq: [
      { question: 'What is cache-aside?', answer: 'A caching pattern where the application reads from the cache first and, on a miss, loads the data from the database and stores it in the cache for next time.' },
      { question: 'Redis vs Memcached?', answer: 'Both are fast in-memory caches. Redis adds data structures (lists, sets, sorted sets, geo indexes), persistence and replication; Memcached is simpler and purely a key-value cache.' },
    ],
    match: /cache|redis|memcached/,
  },
  {
    slug: 'message-queue',
    name: 'Message Queue',
    summary: 'A message queue lets one service hand work to another asynchronously: producers add messages, consumers process them later, at their own pace.',
    intro: [
      'A message queue is a buffer between services. A producer puts a message on the queue and carries on; a consumer takes messages off and processes them.',
      'It decouples the two sides in time: the producer does not wait for the work to finish, and the consumer can be slower, scaled separately or briefly down without losing work.',
    ],
    howItWorks: [
      'The producer sends a message describing a job or event.',
      'The queue stores it durably until a consumer takes it.',
      'The consumer processes it and acknowledges it; unacknowledged messages are redelivered.',
      'Messages that keep failing go to a dead-letter queue for inspection.',
    ],
    whenToUse: [
      'Work that does not need to finish before the user gets a response: emails, image processing, reports.',
      'Smoothing out bursts so a downstream service is not overwhelmed.',
      'Retrying unreliable work such as calls to third-party APIs.',
    ],
    tradeoffs: [
      'Most queues deliver at least once, so consumers must be idempotent.',
      'Asynchronous work is harder to trace and debug than a direct call.',
    ],
    examples: ['Amazon SQS', 'RabbitMQ', 'Google Cloud Tasks', 'Kafka (as a log)', 'Sidekiq / Celery (job queues)'],
    faq: [
      { question: 'What is the difference between a message queue and Kafka?', answer: 'A classic queue hands each message to one consumer and removes it once processed. Kafka is a log: messages are kept for a retention period and many consumer groups can read the same stream independently.' },
      { question: 'Why use a message queue?', answer: 'To decouple services, absorb traffic spikes and move slow work out of the request path, with retries when processing fails.' },
    ],
    match: /\bqueue\b|\bsqs\b|rabbitmq/,
  },
  {
    slug: 'event-streaming',
    name: 'Event Streaming (Kafka)',
    summary: 'Event streaming records every change as an event in a durable log, such as Kafka, that many services can read independently and replay.',
    intro: [
      'In event streaming, services publish events (order created, track played) to a log, and any number of consumers read that log in order, each at its own position.',
      'Unlike a queue, events are not removed when read. They are kept for a retention period, so new consumers can start from the beginning and existing ones can replay history.',
    ],
    howItWorks: [
      'Producers append events to a topic, which is split into partitions for throughput.',
      'Events with the same key (for example, an order id) go to the same partition and stay in order.',
      'Each consumer group tracks its own offset in each partition.',
      'Events stay in the log for the retention period, or indefinitely with compaction.',
    ],
    whenToUse: [
      'Several services reacting to the same changes (search indexing, analytics, notifications).',
      'Feeding data pipelines and warehouses.',
      'Event-driven and CQRS designs where read models are built from events.',
    ],
    tradeoffs: [
      'Operating a streaming cluster is significant work; managed services reduce it.',
      'Order is only guaranteed within a partition, so keys must be chosen carefully.',
    ],
    examples: ['Apache Kafka', 'Amazon Kinesis', 'Google Pub/Sub', 'Redpanda', 'Apache Pulsar'],
    faq: [
      { question: 'What is Kafka used for in system design?', answer: 'As a durable, high-throughput event log between services: producers publish events, and many consumers (search, analytics, notifications) read them independently and can replay history.' },
      { question: 'What is a Kafka partition?', answer: 'A slice of a topic. Partitions spread a topic across brokers for throughput, and events within one partition are strictly ordered.' },
    ],
    match: /kafka|event bus|event stream|pub\/sub|pub-sub|\bevents\b|kinesis|eventbridge/,
  },
  {
    slug: 'websocket',
    name: 'WebSockets',
    summary: 'WebSockets keep a connection open between client and server so either side can send messages instantly, which real-time chat, presence and live updates rely on.',
    intro: [
      'A WebSocket is a long-lived, two-way connection over a single TCP connection. After an HTTP handshake upgrades it, client and server can both send messages at any time.',
      'That is what makes real-time features possible without polling: chat messages, typing indicators, live cursors, driver locations and notifications are pushed the moment they happen.',
    ],
    howItWorks: [
      'The client opens an HTTP connection and asks to upgrade it to a WebSocket.',
      'Once accepted, both sides exchange small frames over the open connection.',
      'Heartbeats keep the connection alive through proxies and detect dropped clients.',
      'A gateway tier holds the connections and a registry records which server holds which user.',
    ],
    whenToUse: [
      'Chat, collaboration, multiplayer and live dashboards.',
      'Streaming frequent small updates from clients, such as locations.',
      'Pushing notifications to users who have the app open.',
    ],
    tradeoffs: [
      'Each connection uses server memory even when idle, so gateway servers are sized for connection count.',
      'Load balancing long-lived connections is harder than short requests; reconnect logic must handle deploys and drops.',
    ],
    examples: ['Native WebSocket API', 'Socket.IO', 'AWS API Gateway WebSockets', 'Phoenix Channels', 'Server-sent events (one-way alternative)'],
    faq: [
      { question: 'WebSockets vs polling: which is better?', answer: 'For frequent real-time updates, WebSockets: the server pushes changes instantly over one open connection. Polling repeatedly asks for changes, which adds delay and wasted requests.' },
      { question: 'WebSockets vs server-sent events?', answer: 'Server-sent events stream from server to client only over plain HTTP, which is simpler and enough for feeds and token streaming. WebSockets are two-way, which chat and collaboration need.' },
    ],
    match: /websocket|chat server|ws gw/,
  },
  {
    slug: 'object-storage',
    name: 'Object Storage',
    summary: 'Object storage, such as Amazon S3, stores files as objects in buckets with near-unlimited capacity, and is where most systems keep images, video and backups.',
    intro: [
      'Object storage keeps data as whole objects (a file plus metadata) addressed by a key, rather than as blocks on a disk or rows in a database.',
      'It scales to enormous amounts of data at low cost and high durability, which makes it the default home for user uploads, media, logs, backups and data lake files.',
    ],
    howItWorks: [
      'Applications upload and download objects over an HTTP API, by bucket and key.',
      'The service replicates each object across machines or zones for durability.',
      'Pre-signed URLs let clients upload or download directly without passing through your servers.',
      'A CDN usually sits in front for serving popular objects to users.',
    ],
    whenToUse: [
      'Images, video, audio and documents uploaded by users.',
      'Static website assets, backups, exports and logs.',
      'Large datasets read by analytics or machine learning jobs.',
    ],
    tradeoffs: [
      'Objects are replaced whole, not edited in place, and listing or querying them is slow compared with a database.',
      'Latency is higher than local disk, so hot content is cached or served through a CDN.',
    ],
    examples: ['Amazon S3', 'Google Cloud Storage', 'Azure Blob Storage', 'Cloudflare R2', 'MinIO'],
    faq: [
      { question: 'What is the difference between object storage and a database?', answer: 'A database stores structured records you can query and update in place. Object storage stores whole files by key, cheaply and at huge scale, but cannot query their contents.' },
      { question: 'Why store images in S3 instead of the database?', answer: 'Files are large and rarely change. Object storage holds them far more cheaply, serves them efficiently through a CDN, and keeps the database small and fast.' },
    ],
    match: /object storage|\bs3\b|blob storage|azure blob/,
  },
  {
    slug: 'sql-database',
    name: 'SQL Database',
    summary: 'A SQL (relational) database stores data in tables with a fixed schema and supports joins and transactions, the default choice for accounts, orders and money.',
    intro: [
      'A relational database organises data into tables of rows and columns, with relationships between tables, and is queried with SQL.',
      'Its strengths are transactions (all-or-nothing changes), constraints that keep data valid, and flexible queries with joins. That is why accounts, payments, orders and permissions usually live in one.',
    ],
    howItWorks: [
      'Data is defined by a schema: tables, columns, types, keys and constraints.',
      'Transactions group changes so they all commit or none do (ACID).',
      'Indexes speed up lookups; the query planner chooses how to run each query.',
      'Read replicas copy data for read scaling; a single primary usually takes writes.',
    ],
    whenToUse: [
      'Data with relationships and rules: users, orders, inventory, billing.',
      'Anything that needs transactions and strong consistency.',
      'Ad hoc queries and reporting on operational data.',
    ],
    tradeoffs: [
      'Scaling writes beyond one primary needs sharding, which is complex.',
      'Schema changes on very large tables need care to avoid downtime.',
    ],
    examples: ['PostgreSQL', 'MySQL', 'Amazon Aurora', 'SQL Server', 'CockroachDB / Spanner (distributed SQL)'],
    faq: [
      { question: 'When should I use SQL instead of NoSQL?', answer: 'When the data has relationships and rules, you need transactions, or you want flexible queries. Choose NoSQL when access patterns are simple key lookups at very high scale.' },
      { question: 'How do you scale a SQL database?', answer: 'First with indexes, caching and read replicas; then by partitioning large tables; and finally by sharding data across several primaries or moving to a distributed SQL database.' },
    ],
    match: /(?<!no)sql\b|postgres|mysql|\brdbms\b/,
  },
  {
    slug: 'nosql-database',
    name: 'NoSQL Database',
    summary: 'A NoSQL database such as Cassandra or DynamoDB trades joins and fixed schemas for horizontal scale and fast key-based access at very high volume.',
    intro: [
      'NoSQL covers databases that do not use the relational table model: key-value, document, wide-column and graph stores.',
      'Most are designed to spread data across many machines from the start, so they handle huge write volumes and datasets, provided you design the data around how it will be read.',
    ],
    howItWorks: [
      'Data is partitioned across nodes by a key, usually with consistent hashing.',
      'Each partition is replicated to several nodes for availability.',
      'Reads and writes go to the nodes that own the key, so lookups by key stay fast at any size.',
      'Many offer tunable consistency: wait for one replica (fast) or a quorum (safer).',
    ],
    whenToUse: [
      'Very high write volumes: messages, events, timelines, sensor data.',
      'Simple access patterns, by key or key plus time range.',
      'Flexible or evolving document shapes.',
    ],
    tradeoffs: [
      'No joins and limited transactions; data is often duplicated to serve each query.',
      'You must know your access patterns up front, since keys decide what is fast.',
    ],
    examples: ['Apache Cassandra', 'Amazon DynamoDB', 'MongoDB', 'ScyllaDB', 'Google Bigtable'],
    faq: [
      { question: 'What are the types of NoSQL databases?', answer: 'Key-value (Redis, DynamoDB), document (MongoDB), wide-column (Cassandra, Bigtable) and graph (Neo4j) databases.' },
      { question: 'Why do chat apps use Cassandra?', answer: 'Messages are written constantly and read by conversation and time. Cassandra spreads writes across many nodes and reads a conversation\'s recent messages from one partition.' },
    ],
    match: /nosql|cassandra|dynamodb|mongodb|message store/,
  },
  {
    slug: 'search-index',
    name: 'Search Index',
    summary: 'A search index, such as Elasticsearch, stores an inverted index of your data so full-text search, filters and ranking return results in milliseconds.',
    intro: [
      'A search index is a data structure, and usually a separate system, built for finding documents by the words they contain, with filters and relevance ranking.',
      'Databases are poor at full-text search over large data. Systems therefore copy searchable data into a search engine and query that instead.',
    ],
    howItWorks: [
      'Documents are analysed into terms (lower-cased, stemmed, tokenised).',
      'An inverted index maps each term to the documents that contain it.',
      'Queries combine term matches, filters and scoring such as BM25 to rank results.',
      'The index is updated from the primary database, often through change data capture or an event stream.',
    ],
    whenToUse: [
      'Product, content, people or code search.',
      'Autocomplete and typo-tolerant search.',
      'Log and event search for operations.',
    ],
    tradeoffs: [
      'The index is a second copy of the data and is eventually consistent with the database.',
      'Clusters need tuning for index size, shard counts and relevance.',
    ],
    examples: ['Elasticsearch', 'OpenSearch', 'Apache Solr', 'Algolia', 'Meilisearch'],
    faq: [
      { question: 'What is an inverted index?', answer: 'A map from each word to the list of documents that contain it, which is what lets a search engine find matching documents without scanning them all.' },
      { question: 'How is a search index kept in sync with the database?', answer: 'Usually by streaming changes (change data capture or application events) into an indexer that updates the search engine shortly after each write.' },
    ],
    match: /elasticsearch|search index|search engine|opensearch/,
  },
  {
    slug: 'vector-database',
    name: 'Vector Database',
    summary: 'A vector database stores embeddings and quickly finds the most similar ones, which is how AI apps retrieve context for retrieval-augmented generation (RAG).',
    intro: [
      'A vector database stores embeddings: lists of numbers produced by a model so that similar meanings end up close together.',
      'Given a query embedding, it returns the nearest stored vectors. That similarity search powers semantic search, recommendations and the retrieval step of RAG pipelines for LLM apps.',
    ],
    howItWorks: [
      'Documents are split into chunks and turned into embeddings by an embedding model.',
      'The vectors are stored with their text and metadata.',
      'Approximate nearest-neighbour indexes (such as HNSW) find the closest vectors to a query quickly.',
      'Results can be filtered by metadata and passed to an LLM as context.',
    ],
    whenToUse: [
      'Retrieval-augmented generation for chat assistants over your documents.',
      'Semantic search, where meaning matters more than exact words.',
      'Recommendations and deduplication by similarity.',
    ],
    tradeoffs: [
      'Results are approximate; recall and speed are traded through index settings.',
      'Embeddings must be regenerated when the model changes.',
    ],
    examples: ['pgvector', 'Pinecone', 'Weaviate', 'Qdrant', 'Milvus'],
    faq: [
      { question: 'What is a vector database used for?', answer: 'Finding items similar in meaning by comparing embeddings, most often to retrieve relevant document chunks for an LLM (RAG), or for semantic search and recommendations.' },
      { question: 'Do I need a dedicated vector database?', answer: 'Not always. An extension such as pgvector in PostgreSQL handles many applications; dedicated systems help at very large scale or with demanding latency.' },
    ],
    match: /vector/,
  },
  {
    slug: 'dns',
    name: 'DNS',
    summary: 'DNS translates domain names into IP addresses, and is also used to route users to the nearest region or healthy server.',
    intro: [
      'The Domain Name System is the internet\'s directory: it turns a name like example.com into the address of a server.',
      'In system design it does more than lookups. Geo-aware and latency-based DNS send users to the nearest region, and health-checked records move traffic away from a failed one.',
    ],
    howItWorks: [
      'The browser asks a resolver for the domain\'s address.',
      'The resolver walks from the root to the domain\'s authoritative name servers.',
      'The answer is cached for its time-to-live (TTL) at every level.',
      'Managed DNS can answer differently by location, latency or health.',
    ],
    whenToUse: [
      'Every public service, as the first step of every request.',
      'Routing users between regions or to a CDN.',
      'Failing over to a standby region.',
    ],
    tradeoffs: [
      'Caching means changes take up to the TTL to reach everyone; low TTLs speed failover but add lookups.',
      'DNS outages make a service unreachable even when servers are fine, so providers are often doubled.',
    ],
    examples: ['Amazon Route 53', 'Cloudflare DNS', 'Google Cloud DNS', 'NS1'],
    faq: [
      { question: 'What happens during a DNS lookup?', answer: 'The browser asks a resolver, which queries the root, then the top-level domain servers, then the domain\'s authoritative servers for the address, caching each answer for its TTL.' },
      { question: 'How is DNS used for load balancing?', answer: 'By returning different addresses to different users, based on location, latency, weights or health checks, so traffic spreads across regions or servers.' },
    ],
    match: /\bdns\b|route 53/,
  },
  {
    slug: 'rate-limiting',
    name: 'Rate Limiting',
    summary: 'Rate limiting caps how many requests a client can make in a period, protecting services from overload and abuse and enforcing API plan limits.',
    intro: [
      'A rate limiter counts requests per client (API key, user or IP) and rejects those over the limit, usually with HTTP 429 Too Many Requests.',
      'It protects the system from traffic spikes, scrapers and runaway clients, and is how APIs enforce plan quotas fairly.',
    ],
    howItWorks: [
      'Each request is identified by a key such as the API key or IP address.',
      'An algorithm (token bucket, leaky bucket, fixed or sliding window) decides whether the key has capacity.',
      'Counters live in a shared store such as Redis so every server sees the same count.',
      'Rejected requests get 429 with a Retry-After header.',
    ],
    whenToUse: [
      'Public APIs and login endpoints.',
      'Expensive operations such as AI generation or exports.',
      'Protecting downstream services that cannot absorb bursts.',
    ],
    tradeoffs: [
      'A central counter store adds a network call per request; local counting is faster but less exact.',
      'If the counter store fails, the limiter must fail open or closed, trading availability against protection.',
    ],
    examples: ['Redis with token bucket scripts', 'NGINX limit_req', 'Envoy rate limit service', 'API gateway quotas'],
    faq: [
      { question: 'What is the token bucket algorithm?', answer: 'Each client has a bucket of tokens that refills at a fixed rate up to a maximum. Each request takes a token, and a request with no token left is rejected, which allows short bursts while enforcing an average rate.' },
      { question: 'Where should rate limiting happen?', answer: 'As early as possible, usually at the API gateway or edge, so rejected requests never reach the application servers.' },
    ],
    match: /rate limit/,
  },
  {
    slug: 'background-jobs',
    name: 'Background Jobs and Workers',
    summary: 'Background workers process slow or deferred tasks, such as emails, resizing and transcoding, outside the request so users never wait for them.',
    intro: [
      'A worker is a process that takes jobs from a queue and runs them in the background. The web request only records the job and returns immediately.',
      'Anything slow, retryable or not needed for the response belongs here: sending email, processing uploads, generating reports, calling flaky third-party APIs.',
    ],
    howItWorks: [
      'The application enqueues a job with its parameters.',
      'Workers poll the queue, run the job and mark it done.',
      'Failed jobs are retried with backoff, and give up into a dead-letter queue after repeated failures.',
      'The number of workers scales with the length of the queue.',
    ],
    whenToUse: [
      'Media processing: resizing images, transcoding video and audio.',
      'Notifications, emails and webhooks.',
      'Scheduled work such as clean-ups, reports and syncs.',
    ],
    tradeoffs: [
      'Results are not immediate, so the UI must show progress or notify when done.',
      'Jobs can run twice after a retry, so they must be idempotent.',
    ],
    examples: ['Sidekiq', 'Celery', 'BullMQ', 'AWS Lambda with SQS', 'Temporal'],
    faq: [
      { question: 'What is a background job?', answer: 'A task the application runs outside the request that triggered it, usually by putting it on a queue for worker processes, so the user does not wait for it.' },
      { question: 'What tasks should run in the background?', answer: 'Anything slow or not needed for the immediate response: emails, notifications, media processing, exports, reports and calls to external services.' },
    ],
    match: /worker|background job|transcoder|cleanup job|snapshot worker/,
  },
  {
    slug: 'webhooks',
    name: 'Webhooks',
    summary: 'A webhook is an HTTP request a service sends to your URL when an event happens, so integrations react immediately instead of polling for changes.',
    intro: [
      'A webhook lets one system notify another: you register a URL, and when an event happens (a payment succeeded, code was pushed) the provider sends an HTTP POST describing it.',
      'It is how platforms such as GitHub, Stripe and Slack connect to everything else without each integration polling their APIs.',
    ],
    howItWorks: [
      'The receiver registers an endpoint URL and the events it wants.',
      'When an event happens, the provider queues a delivery and POSTs a JSON payload to the URL.',
      'The payload is signed so the receiver can verify it came from the provider.',
      'Failed deliveries are retried with backoff.',
    ],
    whenToUse: [
      'Notifying third-party integrations of events.',
      'Receiving events from payment, Git or messaging platforms.',
      'Triggering CI, deployments or automations.',
    ],
    tradeoffs: [
      'Receivers must handle retries and duplicates (idempotency) and verify signatures.',
      'A slow or down receiver must not block the sender, so delivery runs from a queue.',
    ],
    examples: ['GitHub webhooks', 'Stripe webhooks', 'Slack Events API', 'Svix (webhook delivery)'],
    faq: [
      { question: 'What is the difference between a webhook and an API?', answer: 'With an API, you call the service to ask for data. With a webhook, the service calls you when something happens.' },
      { question: 'How do you secure a webhook?', answer: 'Verify the signature the provider sends with each payload using a shared secret, use HTTPS, and reject old timestamps to stop replays.' },
    ],
    match: /webhook/,
  },
  {
    slug: 'crdt',
    name: 'CRDT (Conflict-free Replicated Data Type)',
    summary: 'A CRDT is a data structure that lets many users edit the same data at once, even offline, and always merges their changes to the same result.',
    intro: [
      'Conflict-free replicated data types are data structures designed so that copies edited independently can always be merged automatically, in any order, into the same state.',
      'They power real-time collaboration: shared documents, design files, whiteboards and offline-first apps, where every device applies edits locally and syncs later.',
    ],
    howItWorks: [
      'Each change is recorded as an operation with enough information (such as unique ids and positions) to apply it anywhere.',
      'Clients apply their own changes immediately and send them to others.',
      'Merging is commutative and idempotent: the same set of operations gives the same result regardless of order or duplicates.',
      'A server can relay and store operations, and snapshots keep the history manageable.',
    ],
    whenToUse: [
      'Real-time collaborative editing of text, designs or structured data.',
      'Offline-first apps that sync when they reconnect.',
      'Replicating state across regions without central locking.',
    ],
    tradeoffs: [
      'Metadata for every operation grows the document; compaction is needed.',
      'Automatic merges are consistent but not always what users intended, so some apps add rules on top.',
    ],
    examples: ['Yjs', 'Automerge', 'Figma multiplayer (CRDT-inspired)', 'Redis CRDT (Active-Active)'],
    faq: [
      { question: 'CRDT vs operational transformation?', answer: 'Operational transformation rewrites concurrent operations against each other and usually needs a central server to order them. CRDTs are designed so operations merge in any order, which suits peer-to-peer and offline editing.' },
      { question: 'Does Google Docs use CRDTs?', answer: 'Google Docs is known to use operational transformation. Many newer collaborative tools use CRDTs or CRDT-inspired designs.' },
    ],
    match: /crdt|collab service/,
  },
  {
    slug: 'authentication-service',
    name: 'Authentication Service',
    summary: 'An authentication service verifies who a user is and issues tokens, such as JWTs or sessions, that other services trust on every request.',
    intro: [
      'An authentication service handles sign-up, sign-in and the credentials that prove identity on later requests, so individual services do not each implement login.',
      'It usually issues a token after sign-in. The API gateway or services verify that token on each request and read the user\'s identity and permissions from it.',
    ],
    howItWorks: [
      'The user signs in with a password, a social login (OAuth / OpenID Connect) or a passkey.',
      'The service creates a session or signs a token such as a JWT containing the user\'s id and claims.',
      'Each request carries the token; the gateway verifies its signature and expiry.',
      'Short-lived access tokens are renewed with refresh tokens, and revoked sessions are rejected.',
    ],
    whenToUse: [
      'Any system with user accounts and more than one service.',
      'Single sign-on across several apps.',
      'Third-party access to user data (OAuth).',
    ],
    tradeoffs: [
      'Stateless JWTs are fast to verify but hard to revoke before they expire; server sessions are easy to revoke but need a lookup.',
      'It is a security-critical component, so managed identity providers are common.',
    ],
    examples: ['Auth0', 'Amazon Cognito', 'Keycloak', 'Firebase Authentication', 'better-auth'],
    faq: [
      { question: 'What is a JWT?', answer: 'A JSON Web Token: a signed token containing claims such as the user id and expiry. Services verify the signature to trust the claims without calling the auth service on every request.' },
      { question: 'Authentication vs authorization?', answer: 'Authentication proves who the user is. Authorization decides what that user is allowed to do.' },
    ],
    match: /\bauth\b|auth service|jwt|oauth|identity provider/,
  },
  {
    slug: 'data-warehouse',
    name: 'Data Warehouse',
    summary: 'A data warehouse stores historical data from across the system in a form built for analytics, so reporting queries never slow down the production databases.',
    intro: [
      'A data warehouse is a database designed for analysis: large scans and aggregations over months or years of data, rather than many small reads and writes.',
      'Production systems stream or copy their data and events into it, and analysts, dashboards and machine learning jobs query the warehouse instead of the live databases.',
    ],
    howItWorks: [
      'Data arrives from databases (change data capture or batch exports) and event streams.',
      'It is stored in columnar format, which makes scanning a few columns over many rows fast.',
      'Pipelines clean and model the data into tables for reporting.',
      'BI tools and notebooks query it with SQL.',
    ],
    whenToUse: [
      'Business reporting and dashboards.',
      'Product analytics such as watch history, funnels and retention.',
      'Training data for recommendations and other models.',
    ],
    tradeoffs: [
      'Data is usually minutes to hours old, not real time.',
      'Costs grow with data scanned, so tables are partitioned and queries kept focused.',
    ],
    examples: ['Snowflake', 'Google BigQuery', 'Amazon Redshift', 'Databricks', 'ClickHouse'],
    faq: [
      { question: 'Data warehouse vs database: what is the difference?', answer: 'An operational database handles the application\'s many small reads and writes. A data warehouse stores historical data from many sources and is optimised for large analytical queries.' },
      { question: 'How does data get into a data warehouse?', answer: 'Through pipelines: batch exports or change data capture from databases, and event streams such as Kafka, loaded and transformed on a schedule or continuously.' },
    ],
    match: /warehouse/,
  },
  {
    slug: 'presence',
    name: 'Presence (Online Status)',
    summary: 'Presence tracks which users are online, typing or viewing something right now, and shares those changes in real time without touching the main database.',
    intro: [
      'Presence is the live state of users: online or offline, last seen, typing, which document or channel they are in, and where their cursor is.',
      'It changes constantly and matters only while it is fresh, so it is kept in memory and broadcast to the people who can see it, separately from durable data.',
    ],
    howItWorks: [
      'Connected clients send heartbeats over their WebSocket connection.',
      'A presence service keeps each user\'s status in an in-memory store with a short expiry.',
      'Changes are published to the users who can see them (contacts, channel members, document viewers).',
      'A missed heartbeat expires the status, marking the user offline.',
    ],
    whenToUse: [
      'Chat and messaging apps (online, typing, last seen).',
      'Collaborative editors and design tools (who is here, live cursors).',
      'Multiplayer and live-location features.',
    ],
    tradeoffs: [
      'Broadcasting every change to large audiences is expensive, so updates are batched and fanned out only to online viewers.',
      'Status is approximate by design: a user may appear online for a few seconds after disconnecting.',
    ],
    examples: ['Redis with key expiry', 'Phoenix Presence', 'Ably / Pusher presence channels', 'Liveblocks'],
    faq: [
      { question: 'How do chat apps show online status?', answer: 'Clients send heartbeats over their open connection; a presence service keeps each user\'s status in memory with a short expiry and pushes changes to their contacts.' },
      { question: 'Why is presence kept separate from the database?', answer: 'It changes many times a minute per user and only matters while fresh. An in-memory store handles that write rate and expires stale entries automatically.' },
    ],
    match: /presence/,
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.slug === slug);
}
