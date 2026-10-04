// Builds the extension and zips dist/ into xquiz-<version>.zip for upload to
// the Chrome Web Store.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const build = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs')], {
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const manifest = JSON.parse(await readFile(path.join(root, 'dist/manifest.json'), 'utf8'));
const zipPath = path.join(root, `xquiz-${manifest.version}.zip`);

const zip = new AdmZip();
zip.addLocalFolder(path.join(root, 'dist'));
zip.writeZip(zipPath);
console.log(`Wrote ${path.relative(root, zipPath)}`);
