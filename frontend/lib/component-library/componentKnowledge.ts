export interface ComponentKnowledge {
  id: string;
  category: string;
  name: string;
  icon: string;
  overview: string;
  purpose: string;
  characteristics: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  learningResources: LearningResource[];
  bestPractices: BestPractices;
  relatedConcepts: string[];
  commonPatterns: string[];
  whyItMatters?: string;
  concepts?: string[];
  realWorldFact?: string;
}

export interface LearningResource {
  type: 'documentation' | 'video' | 'article' | 'code' | 'course';
  title: string;
  url: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  description?: string;
}

export interface BestPractices {
  dos: string[];
  donts: string[];
  performance?: string[];
  security?: string[];
}

export const componentKnowledgeBase: Record<string, ComponentKnowledge> = {
  'api-gateway': {
    id: 'api-gateway',
    category: 'edge',
    name: 'API Gateway',
    icon: 'Gate',
    overview: 'An API Gateway is a server that acts as a single entry point for a collection of microservices. It handles incoming requests and routes them to the appropriate backend services, providing a unified API interface to clients.',
    purpose: 'Centralize API management, handle cross-cutting concerns, and simplify client integration.',
    characteristics: [
      'Single entry point for all clients',
      'Request routing and composition',
      'Authentication and authorization',
      'Rate limiting and throttling',
      'Request/response transformation',
      'Protocol translation'
    ],
    whenToUse: [
      'Building microservices architecture',
      'Need to centralize authentication',
      'Implementing rate limiting',
      'Supporting multiple client types',
      'Reducing client complexity'
    ],
    whenNotToUse: [
      'Simple monolithic applications with one endpoint',
      'When overhead is unnecessary',
      'Low-traffic internal tools'
    ],
    learningResources: [
      { type: 'documentation', title: 'Kong API Gateway Docs', url: 'https://docs.konghq.com/', difficulty: 'beginner', estimatedTime: '30 min' },
      { type: 'video', title: 'API Gateway Explained', url: 'https://youtu.be/example', difficulty: 'beginner', estimatedTime: '12 min' },
      { type: 'article', title: 'When to Use an API Gateway', url: 'https://example.com/gateway', difficulty: 'intermediate', estimatedTime: '10 min' },
      { type: 'documentation', title: 'AWS API Gateway Guide', url: 'https://docs.aws.amazon.com/apigateway/', difficulty: 'intermediate', estimatedTime: '45 min' }
    ],
    bestPractices: {
      dos: [
        'Implement rate limiting to prevent abuse',
        'Use caching for frequently accessed data',
        'Enable request/response logging',
        'Version your APIs for backward compatibility',
        'Use circuit breakers for fault tolerance'
      ],
      donts: [
        'Put business logic in the API Gateway',
        'Make the gateway a single point of failure',
        'Ignore authentication/authorization',
        'Tightly couple clients to backend structure',
        'Skip monitoring and metrics'
      ],
      performance: [
        'Enable compression for responses',
        'Use connection pooling for backend services',
        'Implement caching at gateway level',
        'Consider async processing for heavy requests'
      ]
    },
    relatedConcepts: ['Load Balancer', 'Reverse Proxy', 'Service Mesh', 'Backend for Frontend (BFF)', 'Microservices'],
    commonPatterns: ['Microservices Gateway', 'API-first Design', 'Strangler Fig Pattern']
  },
  'database': {
    id: 'database',
    category: 'data',
    name: 'Database',
    icon: 'Database',
    overview: 'A database is a structured collection of data that provides persistent storage with capabilities for querying, updating, and managing data efficiently.',
    purpose: 'Provide persistent data storage and ensure ACID compliance for critical business data.',
    characteristics: [
      'Persistent storage',
      'ACID transactions',
      'Query language (SQL)',
      'Schema enforcement',
      'Data relationships',
      'Backup and recovery'
    ],
    whenToUse: [
      'Storing persistent business data',
      'Need for data relationships',
      'Requiring ACID transactions',
      'Complex queries and reporting',
      'Data integrity requirements'
    ],
    whenNotToUse: [
      'Simple key-value caching needs',
      'Highly ephemeral data',
      'Real-time analytics (use data warehouses)',
      'File storage (use object storage)'
    ],
    learningResources: [
      { type: 'documentation', title: 'PostgreSQL Documentation', url: 'https://www.postgresql.org/docs/', difficulty: 'beginner', estimatedTime: '1 hr' },
      { type: 'course', title: 'SQL Database Design', url: 'https://example.com/sql', difficulty: 'beginner', estimatedTime: '2 hr' },
      { type: 'documentation', title: 'Database Normalization Guide', url: 'https://example.com/normalization', difficulty: 'intermediate', estimatedTime: '30 min' }
    ],
    bestPractices: {
      dos: [
        'Use database migrations for schema changes',
        'Implement proper indexing strategies',
        'Regular backup testing',
        'Use connection pooling',
        'Enforce data validation at application layer too'
      ],
      donts: [
        'Store serialized JSON in text fields for querying',
        'Skip database backups',
        'Use root user for applications',
        'Neglect connection pool limits',
        'Skip database performance monitoring'
      ]
    },
    relatedConcepts: ['Data Warehouse', 'Cache', 'ORM', 'ACID', 'Database Replication'],
    commonPatterns: ['Database-per-Service', 'CQRS Pattern', 'Event Sourcing']
  },
  'cache': {
    id: 'cache',
    category: 'data',
    name: 'Cache',
    icon: 'Zap',
    overview: 'A cache is an in-memory or distributed store that provides fast data access by storing frequently accessed data closer to the consumer.',
    purpose: 'Reduce latency and improve performance by caching frequently accessed data.',
    characteristics: [
      'In-memory storage',
      'TTL/expiration support',
      'Key-value or distributed access',
      'Cache invalidation strategies',
      'High read throughput'
    ],
    whenToUse: [
      'Frequently accessed data',
      'Expensive computations',
      'Reducing database load',
      'Improving response times',
      'Session storage'
    ],
    whenNotToUse: [
      'Data that changes frequently',
      'Unique single-access data',
      'Large data objects',
      'Critical data requiring persistence'
    ],
    learningResources: [
      { type: 'documentation', title: 'Redis Documentation', url: 'https://redis.io/docs/', difficulty: 'beginner', estimatedTime: '1 hr' },
      { type: 'video', title: 'Caching Strategies', url: 'https://example.com/caching', difficulty: 'intermediate', estimatedTime: '20 min' }
    ],
    bestPractices: {
      dos: [
        'Implement cache invalidation strategies',
        'Use TTL for expiring data',
        'Prefer read-through caching',
        'Monitor cache hit rates',
        'Separate hot and cold data'
      ],
      donts: [
        'Cache critical data without backup',
        'Use cache as primary store',
        'Neglect cache size limits',
        'Cache sensitive data unencrypted'
      ]
    },
    relatedConcepts: ['Redis', 'Memcached', 'CDN', 'Cache Invalidation'],
    commonPatterns: ['Cache-Aside', 'Write-Through', 'Read-Through']
  },
  'user-service': {
    id: 'user-service',
    category: 'compute',
    name: 'User Service',
    icon: 'Users',
    overview: 'A User Service is a backend service responsible for managing user accounts, authentication, and authorization.',
    purpose: 'Handle user lifecycle, authentication flows, and access control.',
    characteristics: [
      'User authentication (login/logout)',
      'User registration and management',
      'JWT/Token management',
      'Password hashing and reset',
      'Role-based access control'
    ],
    whenToUse: [
      'Applications with user accounts',
      'Implementing authentication',
      'Managing user permissions',
      'Multi-tenant applications'
    ],
    whenNotToUse: [
      'Public read-only content',
      'No authentication needed',
      'Single-user applications'
    ],
    learningResources: [
      { type: 'documentation', title: 'JWT Handbook', url: 'https://jwt.io/introduction', difficulty: 'beginner', estimatedTime: '20 min' },
      { type: 'article', title: 'Authentication Best Practices', url: 'https://example.com/auth', difficulty: 'intermediate', estimatedTime: '15 min' }
    ],
    bestPractices: {
      dos: [
        'Use strong password hashing (bcrypt/argon2)',
        'Implement JWT with short expiration',
        'Store tokens securely (httpOnly cookies)',
        'Use HTTPS exclusively',
        'Implement account lockout policies'
      ],
      donts: [
        'Store passwords in plain text',
        'Use weak hashing algorithms (MD5/SHA1)',
        'Put tokens in localStorage for sensitive apps',
        'Skip HTTPS in production'
      ]
    },
    relatedConcepts: ['OAuth', 'JWT', 'Session Management', 'MFA'],
    commonPatterns: ['Authentication Service', 'RBAC', 'JWT Refresh Token']
  },
  'frontend': {
    id: 'frontend',
    category: 'client',
    name: 'Frontend Client',
    icon: 'Layout',
    overview: 'A frontend client is the user-facing interface that consumes the API and renders the application for end users.',
    purpose: 'Present the application to users and handle user interactions.',
    characteristics: [
      'UI rendering and state management',
      'API consumption',
      'User interaction handling',
      'Responsive design',
      'Client-side routing'
    ],
    whenToUse: [
      'Any interactive application',
      'Web or mobile interfaces',
      'User-facing applications'
    ],
    whenNotToUse: [
      'Backend-only services',
      'API-only systems',
      'Batch processing applications'
    ],
    learningResources: [
      { type: 'documentation', title: 'React Documentation', url: 'https://react.dev', difficulty: 'beginner', estimatedTime: '2 hr' },
      { type: 'course', title: 'Modern React Patterns', url: 'https://example.com/react', difficulty: 'intermediate', estimatedTime: '4 hr' }
    ],
    bestPractices: {
      dos: [
        'Implement proper error handling',
        'Use TypeScript for type safety',
        'Optimize bundle size',
        'Implement lazy loading',
        'Use proper state management'
      ],
      donts: [
        'Store sensitive data in client',
        'Skip accessibility testing',
        'Ignore performance budgets',
        'Use deprecated APIs'
      ]
    },
    relatedConcepts: ['React', 'SPA', 'PWA', 'Client-Side Rendering'],
    commonPatterns: ['Single Page Application', 'Progressive Web App', 'BFF Pattern']
  },
  'message-queue': {
    id: 'message-queue',
    category: 'async',
    name: 'Message Queue',
    icon: 'MessageSquare',
    overview: 'A message queue is an asynchronous communication pattern that decouples producers from consumers using message-based communication.',
    purpose: 'Enable asynchronous communication between services and handle load spikes.',
    characteristics: [
      'Async message passing',
      'Publish/subscribe pattern',
      'Message persistence',
      'Consumer groups',
      'Dead letter queues'
    ],
    whenToUse: [
      'Microservices communication',
      'Handling background jobs',
      'Buffering traffic spikes',
      'Loose coupling between services',
      'Event-driven architectures'
    ],
    whenNotToUse: [
      'Synchronous requests required',
      'Simple direct calls sufficient',
      'Low latency requirements critical'
    ],
    learningResources: [
      { type: 'documentation', title: 'RabbitMQ Documentation', url: 'https://www.rabbitmq.com/docs/', difficulty: 'intermediate', estimatedTime: '1 hr' },
      { type: 'video', title: 'Message Queues Explained', url: 'https://example.com/mq', difficulty: 'beginner', estimatedTime: '15 min' }
    ],
    bestPractices: {
      dos: [
        'Implement dead letter queues for failed messages',
        'Use message idempotency',
        'Monitor queue depths',
        'Set appropriate TTL values',
        'Implement retry with backoff'
      ],
      donts: [
        'Put large payloads in messages',
        'Skip message acknowledgment',
        'Neglect ordering requirements',
        'Use sync calls when not needed'
      ]
    },
    relatedConcepts: ['RabbitMQ', 'Kafka', 'Event Bus', 'Pub/Sub'],
    commonPatterns: ['Event-Driven Architecture', 'CQRS', 'Saga Pattern']
  }
};

export function getComponentKnowledge(category: string): ComponentKnowledge | undefined {
  return componentKnowledgeBase[category];
}

export function getRelatedExplanation(nodeName: string, category: string, upstreamNodes: string[], downstreamNodes: string[]): string {
  const knowledge = componentKnowledgeBase[category];
  if (!knowledge) return `A ${category} component in your architecture.`;
  
  const upstream = upstreamNodes.length > 0 ? `Receives requests from ${upstreamNodes.join(', ')}` : 'Receives requests from clients';
  const downstream = downstreamNodes.length > 0 ? `Routes to ${downstreamNodes.join(', ')}` : 'Routes to backend services';
  
  return `In your architecture, this ${knowledge.name} serves as ${upstream} and ${downstream}. It exists in this architecture to: ${knowledge.purpose}`;
}