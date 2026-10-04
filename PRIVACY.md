# XQuiz Privacy Policy

_Last updated: 2026-10-04_

XQuiz is a browser extension (Chrome, Safari) that quizzes you on posts you read on x.com / twitter.com. It has no servers and no accounts, and the developer receives no data from you.

## What XQuiz processes

- **Post text you read on x.com / twitter.com.** The extension reads the text of posts that are on your screen to count what you read and to write quiz questions and the optional daily digest. It runs only on x.com and twitter.com.
- **Reading activity (optional, off by default).** If you turn on "Track my reading for the daily digest", XQuiz records, per post, the text (first 500 characters), author handle, link, how long it was on screen and how many times you saw it. It keeps at most about 500 posts per day for 7 days.
- **Your quiz results and settings.** Score, streak, a daily answer log, quiz history (recent questions), a list of hashes of tweets already quizzed, your preferences and your Gemini API key.

## Where it is stored

All of the above is stored **on your device** in the browser's extension storage (`storage.local` / `storage.sync`). Your Gemini API key is kept in local storage only. In Chrome, non-secret preference settings may sync through your Google account's Chrome sync; in Safari they stay on the device. You can delete reading data and digests in Settings ("Clear reading data"), reset stats, clear history, or remove everything by uninstalling the extension.

## What is sent off your device

XQuiz sends data to exactly one third party, **Google (Gemini API, generativelanguage.googleapis.com)**, and only when it generates a quiz or a digest:

- the text of the posts used for that quiz (or the top ten posts of a digest), and the instructions telling the model what to write;
- your own Gemini API key, in an HTTP header, to authorize the request.

This happens only if you have entered a Gemini API key. Without a key, quizzes cannot be generated and digests are built locally without AI. Google processes this data under its own terms and privacy policy (https://policies.google.com/privacy and the Gemini API terms); because you supply the key, the request is tied to your Google AI Studio account and its usage settings. The developer never sees these requests.

XQuiz does not use analytics, advertising, tracking or crash-reporting services, does not sell or share data, and does not read your direct messages, passwords, or pages other than x.com / twitter.com.

## Permissions

See the store listing for why each permission is needed: `storage` (save results and settings), `alarms` (schedule the daily digest), `sidePanel` (Chrome UI), `notifications` (Chrome: tell you the digest is ready), and host access to x.com / twitter.com (read visible posts, hide video/image-only posts in Distraction mode).

## Children

XQuiz is not directed at children under 13.

## Changes and contact

If this policy changes, the date above changes and the new text ships with the extension. Questions or deletion requests (there is nothing for the developer to delete, since no data is collected): open an issue at the project repository or email ranawat.rishabh@gmail.com.
