import { describe, it, expect } from 'vitest';
import { classifyCloudNode, normalizeCloudLabel, getNodeProviderAffinity } from '@/lib/cloudIcons/classifier';
import { resolveCloudIcon, GENERIC_CLOUD_COLOR } from '@/lib/cloudIcons/resolution';
import { CLOUD_SERVICE_ENTRIES, CLOUD_EQUIVALENCE, CLOUD_BRAND_COLORS } from '@/lib/cloudIcons/dictionaries';
import { AWS_ICON_PATHS } from '@/lib/cloudIcons/iconData/aws';
import { AZURE_ICON_PATHS } from '@/lib/cloudIcons/iconData/azure';

describe('icon set integrity', () => {
  it('every dictionary serviceKey has a lazy-loaded icon path', () => {
    for (const e of CLOUD_SERVICE_ENTRIES.aws) {
      expect(AWS_ICON_PATHS[e.key], `missing AWS icon path for ${e.key}`).toBeTruthy();
    }
    for (const e of CLOUD_SERVICE_ENTRIES.azure) {
      expect(AZURE_ICON_PATHS[e.key], `missing Azure icon path for ${e.key}`).toBeTruthy();
    }
  });

  it('equivalence maps each azure key at most once', () => {
    const seen = new Set<string>();
    for (const azureKey of Object.values(CLOUD_EQUIVALENCE)) {
      expect(seen.has(azureKey), `azure key ${azureKey} mapped twice`).toBe(false);
      seen.add(azureKey);
    }
  });
});

describe('normalizeCloudLabel', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalizeCloudLabel('  S3! Bucket,  ')).toBe('s3 bucket');
    expect(normalizeCloudLabel('API Gateway')).toBe('api gateway');
    expect(normalizeCloudLabel('Cosmos DB')).toBe('cosmos db');
    expect(normalizeCloudLabel(undefined)).toBe('');
  });
});

