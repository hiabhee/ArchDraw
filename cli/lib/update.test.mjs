import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewer, latestVersion, updateCheckDisabled } from './update.mjs';

test('compares versions numerically, not as text', () => {
  assert.equal(isNewer('0.3.1', '0.3.0'), true);
  assert.equal(isNewer('0.10.0', '0.9.9'), true);
  assert.equal(isNewer('1.0.0', '0.99.99'), true);
  assert.equal(isNewer('0.3.0', '0.3.0'), false);
  assert.equal(isNewer('0.2.9', '0.3.0'), false);
  assert.equal(isNewer('0.3.1-beta.1', '0.3.0'), true);
});

test('reads the latest version from the registry answer', async () => {
  const ok = async () => ({ ok: true, json: async () => ({ version: '0.4.2' }) });
  assert.equal(await latestVersion({ fetchImpl: ok }), '0.4.2');
});

test('an unreachable or odd registry answer means "no update", never an error', async () => {
  assert.equal(await latestVersion({ fetchImpl: async () => { throw new Error('offline'); } }), null);
  assert.equal(await latestVersion({ fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await latestVersion({ fetchImpl: async () => ({ ok: true, json: async () => ({ version: 'latest' }) }) }), null);
});

test('the check can be switched off, and is skipped inside the re-launched copy and in CI', () => {
  assert.equal(updateCheckDisabled({}), false);
  assert.equal(updateCheckDisabled({ ARCHDRAW_NO_UPDATE_CHECK: '1' }), true);
  assert.equal(updateCheckDisabled({ ARCHDRAW_LIVE_UPDATED: '1' }), true);
  assert.equal(updateCheckDisabled({ CI: 'true' }), true);
});
