# XQuiz for Safari (iPhone, iPad, Mac)

XQuiz ships to Safari as a **Safari Web Extension**: the same JavaScript as the Chrome build, wrapped in a small app that Xcode generates. Nothing here could be built or run on Linux, so everything below the "Mac steps" heading is untested until you run it. Everything up to `npm run build:safari` is automated and tested in CI.

## What differs from Chrome

| Area                | Chrome                                    | Safari (iOS / macOS)                                                                                        |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| UI                  | Side panel                                | Toolbar popup (iPhone: "aA" menu > XQuiz; full-width sheet). Same HTML, `layout-popup` class + `popup.css`  |
| Quiz "read" trigger | Hover over a tweet for N s                | Touch devices: tweet >= 60% on screen (or filling 60% of the viewport) with the page visible for N s        |
| Daily digest alert  | Notification + alarm                      | No notifications API. Digest is built when the popup opens / X loads once it is due; open it from the popup |
| Digest page         | New tab                                   | Opens inside the popup, with a "Back to XQuiz" link                                                         |
| Settings sync       | `storage.sync`                            | Safari maps `storage.sync` to local storage (no cross-device sync)                                          |
| Background          | Module service worker                     | Classic non-persistent script (single IIFE bundle). iOS unloads it often; all state is persisted already    |
| Permissions         | storage, alarms, sidePanel, notifications | storage, alarms. Host access to x.com / twitter.com must be granted by the user in Safari                   |

The Safari manifest is generated from `src/manifest.json` by `toSafariManifest()` in `scripts/manifest.mjs` (unit tested). Do not edit it by hand.

## Prerequisites

- A Mac with macOS 13+ and **Xcode 15 or newer** (free from the App Store). Open Xcode once and accept the license.
- `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` if `xcrun` complains about command line tools.
- Node.js 20+ and `npm install` in this repo.
- An iPhone on iOS 16 or newer (the build targets Safari 16; non-persistent background pages need iOS 15.4+), connected by cable or paired for wireless debugging.
- An Apple ID. A free one is enough for installing on your own devices. A paid Apple Developer Program membership (99 USD/year) is needed for TestFlight and the App Store.

## Mac steps

1. Build and generate the Xcode project (replace the bundle id with your own reverse-DNS name; it must be unique):

   ```sh
   scripts/safari-convert.sh com.yourname.xquiz
   ```

   That is equivalent to:

   ```sh
   npm run build:safari
   xcrun safari-web-extension-converter dist-safari \
     --project-location safari/XQuizApp \
     --app-name XQuiz \
     --bundle-identifier com.yourname.xquiz \
     --swift --force
   ```

   Add `--ios-only` (or `--macos-only`) if you only want one platform. Run `xcrun safari-web-extension-converter --help` to confirm the flags your Xcode version supports. The converter opens the project in Xcode; the generated project references `dist-safari/`, so after changing code you only need `npm run build:safari` and Run again.

2. In Xcode, select the project (top of the file list). For **each** target (`XQuiz` and `XQuiz Extension`, for the iOS and macOS variants you want) open _Signing & Capabilities_, tick _Automatically manage signing_ and choose your **Team** (your Apple ID; add it under Xcode > Settings > Accounts). The extension's bundle id must stay `<app bundle id>.Extension`.

3. Set the deployment target of the iOS targets to **iOS 16.0** (General > Minimum Deployments).

4. Choose the scheme **XQuiz (iOS)**, pick your iPhone as the run destination and press Run.
   - First install on a device: enable **Developer Mode** (Settings > Privacy & Security > Developer Mode, restart) and trust your developer certificate (Settings > General > VPN & Device Management).
   - With a free Apple ID the install **expires after 7 days** and must be re-run from Xcode; apps are limited to 3 per device. A paid membership lasts a year (TestFlight builds 90 days).

5. On the iPhone, enable the extension:
   - iOS 18 and later: Settings > Apps > Safari > Extensions > XQuiz > turn on. (iOS 16-17: Settings > Safari > Extensions.)
   - Under "Allow Extension", allow it on **x.com** and **twitter.com** ("Allow" or "Ask"). Without this, the content script never runs and no tweets are collected.

6. Open Safari, go to x.com, tap **aA** in the address bar > **Manage Extensions** to make sure XQuiz is on, then tap **aA > XQuiz** to open the popup. Add your Gemini API key under the gear icon.

7. Scroll your feed. The status badge sits above X's tab bar. After enough tweets stay on screen for the configured time, open XQuiz from **aA** for the quiz.

### Using it on the Mac (bonus)

Run the macOS scheme, then Safari > Settings > Extensions > enable XQuiz and allow x.com. The popup is sized 380px wide. macOS Safari may refuse unsigned extensions: enable Develop > Allow Unsigned Extensions (resets on every Safari restart) or sign with your team.

## Debugging

