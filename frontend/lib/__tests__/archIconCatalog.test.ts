import { describe, expect, it } from 'vitest';
import { ARCH_ICON_IDS, CUSTOM_ICON_SET } from '@/lib/archIconCatalog';
import { AWS_TO_ARCH_ICON, toCanvasArchIcon } from '@/lib/iconAliases';
import { toCustomNodeIconName } from '@/components/icons/CustomNodeIcon';

describe('custom architecture icons', () => {
  it('maps every catalog id to a canvas glyph', () => {
    for (const id of ARCH_ICON_IDS) {
      expect(toCustomNodeIconName(id)).toBe(id);
    }
  });

  it('maps AWS service keys onto catalog glyphs', () => {
    for (const [aws, arch] of Object.entries(AWS_TO_ARCH_ICON)) {
      expect(CUSTOM_ICON_SET.has(arch), `${aws} → ${arch}`).toBe(true);
      expect(toCanvasArchIcon(aws)).toBe(arch);
    }
  });

  it('does not keep official AWS keys as the drawn icon', () => {
    expect(toCustomNodeIconName('aws-lambda')).toBe('arch-function');
    expect(toCustomNodeIconName('aws-s3')).toBe('arch-storage');
  });
});
