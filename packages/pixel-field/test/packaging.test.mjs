import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const PACKAGE_ROOT = new URL('../', import.meta.url);
const DIST = new URL('dist/', PACKAGE_ROOT);

/**
 * The published package is the built `dist`, so these tests guard the parts of
 * it that consumers depend on and that nothing else would catch: the
 * `'use client'` directive, the absence of bench-only artifacts, and that
 * every path the manifest points at actually exists.
 */

test('the ESM entry opens with the use client directive', () => {
  const source = readFileSync(new URL('index.js', DIST), 'utf8');
  // Bundlers only honor the directive in the module prologue.
  assert.match(source.slice(0, 40), /^["']use client["'];/);
});

test('the CJS entry carries the directive in its prologue', () => {
  const source = readFileSync(new URL('index.cjs', DIST), 'utf8');
  const prologue = source.split('\n').slice(0, 5).join('\n');
  assert.match(prologue, /["']use client["'];/);
});

test('dist ships the public entry alone', () => {
  // The React-free bench entry builds into `bench/dist`; a bench bundle here
  // would mean the tarball picked up internals again.
  for (const file of ['bench.js', 'bench.cjs', 'bench.d.ts']) {
    assert.equal(existsSync(new URL(file, DIST)), false, `${file} in dist`);
  }
});

test('every path the manifest references exists on disk', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('package.json', PACKAGE_ROOT), 'utf8'),
  );

  const paths = [];
  const collect = (value) => {
    if (typeof value === 'string') paths.push(value);
    else if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) collect(entry);
    }
  };
  collect(manifest.exports);
  collect([manifest.main, manifest.module, manifest.types]);

  assert.ok(paths.length > 0, 'manifest references no paths');
  for (const path of paths) {
    assert.ok(existsSync(new URL(path, PACKAGE_ROOT)), `missing ${path}`);
  }

  // `files` decides the tarball (npm always adds package.json and README.md).
  for (const entry of manifest.files) {
    assert.ok(
      existsSync(new URL(entry, PACKAGE_ROOT)),
      `files entry missing: ${entry}`,
    );
  }
});
