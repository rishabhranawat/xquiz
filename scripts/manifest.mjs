// Pure manifest transformations (no I/O) so they can be unit tested.
// The repo's src/manifest.json is the Chrome manifest; other targets are derived
// from it by the functions here instead of maintaining a second copy.

/** Permissions Safari web extensions do not implement. */
export const SAFARI_UNSUPPORTED_PERMISSIONS = Object.freeze(['sidePanel', 'notifications']);

/** Where the Safari popup lives: the side panel page, laid out as a popup at runtime. */
export const SAFARI_POPUP_PATH = 'sidepanel/index.html';

/**
 * Derives the Safari Web Extension manifest from the Chrome one.
 *
 * - drops `side_panel` and the `sidePanel`/`notifications` permissions (Safari has neither)
 * - keeps `alarms` (supported, non-persistent) and `storage`
 * - replaces the module service worker with a classic, non-persistent
 *   `background.scripts` entry (the build bundles it as a single IIFE)
 * - adds the toolbar popup, which is the extension UI on iOS ("aA" menu >
 *   Manage Extensions) and macOS
 *
 * @param {object} base Parsed Chrome manifest.json (not modified).
 * @returns {object}
 */
export function toSafariManifest(base) {
  const manifest = structuredClone(base);

  manifest.permissions = (manifest.permissions ?? []).filter(
    (permission) => !SAFARI_UNSUPPORTED_PERMISSIONS.includes(permission)
  );
  delete manifest.side_panel;

  const worker = manifest.background?.service_worker;
  if (worker) {
    manifest.background = { scripts: [worker], persistent: false };
  }

  manifest.action = {
    ...manifest.action,
    default_popup: SAFARI_POPUP_PATH,
    default_title: 'XQuiz',
  };

  return manifest;
}

/**
 * Every file path a manifest references, for build-time verification.
 * @param {object} manifest
 * @returns {string[]}
 */
export function referencedFiles(manifest) {
  return [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    manifest.side_panel?.default_path,
    manifest.action?.default_popup,
    ...(manifest.content_scripts ?? []).flatMap((entry) => [
      ...(entry.js ?? []),
      ...(entry.css ?? []),
    ]),
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter(Boolean);
}
