import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const discordTutorial = defineTutorial({
  id: 'discord-architecture',
  title: 'How to Design Discord Architecture',
  description: 'Build a real-time voice and text platform for 19 million active servers. Understand WebRTC, guild sharding, voice channel architecture, and message history at scale.',
  difficulty: 'advanced',
  estimatedMinutes: 87,
  tags: ['real-time', 'websocket', 'gaming'],
  icon: 'MessageCircle',
  color: '#5865F2',

  levels: [
    level({
      title: 'Real-Time Platform',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: { heading: 'Welcome to Discord Architecture', body: '19 million active servers, 200 million users, 4 billion messages monthly.' },
            intro: { heading: 'About Clients', body: "Discord's client maintains persistent WebSocket connections." },
            teaching: { heading: 'Deep dive: Web Client', body: "Discord's client is the web app, desktop app (Electron), and mobile app. All maintain persistent WebSocket connections." },
            action: { heading: 'Your turn!', body: "Press \u2318K and search for 'Web' to add the client." },
            connecting: { heading: 'Connect it up', body: 'First step, no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Web Client added.' },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'CDN', nodeType: 'cdn', parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: CDN', body: 'Discord serves 4+ billion images, emojis, and attachments monthly. The CDN handles all static media delivery.' },
            intro: { heading: 'About CDNs', body: 'CDNs cache content at edge servers worldwide, reducing latency for users far from origin servers.' },
            teaching: { heading: 'Deep dive: CDN', body: 'Discord\'s CDN serves custom emojis, sticker packs, profile avatars, and file attachments. Each guild can have up to 2,500 custom emojis — multiplied by 19 million servers, that\'s billions of cached assets. Without a CDN, every image load would hit origin storage, creating massive bandwidth costs and 500ms+ latency for international users.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'CDN', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 CDN.' },
            celebration: { heading: 'Great job!', body: 'CDN added.' },
          },
          hints: ['Search for "CDN"', 'Connect Web Client to it'],
        }),
        step({
          component: 'API Gateway', nodeType: 'api_gateway', parent: 'Web Client',
          phases: {
            context: { heading: 'Step 3: API Gateway', body: 'All REST API calls — channel management, user settings, server configuration — flow through the API Gateway.' },
            intro: { heading: 'About API Gateways', body: 'API gateways route requests, enforce rate limits, and authenticate tokens.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'Discord\'s API Gateway handles 2 million requests per second. It enforces per-bot rate limits (50 requests/second per guild), validates OAuth2 tokens, and routes requests to the appropriate microservice. Without rate limiting, a misbehaving bot could DDoS the entire platform.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Auth Service', nodeType: 'auth_service', parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 4: Auth Service', body: 'Every API request must be authenticated. The Auth Service validates tokens and manages session state.' },
            intro: { heading: 'About Auth Services', body: 'Auth services handle login, token validation, permission checks, and session management.' },
            teaching: { heading: 'Deep dive: Auth Service', body: 'Discord uses OAuth2 with short-lived access tokens (15 minutes) and long-lived refresh tokens. The Auth Service validates every API request\'s bearer token against a distributed token store. For bot tokens, it checks guild-specific permissions. Without centralized auth, services would need to independently validate tokens, creating race conditions when permissions change.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Auth', and add the Auth Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Auth Service.' },
            celebration: { heading: 'Great job!', body: 'Auth Service added.' },
          },
          hints: ['Search for "Auth"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Add Guild Service', nodeType: 'microservice', parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 5: Guild Service', body: 'A guild is Discord\'s term for a server. The Guild Service manages guild membership, channels, roles, and permissions.' },
            intro: { heading: 'About Guild Management', body: 'Guild services handle the social graph — who belongs to which server, what channels they can see, and what actions they can perform.' },
            teaching: { heading: 'Deep dive: Guild Service', body: 'With 19 million active servers, the Guild Service must handle rapid membership changes (a viral Discord link can add 100K users in hours). It shards guilds across independent database partitions so no single server\'s growth impacts others. Role-based access control (RBAC) determines which of the 150+ permission flags each member has in each channel.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Guild Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Add Guild Service.' },
            celebration: { heading: 'Great job!', body: 'Guild Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Add Message Service', nodeType: 'microservice', parent: 'Add Guild Service',
          phases: {
            context: { heading: 'Step 6: Message Service', body: 'Discord processes 4 billion messages monthly. The Message Service handles message creation, editing, deletion, and search indexing.' },
            intro: { heading: 'About Message Services', body: 'Message services manage the full lifecycle of messages — from creation through indexing to archival.' },
            teaching: { heading: 'Deep dive: Message Service', body: 'Every message must be: written to storage, indexed for full-text search, delivered to all online guild members via WebSocket, and stored for the 14-day message history guarantee. The Message Service uses a write-ahead log to ensure no message is lost even during cascading failures. Message edits and deletes propagate to all connected clients within 100ms.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Message Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Guild Service \u2192 Add Message Service.' },
            celebration: { heading: 'Great job!', body: 'Message Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect Add Guild Service to it'],
        }),
        step({
          component: 'NoSQL Database', nodeType: 'nosql_db', parent: 'Add Message Service',
          phases: {
            context: { heading: 'Step 7: NoSQL Database', body: 'Message storage requires write-heavy, append-only patterns. A NoSQL database handles this better than relational.' },
            intro: { heading: 'About NoSQL Databases', body: 'NoSQL databases optimize for horizontal scaling and write throughput over transactional consistency.' },
            teaching: { heading: 'Deep dive: NoSQL Database', body: 'Discord uses ScyllaDB (a Cassandra-compatible database) for message storage. Messages are partitioned by channel ID with time-bucketed clustering — each partition holds messages for a single channel within a time window. This enables efficient "scroll back" queries (last 50 messages in a channel) while supporting the massive write throughput of 4 billion messages/month.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'NoSQL', and add the database." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Message Service \u2192 NoSQL Database.' },
            celebration: { heading: 'Great job!', body: 'NoSQL Database added.' },
          },
          hints: ['Search for "NoSQL"', 'Connect Add Message Service to it'],
        }),
        step({
          component: 'Add Voice Service', nodeType: 'microservice', parent: 'Add Guild Service',
          phases: {
            context: { heading: 'Step 8: Voice Service', body: 'Voice channels are Discord\'s differentiator. The Voice Service manages WebRTC connections, audio routing, and voice state.' },
            intro: { heading: 'About Voice Services', body: 'Voice services handle real-time audio — connecting users, routing audio streams, and managing push-to-talk vs voice activity detection.' },
            teaching: { heading: 'Deep dive: Voice Service', body: 'The Voice Service manages voice state across 5+ million concurrent voice channel users. Each voice connection uses encrypted UDP (not TCP) for sub-100ms audio latency. The service handles jitter buffering, packet loss concealment, and adaptive bitrate — automatically lowering audio quality when network conditions degrade rather than dropping audio entirely.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Voice Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Guild Service \u2192 Add Voice Service.' },
            celebration: { heading: 'Great job!', body: 'Voice Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect Add Guild Service to it'],
        }),
        step({
          component: 'Add Session Service', nodeType: 'microservice', parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 9: Session Service', body: 'The Session Service tracks which users are online, their typing status, and their current activity across all guilds.' },
            intro: { heading: 'About Session Services', body: 'Session services maintain real-time user presence — online/offline/idle status, typing indicators, and activity (e.g., "Playing Valorant").' },
            teaching: { heading: 'Deep dive: Session Service', body: 'Presence is the most expensive feature per-user. When a user comes online, the Session Service must notify all guild members who share a server with them. For a user in 50 guilds with 100 members each, that\'s 5,000 notifications per login. Discord solves this with a pub/sub system where presence updates are fanned out only to guilds where the user\'s visibility settings permit it.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Session Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Add Session Service.' },
            celebration: { heading: 'Great job!', body: 'Session Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Media Pipeline',
          nodeType: 'message_queue',
          parent: 'Add Message Service',
          phases: {
            context: { heading: 'Level 2: Media Handling', body: 'Discord handles 2+ billion images, videos, and files monthly. This is the media upload and processing pipeline.' },
            intro: { heading: 'About Media Pipelines', body: 'Media pipelines handle uploads, image resizing, video transcoding, and delivery via CDN.' },
            teaching: { heading: 'Deep dive: Media Pipeline', body: 'Discord\'s media pipeline handles uploads of images, videos, and files. It resizes images into multiple formats (WebP, AVIF), transcodes video to browser-compatible formats, and serves everything through edge CDN nodes. Each upload is scanned for malware before delivery.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Message Queue', and add the Media Pipeline." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Message Service \u2192 Media Pipeline.' },
            celebration: { heading: 'Great job!', body: 'Media Pipeline added.' },
          },
          hints: ['Search for "Message Queue"', 'Connect Add Message Service to it'],
        }),
        step({
          component: 'In-Memory Cache', nodeType: 'in_memory_cache', parent: 'Add Session Service', aliases: ['app_cache'],
          phases: {
            context: { heading: 'Step 2: In-Memory Cache', body: 'Session lookups and guild metadata must be sub-millisecond. The cache stores hot data close to the application.' },
            intro: { heading: 'About In-Memory Caches', body: 'Caches store frequently accessed data in RAM, eliminating database round-trips for hot paths.' },
            teaching: { heading: 'Deep dive: In-Memory Cache', body: 'Discord uses Redis to cache session tokens, guild metadata, and permission lookups. A single permission check (can user X see channel Y?) requires traversing the guild → role → permission hierarchy — expensive on every message. Caching the resolved permission set reduces this to a single Redis GET (0.2ms) instead of a database query (5-50ms).' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'In-Memory Cache', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Session Service \u2192 In-Memory Cache.' },
            celebration: { heading: 'Great job!', body: 'In-Memory Cache added.' },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Add Session Service to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Metrics Collector', nodeType: 'metrics_collector', parent: 'Add Session Service',
          phases: {
            context: { heading: 'Level 3: Metrics Collector', body: 'You cannot fix what you cannot measure. The Metrics Collector gathers latency, error rates, and throughput from every service.' },
            intro: { heading: 'About Metrics Collectors', body: 'Metrics collectors aggregate time-series data for dashboards, alerting, and capacity planning.' },
            teaching: { heading: 'Deep dive: Metrics Collector', body: 'Discord collects millions of metrics per second — message delivery latency, WebSocket connection count, voice packet loss rate, API error rates by endpoint. These feed into Grafana dashboards and PagerDuty alerts. Without comprehensive metrics, a degradation in voice quality in São Paulo might go unnoticed for hours while the engineering team focuses on a New York latency spike.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Metrics', and add the Metrics Collector." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Session Service \u2192 Metrics Collector.' },
            celebration: { heading: 'Great job!', body: 'Metrics Collector added.' },
          },
          hints: ['Search for "Metrics"', 'Connect Add Session Service to it'],
        }),
        step({
          component: 'Tracing Service', nodeType: 'tracing_service', parent: 'Add Session Service',
          phases: {
            context: { heading: 'Step 2: Tracing Service', body: 'When a message takes 3 seconds to deliver, you need to know which of 5 services in the chain is slow. Distributed tracing makes this visible.' },
            intro: { heading: 'About Tracing Services', body: 'Distributed tracing assigns a unique ID to each request and records timing at every service hop.' },
            teaching: { heading: 'Deep dive: Tracing Service', body: 'Discord uses distributed tracing (OpenTelemetry) to track a single message from API Gateway → Guild Service → Message Service → WebSocket delivery. Each span records timing, error state, and metadata. When delivery latency spikes, engineers can immediately see: "the delay is in the Message Service write path, not WebSocket delivery." Without tracing, debugging distributed systems requires grepping logs across 5 services — a hours-long process.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Tracing', and add the Tracing Service." },
            connecting: { heading: 'Connect it up', body: 'Connect Add Session Service \u2192 Tracing Service.' },
            celebration: { heading: 'Great job!', body: 'Tracing Service added. Your Discord architecture is complete!' },
          },
          hints: ['Search for "Tracing"', 'Connect Add Session Service to it'],
        }),
      ],
    }),
  ],
});

export default discordTutorial;
