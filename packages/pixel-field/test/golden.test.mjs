import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { GOLDEN_CASES } from './golden-cases.mjs';
import { fingerprint } from './golden.mjs';

const goldenPath = fileURLToPath(new URL('./golden.json', import.meta.url));

test('rendered field matches the committed golden fingerprints', () => {
  assert.ok(
    existsSync(goldenPath),
    'test/golden.json is missing — run `node test/golden-update.mjs` once ' +
      'against a known-good build to create it',
  );

  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));

  for (const { name, ...scenario } of GOLDEN_CASES) {
    const expected = golden[name];
    assert.ok(expected, `${name}: case missing from golden.json`);

    const actual = fingerprint(scenario);
    const label = `${name} (${scenario.width}x${scenario.height} t=${scenario.time})`;

    assert.equal(actual.count, expected.count, `${label}: cell count`);
    assert.equal(actual.body, expected.body, `${label}: body palette keys`);
    assert.equal(actual.glint, expected.glint, `${label}: glint palette keys`);
    assert.equal(actual.x, expected.x, `${label}: cell x origins`);
    assert.equal(actual.y, expected.y, `${label}: cell y origins`);
    assert.equal(actual.size, expected.size, `${label}: cell sizes`);
  }
});

test('golden.json has no stale cases', () => {
  assert.ok(existsSync(goldenPath), 'test/golden.json is missing');
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  const known = new Set(GOLDEN_CASES.map((c) => c.name));
  for (const name of Object.keys(golden)) {
    assert.ok(
      known.has(name),
      `${name}: golden.json has a case the test never runs`,
    );
  }
});
