import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const urlShortenerTutorial = defineTutorial({
  id: 'url-shortener-architecture',
  title: 'How to Design URL Shortener Architecture',
  description: 'Build the classic system design interview question \u2014 a URL shortening service like Bitly. Learn hash generation, redirect logic, analytics, and the tradeoffs between consistent hashing and base-62 encoding.',
  difficulty: 'beginner',
  estimatedMinutes: 15,
  tags: ['caching', 'analytics', 'api'],
  icon: 'Link',
  color: '#8B3DFF',

  levels: [
    level({
      title: 'URL Shortener',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          noConnect: true,
          phases: {
            context: {
              heading: 'Welcome to URL Shortener Architecture',
              body: "Let's build a URL shortener from scratch \u2014 the classic system design interview question. Services like Bitly and TinyURL handle billions of redirects daily.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: 'The client is any web browser. Users paste a long URL and get back a short code.',
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "Every system starts with the client. For a URL shortener, the client is simple \u2014 it only needs to accept a URL input and display the shortened result.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Web', and add the client to the canvas.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'This is the first step, so no connections needed yet.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Web Client added. Now the API Gateway.',
            },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Level 1: Step 2',
              body: 'Adding the API Gateway \u2014 routes POST for shortening, GET for redirect.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: 'All requests hit the API Gateway. Two main flows: POST /shorten and GET /{code}.',
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "The API Gateway handles both flows: creating short URLs (POST) and redirecting browsers (GET). It also enforces rate limits.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'API Gateway', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Web Client \u2192 API Gateway.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'API Gateway added. Now the Load Balancer.',
            },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Load Balancer',
          nodeType: 'load_balancer',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Level 1: Step 3',
              body: 'Adding the Load Balancer \u2014 distributes millions of daily redirects.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "URL shorteners are read-heavy \u2014 95% of traffic is redirects, only 5% is URL creation.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "The Load Balancer enables horizontal scaling to handle redirect bursts. Consistent hashing keeps redirect lookups cache-friendly.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Load Balancer', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Load Balancer.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Load Balancer added. Now the Cache.',
            },
          },
          hints: ['Search for "Load Balancer"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'In-Memory Cache',
          nodeType: 'in_memory_cache',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Level 1: Step 4',
              body: 'Adding the Cache \u2014 serves redirect lookups from Redis.',
            },
            intro: {
              heading: 'Do you know about In-Memory Caches?',
              body: "Before hitting the database, the redirect handler checks Redis. 95% of traffic is redirects \u2014 caching makes redirects sub-millisecond.",
            },
            teaching: {
              heading: 'Deep dive: In-Memory Cache',
              body: "Redis stores the code \u2192 URL mapping. A redirect checks Redis first. Sub-millisecond lookup. Only 5% of requests (cache misses) hit the database.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'In-Memory Cache', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 In-Memory Cache.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Cache added. Now the URL Service.',
            },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
    level({
      title: 'Hashing & Storage',
      steps: [
        step({
          component: 'Microservice', nodeType: 'microservice', parent: 'In-Memory Cache',
          title: 'Add the URL Service',
          phases: {
            context: { heading: 'Level 2: The URL Service', body: 'The URL Service handles two operations: POST /shorten (generate a short code) and GET /{code} (resolve to original URL). The core challenge is generating collision-free short codes at scale.' },
            intro: { heading: 'Base-62 encoding', body: 'The most common approach: generate a random 6-character base-62 string (a-z, A-Z, 0-9) = 62^6 = 56 billion possible codes. No central counter needed.' },
            teaching: { heading: 'Collision strategy and counter-based vs random',
              body: 'Random codes risk collisions at scale. Counter-based (atomic integer → base-62) guarantees uniqueness but requires a distributed counter service (Redis INCR). Bitly uses a counter with Zookeeper coordination. At 1B URLs, random with retry has ~0.0002% collision rate — acceptable for most uses.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Microservice', and add the URL Service." },
            connecting: { heading: 'Connect it', body: 'Connect In-Memory Cache → URL Service.' },
            celebration: { heading: 'URL Service added.', body: 'Now the database.' },
          },
          hints: ['Search for "Microservice"', 'Connect Cache to it'],
        }),
        step({
          component: 'SQL Database', nodeType: 'sql_db', parent: 'Microservice',
          phases: {
            context: { heading: 'Step 2: SQL Database', body: 'The SQL Database is the source of truth: stores code → original URL mappings. Reads are served from cache 95% of the time. The DB is only hit for cache misses and new URL creation.' },
            intro: { heading: 'Schema simplicity', body: 'The table has three columns: code (PK, varchar 8), original_url (text), created_at. That is the entire data model.' },
            teaching: { heading: 'Read-write asymmetry',
              body: 'URL shorteners have extreme read-write asymmetry: 95% reads (redirects), 5% writes (new URLs). This means you can optimize reads aggressively: replicas, read-through cache, CDN edge caching of redirect responses. Writes are infrequent enough that a single primary handles them comfortably up to millions of daily new URLs.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'SQL', and add the SQL Database." },
            connecting: { heading: 'Connect it', body: 'Connect URL Service → SQL Database.' },
            celebration: { heading: 'SQL Database added.', body: 'Now analytics.' },
          },
          hints: ['Search for "SQL"', 'Connect URL Service to it'],
        }),
        step({
          component: 'Analytics Service', nodeType: 'analytics_service', parent: 'Microservice',
          phases: {
            context: { heading: 'Step 3: Analytics', body: 'Every redirect is a data point: timestamp, referrer, user agent, country. The analytics pipeline tracks click-through rates, geographic distribution, and link performance.' },
            intro: { heading: 'Write-behind async analytics', body: 'Analytics writes must not block the redirect. A redirect that takes 50ms is fine. One that takes 300ms because it waits for analytics to write is not.' },
            teaching: { heading: 'The async analytics pattern',
              body: 'On each redirect: synchronously return the 301. Asynchronously emit a click event to a message queue. The Analytics Service consumes from the queue and batches writes to a columnar store (ClickHouse, BigQuery). This decouples the critical-path redirect (p99: 10ms) from non-critical analytics writes.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Analytics', and add the Analytics Service." },
            connecting: { heading: 'Connect it', body: 'Connect URL Service → Analytics Service.' },
            celebration: { heading: 'Analytics added. URL Shortener complete!', body: 'You built the classic interview system.' },
          },
          hints: ['Search for "Analytics"', 'Connect URL Service to it'],
        }),
      ],
    }),
  ],
});

export default urlShortenerTutorial;
