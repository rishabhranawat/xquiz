# XQuiz

A Chrome and Safari (iPhone, iPad, Mac) extension that tests your attention and retention while scrolling Twitter/X.

**Built entirely with AI agents. 100% vibe coded.**

## Screenshots

<p align="center">
  <img src="assets/quiz.png" width="400" alt="Quiz Interface">
  <img src="assets/settings.png" width="400" alt="Settings">
</p>

## What it does

XQuiz monitors the tweets you scroll past on Twitter/X and periodically generates quiz questions to test how much you're actually absorbing. It uses Google's Gemini AI to create questions based on the content you've read.

## Features

- **Automatic tweet collection** - Tracks tweets as you scroll through your feed
- **AI-generated quizzes** - Creates multiple choice, true/false, and fill-in-the-blank questions
- **Progress tracking** - Monitors your score, accuracy percentage, and answer streaks
- **Shareable scorecards** - Generate a PNG scorecard of your stats (wide or square, dark or light); share it with the native share sheet (iPhone/Android/Mac), copy or download it
- **Daily reading digest** - Optional top-10 summary of the posts you actually spent time on (see below)
- **Safari / iPhone support** - Same code, touch-friendly popup UI and tap-free "read" detection (see [Safari](#safari-iphone-ipad-mac))
- **Configurable** - Adjust how many tweets trigger a quiz
- **Distraction mode** - Optional toggle that hides video posts and image-only posts (pictures, GIFs or cards with no text) from your feed; hidden posts are never used for quizzes
- **Quiz history** - Review your most recent quiz questions and clear them whenever you like
- **Custom attention timer** - Pick how long a tweet must stay visible before it counts as “read”
- **Track specific pages** - Decide whether quizzes should monitor only the home feed or additional sections like user profiles

## Daily reading digest

Optional and **off by default** (Settings > Daily digest > "Track my reading for the daily digest").

- While enabled, XQuiz records how long each post is on screen (at least 60% visible, tab visible and focused, no 30s of inactivity; no hover needed). Posts with under 1.5s of attention are ignored and ads are skipped.
- Reading data is stored only in extension local storage in this browser, capped at ~500 posts per day and kept for 7 days. You can pause tracking or clear all reading data and digests at any time.
- At your chosen time (default 9:00 PM) XQuiz ranks the day's posts by inferred intent (dwell time relative to expected reading time at ~238 wpm, with a bonus for revisits) and builds a digest of the top 10, delivered as a notification that opens the digest page (Chrome; on Safari it is built when you open the popup) (past 7 days available, with "Copy as text" and "Email it to me").
- **Privacy:** reading data never leaves the browser, except that the text of the top 10 posts is sent to Gemini (with your own API key) to write the summary. Without a key, or if the call fails, a plain digest is built locally.

## Safari (iPhone, iPad, Mac)

`npm run build:safari` builds a Safari Web Extension into `dist-safari/` from the same sources (`--target=safari` in `scripts/build.mjs`; the manifest is derived from `src/manifest.json` by `scripts/manifest.mjs`). On Safari:

- The UI is the toolbar popup (iPhone: **aA** menu > XQuiz) instead of a side panel; it is the side panel page with a `layout-popup` layout (full width, 44px touch targets, 16px inputs, safe-area insets).
- With no hover on touch devices, a tweet counts as read once at least 60% of it (or 60% of the viewport for tall posts) has been on screen with the page visible for your configured time. Desktop hover behaviour is unchanged.
- There is no notifications API: the digest is built when the popup opens or X loads after your delivery time, and opens inside the popup.
- The Xcode project must be generated on a Mac. See [safari/README.md](safari/README.md) for the step-by-step guide (signing with a free Apple ID, enabling the extension on iPhone, granting x.com access, App Store notes) and run `scripts/safari-convert.sh com.yourname.xquiz`.
- Privacy: see [PRIVACY.md](PRIVACY.md). Chrome Web Store listing text: [docs/store-listing.md](docs/store-listing.md).

## Security considerations

- Your Gemini API key is stored only in Chrome's local storage (never synced to the cloud) and is only accessible from trusted extension surfaces.
- The key is sent to Google in the `x-goog-api-key` request header, never in the URL, and is never logged.
- Background message handlers validate the sender, preventing other extensions from querying your settings or stats.
- Permissions are kept minimal: `storage`, `alarms`, `notifications` and `sidePanel` (Chrome only; Safari uses `storage` and `alarms`), and host access to `x.com` / `twitter.com` only.

## Installation

XQuiz is built with [esbuild](https://esbuild.github.io/), so the extension is loaded from the generated `dist/` folder rather than the repository root (the repo root has no `manifest.json` on purpose, so loading it fails with "Manifest file is missing" instead of a confusing script error).

1. Clone this repository and run `npm install`
2. Run `npm run build`
3. Open Chrome and navigate to `chrome://extensions`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked" and select the `dist/` folder

After code changes, run `npm run build` again (or keep `npm run watch` running) and click the reload icon on the extension card.

## Setup

1. Click the XQuiz icon to open the side panel
2. Click the settings gear icon
3. Enter your [Gemini API key](https://aistudio.google.com/apikey)
4. Adjust tweets-per-quiz if desired (default: 5)

## Usage

1. Navigate to twitter.com or x.com
2. Open the XQuiz side panel by clicking the extension icon
3. Scroll through your feed as normal
4. When enough tweets are collected, a quiz will appear
5. Answer questions and track your retention!

## Project Structure

```
xquiz/
├── PRIVACY.md                  # Privacy policy (store listings)
├── docs/store-listing.md       # Chrome Web Store listing text and permission justifications
├── safari/                     # Safari/Xcode instructions (README.md); generated XQuizApp/ lands here
├── icons/                      # Extension icons
├── scripts/
│   ├── build.mjs               # esbuild bundler -> dist/ or dist-safari/ (--target=safari)
│   ├── manifest.mjs            # Pure Chrome -> Safari manifest transform
│   ├── safari-convert.sh       # macOS: build + xcrun safari-web-extension-converter
│   └── package.mjs             # Builds and zips dist/ for the Chrome Web Store
├── src/
│   ├── manifest.json           # Chrome manifest (paths relative to dist/); Safari's is derived from it
│   ├── shared/                 # Used by every context; no DOM, tiny chrome surface
│   │   ├── constants.js        # Message types, defaults, storage keys, limits
│   │   ├── browser.js          # Platform shim: browser/chrome namespace + feature detection
│   │   ├── visibility.js       # Pure "post is on screen" rule (digest + touch quiz tracking)
│   │   ├── logger.js           # Logger (debug output only in watch/debug builds)
│   │   ├── messaging.js        # sendMessage / message router / listeners
│   │   ├── settings.js         # Pure settings normalization
│   │   ├── stats.js            # Pure stats updates
│   │   ├── storage.js          # Promise-based chrome.storage + settings persistence
│   │   └── tweet-hash.js       # Pure tweet content hashing
│   ├── background/             # Service worker
│   │   ├── service-worker.js   # Entry point: registers listeners, merges handlers
│   │   ├── store.js            # Persisted write-through state (survives worker restarts)
│   │   ├── quiz-generator.js   # Gemini request/prompt, TWEETS_COLLECTED handler
│   │   ├── quiz-parser.js      # Pure JSON parsing/repair/validation of model output
│   │   ├── quiz-queue.js       # Persisted queue of quizzes waiting for the panel
│   │   ├── quiz-history.js     # Past questions log
│   │   ├── tweet-history.js    # Tweets already quizzed (de-duplication)
│   │   ├── stats.js            # Persisted score/streak
│   │   ├── settings-handlers.js# GET/UPDATE_SETTINGS
│   │   └── side-panel.js       # Side panel enable/open logic
│   ├── content/                # Content script (runs on x.com / twitter.com)
│   │   ├── content.js          # Entry point wiring the modules together
│   │   ├── page-tracker.js     # Which pages count (pure) + SPA navigation watcher
│   │   ├── tweet-extractor.js  # DOM selectors -> tweet data
│   │   ├── post-classifier.js  # Video / image-only / text classification (pure + DOM)
│   │   ├── tweet-collector.js  # Buffer + de-duplication of read tweets
│   │   ├── attention-tracker.js# "Read" detection: hover on desktop, chooses the tracker below on touch
│   │   ├── attention-visibility.js# Viewport-dwell "read" detection for touch devices
│   │   ├── dwell-tracker.js    # Daily digest reading-time tracking
│   │   ├── status-indicator.js # Floating READING / NOT READING badge
│   │   ├── auto-open.js        # Opens the side panel on the next user gesture
│   │   └── distraction.js      # Distraction mode: hide video / image-only posts
│   └── sidepanel/              # Side panel UI
│       ├── index.html, styles.css, popup.css (Safari popup layout)
│       ├── sidepanel.js        # Entry point: creates views, handles messages
│       ├── quiz-view.js        # Quiz card, progress counter, empty/error state
│       ├── settings-view.js    # Settings modal
│       ├── history-view.js     # Past questions list
│       ├── share-view.js       # Share modal (download / post to X)
│       ├── scorecard.js        # Canvas scorecard rendering
│       ├── stats-view.js       # Score / streak / accuracy bar
│       ├── answer-check.js     # Pure answer checking
│       └── dom.js              # DOM helpers
├── tests/                      # Unit tests (node --test)
├── dist/                       # Chrome build output (gitignored) - load this in Chrome
└── dist-safari/                # Safari build output (gitignored) - input for the Xcode converter
```

## Development

Requires Node.js 20+.

| Command                | What it does                                                                      |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run build`        | Bundle into `dist/` and verify every path in the manifest exists                  |
| `npm run build:safari` | Bundle the Safari Web Extension into `dist-safari/` (then see `safari/README.md`) |
| `npm run watch`        | Rebuild on change, with debug logging enabled                                     |
| `npm run lint`         | ESLint (flat config)                                                              |
| `npm run format`       | Prettier (`npm run format:check` verifies without writing)                        |
| `npm test`             | Unit tests with Node's built-in test runner                                       |
| `npm run package`      | Build and zip `dist/` into `xquiz-<version>.zip`                                  |

CI (`.github/workflows/ci.yml`) runs install, lint, format check, tests and both builds (Chrome and Safari) on every push and pull request.

### Extending XQuiz

- **New message type**: add it to `MESSAGE_TYPES` in `src/shared/constants.js`. Handle requests in a background module by exporting a `messageHandlers` object (type -> `(message, sender) => response`) and spreading it into the router in `service-worker.js`. Send with `sendMessage(MESSAGE_TYPES.X, payload)`. Every request receives a response (`{ error }` on failure). For notifications to the panel/content script, use `broadcast()` and `listenForMessages()`.
- **New setting**: add its default (and limits) in `src/shared/constants.js`, handle it in `normalizeSettings` (`src/shared/settings.js`, with a test), add it to `SYNC_SETTING_KEYS` if it should sync, add the control to `index.html` and read/write it in `settings-view.js`.
- **New content-script feature**: create a module in `src/content/` exporting a factory/functions and initialise it in `init()` in `content.js`. Keep DOM selectors in `tweet-extractor.js` and decision logic in pure functions so they can be tested.
- **New side panel view**: add its markup to `index.html`, create `src/sidepanel/<name>-view.js` exporting `create<Name>View()` that looks up elements with `byId`, and instantiate it in `sidepanel.js`. Render untrusted text with `textContent`, never `innerHTML`.
- **New persisted background state**: use `createStore()` from `src/background/store.js` so state is reloaded after the service worker sleeps.

## Requirements

- Chrome (Manifest V3), or Safari 16+ on iOS/iPadOS/macOS (needs a Mac with Xcode to build the app)
- Gemini API key

## License

[MIT](LICENSE) © Rishabh Ranawat
