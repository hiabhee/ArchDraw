import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPackage, hostedSkill, PACKAGE_FILES } from './package.mjs';

test('public archive includes only hosted components and complete review scenarios', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'archdraw-package-test-'));
  try {
    const archive = await buildPackage(directory);
    const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(entries.sort(), [...PACKAGE_FILES].sort());
    const extract = (name) => execFileSync('unzip', ['-p', archive, name], { encoding: 'utf8' });
    const manifest = JSON.parse(extract('plugin.json'));
    const original = JSON.parse(await readFile(new URL('../archdraw/plugin.json', import.meta.url), 'utf8'));
    assert.equal(manifest.version, original.version);
    const mcp = JSON.parse(extract('mcp.json'));
    assert.deepEqual(mcp.mcpServers, {
      archdraw: { type: 'streamable-http', url: 'https://archdraw.hiabhee.online/api/mcp' },
    });
    const openai = manifest.extensions['com.openai'];
    assert.equal(openai.hooks, undefined);
    assert.equal(openai.apps, undefined);
    for (const field of ['logo', 'composerIcon']) {
      assert.ok(entries.includes(openai.interface[field].replace(/^\.\//, '')));
    }
    for (const field of ['supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
      assert.equal(new URL(openai.interface[field]).protocol, 'https:');
    }
    assert.equal(openai.review.test_cases.positive.length, 5);
    assert.equal(openai.review.test_cases.negative.length, 3);
    assert.ok(openai.review.test_cases.positive.every(c => c.prompt && c.tools_triggered && c.expected_behavior));
    const skill = extract('skills/archdraw/SKILL.md');
    assert.match(skill, /^---\nname: archdraw\ndescription: .+\n---\n/);
    assert.match(skill, /workingSessionId/);
    assert.match(skill, /publish: false/);
    assert.doesNotMatch(skill, /Live projects|archdraw-mcp-server link|hook adds/);
    const readme = extract('README.md');
    assert.match(readme, /published by default/);
    assert.match(readme, /24 hours/);
    assert.doesNotMatch(readme, /npx -y/);
    // Rebuilding must discard any old files rather than update an existing ZIP.
    await writeFile(join(directory, 'stale.txt'), 'must not ship');
    execFileSync('zip', ['-q', archive, 'stale.txt'], { cwd: directory });
    await buildPackage(directory);
    assert.deepEqual(execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort(), entries);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a changed local-only section boundary requires review rather than leaking commands', () => {
  assert.throws(() => hostedSkill('unexpected skill format'), /review the public skill/);
});
