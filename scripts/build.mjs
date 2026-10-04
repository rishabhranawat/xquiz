// Build script: bundles the extension sources into dist/ so it can be loaded
// unpacked (chrome://extensions -> Load unpacked -> select dist/).
//
//   node scripts/build.mjs           one-off production build
//   node scripts/build.mjs --watch   rebuild on change, with debug logging enabled
//
// Set XQUIZ_DEBUG=1 to enable debug logging in a one-off build.

import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const debug = watch || process.env.XQUIZ_DEBUG === '1';

/** Files copied verbatim into dist/ (source path relative to the repo root). */
const STATIC_FILES = [
  ['manifest.json', 'manifest.json'],
  ['icons', 'icons'],
  ['src/sidepanel/index.html', 'sidepanel/index.html'],
  ['src/sidepanel/styles.css', 'sidepanel/styles.css'],
];

/**
 * Bundle entry points. The key is the output path inside dist/ (without
 * extension) and must match the paths referenced by manifest.json.
 * Background runs as an ES module; content script and side panel are IIFEs.
 */
const BUNDLES = [
  {
    format: 'esm',
    entryPoints: { 'background/service-worker': 'src/background/service-worker.js' },
  },
  {
    format: 'iife',
    entryPoints: {
      'content/content': 'src/content/content.js',
      'sidepanel/sidepanel': 'src/sidepanel/sidepanel.js',
    },
  },
];

async function copyStaticFiles() {
  for (const [from, to] of STATIC_FILES) {
    const target = path.join(dist, to);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, from), target, { recursive: true });
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
    target: 'chrome110',
    sourcemap: debug ? 'inline' : false,
    define: { __XQUIZ_DEBUG__: String(debug) },
    logLevel: 'info',
  };
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
  console.log(`Built extension into ${path.relative(root, dist)}/`);
}
