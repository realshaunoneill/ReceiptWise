// Zip the extension for the Chrome Web Store: npm run extension:zip
//
// Packages only what runs (no README, scripts or store assets), and refuses to package a copy that
// has been pointed at a development server: config.js and the manifest must name production only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION = 'https://www.receiptwise.io';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const config = readFileSync(join(root, 'config.js'), 'utf8');

const problems = [];
if (!config.includes(`'${PRODUCTION}'`)) problems.push(`config.js must point at ${PRODUCTION}`);
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify([`${PRODUCTION}/*`])) {
  problems.push(`host_permissions must be exactly ["${PRODUCTION}/*"]`);
}
if (JSON.stringify(manifest.externally_connectable?.matches) !== JSON.stringify([`${PRODUCTION}/*`])) {
  problems.push(`externally_connectable.matches must be exactly ["${PRODUCTION}/*"]`);
}
if (problems.length > 0) {
  console.error(`Not packaging:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

// -FS: when the zip already exists, also drop entries for files that are gone (plain -r only adds).
const out = join(root, '..', `receiptwise-clipper-${manifest.version}.zip`);
execFileSync('zip', ['-r', '-FS', '-X', '-q', out, '.', '-x', 'README.md', 'scripts/*', 'store/*', '*.DS_Store'], { cwd: root, stdio: 'inherit' });
console.log(`Wrote ${out}`);
