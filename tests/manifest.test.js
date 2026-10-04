import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { referencedFiles, toSafariManifest } from '../scripts/manifest.mjs';

const chromeManifest = JSON.parse(await readFile(new URL('../src/manifest.json', import.meta.url)));
const safari = toSafariManifest(chromeManifest);

test('does not mutate the Chrome manifest', () => {
  assert.ok(chromeManifest.permissions.includes('sidePanel'));
  assert.ok(chromeManifest.side_panel);
  assert.equal(chromeManifest.background.service_worker, 'background/service-worker.js');
});

test('removes the side panel and unsupported permissions', () => {
  assert.equal(safari.side_panel, undefined);
  assert.deepEqual(safari.permissions, ['storage', 'alarms']);
});

test('uses a classic non-persistent background script', () => {
  assert.deepEqual(safari.background, {
    scripts: ['background/service-worker.js'],
    persistent: false,
  });
});

test('adds the toolbar popup and keeps icons and host access', () => {
  assert.equal(safari.action.default_popup, 'sidepanel/index.html');
  assert.deepEqual(safari.action.default_icon, chromeManifest.action.default_icon);
  assert.deepEqual(safari.host_permissions, chromeManifest.host_permissions);
  assert.deepEqual(safari.content_scripts, chromeManifest.content_scripts);
});

test('referencedFiles lists scripts, popup, content scripts and icons', () => {
  const files = referencedFiles(safari);
  for (const file of [
    'background/service-worker.js',
    'sidepanel/index.html',
    'content/content.js',
    'icons/icon128.png',
  ]) {
    assert.ok(files.includes(file), file);
  }
});

test('tolerates a manifest without optional keys', () => {
  const minimal = toSafariManifest({ manifest_version: 3, name: 'x', version: '1' });
  assert.deepEqual(minimal.permissions, []);
  assert.equal(minimal.action.default_popup, 'sidepanel/index.html');
});
