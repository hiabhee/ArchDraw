import { describe, expect, it } from 'vitest';
import { shouldSkipComponentExtraction } from '../ExtractStage';

describe('shouldSkipComponentExtraction', () => {
  it.each(['library', 'framework'])('skips application-style extraction for %s repositories', (repoType) => {
    expect(shouldSkipComponentExtraction(repoType)).toBe(true);
  });

  it.each(['backend_only', 'fullstack_monolith', 'monorepo', undefined])('keeps extraction for %s repositories', (repoType) => {
    expect(shouldSkipComponentExtraction(repoType)).toBe(false);
  });
});
