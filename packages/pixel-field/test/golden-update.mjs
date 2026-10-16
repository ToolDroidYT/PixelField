/**
 * Regenerates `test/golden.json` from the current build.
 *
 * Only run this after a change that is *meant* to alter what the field draws;
 * the digests are the equivalence bar for everything else (see `golden.mjs`).
 *
 *   node test/golden-update.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GOLDEN_CASES } from './golden-cases.mjs';
import { fingerprint } from './golden.mjs';

const out = {};
for (const { name, ...scenario } of GOLDEN_CASES) {
  out[name] = fingerprint(scenario);
}

const target = fileURLToPath(new URL('./golden.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);

for (const [name, result] of Object.entries(out)) {
  console.log(
    `${name.padEnd(20)} ${result.count.toString().padStart(6)} cells  ${result.body}/${result.glint}`,
  );
}
console.log(`\nwrote ${target}`);
