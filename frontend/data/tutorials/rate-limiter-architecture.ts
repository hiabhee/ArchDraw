import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const rateLimiterTutorial = defineTutorial({
  id: 'rate-limiter-architecture',
  title: 'How to Design a Rate Limiter',
  description: 'Build a distributed rate limiter step by step \u2014 the API guard that keeps every service alive. Learn token buckets, sliding windows, and Redis coordination.',
  difficulty: 'beginner',
  estimatedMinutes: 20,
  tags: ['rate-limiting', 'redis', 'api'],
  icon: 'Gauge',
  color: '#F59E0B',
  recommendedOrder: 2,

  levels: [
    level({
      title: 'The Basics',
      description: 'Build the request path that every API call travels: client, gateway, the rate limiter itself, and the fast local cache.',
      steps: [
        step({
          component: 'Web',
          nodeType: 'client_web',
          noConnect: true,
          title: 'Add the Web Client',
          phases: {
            context: {
              heading: 'Welcome to Rate Limiter Architecture',
              body: 'A rate limiter decides how many requests a client is allowed per second. Every big API \u2014 Stripe, GitHub, Twitter \u2014 has one protecting its servers.',
            },
            intro: {
              heading: 'About the Web Client',
              body: 'The client is any app making API calls: a browser, a mobile app, or another server.',
            },
            teaching: {
              heading: 'Deep dive: The Web Client',
              body: 'Every client sends a stream of requests. A well-behaved client stays under the limit, but a buggy loop, a misconfigured script, or an attacker can send thousands of requests per second. The rate limiter exists because you cannot trust any single client.',
              whyItMatters: 'Clients are the source of all traffic \u2014 and the source of abuse. Understanding the client side makes it clear why limits are needed.',
              tradeoff: 'Strict limits protect your servers but can block legitimate users, like someone refreshing a page 20 times. Getting the limit wrong on either side frustrates real users or fails to protect the system.',
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
              body: 'Web added. Now the entry point for requests.',
            },
          },
          hints: ['Search for "Web"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web',
          phases: {
            context: {
              heading: 'Adding the API Gateway',
              body: 'Every request enters through one door. The API Gateway is where rate limiting is enforced for the whole system.',
            },
            intro: {
              heading: 'About API Gateways',
              body: 'The gateway is the single entry point for all client requests, and it is the natural home for rate limiting.',
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: 'The gateway checks every request against the rate limiter before it reaches any backend service. If the client is over the limit, the gateway returns HTTP 429 (Too Many Requests) instantly \u2014 no backend work is wasted. Centralizing this at the gateway means one team manages protection for every service.',
              whyItMatters: 'If the gateway does not stop excess traffic, abusive requests would flow into every backend service and take the whole system down.',
              tradeoff: 'A gateway is one more hop and a single point of failure. If it goes down, no requests pass \u2014 so gateways must be replicated and fast.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'API Gateway', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Web \u2192 API Gateway.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'API Gateway added. Now the limiter itself.',
            },
          },
          hints: ['Search for "API Gateway"', 'Connect Web to it'],
        }),
        step({
          component: 'Distributed Rate Limiter',
          nodeType: 'rate_limit_redis',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Distributed Rate Limiter',
              body: 'The gateway must make a decision per request: allowed or not. In a distributed system with many gateway instances, the limiter must agree across all of them.',
            },
            intro: {
              heading: 'About Distributed Rate Limiters',
              body: 'A distributed rate limiter shares the request count across all servers using Redis, so the limit is global \u2014 not per-server.',
            },
            teaching: {
              heading: 'Deep dive: Distributed Rate Limiter',
              body: 'If you have 10 gateway servers and a client is allowed 100 requests/minute, each server allowing 100 would let the client through 1,000 times. The distributed limiter stores the running count in Redis with atomic increments, so every server sees the same number and the limit is enforced globally.',
              whyItMatters: 'Without shared state, scaling out would silently multiply the limit. The distributed limiter is what keeps the limit correct at scale.',
              tradeoff: 'Redis adds a network round-trip to every request, increasing latency. That is the price of a limit that stays correct across all servers.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Distributed Rate Limiter', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Distributed Rate Limiter.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Distributed Rate Limiter added. Now the local fast path.',
            },
          },
          hints: ['Search for "Distributed Rate Limiter"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'In-Memory Cache',
          nodeType: 'in_memory_cache',
          parent: 'Distributed Rate Limiter',
          phases: {
            context: {
              heading: 'Adding the In-Memory Cache',
              body: 'Hitting Redis for every single request is expensive. A local cache holds the common answers close to the gateway.',
            },
            intro: {
              heading: 'About In-Memory Caches',
              body: 'The cache stores recent rate-limit decisions on the same machine as the gateway, so most checks never touch Redis.',
            },
            teaching: {
              heading: 'Deep dive: In-Memory Cache',
              body: 'The gateway keeps a small local cache of the counters it sees most often. If a client was just checked, the answer is already in memory \u2014 no network call needed. This turns a sub-millisecond local read into the common case.',
              whyItMatters: 'Latency is the enemy of a limiter sitting on the hot path of every request. A local cache keeps most checks off the network.',
              tradeoff: 'Local caches can drift from the global count \u2014 two servers might briefly disagree. That is fine for bursts but requires the Redis check for accuracy.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'In-Memory Cache', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Distributed Rate Limiter \u2192 In-Memory Cache.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Cache added. Level 1 done \u2014 on to the algorithms.',
            },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Distributed Rate Limiter to it'],
        }),
      ],
    }),
    level({
      title: 'Algorithms & Scale',
      description: 'Decide how the limiter counts requests, scale it horizontally, store its rules durably, and log every decision.',
      steps: [
        step({
          component: 'Token Bucket Rate Limiter',
          nodeType: 'token_bucket_limiter',
          parent: 'Distributed Rate Limiter',
          phases: {
            context: {
              heading: 'Adding the Token Bucket Algorithm',
              body: 'The limiter needs a rule for how to count. The token bucket is the most common algorithm because it allows bursts.',
            },
            intro: {
              heading: 'About Token Buckets',
              body: 'A bucket holds tokens. Each request spends one token. Tokens refill at a steady rate, so bursts are allowed up to the bucket size.',
            },
            teaching: {
              heading: 'Deep dive: Token Bucket Rate Limiter',
              body: 'Imagine a bucket that holds 10 tokens. It refills at 2 tokens per second. A user can fire 10 requests instantly (using the stored tokens), then is limited to 2 per second until the bucket refills. This is why token buckets are the default \u2014 they tolerate natural spikes like page loads while still enforcing a ceiling.',
              whyItMatters: 'A strict count-per-second algorithm punishes bursts that are completely normal, like opening 10 tabs. The token bucket allows that without weakening the overall limit.',
              tradeoff: 'Allowing bursts means short spikes above the average are fine, but sustained abuse is still capped. For stricter control, the sliding window algorithm is a better fit.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Token Bucket Rate Limiter', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Distributed Rate Limiter \u2192 Token Bucket Rate Limiter.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Token Bucket added. Now scaling out.',
            },
          },
          hints: ['Search for "Token Bucket Rate Limiter"', 'Connect Distributed Rate Limiter to it'],
        }),
        step({
          component: 'Load Balancer',
          nodeType: 'load_balancer',
          parent: 'Distributed Rate Limiter',
          phases: {
            context: {
              heading: 'Adding the Load Balancer',
              body: 'One gateway cannot handle all traffic. The load balancer spreads requests across many gateway instances.',
            },
            intro: {
              heading: 'About Load Balancers',
              body: 'The load balancer sits in front of the gateways and distributes incoming requests across them.',
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: 'As traffic grows, you add more gateway instances and the load balancer spreads requests between them. This is where the "distributed" in distributed rate limiter matters \u2014 each gateway instance checks the same shared counters, so scaling out never weakens the limit.',
              whyItMatters: 'Scaling is how you absorb more legitimate traffic. Without it, one overloaded gateway becomes the bottleneck for everything.',
              tradeoff: 'More instances means more shared-state traffic to Redis and more cache drift between instances. Scale must be balanced against coordination cost.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Load Balancer', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Distributed Rate Limiter \u2192 Load Balancer.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Load Balancer added. Now durable rules.',
            },
          },
          hints: ['Search for "Load Balancer"', 'Connect Distributed Rate Limiter to it'],
        }),
        step({
          component: 'SQL Database',
          nodeType: 'sql_db',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Adding the SQL Database',
              body: 'Rate limit rules \u2014 who is limited to what \u2014 must survive restarts. They live in the database.',
            },
            intro: {
              heading: 'About the Rules Database',
              body: 'The SQL database stores the configuration: per-user, per-plan, or per-IP limits and which algorithm each one uses.',
            },
            teaching: {
              heading: 'Deep dive: SQL Database',
              body: 'Limits are configuration, not code. A table stores rows like "user tier: 100 req/min". When a plan changes, an operator updates the database and gateways pick up the new rules. Redis holds the live counters, but the database is the source of truth for what the limits are.',
              whyItMatters: 'Hard-coding limits in each service makes them impossible to change without redeploys. Storing them centrally means one update changes the whole system.',
              tradeoff: 'Rules can change rarely \u2014 so reads of the database are cached aggressively. The database must never be on the hot request path.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'SQL Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 SQL Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'SQL Database added. Final step \u2014 the audit log.',
            },
          },
          hints: ['Search for "SQL Database"', 'Connect Load Balancer to it'],
        }),
        step({
          component: 'Message Queue',
          nodeType: 'message_queue',
          parent: 'Load Balancer',
          phases: {
            context: {
              heading: 'Adding the Message Queue',
              body: 'Every rate limit decision is valuable data \u2014 for abuse detection, billing, and tuning. But logging must never slow the request down.',
            },
            intro: {
              heading: 'About Message Queues',
              body: 'The message queue carries rate-limit events to background consumers, off the request path.',
            },
            teaching: {
              heading: 'Deep dive: Message Queue',
              body: 'When a request is rejected or a limit is hit, the limiter publishes an event \u2014 client id, count, timestamp \u2014 to the queue. Downstream consumers build abuse reports, charge for premium plans, and tune limits. The queue decouples this analysis from the hot request path.',
              whyItMatters: 'You cannot tune limits you cannot measure. The queue makes every decision observable without adding latency to requests.',
              tradeoff: 'Events are logged asynchronously, so analytics are slightly delayed. If the queue backs up, you lose visibility \u2014 until the consumers catch up.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Message Queue', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Load Balancer \u2192 Message Queue.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Message Queue added. You have built a distributed rate limiter \u2014 the guard that keeps every API alive.',
            },
          },
          hints: ['Search for "Message Queue"', 'Connect Load Balancer to it'],
        }),
      ],
    }),
  ],
});

export default rateLimiterTutorial;
