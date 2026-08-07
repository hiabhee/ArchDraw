/**
 * Icon registry — maps every component/technology id to an icon + brand color.
 * AWS entries use custom AWS icons, others use custom architecture icons.
 */

export type IconEntry = {
    kind: 'aws' | 'lucide' | 'custom';
    icon: string;
    color: string;
    description: string;
};

export const iconRegistry: Record<string, IconEntry> = {
    // ── AWS Compute ────────────────────────────────────────────────────────────
    'aws-ec2': { kind: 'aws', icon: 'aws-ec2', color: '#FF9900', description: 'Virtual servers in the cloud' },
    'aws-lambda': { kind: 'aws', icon: 'aws-lambda', color: '#FF9900', description: 'Run code without provisioning servers' },
    'aws-ecs': { kind: 'aws', icon: 'aws-ecs', color: '#FF9900', description: 'Run containerized applications' },
    'aws-eks': { kind: 'aws', icon: 'aws-eks', color: '#FF9900', description: 'Managed Kubernetes service' },
    'aws-fargate': { kind: 'aws', icon: 'aws-fargate', color: '#FF9900', description: 'Serverless compute for containers' },
    'aws-beanstalk': { kind: 'aws', icon: 'aws-beanstalk', color: '#FF9900', description: 'Deploy and scale web applications' },

    // ── AWS Storage ────────────────────────────────────────────────────────────
    'aws-s3': { kind: 'aws', icon: 'aws-s3', color: '#3F8624', description: 'Scalable object storage' },
    'aws-ebs': { kind: 'aws', icon: 'aws-ebs', color: '#3F8624', description: 'Block storage for EC2 instances' },
    'aws-efs': { kind: 'aws', icon: 'aws-efs', color: '#3F8624', description: 'Elastic file system for Linux workloads' },
    'aws-glacier': { kind: 'aws', icon: 'aws-glacier', color: '#3F8624', description: 'Low-cost archival storage' },

    // ── AWS Database ───────────────────────────────────────────────────────────
    'aws-rds': { kind: 'aws', icon: 'aws-rds', color: '#3B48CC', description: 'Managed relational database service' },
    'aws-dynamodb': { kind: 'aws', icon: 'aws-dynamodb', color: '#3B48CC', description: 'Serverless NoSQL key-value database' },
    'aws-elasticache': { kind: 'aws', icon: 'aws-elasticache', color: '#3B48CC', description: 'In-memory caching with Redis or Memcached' },
    'aws-aurora': { kind: 'aws', icon: 'aws-aurora', color: '#3B48CC', description: 'MySQL/PostgreSQL-compatible cloud database' },
    'aws-redshift': { kind: 'aws', icon: 'aws-redshift', color: '#3B48CC', description: 'Cloud data warehouse for analytics' },
    'aws-documentdb': { kind: 'aws', icon: 'aws-documentdb', color: '#3B48CC', description: 'MongoDB-compatible document database' },

    // ── AWS Networking ─────────────────────────────────────────────────────────
    'aws-api-gateway': { kind: 'aws', icon: 'aws-api-gateway', color: '#A020F0', description: 'Create, publish, and secure APIs at scale' },
    'aws-cloudfront': { kind: 'aws', icon: 'aws-cloudfront', color: '#A020F0', description: 'Global CDN and content delivery' },
    'aws-route53': { kind: 'aws', icon: 'aws-route53', color: '#A020F0', description: 'Scalable DNS and domain registration' },
    'aws-vpc': { kind: 'aws', icon: 'aws-vpc', color: '#A020F0', description: 'Isolated virtual network in AWS' },
    'aws-elb': { kind: 'aws', icon: 'aws-elb', color: '#A020F0', description: 'Classic load balancer for EC2' },
    'aws-alb': { kind: 'aws', icon: 'aws-alb', color: '#A020F0', description: 'Application load balancer (Layer 7)' },

    // ── AWS Messaging ──────────────────────────────────────────────────────────
    'aws-sqs': { kind: 'aws', icon: 'aws-sqs', color: '#FF9900', description: 'Fully managed message queuing service' },
    'aws-sns': { kind: 'aws', icon: 'aws-sns', color: '#FF9900', description: 'Pub/sub messaging and mobile notifications' },
    'aws-eventbridge': { kind: 'aws', icon: 'aws-eventbridge', color: '#FF9900', description: 'Serverless event bus for SaaS and AWS services' },
    'aws-kinesis': { kind: 'aws', icon: 'aws-kinesis', color: '#FF9900', description: 'Real-time data streaming at scale' },

    // ── AWS Auth & Security ────────────────────────────────────────────────────
    'aws-cognito': { kind: 'aws', icon: 'aws-cognito', color: '#DD344C', description: 'User sign-up, sign-in, and access control' },
    'aws-iam': { kind: 'aws', icon: 'aws-iam', color: '#DD344C', description: 'Manage access to AWS services and resources' },
    'aws-secrets-manager': { kind: 'aws', icon: 'aws-secrets-manager', color: '#DD344C', description: 'Rotate, manage, and retrieve secrets' },
    'aws-waf': { kind: 'aws', icon: 'aws-waf', color: '#DD344C', description: 'Web application firewall' },
    'aws-shield': { kind: 'aws', icon: 'aws-shield', color: '#DD344C', description: 'DDoS protection for AWS resources' },

    // ── AWS Observability ──────────────────────────────────────────────────────
    'aws-cloudwatch': { kind: 'aws', icon: 'aws-cloudwatch', color: '#E7157B', description: 'Monitor AWS resources and applications' },
    'aws-xray': { kind: 'aws', icon: 'aws-xray', color: '#E7157B', description: 'Distributed tracing for AWS applications' },
    'aws-cloudtrail': { kind: 'aws', icon: 'aws-cloudtrail', color: '#E7157B', description: 'Audit log of all AWS API calls' },

    // ── AWS DevOps ─────────────────────────────────────────────────────────────
    'aws-codepipeline': { kind: 'aws', icon: 'aws-codepipeline', color: '#3F8624', description: 'Continuous delivery pipeline service' },
    'aws-codebuild': { kind: 'aws', icon: 'aws-codebuild', color: '#3F8624', description: 'Fully managed build service' },
    'aws-ecr': { kind: 'aws', icon: 'aws-ecr', color: '#3F8624', description: 'Docker container image registry' },
    'aws-cloudformation': { kind: 'aws', icon: 'aws-cloudformation', color: '#3F8624', description: 'Infrastructure as code for AWS' },

    // ── Databases ──────────────────────────────────────────────────────────────
    'mongodb': { kind: 'custom', icon: 'arch-document-db', color: '#47A248', description: 'Document-oriented NoSQL database' },
    'postgresql': { kind: 'custom', icon: 'arch-database', color: '#336791', description: 'Advanced open-source relational database' },
    'mysql': { kind: 'custom', icon: 'arch-database', color: '#4479A1', description: "World's most popular open-source database" },
    'sqlite': { kind: 'custom', icon: 'arch-database', color: '#003B57', description: 'Lightweight embedded relational database' },
    'redis': { kind: 'custom', icon: 'arch-cache', color: '#DC382D', description: 'In-memory data structure store and cache' },
    'cassandra': { kind: 'custom', icon: 'arch-key-value', color: '#1287B1', description: 'Distributed wide-column NoSQL database' },
    'cockroachdb': { kind: 'custom', icon: 'arch-database', color: '#6933FF', description: 'Distributed SQL database for global apps' },
    'supabase': { kind: 'custom', icon: 'arch-database', color: '#3ECF8E', description: 'Open-source Firebase alternative with Postgres' },
    'planetscale': { kind: 'custom', icon: 'arch-database', color: '#000000', description: 'Serverless MySQL platform with branching' },
    'fauna': { kind: 'custom', icon: 'arch-document-db', color: '#3A1AB6', description: 'Distributed document-relational database' },
    'firestore': { kind: 'custom', icon: 'arch-document-db', color: '#FFCA28', description: 'Flexible, scalable NoSQL cloud database' },

    // ── ORMs & Query Tools ─────────────────────────────────────────────────────
    'prisma': { kind: 'custom', icon: 'arch-database', color: '#2D3748', description: 'Next-generation ORM for Node.js and TypeScript' },
    'drizzle': { kind: 'custom', icon: 'arch-database', color: '#C5F74F', description: 'Lightweight TypeScript ORM with SQL-like syntax' },
    'typeorm': { kind: 'custom', icon: 'arch-database', color: '#E83524', description: 'ORM for TypeScript and JavaScript' },
    'sequelize': { kind: 'custom', icon: 'arch-database', color: '#52B0E7', description: 'Promise-based Node.js ORM for SQL databases' },

    // ── Auth ───────────────────────────────────────────────────────────────────
    'auth0': { kind: 'custom', icon: 'arch-auth', color: '#EB5424', description: 'Identity platform for app builders' },
    'clerk': { kind: 'custom', icon: 'arch-users', color: '#6C47FF', description: 'Complete user management and authentication' },
    'nextauth': { kind: 'custom', icon: 'arch-auth', color: '#000000', description: 'Authentication for Next.js applications' },
    'firebase-auth': { kind: 'custom', icon: 'arch-auth', color: '#FFCA28', description: "Google's authentication service" },
    'supabase-auth': { kind: 'custom', icon: 'arch-auth', color: '#3ECF8E', description: 'Row-level security and JWT auth via Supabase' },

    // ── Search ─────────────────────────────────────────────────────────────────
    'elasticsearch': { kind: 'custom', icon: 'arch-search', color: '#FEC514', description: 'Distributed search and analytics engine' },
    'algolia': { kind: 'custom', icon: 'arch-search', color: '#003DFF', description: 'Hosted search API for fast results' },
    'typesense': { kind: 'custom', icon: 'arch-search', color: '#E1341E', description: 'Open-source typo-tolerant search engine' },
    'meilisearch': { kind: 'custom', icon: 'arch-search', color: '#FF5CAA', description: 'Lightning-fast open-source search engine' },

    // ── Messaging ──────────────────────────────────────────────────────────────
    'kafka': { kind: 'custom', icon: 'arch-event-stream', color: '#231F20', description: 'Distributed event streaming platform' },
    'rabbitmq': { kind: 'custom', icon: 'arch-message-queue', color: '#FF6600', description: 'Open-source message broker' },
    'upstash': { kind: 'custom', icon: 'arch-cache', color: '#00E9A3', description: 'Serverless Redis and Kafka for the edge' },

    // ── Monitoring ─────────────────────────────────────────────────────────────
    'datadog': { kind: 'custom', icon: 'arch-observability', color: '#632CA6', description: 'Cloud monitoring and security platform' },
    'sentry': { kind: 'custom', icon: 'arch-logs', color: '#362D59', description: 'Application error tracking and performance' },
    'newrelic': { kind: 'custom', icon: 'arch-metrics', color: '#1CE783', description: 'Full-stack observability platform' },
    'grafana': { kind: 'custom', icon: 'arch-metrics', color: '#F46800', description: 'Open-source analytics and monitoring' },
    'prometheus': { kind: 'custom', icon: 'arch-metrics', color: '#E6522C', description: 'Open-source metrics and alerting toolkit' },

    // ── AI ─────────────────────────────────────────────────────────────────────
    'openai': { kind: 'custom', icon: 'arch-ai', color: '#412991', description: 'GPT models and AI APIs' },
    'anthropic': { kind: 'custom', icon: 'arch-ai', color: '#D4A27F', description: 'Claude AI models for safe, helpful AI' },
    'pinecone': { kind: 'custom', icon: 'arch-vector', color: '#1C17FF', description: 'Vector database for ML applications' },
    'weaviate': { kind: 'custom', icon: 'arch-vector', color: '#FA0050', description: 'Open-source vector search engine' },
    'langchain': { kind: 'custom', icon: 'arch-agent', color: '#1C3C3C', description: 'Framework for LLM-powered applications' },
    'huggingface': { kind: 'custom', icon: 'arch-ai', color: '#FFD21E', description: 'Open-source ML models and datasets' },

    // ── DevOps ─────────────────────────────────────────────────────────────────
    'docker': { kind: 'custom', icon: 'arch-docker', color: '#2496ED', description: 'Build, ship, and run containerized apps' },
    'kubernetes': { kind: 'custom', icon: 'arch-kubernetes', color: '#326CE5', description: 'Container orchestration at scale' },
    'vercel': { kind: 'custom', icon: 'arch-web', color: '#000000', description: 'Frontend cloud for web deployment' },
    'railway': { kind: 'custom', icon: 'arch-server', color: '#0B0D0E', description: 'Infrastructure platform for any language' },
    'render': { kind: 'custom', icon: 'arch-server', color: '#46E3B7', description: 'Unified cloud for apps and databases' },
    'flyio': { kind: 'custom', icon: 'arch-cdn', color: '#7B3FE4', description: 'Run full-stack apps close to users' },
    'github-actions': { kind: 'custom', icon: 'arch-cicd', color: '#2088FF', description: 'CI/CD automation built into GitHub' },

    // ── Azure Compute ─────────────────────────────────────────────────────────────
    'azure-vm': { kind: 'custom', icon: 'arch-server', color: '#0078D4', description: 'Azure Virtual Machines' },
    'azure-functions': { kind: 'custom', icon: 'arch-function', color: '#0078D4', description: 'Azure Functions serverless compute' },
    'azure-appservice': { kind: 'custom', icon: 'arch-web', color: '#0078D4', description: 'Azure App Service web hosting' },
    'azure-aks': { kind: 'custom', icon: 'arch-kubernetes', color: '#0078D4', description: 'Azure Kubernetes Service' },
    'azure-container-instance': { kind: 'custom', icon: 'arch-docker', color: '#0078D4', description: 'Azure Container Instances' },

    // ── Azure Storage & Databases ────────────────────────────────────────────────
    'azure-storage': { kind: 'custom', icon: 'arch-storage', color: '#0078D4', description: 'Azure Blob Storage' },
    'azure-sql': { kind: 'custom', icon: 'arch-database', color: '#0078D4', description: 'Azure SQL Database' },
    'azure-cosmosdb': { kind: 'custom', icon: 'arch-document-db', color: '#0078D4', description: 'Azure Cosmos DB NoSQL database' },
    'azure-redis': { kind: 'custom', icon: 'arch-cache', color: '#0078D4', description: 'Azure Cache for Redis' },

    // ── Azure Networking ──────────────────────────────────────────────────────────
    'azure-api-management': { kind: 'custom', icon: 'arch-api-gateway', color: '#0078D4', description: 'Azure API Management' },
    'azure-cdn': { kind: 'custom', icon: 'arch-cdn', color: '#0078D4', description: 'Azure Content Delivery Network' },
    'azure-vnet': { kind: 'custom', icon: 'arch-dns', color: '#0078D4', description: 'Azure Virtual Network' },
    'azure-lb': { kind: 'custom', icon: 'arch-load-balancer', color: '#0078D4', description: 'Azure Load Balancer' },
    'azure-app-gateway': { kind: 'custom', icon: 'arch-proxy', color: '#0078D4', description: 'Azure Application Gateway' },

    // ── Azure Messaging ────────────────────────────────────────────────────────────
    'azure-servicebus': { kind: 'custom', icon: 'arch-message-queue', color: '#0078D4', description: 'Azure Service Bus messaging' },
    'azure-eventhub': { kind: 'custom', icon: 'arch-event-stream', color: '#0078D4', description: 'Azure Event Hubs' },
    'azure-event-grid': { kind: 'custom', icon: 'arch-webhook', color: '#0078D4', description: 'Azure Event Grid' },

    // ── Azure Security ─────────────────────────────────────────────────────────────
    'azure-ad': { kind: 'custom', icon: 'arch-users', color: '#0078D4', description: 'Azure Active Directory' },
    'azure-keyvault': { kind: 'custom', icon: 'arch-secrets', color: '#0078D4', description: 'Azure Key Vault secrets management' },

    // ── Azure Observability ───────────────────────────────────────────────────────
    'azure-monitor': { kind: 'custom', icon: 'arch-observability', color: '#0078D4', description: 'Azure Monitor' },
    'azure-application-insights': { kind: 'custom', icon: 'arch-trace', color: '#0078D4', description: 'Azure Application Insights' },

    // ── GCP Compute ────────────────────────────────────────────────────────────────
    'gcp-compute-engine': { kind: 'custom', icon: 'arch-server', color: '#4285F4', description: 'GCP Compute Engine VMs' },
    'gcp-cloud-functions': { kind: 'custom', icon: 'arch-function', color: '#4285F4', description: 'GCP Cloud Functions' },
    'gcp-run': { kind: 'custom', icon: 'arch-docker', color: '#4285F4', description: 'GCP Cloud Run serverless containers' },
    'gcp-gke': { kind: 'custom', icon: 'arch-kubernetes', color: '#4285F4', description: 'GCP Kubernetes Engine' },

    // ── GCP Storage & Databases ───────────────────────────────────────────────────
    'gcp-storage': { kind: 'custom', icon: 'arch-storage', color: '#4285F4', description: 'GCP Cloud Storage' },
    'gcp-sql': { kind: 'custom', icon: 'arch-database', color: '#4285F4', description: 'GCP Cloud SQL' },
    'gcp-firestore': { kind: 'custom', icon: 'arch-document-db', color: '#4285F4', description: 'GCP Firestore NoSQL database' },
    'gcp-bigtable': { kind: 'custom', icon: 'arch-key-value', color: '#4285F4', description: 'GCP Bigtable wide-column database' },
    'gcp-spanner': { kind: 'custom', icon: 'arch-database', color: '#4285F4', description: 'GCP Cloud Spanner global SQL database' },

    // ── GCP Networking ─────────────────────────────────────────────────────────────
    'gcp-api-gateway': { kind: 'custom', icon: 'arch-api-gateway', color: '#4285F4', description: 'GCP API Gateway' },
    'gcp-cloud-cdn': { kind: 'custom', icon: 'arch-cdn', color: '#4285F4', description: 'GCP Cloud CDN' },
    'gcp-vpc': { kind: 'custom', icon: 'arch-dns', color: '#4285F4', description: 'GCP Virtual Private Cloud' },
    'gcp-lb': { kind: 'custom', icon: 'arch-load-balancer', color: '#4285F4', description: 'GCP Cloud Load Balancing' },

    // ── Generic Service Types ──────────────────────────────────────────────────────
    'generic-api': { kind: 'custom', icon: 'arch-api-gateway', color: '#6B7280', description: 'Generic API service' },
    'generic-database': { kind: 'custom', icon: 'arch-database', color: '#6B7280', description: 'Generic database service' },
    'generic-storage': { kind: 'custom', icon: 'arch-storage', color: '#6B7280', description: 'Generic storage service' },
    'generic-queue': { kind: 'custom', icon: 'arch-message-queue', color: '#6B7280', description: 'Generic message queue' },
    'generic-cache': { kind: 'custom', icon: 'arch-cache', color: '#6B7280', description: 'Generic cache service' },
    'generic-auth': { kind: 'custom', icon: 'arch-auth', color: '#6B7280', description: 'Generic authentication service' },
    'generic-search': { kind: 'custom', icon: 'arch-search', color: '#6B7280', description: 'Generic search service' },
    'generic-compute': { kind: 'custom', icon: 'arch-server', color: '#6B7280', description: 'Generic compute service' },
    'generic-container': { kind: 'custom', icon: 'arch-docker', color: '#6B7280', description: 'Generic container service' },
    'generic-server': { kind: 'custom', icon: 'arch-server', color: '#6B7280', description: 'Generic server/service' },
    'generic-client': { kind: 'custom', icon: 'arch-web', color: '#6B7280', description: 'Generic client/application' },
    'generic-cdn': { kind: 'custom', icon: 'arch-cdn', color: '#6B7280', description: 'Generic CDN service' },
    'generic-dns': { kind: 'custom', icon: 'arch-dns', color: '#6B7280', description: 'Generic DNS service' },
    'generic-monitoring': { kind: 'custom', icon: 'arch-metrics', color: '#6B7280', description: 'Generic monitoring service' },
    'generic-logging': { kind: 'custom', icon: 'arch-logs', color: '#6B7280', description: 'Generic logging service' },
};