- Safari on Mac > Develop > _your iPhone_ > x.com page shows the content script console. The extension popup/background appear under Develop > Web Extension Background Content (Mac) and the popup can be inspected from the iPhone entry while it is open (enable Settings > Safari > Advanced > Web Inspector on the phone).
- Extension errors also appear in Console.app, filter on "XQuiz".

## Troubleshooting

| Symptom                                 | Fix                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| XQuiz not listed in Safari Extensions   | Run the app target once (the container app must be installed). Check the extension target is signed with the same team.                           |
| "No Team" / signing errors              | Pick your Team on both targets; the bundle id must be unique (change `com.yourname`).                                                             |
| Extension on but nothing collected      | Allow x.com in the extension's website access (step 5). Reload the tab. Open the popup to see if tracking page types match (Settings > Pages).    |
| Quiz never appears                      | Add a Gemini key. Quizzes are generated by the background script; check the key in the popup settings and the network.                            |
| Digest not generated by itself          | Expected on Safari: no notifications and alarms are best effort. It is built when you open the popup or load X after your delivery time.          |
| Popup looks cramped / zooms when typing | Inputs are 16px by design; make sure you are on a build from `npm run build:safari`, then clean the Xcode build folder (Shift-Cmd-K).             |
| Xcode says "manifest key not supported" | Warnings for keys Safari ignores are harmless. Errors about `service_worker` mean the Chrome build was converted: use `dist-safari`, not `dist`.  |
| Share button only shows Download / Copy | The native share sheet needs a user tap on iOS 15+; if still missing, the Web Share API with files is blocked in that context. Use Copy/Download. |
| App expires after 7 days                | Free Apple ID limitation. Rebuild from Xcode, or join the paid Developer Program and use TestFlight.                                              |

## Known risks (unverified, Mac-only)

- x.com's mobile web markup is largely the same as desktop (`article[data-testid="tweet"]`) but is not guaranteed; if tweets are not collected on iPhone, inspect the DOM and adjust `src/content/tweet-extractor.js`. Distraction mode and the digest depend on the same selectors.
- iOS may unload the background script at any time. State is persisted; in-flight Gemini calls can be cut off when the popup closes. Reopening and retrying is safe.
- `tabs.create` from an iOS popup is avoided on purpose (digest opens in-popup). Links in the digest open in Safari normally.
- Per-site permission prompts and the "aA" flow differ slightly between iOS versions.
- `crypto.randomUUID` requires Safari 15.4+; the build targets iOS 16 so this is fine.

## App Store readiness

Requires the paid Developer Program. Checklist:

1. **Bundle ids / icons**: the converter uses the extension's 128px icon. App Store Connect needs a 1024x1024 PNG (no alpha) as the app icon: put it in `XQuiz/Assets.xcassets/AppIcon`.
2. **Container app**: Apple expects the app to do more than say "enable in Settings". The generated screen is minimal; add a short explainer (what XQuiz does, how to enable it, a link to the privacy policy) before submitting, or review may flag guideline 4.2.
3. **Privacy policy URL** (required): host `PRIVACY.md` (for example as a GitHub Pages page or the repo file view) and paste the URL in App Store Connect and in the app.
4. **App Privacy ("nutrition label")**, consistent with what the extension does:
   - Data **not collected** by the developer: no analytics, no accounts, no server operated by the developer. Everything stays on device.
   - If you choose to disclose the Gemini call: _User Content > Other User Content_ (text of posts you read) is sent to a third party (Google Gemini) **only** to generate quizzes/digests, linked to no identity by the developer, not used for tracking, not used for advertising. The API key is entered by the user and stays on the device. Answer "No" to tracking.
   - Reading data (dwell times, quiz history, stats) is stored locally only (up to 7 days for digest data).
5. **Screenshots** (App Store Connect, 2025 sizes): iPhone 6.9" 1320x2868 (or 1290x2796 / 1260x2736) and 6.5" 1284x2778 or 1242x2688; iPad 13" 2064x2752 if you support iPad; Mac 1280x800 up to 2880x1800 if you ship the macOS app. 1-10 per size. Capture the popup over x.com in Safari, the quiz, the scorecard and settings.
6. **Review notes** to paste: "XQuiz is a Safari extension for x.com. Enable it in Settings > Apps > Safari > Extensions, allow x.com, open x.com in Safari, tap aA > XQuiz. A demo Gemini API key for review: <provide one>. The key is optional to open the app but quizzes need it. The extension reads visible post text on x.com only on the user's device; post text is sent to Google's Gemini API only to create quizzes/digests. The extension is not affiliated with X Corp." Provide a reviewer Gemini key and a short screen recording.
7. **Trademark**: avoid using the X logo or the name "X" prominently; the name XQuiz and "for Twitter/X" in the description is the safe side. The share card contains an "X" glyph button label; consider removing it before submission. Do not imply endorsement by X Corp.
8. **Category** Education or Productivity; **age rating** 12+ or 17+ because the extension displays user-generated content from X (answer the questionnaire honestly).
9. Archive (Product > Archive), upload via Organizer, add to TestFlight first.
