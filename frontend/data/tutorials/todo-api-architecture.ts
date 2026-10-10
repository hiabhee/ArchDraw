import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const todoApiTutorial = defineTutorial({
  id: 'todo-api-architecture',
  title: 'How to Design a Todo API',
  description: 'Build your first real backend \u2014 a REST API for todo lists. Learn the classic layering of client, gateway, service, and database that powers almost every web app.',
  difficulty: 'beginner',
  estimatedMinutes: 20,
  tags: ['api', 'rest', 'backend'],
  icon: 'ListTodo',
  color: '#10B981',
  recommendedOrder: 3,

  levels: [
    level({
      title: 'The Core API',
      description: 'Build the request path: browser, API gateway, the todo service, and the database that stores every task.',
      steps: [
        step({
          component: 'Web',
          nodeType: 'client_web',
          noConnect: true,
          title: 'Add the Web Client',
          phases: {
            context: {
              heading: 'Welcome to Todo API Architecture',
              body: 'A todo API is the perfect first architecture \u2014 simple enough to understand completely, but real enough to teach the patterns used by every web service.',
            },
            intro: {
              heading: 'About the Web Client',
              body: 'The client is a web browser (or mobile app) that lets a user create, read, update, and delete todos.',
            },
            teaching: {
              heading: 'Deep dive: The Web Client',
              body: 'The client talks to the API with simple HTTP requests: POST /todos to create, GET /todos to list, PATCH /todos/:id to update, DELETE to remove. It never talks to the database directly \u2014 only through the API. This separation is the heart of a well-layered system.',
              whyItMatters: 'Keeping the client as a pure consumer means you can change the app, add a mobile client, or swap the frontend entirely without touching the backend.',
              tradeoff: 'An API adds a layer of indirection \u2014 one more step between user and data. The flexibility of changing either side independently is worth that small cost.',
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
              body: 'Web added. Now the gateway.',
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
              body: 'Every request arrives at one public entry point before reaching any service.',
            },
            intro: {
              heading: 'About API Gateways',
              body: 'The gateway is the single door to your backend \u2014 it checks auth, rate limits, and routes requests to the right service.',
            },
            teaching: {
              heading: 'Deep dive: API Gateway',
              body: 'The gateway receives every /todos request, verifies the caller is authenticated, and forwards it to the todo service. It also shields the service \u2014 a request that is not authenticated never reaches the business logic. Keeping this logic in one place means your service code stays clean and focused.',
              whyItMatters: 'Without a gateway, every service would re-implement auth and request validation \u2014 duplicated, inconsistent, and impossible to update centrally.',
              tradeoff: 'The gateway is a single hop every request must pass through, so it must be fast and highly available \u2014 if it is down, nothing gets through.',
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
              body: 'API Gateway added. Now the todo service.',
            },
          },
          hints: ['Search for "API Gateway"', 'Connect Web to it'],
        }),
        step({
          component: 'Todo Service',
          nodeType: 'microservice',
          parent: 'API Gateway',
          title: 'Add the Todo Service',
          phases: {
            context: {
              heading: 'Adding the Todo Service',
              body: 'The todo service owns the business logic: what happens when a todo is created, updated, or completed.',
            },
            intro: {
              heading: 'About the Todo Service',
              body: 'This service contains the rules of your app \u2014 validation, business logic, and database access \u2014 and exposes them through the REST API.',
            },
            teaching: {
              heading: 'Deep dive: Todo Service',
              body: 'When a POST /todos arrives, the service validates the title, checks ownership, runs any business rules, and writes the todo to the database. It is the only component allowed to touch the data \u2014 the gateway cannot, the client cannot. Keeping all rules in one service makes the system predictable and testable.',
              whyItMatters: 'Centralizing business logic in the service means rules are enforced exactly once, in exactly one place, no matter which client triggers them.',
              tradeoff: 'A single service becomes the home for all logic, so it grows as features grow. When it gets too big, it must be split \u2014 the classic "monolith to microservices" problem.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Todo Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Todo Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Todo Service added. Now the database.',
            },
          },
          hints: ['Search for "Todo Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'SQL Database',
          nodeType: 'sql_db',
          parent: 'Todo Service',
          phases: {
            context: {
              heading: 'Adding the SQL Database',
              body: 'Todos must survive server restarts \u2014 they need a home that is durable.',
            },
            intro: {
              heading: 'About SQL Databases',
              body: 'The database stores every todo as a row: id, title, completed, created_at.',
            },
            teaching: {
              heading: 'Deep dive: SQL Database',
              body: 'The todo service reads and writes rows: SELECT to list, INSERT to create, UPDATE to mark complete. A SQL database is a natural fit because todo data is structured, related, and needs transactions \u2014 you want an update to be atomic. The database is the source of truth; everything else is a view over it.',
              whyItMatters: 'In-memory data vanishes on restart. The database gives every todo a durable home, so nothing is lost when the service restarts or scales.',
              tradeoff: 'Every write to a disk-based database is slower than memory. For a todo app that is trivial, but it is the tradeoff that motivates caching for hotter systems.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'SQL Database', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Todo Service \u2192 SQL Database.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'SQL Database added. Level 1 complete \u2014 the core API is alive.',
            },
          },
          hints: ['Search for "SQL Database"', 'Connect Todo Service to it'],
        }),
      ],
    }),
    level({
      title: 'Scale & Reliability',
      description: 'Speed up reads with a cache, spread load across many instances, and add the authentication and async notifications every real API needs.',
      steps: [
        step({
          component: 'In-Memory Cache',
          nodeType: 'in_memory_cache',
          parent: 'Todo Service',
          phases: {
            context: {
              heading: 'Adding the In-Memory Cache',
              body: 'Users reload their todo list constantly. The database should not answer every read.',
            },
            intro: {
              heading: 'About In-Memory Caches',
              body: 'The cache stores recently read todos in memory so repeated requests never hit the database.',
            },
            teaching: {
              heading: 'Deep dive: In-Memory Cache',
              body: 'The most-accessed todo lists are kept in the cache. When a user opens the app, the service checks the cache first and only falls back to the database on a miss. Since a todo app is read-heavy \u2014 users look at lists far more than they write \u2014 this keeps read latency low and offloads the database.',
              whyItMatters: 'Most requests are reads, and reads from memory are 10-100x faster than from disk. Caching turns the common case into the fast case.',
              tradeoff: 'Caches can serve stale data \u2014 an updated todo might briefly show the old version until the cache is invalidated.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'In-Memory Cache', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Todo Service \u2192 In-Memory Cache.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Cache added. Now scaling out.',
            },
          },
          hints: ['Search for "In-Memory Cache"', 'Connect Todo Service to it'],
        }),
        step({
          component: 'Load Balancer',
          nodeType: 'load_balancer',
          parent: 'Todo Service',
          phases: {
            context: {
              heading: 'Adding the Load Balancer',
              body: 'One todo service instance handles a few users easily \u2014 but what about thousands?',
            },
            intro: {
              heading: 'About Load Balancers',
              body: 'The load balancer sits in front of multiple todo service instances and spreads requests across them.',
            },
            teaching: {
              heading: 'Deep dive: Load Balancer',
              body: 'As usage grows, you run several copies of the todo service and the load balancer distributes requests between them. If one instance is busy or crashes, others pick up the traffic. The load balancer is what turns "a service" into "a scalable service".',
              whyItMatters: 'A single instance is a single point of failure and a hard capacity ceiling. The load balancer unlocks both scale and availability.',
              tradeoff: 'Running many instances shares the shared cache and database \u2014 now those become the new bottlenecks, and coordinating across instances gets harder.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Load Balancer', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Todo Service \u2192 Load Balancer.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Load Balancer added. Now authentication.',
            },
          },
          hints: ['Search for "Load Balancer"', 'Connect Todo Service to it'],
        }),
        step({
          component: 'Auth Service',
          nodeType: 'auth_service',
          parent: 'API Gateway',
          phases: {
            context: {
              heading: 'Adding the Auth Service',
              body: 'Your todos belong to a user. The auth service makes sure only that user can see and edit them.',
            },
            intro: {
              heading: 'About Auth Services',
              body: 'The auth service logs users in, issues tokens, and verifies that requests come from who they claim to be.',
            },
            teaching: {
              heading: 'Deep dive: Auth Service',
              body: 'When a user logs in, the auth service issues a signed token. Every request carries that token to the gateway, which verifies it with the auth service before forwarding. The todo service then scopes queries to that user \u2014 you only ever see your own todos. Separating auth into its own service means one login flow works for every service in the system.',
              whyItMatters: 'Identity is a cross-cutting concern every feature depends on. Centralizing it means one high-quality, well-audited implementation instead of dozens of ad-hoc ones.',
              tradeoff: 'Every request now depends on auth being available. If the auth service is down, no one can log in \u2014 so it needs its own redundancy.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Auth Service', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect API Gateway \u2192 Auth Service.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Auth Service added. Final step \u2014 notifications.',
            },
          },
          hints: ['Search for "Auth Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Message Queue',
          nodeType: 'message_queue',
          parent: 'Todo Service',
          phases: {
            context: {
              heading: 'Adding the Message Queue',
              body: 'When a todo is due, a user should hear about it. But sending notifications must never slow down the API.',
            },
            intro: {
              heading: 'About Message Queues',
              body: 'The message queue carries "todo created" and "todo due" events to background workers that send notifications.',
            },
            teaching: {
              heading: 'Deep dive: Message Queue',
              body: 'When a user saves a todo, the service publishes an event \u2014 todo_created, todo_due_soon \u2014 to the queue. A background worker consumes these events and sends emails or push notifications. The API returns immediately; the notification happens later. This decoupling is the standard pattern for any side effect that does not need to block the user.',
              whyItMatters: 'Sending an email can take a second and might fail. Doing it inline would make every save slow and unreliable. The queue makes it fast and retryable.',
              tradeoff: 'The email is no longer guaranteed to send instantly \u2014 it is "eventually" sent. For notifications that is fine; for things like payments it would not be.',
            },
            action: {
              heading: 'Your turn!',
              body: "Press \u2318K, search for 'Message Queue', and add it.",
            },
            connecting: {
              heading: 'Connect it up',
              body: 'Connect Todo Service \u2192 Message Queue.',
            },
            celebration: {
              heading: 'Great job!',
              body: 'Message Queue added. You have built a complete, scalable todo API \u2014 the patterns you learned power almost every web app.',
            },
          },
          hints: ['Search for "Message Queue"', 'Connect Todo Service to it'],
        }),
      ],
    }),
  ],
});

export default todoApiTutorial;
