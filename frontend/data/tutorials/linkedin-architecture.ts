import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const linkedinTutorial = defineTutorial({
  id: 'linkedin-architecture',
  title: 'How to Design LinkedIn Architecture',
  description: 'Build a professional social network for 1 billion members. Learn social graph traversal, feed ranking, connection degrees, job matching, and real-time messaging at scale.',
  difficulty: 'intermediate',
  estimatedMinutes: 40,
  tags: ['social-media', 'job-matching', 'networking'],
  icon: 'Users',
  color: '#0A66C2',

  levels: [
    level({
      title: 'Professional Social Network',
      description: 'The request path: browser client, gateway, consistent-hashing load balancing, and auth with enterprise SSO.',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          phases: {
            context: {
              heading: 'Welcome to LinkedIn Architecture',
              body: "Let's build LinkedIn from scratch. 1 billion members, 40 million job postings, and a social graph with billions of connections.",
            },
            intro: {
              heading: 'Do you know about Web Clients?',
              body: "LinkedIn's web client handles the feed, profile pages, job search, and messaging.",
            },
            teaching: {
              heading: 'Deep dive: Web Client',
              body: "LinkedIn's hardest problem: when you search for '2nd-degree connections who work at Google', LinkedIn must traverse a graph of billions of edges in milliseconds.",
              whyItMatters: 'The client is how members experience the network \u2014 feed, profile, jobs, messaging. Every feature is reached from this surface.',
              tradeoff: 'A feed-heavy, mobile-first web client must decide how much to render client-side vs server-side. Too much client work and SEO + first paint suffer.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Web Client', and add the client to the canvas.",
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
          hints: ['Press \u2318K to open component search', 'Search for "Web Client"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: {
              heading: 'Adding the API Gateway',
              body: 'All client requests flow through the gateway with authentication and rate limiting.',
            },
            intro: {
              heading: 'Do you know about API Gateways?',
              body: 'All client requests flow through the API Gateway with authentication and rate limiting.',
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: "The gateway validates your auth token, checks rate limits (LinkedIn throttles aggressive scrapers), and routes to the right service.",
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
              heading: 'Adding the Load Balancer',
              body: 'Traffic is distributed with consistent hashing so a member always lands on the server that has their connection graph cached.',
            },
            intro: {
              heading: 'Do you know about Load Balancers?',
              body: "LinkedIn's Load Balancer distributes traffic across service instances with consistent hashing.",
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: "Consistent hashing means user A's requests always go to the same server. That server caches your connection graph in memory, making subsequent requests much faster.",
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
              body: 'Load Balancer added. Now the Auth Service.',
            },
          },
          hints: ['Search for "Load Balancer"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Auth Service',
          nodeType: 'auth_service',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Adding the Auth Service',
              body: 'OAuth login, email/password, and SAML enterprise SSO all resolve here.',
            },
            intro: {
              heading: 'Do you know about Auth Services?',
              body: "LinkedIn's Auth Service handles OAuth login, email/password, and SAML enterprise SSO.",
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: "Enterprise customers configure their identity provider (Okta, Azure AD) to authenticate employees. This is how 'Sign in with your company account' works.",
              whyItMatters: 'LinkedIn holds highly sensitive professional data. A weak auth layer is an existential risk \u2014 one breach destroys member trust.',
              tradeoff: 'Enterprise SSO (SAML) is a different flow from consumer OAuth. Supporting both adds surface area and each provider has quirks.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Auth Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 Auth Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Auth Service added. Level 1 complete \u2014 on to the social graph.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
    level({
      title: 'The Social Graph',
      description: 'Store the graph of professional connections and use it to power profiles, feeds, and discovery.',
      steps: [
        step({
          component: 'User Service',
          nodeType: 'user_service',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the User Service',
              body: 'Profiles, connections, and following are the backbone of the network.',
            },
            intro: {
              heading: 'Do you know about User Services?',
              body: 'The User Service owns profiles, connections, and follows \u2014 who someone is and who they know.',
            },
            teaching: {
              heading: 'Deep dive: User Service',
              body: "The User Service is the source of truth for member identity: profile fields, work history, connections, and follow relationships. When a member updates their headline, the User Service publishes the change so the feed, search index, and notifications stay consistent.",
              whyItMatters: 'Every feature is anchored to the member. A slow or wrong User Service breaks the feed, search, jobs, and messaging at once.',
              tradeoff: 'One service owning all member data gets hot \u2014 connections are written rarely but read constantly. Split hot reads (graph, cache) from the source of truth or the service becomes the bottleneck.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'User Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 User Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'User Service added. Now the graph store.',
            },
          },
          hints: ['Search for "User Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Graph Database',
          nodeType: 'graph_database',
          parent: 'User Service',
          phases: {
            context: {
              heading: 'Adding the Graph Database',
              body: 'Connection queries are relationship traversals \u2014 "who are my 2nd-degree connections at Google?" \u2014 not row lookups.',
            },
            intro: {
              heading: 'Do you know about Graph Databases?',
              body: 'Graph databases store entities and edges, making multi-hop relationship queries fast.',
            },
            teaching: {
              heading: 'Deep dive: Graph Database',
              body: "The graph database stores members as nodes and connections as edges. Degree queries \u2014 1st, 2nd, 3rd \u2014 become path traversals. 'People you may know' recommendations run graph algorithms over this store.",
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Graph Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect User Service \u2192 Graph Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Graph Database added. Now the cache.',
            },
          },
          hints: ['Search for "Graph Database"', 'Connect User Service to it'],
        }),
        step({
          component: 'In-Memory Cache',
          nodeType: 'in_memory_cache',
          parent: 'User Service',
          phases: {
            context: {
              heading: 'Adding the Cache',
              body: 'The hottest reads in the system are connection lists and profile snapshots. They must be served from memory.',
            },
            intro: {
              heading: 'Do you know about In-Memory Caches?',
              body: 'Caches serve hot data from RAM, cutting database and graph queries by 90%+.',
            },
            teaching: {
              heading: 'Deep dive: In-Memory Cache',
              body: "The cache stores each member's connection graph and recently viewed profiles in memory. Because the load balancer pins members to servers, the cache is warm where it is needed most. Feed generation reads the graph from cache, not from disk.",
              whyItMatters: 'Graph traversals against disk at LinkedIn scale would take seconds per feed view. The cache is what keeps the feed snappy for a billion members.',
              tradeoff: 'Cached graphs go stale \u2014 a new connection is not visible until the cache refreshes. Acceptable for the feed, deadly for "viewed by" features; choose invalidation carefully.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'In-Memory Cache', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect User Service \u2192 In-Memory Cache.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Cache added. Now the feed.',
            },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect User Service to it'],
        }),
        step({
          component: 'Feed Service',
          nodeType: 'feed_service',
          parent: 'User Service',
          phases: {
            context: {
              heading: 'Adding the Feed Service',
              body: 'The feed is the product. It assembles updates from your network, ranked and deduped.',
            },
            intro: {
              heading: 'Do you know about Feed Services?',
              body: 'The Feed Service gathers posts from your connections and ranks them for you personally.',
            },
            teaching: {
              heading: 'Deep dive: Feed Service',
              body: "The Feed Service combines the member's connection graph with the latest posts to build a personalized feed. It ranks by relevance \u2014 connections, engagement, recency \u2014 not just chronology, and keeps the top N cached so scrolling is instant.",
              whyItMatters: 'The feed drives the majority of member sessions. If it is slow or irrelevant, members leave \u2014 feed quality is the product.',
              tradeoff: 'Personalized ranking needs signals (likes, clicks, recency) that change constantly. Re-rank too often and you burn compute; too rarely and the feed feels stale.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Feed Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect User Service \u2192 Feed Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Feed Service added. Level 2 complete \u2014 on to discovery and messaging.',
            },
          },
          hints: ['Search for "Feed Service"', 'Connect User Service to it'],
        }),
      ],
    }),
    level({
      title: 'Discovery & Messaging',
      description: 'Serve timelines at scale, push posts to followers, search the network, and deliver notifications.',
      steps: [
        step({
          component: 'Timeline Service',
          nodeType: 'timeline_service',
          parent: 'Feed Service',
          phases: {
            context: {
              heading: 'Adding the Timeline Service',
              body: 'Once ranked, the feed becomes a concrete timeline that must be served instantly and paginated smoothly.',
            },
            intro: {
              heading: 'Do you know about Timeline Services?',
              body: 'The Timeline Service materializes and serves the ordered list of posts for a member.',
            },
            teaching: {
              heading: 'Deep dive: Timeline Service',
              body: "The Timeline Service stores the ranked feed for each member and serves it with cursor-based pagination. It merges live events \u2014 a new post from a connection \u2014 into the cached timeline so the feed updates without a full rebuild.",
              whyItMatters: 'Timelines must load in tens of milliseconds and scroll without jank. Without a precomputed timeline, feed requests would fan out across the whole network.',
              tradeoff: 'Precomputing timelines costs storage \u2014 every member needs their own ordered list. Millions of idle members storing cold timelines is pure waste; you need TTLs and lazy rebuilds.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Timeline Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Feed Service \u2192 Timeline Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Timeline Service added. Now fan-out.',
            },
          },
          hints: ['Search for "Timeline Service"', 'Connect Feed Service to it'],
        }),
        step({
          component: 'Fan-out Service',
          nodeType: 'fanout_service',
          parent: 'Feed Service',
          phases: {
            context: {
              heading: 'Adding the Fan-out Service',
              body: 'When someone posts, the post must reach every follower. That fan-out is a hard scaling problem.',
            },
            intro: {
              heading: 'Do you know about Fan-out Services?',
              body: 'Fan-out pushes a new post into the timelines of every follower, in bulk.',
            },
            teaching: {
              heading: 'Deep dive: Fan-out Service',
              body: "LinkedIn uses a hybrid fan-out: top-of-feed and celebrity posts are pulled on read, while most posts are pushed into follower timelines on write. The Fan-out Service writes the new post ID into each follower's timeline bucket. A member with 10,000 followers causes 10,000 timeline writes.",
              whyItMatters: 'Without fan-out, followers would never see new posts \u2014 every read would have to scan the entire network. Fan-out is what makes the feed real-time.',
              tradeoff: 'Push fan-out explodes write volume for popular accounts. Hybrid pull-for-superusers keeps writes bounded at the cost of read-time merging.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Fan-out Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Feed Service \u2192 Fan-out Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Fan-out added. Now search.',
            },
          },
          hints: ['Search for "Fan-out Service"', 'Connect Feed Service to it'],
        }),
        step({
          component: 'Search Service',
          nodeType: 'search_service',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Search Service',
              body: 'Search across people, jobs, companies, and posts \u2014 the discovery engine of the network.',
            },
            intro: {
              heading: 'Do you know about Search Services?',
              body: 'Search engines use inverted indexes to return relevance-ranked results in milliseconds.',
            },
            teaching: {
              heading: 'Deep dive: Search Service',
              body: "Search indexes people, jobs, companies, and posts separately. A query like 'senior backend engineer at Stripe' ranks results by text relevance plus social signals \u2014 connection degree and company affinity. Indexes update near-real-time as profiles change.",
              whyItMatters: 'Search is the main discovery surface after the feed \u2014 job seeking and recruiting both depend on it. A stale or slow index loses members and recruiters.',
              tradeoff: 'Real-time index freshness costs re-index throughput. Full-text relevance vs social ranking is a constant tuning battle.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Search Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Search Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Search Service added. Final step \u2014 messaging.',
            },
          },
          hints: ['Search for "Search Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Message Queue',
          nodeType: 'message_queue',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Message Queue',
              body: 'Notifications, InMail, and feed updates are async work \u2014 they must not block the request that triggered them.',
            },
            intro: {
              heading: 'Do you know about Message Queues?',
              body: 'Message queues buffer async work between producers and consumers so nothing blocks the user request.',
            },
            teaching: {
              heading: 'Deep dive: Message Queue',
              body: "When you connect with someone, a message lands on the queue and workers deliver the notification, update the graph, and refresh both member's feeds. When a recruiter sends InMail, the queue guarantees delivery even if the notification service is briefly down.",
              whyItMatters: 'Side effects like notifications and feed refresh must not slow the original action \u2014 connecting with a colleague should return in milliseconds even if fan-out takes seconds.',
              tradeoff: 'Queues deliver at-least-once, so consumers must be idempotent \u2014 a duplicated connection notification is annoying; a duplicated graph write is corrupting.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Message Queue', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Message Queue.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Message Queue added. You have built LinkedIn \u2014 the complete professional network.',
            },
          },
          hints: ['Search for "Message Queue"', 'Connect API Gateway to it'],
        }),
      ],
    }),
  ],
});

export default linkedinTutorial;
