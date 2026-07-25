import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const twitterTutorial = defineTutorial({
  id: 'twitter-architecture',
  title: 'How to Design Twitter Architecture',
  description: 'Build the real-time social network serving 200M+ users. Learn about timeline generation, tweet storage, and high-throughput systems.',
  difficulty: 'advanced',
  estimatedMinutes: 65,
  tags: ['social-media', 'real-time', 'feed'],
  icon: 'Twitter',
  color: '#1DA1F2',

  levels: [
    level({
      title: 'Tweet Foundation',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to Twitter Architecture', body: 'Twitter (X) serves 200 million users who generate 500 million tweets daily. The architecture must deliver timelines in under 200ms while handling viral tweets that get millions of views in minutes.' },
            intro: { heading: 'About the Web Client', body: 'The Twitter web client is a React single-page application that renders timelines, tweet compose, notifications, and direct messages in real-time.' },
            teaching: { heading: 'Deep dive: Web Client', body: 'The Twitter web client implements infinite scroll timeline rendering, optimistic tweet posting (showing your tweet before the server confirms), and WebSocket connections for live notifications. It must handle the "firehose" of real-time data — a trending topic can generate 10,000 tweets per minute, and the client must render them without janking. Without a performant client, users would see stale timelines and miss critical updates.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Web', and add the Web Client." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Web Client added.' },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Every API call — tweet, like, retweet, follow, search — routes through the API Gateway.' },
            intro: { heading: 'About API Gateways', body: 'API gateways route requests, authenticate users, enforce rate limits, and provide a unified interface to multiple backend services.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'Twitter\'s API Gateway handles 600,000 requests per second during peak. It authenticates OAuth tokens, enforces per-user rate limits (300 tweets/3hrs, 15 API calls/15min for search), and routes requests to the appropriate microservice. The gateway also implements request deduplication — if a user double-clicks "Tweet", only one request goes through.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Tweet Service',
          nodeType: 'tweet_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Tweet Service', body: 'The Tweet Service handles tweet creation, deletion, and retrieval. It is the write path for all tweet operations.' },
            intro: { heading: 'About Tweet Services', body: 'Tweet services manage the lifecycle of tweets — creation, storage, deletion, and content moderation.' },
            teaching: { heading: 'Deep dive: Tweet Service', body: 'When you compose a tweet, the Tweet Service validates content (280 char limit, media attachments), runs it through a content moderation pipeline (toxicity detection, spam filtering), stores it in a distributed database, and triggers fan-out to followers\' timelines. The service must handle viral tweets — a tweet from a celebrity can be retweeted 100,000 times in minutes, requiring massive write amplification across the system.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Tweet Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Tweet Service.' },
            celebration: { heading: 'Great job!', body: 'Tweet Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'NoSQL Database',
          nodeType: 'nosql_db',
          parent: 'Tweet Service',
          phases: {
            context: { heading: 'Step 4: NoSQL Database', body: 'Twitter stores 500 million tweets daily in a NoSQL database optimized for high-write throughput and time-ordered reads.' },
            intro: { heading: 'About NoSQL Databases', body: 'NoSQL databases provide high write throughput, flexible schemas, and horizontal scaling for unstructured data like social media posts.' },
            teaching: { heading: 'Deep dive: NoSQL Database', body: 'Twitter uses Manhattan (a custom distributed key-value store) to store tweets. Each tweet is indexed by tweet_id (for direct lookup), user_id + timestamp (for user timelines), and hashtag (for topic searches). A SQL database cannot handle 500 million writes/day with sub-10ms reads — NoSQL provides the write throughput and horizontal scaling needed for social media at this scale.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'NoSQL Database', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Tweet Service \u2192 NoSQL Database.' },
            celebration: { heading: 'Great job!', body: 'NoSQL Database added. Tweets can now be stored.' },
          },
          hints: ['Search for "NoSQL Database"', 'Connect Tweet Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Ready',
      steps: [
        step({
          component: 'Timeline Service',
          nodeType: 'timeline_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: Timeline Service', body: 'The Timeline Service is Twitter\'s most complex component — it pre-computes each user\'s home timeline so it can be served in under 200ms.' },
            intro: { heading: 'About Timeline Services', body: 'Timeline services generate, rank, and serve personalized feeds for each user in real-time.' },
            teaching: { heading: 'Deep dive: Timeline Service', body: 'Twitter uses a "fan-out-on-write" model: when a user tweets, the Tweet Service immediately pushes that tweet to every follower\'s pre-computed timeline (stored in a sorted set). When a user opens Twitter, their timeline is already built — just read the pre-computed list. This trades write amplification (one tweet fans out to millions of followers) for read speed (timeline loads in <200ms). For users with millions of followers (celebrities), Twitter switches to "fan-out-on-read" to avoid writing one tweet to millions of timelines.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Microservice', and add the Timeline Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Timeline Service.' },
            celebration: { heading: 'Great job!', body: 'Timeline Service added.' },
          },
          hints: ['Search for "Microservice"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Cache',
          nodeType: 'in_memory_cache',
          parent: 'Timeline Service',
          phases: {
            context: { heading: 'Level 3: Cache', body: 'Twitter caches 80% of timeline reads from Memcached clusters. Without caching, the database would be overwhelmed by timeline read requests.' },
            intro: { heading: 'About Caches', body: 'Caches store frequently accessed data in memory for sub-millisecond reads, reducing database load.' },
            teaching: { heading: 'Deep dive: Cache', body: 'Twitter\'s Memcached cluster stores 12TB of hot timeline data across thousands of servers. Each user\'s pre-computed timeline is cached with a TTL matching their activity level (active users: 5min TTL, inactive users: 30min TTL). When a timeline is read, it hits the cache first — if present, the database is never queried. Cache invalidation happens when new tweets are fanned out to a user\'s timeline. Without this cache layer, every timeline read would hit the database, causing cascading failures during traffic spikes.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'In-Memory Cache', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Timeline Service \u2192 Cache.' },
            celebration: { heading: 'Great job!', body: 'Cache added. Your Twitter architecture is complete!' },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Timeline Service to it'],
        }),
      ],
    }),
  ],
});

export default twitterTutorial;