describe('classifyCloudNode — tier', () => {
  it('classifies explicit AWS/azure typeIds as cloudService even without a label match', () => {
    const cls = classifyCloudNode({ label: 'Orders Service', typeId: 'aws-lambda' });
    expect(cls.tier).toBe('cloudService');
    expect(cls.state).toBe('unmatched');
  });

  it('classifies non-cloud node types as nonCloud', () => {
    for (const typeId of ['groupNode', 'textLabelNode', 'annotationNode']) {
      expect(classifyCloudNode({ label: 'Anything', typeId }).tier).toBe('nonCloud');
    }
  });

  it('classifies client/docker serviceTypes as nonCloud', () => {
    expect(classifyCloudNode({ label: 'Web', serviceType: 'client' }).tier).toBe('nonCloud');
    expect(classifyCloudNode({ label: 'Container', serviceType: 'docker' }).tier).toBe('nonCloud');
  });

  it('classifies non-cloud labels as nonCloud', () => {
    for (const label of ['Web Client', 'Kubernetes', 'Docker Swarm', 'On-prem DB', 'Group']) {
      expect(classifyCloudNode({ label }).tier).toBe('nonCloud');
    }
  });

  it('classifies ambiguous labels as genericComponent (silence is safe)', () => {
    for (const label of ['My Service', 'API Server', 'Billing', 'Worker', 'Ingest']) {
      const cls = classifyCloudNode({ label });
      expect(cls.tier).toBe('genericComponent');
      expect(cls.state).toBe('unmatched');
    }
  });

  it('classifies common diagram labels as cloud services', () => {
    expect(classifyCloudNode({ label: 'Database' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'PostgreSQL' }).awsMatch).toBe('aws-rds');
    expect(classifyCloudNode({ label: 'Auth Service' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Cache' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Object Storage' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Kafka' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Data Warehouse' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Batch Processing' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Search Engine' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Notification Service' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'Real-time Processing' }).state).toBe('matchedBoth');
  });
});

describe('classifyCloudNode — provider matches', () => {
  it('matches exact canonical names', () => {
    expect(classifyCloudNode({ label: 'DynamoDB' }).state).toBe('matchedAWS');
    expect(classifyCloudNode({ label: 'Lambda' }).awsMatch).toBe('aws-lambda');
    expect(classifyCloudNode({ label: 'Cosmos DB' }).azureMatch).toBe('azure-cosmosdb');
    expect(classifyCloudNode({ label: 'Event Hubs' }).azureMatch).toBe('azure-eventhub');
  });

  it('matches aliases', () => {
    expect(classifyCloudNode({ label: 'Azure Cosmos DB' }).azureMatch).toBe('azure-cosmosdb');
    expect(classifyCloudNode({ label: 'Amazon S3' }).awsMatch).toBe('aws-s3');
    expect(classifyCloudNode({ label: 'Microsoft Entra ID' }).azureMatch).toBe('azure-ad');
  });

  it('matches conservative keywords with word-boundary tokens', () => {
    expect(classifyCloudNode({ label: 'S3 Bucket' }).awsMatch).toBe('aws-s3');
    expect(classifyCloudNode({ label: 'Redis Cache' }).state).toBe('matchedBoth');
    expect(classifyCloudNode({ label: 'API Gateway' }).awsMatch).toBe('aws-api-gateway');
    expect(classifyCloudNode({ label: 'App Service' }).azureMatch).toBe('azure-appservice');
  });

  it('does not partial-match keywords across tokens', () => {
    // "s3a" must not match keyword "s3"; only whole tokens match.
    expect(classifyCloudNode({ label: 's3a data' }).tier).toBe('genericComponent');
  });

  it('produces matchedBoth only for curated equivalence pairs', () => {
    const both = classifyCloudNode({ label: 'Load Balancer' });
    expect(both.state).toBe('matchedBoth');
    expect(both.awsMatch).toBe('aws-alb');
    expect(both.azureMatch).toBe('azure-lb');

    const queue = classifyCloudNode({ label: 'Queue' });
    expect(queue.state).toBe('matchedBoth');
    expect(queue.awsMatch).toBe('aws-sqs');
    expect(queue.azureMatch).toBe('azure-servicebus');
  });

  it('never infers a second provider from string similarity', () => {
    // "Lambda" is AWS-only even though its curated Azure counterpart exists.
    const lambda = classifyCloudNode({ label: 'Lambda' });
    expect(lambda.state).toBe('matchedAWS');
    expect(lambda.azureMatch).toBeNull();
  });
});

describe('getNodeProviderAffinity', () => {
  it('detects provider branding from typeId/technology/icon', () => {
    expect(getNodeProviderAffinity({ typeId: 'aws-s3' })).toBe('aws');
    expect(getNodeProviderAffinity({ technology: 'azure-functions' })).toBe('azure');
    expect(getNodeProviderAffinity({ icon: 'aws-lambda' })).toBe('aws');
    expect(getNodeProviderAffinity({ label: 'Lambda' })).toBeNull();
  });
});

describe('resolveCloudIcon — Rule 5.1 priority', () => {
  it('returns null when toggle is off (no visual regression)', () => {
    expect(resolveCloudIcon({ label: 'Lambda' }, 'off')).toBeNull();
    expect(resolveCloudIcon({ label: 'Anything' }, 'off')).toBeNull();
  });

  it('keeps default icon for nonCloud/genericComponent nodes', () => {
    for (const toggle of ['aws', 'azure'] as const) {
      expect(resolveCloudIcon({ label: 'Web Client' }, toggle)).toBeNull();
      expect(resolveCloudIcon({ label: 'My Service' }, toggle)).toBeNull();
      expect(resolveCloudIcon({ label: 'Billing' }, toggle)).toBeNull();
    }
  });

  it('shows provider icons for common labels on each provider', () => {
    expect(resolveCloudIcon({ label: 'Database' }, 'aws')).toEqual(
      expect.objectContaining({ kind: 'aws', serviceKey: 'aws-rds' })
    );
    expect(resolveCloudIcon({ label: 'Database' }, 'azure')).toEqual(
      expect.objectContaining({ kind: 'azure', serviceKey: 'azure-sql' })
    );
    expect(resolveCloudIcon({ label: 'Kafka' }, 'aws')).toEqual(
      expect.objectContaining({ kind: 'aws', serviceKey: 'aws-msk' })
    );
    expect(resolveCloudIcon({ label: 'Kafka' }, 'azure')).toEqual(
      expect.objectContaining({ kind: 'azure', serviceKey: 'azure-eventhub' })
    );
    expect(resolveCloudIcon({ label: 'Search Engine' }, 'azure')).toEqual(
      expect.objectContaining({ kind: 'azure', serviceKey: 'azure-ai-search' })
    );
  });

  it('shows provider icon for matched active provider', () => {
    expect(resolveCloudIcon({ label: 'DynamoDB' }, 'aws')).toEqual({
      kind: 'aws',
      serviceKey: 'aws-dynamodb',
      color: CLOUD_BRAND_COLORS.aws,
    });
    expect(resolveCloudIcon({ label: 'Cosmos DB' }, 'azure')).toEqual({
      kind: 'azure',
      serviceKey: 'azure-cosmosdb',
      color: CLOUD_BRAND_COLORS.azure,
    });
  });

  it('shows active-provider icon for matchedBoth', () => {
    expect(resolveCloudIcon({ label: 'Load Balancer' }, 'aws')).toEqual(
      expect.objectContaining({ kind: 'aws', serviceKey: 'aws-alb' })
    );
    expect(resolveCloudIcon({ label: 'Load Balancer' }, 'azure')).toEqual(
      expect.objectContaining({ kind: 'azure', serviceKey: 'azure-lb' })
    );
  });

  it('shows no provider icon when matched only the inactive provider', () => {
    expect(resolveCloudIcon({ label: 'DynamoDB' }, 'azure')).toBeNull();
    expect(resolveCloudIcon({ label: 'Cosmos DB' }, 'aws')).toBeNull();
  });

  it('shows a single vendor-neutral generic cloud icon for unmatched cloudService', () => {
    const v = resolveCloudIcon({ label: 'Orders Service', typeId: 'aws-lambda' }, 'azure');
    expect(v).toEqual({ kind: 'generic', color: GENERIC_CLOUD_COLOR });
  });

  it('keeps the existing icon for provider-branded nodes matching the active toggle', () => {
    expect(resolveCloudIcon({ label: 'Orders Service', typeId: 'aws-lambda' }, 'aws')).toBeNull();
    expect(resolveCloudIcon({ label: 'Ingest', technology: 'azure-functions' }, 'azure')).toBeNull();
  });

  it('never mixes AWS and Azure icons for the same node', () => {
    const aws = resolveCloudIcon({ label: 'Lambda' }, 'aws');
    const azure = resolveCloudIcon({ label: 'Lambda' }, 'azure');
    expect(aws).not.toBeNull();
    expect(aws!.kind).toBe('aws');
    expect(azure).toBeNull();
  });
});
