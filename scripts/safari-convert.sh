#!/usr/bin/env bash
# Builds the Safari web extension and generates the Xcode project for it.
# macOS only: it needs Xcode's `xcrun safari-web-extension-converter`.
#
#   scripts/safari-convert.sh com.yourname.xquiz            # iOS + macOS
#   scripts/safari-convert.sh com.yourname.xquiz --ios-only
#   BUNDLE_ID=com.yourname.xquiz scripts/safari-convert.sh
#
# Extra arguments are passed to the converter. See safari/README.md.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  cat >&2 <<'MSG'
scripts/safari-convert.sh only runs on macOS.

The Safari app can only be built with Xcode, which does not exist on this
platform. What you CAN do anywhere is `npm run build:safari`, which produces
dist-safari/. Copy this repository to a Mac (or push it and clone it there) and
run this script there. Full steps: safari/README.md
MSG
  exit 1
fi

cd "$(dirname "$0")/.."

BUNDLE_ID="${1:-${BUNDLE_ID:-}}"
if [[ -z "$BUNDLE_ID" || "$BUNDLE_ID" == -* ]]; then
  echo "Usage: $0 <bundle-identifier> [converter options]   e.g. $0 com.yourname.xquiz" >&2
  exit 2
fi
[[ "${1:-}" == "$BUNDLE_ID" ]] && shift || true

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "safari-web-extension-converter not found. Install Xcode (App Store), open it once," >&2
  echo "then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

npm run build:safari

xcrun safari-web-extension-converter dist-safari \
  --project-location safari/XQuizApp \
  --app-name XQuiz \
  --bundle-identifier "$BUNDLE_ID" \
  --swift \
  --force \
  "$@"

echo
echo "Project generated in safari/XQuizApp. Next: open it in Xcode, pick your Team under"
echo "Signing & Capabilities for BOTH targets, and Run on your iPhone. See safari/README.md."
