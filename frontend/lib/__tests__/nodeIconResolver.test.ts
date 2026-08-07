import { describe, expect, it } from 'vitest';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { normalizeArchIconName } from '@/lib/iconAliases';

describe('normalizeArchIconName', () => {
  it('maps lucide names to distinctive arch icons', () => {
    expect(normalizeArchIconName('RadioTower')).toBe('arch-cdn');
    expect(normalizeArchIconName('Search')).toBe('arch-search');
    expect(normalizeArchIconName('Zap')).toBe('arch-function');
    expect(normalizeArchIconName('Network')).toBe('arch-dns');
  });

  it('preserves explicit arch and aws icons', () => {
    expect(normalizeArchIconName('arch-vector')).toBe('arch-vector');
    expect(normalizeArchIconName('aws-lambda')).toBe('aws-lambda');
  });
});

describe('resolveNodeIcon', () => {
  it('uses unique icons for common palette components', () => {
    expect(resolveNodeIcon({ typeId: 'dns' }).icon).toBe('arch-dns');
    expect(resolveNodeIcon({ typeId: 'cdn' }).icon).toBe('arch-cdn');
    expect(resolveNodeIcon({ typeId: 'search_engine' }).icon).toBe('arch-search');
    expect(resolveNodeIcon({ typeId: 'serverless_fn' }).icon).toBe('arch-function');
    expect(resolveNodeIcon({ typeId: 'worker_job' }).icon).toBe('arch-worker');
    expect(resolveNodeIcon({ typeId: 'vector_db' }).icon).toBe('arch-vector');
    expect(resolveNodeIcon({ typeId: 'firewall_waf' }).icon).toBe('arch-firewall');
    expect(resolveNodeIcon({ typeId: 'payment_gateway' }).icon).toBe('arch-payment');
    expect(resolveNodeIcon({ typeId: 'email_service' }).icon).toBe('arch-email');
    expect(resolveNodeIcon({ typeId: 'nosql_db' }).icon).toBe('arch-document-db');
    expect(resolveNodeIcon({ typeId: 'cicd_pipeline' }).icon).toBe('arch-cicd');
    expect(resolveNodeIcon({ typeId: 'ai_agent' }).icon).toBe('arch-agent');
  });

  it('maps labels to distinctive icons', () => {
    expect(resolveNodeIcon({ label: 'Elasticsearch' }).icon).toBe('arch-search');
    expect(resolveNodeIcon({ label: 'CDN Edge' }).icon).toBe('arch-cdn');
    expect(resolveNodeIcon({ label: 'Vector Store' }).icon).toBe('arch-vector');
    expect(resolveNodeIcon({ label: 'Lambda Function' }).icon).toBe('aws-lambda');
    expect(resolveNodeIcon({ label: 'EC2 Instance' }).icon).toBe('aws-ec2');
    expect(resolveNodeIcon({ label: 'WAF Firewall' }).icon).toBe('arch-firewall');
  });

  it('prefers component mapping over lucide palette icons', () => {
    expect(resolveNodeIcon({ typeId: 'cdn', icon: 'Globe' }).icon).toBe('arch-cdn');
    expect(resolveNodeIcon({ componentType: 'function', icon: 'Server' }).icon).toBe('arch-function');
  });

  it('uses technology-specific icons from the registry', () => {
    expect(resolveNodeIcon({ technology: 'mongodb' }).icon).toBe('arch-document-db');
    expect(resolveNodeIcon({ technology: 'pinecone' }).icon).toBe('arch-vector');
    expect(resolveNodeIcon({ technology: 'kubernetes' }).icon).toBe('arch-kubernetes');
    expect(resolveNodeIcon({ technology: 'elasticsearch' }).icon).toBe('arch-search');
  });
});
