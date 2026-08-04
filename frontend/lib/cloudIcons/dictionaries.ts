/**
 * Cloud service dictionaries — one canonical `serviceKey → label` mapping per
 * provider (Rule 6.1). Each entry carries:
 * - `name` — canonical display name (exact-match target)
 * - `aliases` — alternate exact names
 * - `keywords` — a short, conservative, service-distinctive keyword list.
 *
 * Keywords must NOT be generic ("database", "api", "monitor" alone are not
 * enough) — only terms distinctive of a specific cloud service, so ambiguous
 * labels fall back to `genericComponent` instead of a wrong icon.
 *
 * The icon key IS the `serviceKey` (e.g. `aws-lambda`, `azure-functions`);
 * the render layer resolves `serviceKey → SVG path` via the lazy icon sets.
 */

import type { CloudProviderId } from './types';

export interface CloudServiceEntry {
  key: string;
  name: string;
  aliases: string[];
  keywords: string[];
}

export const AWS_CLOUD_SERVICES: CloudServiceEntry[] = [
  { key: 'aws-lambda', name: 'Lambda', aliases: ['AWS Lambda'], keywords: ['lambda', 'serverless function'] },
  { key: 'aws-ec2', name: 'EC2', aliases: ['Amazon EC2'], keywords: ['ec2'] },
  { key: 'aws-ecs', name: 'ECS', aliases: ['Amazon ECS'], keywords: ['ecs'] },
  { key: 'aws-eks', name: 'EKS', aliases: ['Amazon EKS'], keywords: ['eks'] },
  { key: 'aws-s3', name: 'S3', aliases: ['Amazon S3', 'Simple Storage Service', 'Object Storage', 'S3 Storage'], keywords: ['s3 bucket', 's3', 'object storage'] },
  { key: 'aws-rds', name: 'RDS', aliases: ['Amazon RDS', 'Relational Database Service'], keywords: ['rds', 'relational database service', 'sql database', 'postgres', 'postgresql', 'mysql', 'database'] },
  { key: 'aws-dynamodb', name: 'DynamoDB', aliases: ['Amazon DynamoDB'], keywords: ['dynamodb', 'dynamo db', 'nosql database', 'document database'] },
  { key: 'aws-elasticache', name: 'ElastiCache', aliases: ['Amazon ElastiCache'], keywords: ['elasticache', 'redis cache', 'redis', 'in-memory cache', 'cache'] },
  { key: 'aws-api-gateway', name: 'API Gateway', aliases: ['Amazon API Gateway'], keywords: ['api gateway'] },
  { key: 'aws-cloudfront', name: 'CloudFront', aliases: ['Amazon CloudFront'], keywords: ['cloudfront', 'cdn', 'content delivery network'] },
  { key: 'aws-alb', name: 'ALB', aliases: ['Application Load Balancer', 'AWS ALB'], keywords: ['application load balancer', 'alb', 'load balancer'] },
  { key: 'aws-sqs', name: 'SQS', aliases: ['Amazon SQS', 'Simple Queue Service'], keywords: ['sqs', 'message queue', 'queue'] },
  { key: 'aws-sns', name: 'SNS', aliases: ['Amazon SNS', 'Simple Notification Service'], keywords: ['sns', 'notification', 'push notification'] },
  { key: 'aws-eventbridge', name: 'EventBridge', aliases: ['Amazon EventBridge'], keywords: ['eventbridge', 'event bus'] },
  { key: 'aws-cognito', name: 'Cognito', aliases: ['Amazon Cognito'], keywords: ['cognito', 'identity provider', 'identity', 'authentication', 'auth service', 'user pool'] },
  { key: 'aws-secrets-manager', name: 'Secrets Manager', aliases: ['AWS Secrets Manager'], keywords: ['secrets manager', 'secret'] },
  { key: 'aws-cloudwatch', name: 'CloudWatch', aliases: ['Amazon CloudWatch'], keywords: ['cloudwatch', 'metrics', 'monitoring', 'logger', 'observability'] },
  { key: 'aws-kinesis', name: 'Kinesis', aliases: ['Amazon Kinesis', 'Kinesis Data Streams'], keywords: ['kinesis', 'data stream', 'stream processor', 'real-time processing', 'real time processing'] },
  { key: 'aws-redshift', name: 'Redshift', aliases: ['Amazon Redshift'], keywords: ['redshift', 'data warehouse', 'warehouse'] },
  { key: 'aws-msk', name: 'MSK', aliases: ['Amazon MSK', 'Managed Streaming for Apache Kafka'], keywords: ['kafka', 'msk'] },
  { key: 'aws-batch', name: 'AWS Batch', aliases: ['Batch'], keywords: ['batch', 'batch processing', 'batch job'] },
  { key: 'aws-opensearch', name: 'OpenSearch', aliases: ['Amazon OpenSearch', 'OpenSearch Service', 'Elasticsearch'], keywords: ['opensearch', 'elasticsearch', 'search engine', 'search service'] },
];

