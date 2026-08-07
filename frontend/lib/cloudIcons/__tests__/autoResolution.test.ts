import { describe, it, expect } from 'vitest';
import { resolveAutoCloudIcon } from '@/lib/cloudIcons/autoResolution';
import { CLOUD_BRAND_COLORS } from '@/lib/cloudIcons/dictionaries';

describe('resolveAutoCloudIcon', () => {
  it('shows AWS EC2 icon for EC2 label without a toggle', () => {
    expect(resolveAutoCloudIcon({ label: 'EC2' })).toEqual({
      kind: 'aws',
      serviceKey: 'aws-ec2',
      color: CLOUD_BRAND_COLORS.aws,
    });
  });

  it('shows AWS icon for palette componentId', () => {
    expect(
      resolveAutoCloudIcon({
        label: 'Web Server',
        componentId: 'aws-lambda',
        technology: 'aws-lambda',
      }),
    ).toEqual({
      kind: 'aws',
      serviceKey: 'aws-lambda',
      color: CLOUD_BRAND_COLORS.aws,
    });
  });

  it('shows Azure icon for Cosmos DB label', () => {
    expect(resolveAutoCloudIcon({ label: 'Cosmos DB' })).toEqual({
      kind: 'azure',
      serviceKey: 'azure-cosmosdb',
      color: CLOUD_BRAND_COLORS.azure,
    });
  });

  it('keeps generic service nodes on default icons', () => {
    expect(resolveAutoCloudIcon({ label: 'Orders Service' })).toBeNull();
    expect(resolveAutoCloudIcon({ label: 'Web Client', serviceType: 'client' })).toBeNull();
  });

  it('resolves ambiguous matchedBoth labels with provider hints', () => {
    expect(resolveAutoCloudIcon({ label: 'AWS Database' })).toEqual(
      expect.objectContaining({ kind: 'aws', serviceKey: 'aws-rds' }),
    );
    expect(resolveAutoCloudIcon({ label: 'Azure Database' })).toEqual(
      expect.objectContaining({ kind: 'azure', serviceKey: 'azure-sql' }),
    );
    expect(resolveAutoCloudIcon({ label: 'Database' })).toBeNull();
  });
});
