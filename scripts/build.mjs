// Build script: bundles the extension sources into dist/ so it can be loaded
// unpacked (chrome://extensions -> Load unpacked -> select dist/).
//
//   node scripts/build.mjs           one-off production build
//   node scripts/build.mjs --watch   rebuild on change, with debug logging enabled
//   node scripts/build.mjs --target=safari   Safari Web Extension -> dist-safari/
//
// Set XQUIZ_DEBUG=1 to enable debug logging in a one-off build.

import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { referencedFiles, toSafariManifest } from './manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg ? targetArg.slice('--target='.length) : 'chrome';
if (!['chrome', 'safari'].includes(target)) {
  throw new Error(`Unknown --target=${target} (expected chrome or safari)`);
}
const isSafari = target === 'safari';
const dist = path.join(root, isSafari ? 'dist-safari' : 'dist');
const watch = process.argv.includes('--watch');
const debug = watch || process.env.XQUIZ_DEBUG === '1';

/** Files copied verbatim into dist/ (source path relative to the repo root). */
const STATIC_FILES = [
  ['manifest.json', 'manifest.json'],
  ['icons', 'icons'],
  ['src/sidepanel/index.html', 'sidepanel/index.html'],
  ['src/sidepanel/styles.css', 'sidepanel/styles.css'],
  ['src/sidepanel/popup.css', 'sidepanel/popup.css'],
  ['src/digest/index.html', 'digest/index.html'],
  ['src/digest/digest.css', 'digest/digest.css'],
];

/**
 * Bundle entry points. The key is the output path inside dist/ (without
 * extension) and must match the paths referenced by manifest.json.
 * Background runs as an ES module; content script and side panel are IIFEs.
 */
const BUNDLES = [
  {
    // Safari loads background.scripts as a classic script, so bundle it as an IIFE there.
    format: isSafari ? 'iife' : 'esm',
    entryPoints: { 'background/service-worker': 'src/background/service-worker.js' },
  },
  {
    format: 'iife',
    entryPoints: {
      'content/content': 'src/content/content.js',
      'sidepanel/sidepanel': 'src/sidepanel/sidepanel.js',
      'digest/digest': 'src/digest/digest.js',
    },
  },
];

async function copyStaticFiles() {
  for (const [from, to] of STATIC_FILES) {
    const destination = path.join(dist, to);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(root, from), destination, { recursive: true });
  }
  if (isSafari) {
    const base = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    await writeFile(
      path.join(dist, 'manifest.json'),
      `${JSON.stringify(toSafariManifest(base), null, 2)}\n`
    );
  }
}

/** @param {{format: 'esm' | 'iife', entryPoints: Record<string, string>}} bundle */
function bundleOptions({ format, entryPoints }) {
  return {
    absWorkingDir: root,
    entryPoints,
    outdir: dist,
    bundle: true,
    format,
    target: isSafari ? 'safari16' : 'chrome110',
    sourcemap: debug ? 'inline' : false,
    define: { __XQUIZ_DEBUG__: String(debug) },
    logLevel: 'info',
  };
}

/** Fails the build if manifest.json points at a file that is not in dist/. */
async function verifyManifestPaths() {
  const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
  const referenced = referencedFiles(manifest);

  const missing = [];
  for (const file of referenced) {
    await access(path.join(dist, file)).catch(() => missing.push(file));
  }
  if (missing.length) {
    throw new Error(
      `manifest.json references files missing from ${path.relative(root, dist)}/: ${missing.join(', ')}`
    );
  }
}

await rm(dist, { recursive: true, force: true });
await copyStaticFiles();

if (watch) {
  const contexts = await Promise.all(
    BUNDLES.map((bundle) => esbuild.context(bundleOptions(bundle)))
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('Watching for changes (static files are copied once; rerun to refresh them)...');
} else {
  await Promise.all(BUNDLES.map((bundle) => esbuild.build(bundleOptions(bundle))));
  await verifyManifestPaths();
  console.log(`Built extension into ${path.relative(root, dist)}/`);
}