export const AZURE_CLOUD_SERVICES: CloudServiceEntry[] = [
  { key: 'azure-functions', name: 'Azure Functions', aliases: ['Function App'], keywords: ['function app', 'serverless function'] },
  { key: 'azure-vm', name: 'VM', aliases: ['Virtual Machine', 'Azure VM', 'Azure Virtual Machines'], keywords: ['virtual machine', 'azure vm'] },
  { key: 'azure-aks', name: 'AKS', aliases: ['Azure Kubernetes Service'], keywords: ['aks'] },
  { key: 'azure-appservice', name: 'App Service', aliases: ['Azure App Service'], keywords: ['app service'] },
  { key: 'azure-storage', name: 'Blob Storage', aliases: ['Azure Storage', 'Azure Blob Storage', 'Object Storage'], keywords: ['blob storage', 'blob', 'storage account', 'object storage'] },
  { key: 'azure-sql', name: 'SQL Database', aliases: ['Azure SQL', 'Azure SQL Database'], keywords: ['sql database', 'azure sql', 'sql server', 'database'] },
  { key: 'azure-cosmosdb', name: 'Cosmos DB', aliases: ['Azure Cosmos DB', 'CosmosDB'], keywords: ['cosmosdb', 'cosmos db', 'nosql database', 'document database'] },
  { key: 'azure-redis', name: 'Cache for Redis', aliases: ['Azure Cache for Redis', 'Azure Redis'], keywords: ['redis cache', 'redis', 'in-memory cache', 'cache'] },
  { key: 'azure-api-management', name: 'API Management', aliases: ['Azure API Management'], keywords: ['api management', 'api gateway'] },
  { key: 'azure-cdn', name: 'CDN', aliases: ['Azure CDN'], keywords: ['cdn', 'content delivery network'] },
  { key: 'azure-lb', name: 'Load Balancer', aliases: ['Azure Load Balancer'], keywords: ['load balancer'] },
  { key: 'azure-servicebus', name: 'Service Bus', aliases: ['Azure Service Bus'], keywords: ['service bus', 'message queue', 'queue'] },
  { key: 'azure-eventhub', name: 'Event Hubs', aliases: ['Azure Event Hubs'], keywords: ['event hub', 'event hubs', 'kafka'] },
  { key: 'azure-event-grid', name: 'Event Grid', aliases: ['Azure Event Grid'], keywords: ['event grid'] },
  { key: 'azure-ad', name: 'Entra ID', aliases: ['Azure AD', 'Azure Active Directory', 'Microsoft Entra ID'], keywords: ['entra id', 'azure ad', 'active directory', 'identity provider', 'identity', 'authentication', 'auth service', 'oauth'] },
  { key: 'azure-keyvault', name: 'Key Vault', aliases: ['Azure Key Vault'], keywords: ['key vault', 'secret'] },
  { key: 'azure-monitor', name: 'Azure Monitor', aliases: ['Microsoft Azure Monitor'], keywords: ['azure monitor', 'app insights', 'metrics', 'monitoring', 'logger', 'observability'] },
  { key: 'azure-stream-analytics', name: 'Stream Analytics', aliases: ['Azure Stream Analytics'], keywords: ['stream analytics', 'stream processor', 'real-time processing', 'real time processing'] },
  { key: 'azure-synapse', name: 'Synapse', aliases: ['Azure Synapse', 'Synapse Analytics'], keywords: ['synapse', 'data warehouse', 'warehouse'] },
  { key: 'azure-batch', name: 'Azure Batch', aliases: ['Batch'], keywords: ['batch', 'batch processing', 'batch job'] },
  { key: 'azure-ai-search', name: 'AI Search', aliases: ['Azure AI Search', 'Azure Cognitive Search'], keywords: ['ai search', 'cognitive search', 'search engine', 'search service'] },
  { key: 'azure-notification-hubs', name: 'Notification Hubs', aliases: ['Azure Notification Hubs'], keywords: ['push notification', 'notification hub', 'notification service'] },
];

/** Curated 1:1 AWS → Azure equivalence. The only route to `matchedBoth`. */
export const CLOUD_EQUIVALENCE: Record<string, string> = {
  'aws-lambda': 'azure-functions',
  'aws-ec2': 'azure-vm',
  'aws-eks': 'azure-aks',
  'aws-s3': 'azure-storage',
  'aws-rds': 'azure-sql',
  'aws-dynamodb': 'azure-cosmosdb',
  'aws-elasticache': 'azure-redis',
  'aws-api-gateway': 'azure-api-management',
  'aws-cloudfront': 'azure-cdn',
  'aws-alb': 'azure-lb',
  'aws-sqs': 'azure-servicebus',
  'aws-sns': 'azure-notification-hubs',
  'aws-eventbridge': 'azure-event-grid',
  'aws-cognito': 'azure-ad',
  'aws-secrets-manager': 'azure-keyvault',
  'aws-cloudwatch': 'azure-monitor',
  'aws-kinesis': 'azure-stream-analytics',
  'aws-redshift': 'azure-synapse',
  'aws-msk': 'azure-eventhub',
  'aws-batch': 'azure-batch',
  'aws-opensearch': 'azure-ai-search',
};

export const CLOUD_SERVICE_ENTRIES: Record<CloudProviderId, CloudServiceEntry[]> = {
  aws: AWS_CLOUD_SERVICES,
  azure: AZURE_CLOUD_SERVICES,
};

/** Official brand colors for provider icons (Rule 4.2). */
export const CLOUD_BRAND_COLORS: Record<CloudProviderId, string> = {
  aws: '#FF9900',
  azure: '#0078D4',
};

export const CLOUD_PROVIDER_IDS: CloudProviderId[] = ['aws', 'azure'];
