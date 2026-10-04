# Chrome Web Store listing

## Name

XQuiz

## Short description (max 132 characters)

Quiz yourself on what you read on X (Twitter): AI questions, streaks, shareable scorecards and an optional daily digest.

(120 characters)

## Category

Education (or Productivity)

## Long description

XQuiz tests whether you actually remember what you scroll past on X (Twitter).

As you read your feed, XQuiz notices the posts you really spend time on. After a few of them, it uses Google's Gemini AI to write a short quiz: multiple choice, true or false, and fill in the blank. Open the side panel, answer, and see how much stuck.

Features

- AI-generated quizzes from the posts you read (bring your own free Gemini API key)
- Score, accuracy and answer streaks
- Shareable scorecards: download or copy a PNG of your stats
- Daily digest (optional, off by default): XQuiz ranks the posts you spent the most attention on and writes a top-10 summary you can copy or email to yourself
- Distraction mode (optional): hide video posts and image-only posts from your feed
- Adjust how many posts make a quiz, how long a post must be in view to count, and which pages are tracked

Privacy

- No accounts, no analytics, no developer servers
- Your reading data, results and API key stay in your browser
- Post text is sent to Google's Gemini API, with your own key, only to write quizzes and digests
- Full policy: PRIVACY.md in the project repository

XQuiz is an independent project and is not affiliated with or endorsed by X Corp. or Google.

## Single purpose

Help users remember what they read on X (Twitter) by generating quizzes from the posts they read, with optional reading digests.

## Permission justifications

- **storage**: Saves quiz stats, quiz history, settings, the optional reading log and digests, and the user's Gemini API key in the browser. Nothing is sent to the developer.
- **alarms**: Schedules the once-a-day time at which the optional daily digest is generated. Not used unless the user turns the digest on.
- **notifications**: Shows one notification when the daily digest is ready, which opens the digest page. Not used unless the user turns the digest on.
- **sidePanel**: The quiz, stats, scorecard and settings are shown in Chrome's side panel next to the page.
- **Host permissions `*://x.com/*` and `*://twitter.com/*`**: The content script runs only on these sites to read the text of the posts currently on screen (to know what was read, to build quizzes and the digest) and to hide video/image-only posts in Distraction mode. No other site is accessed.
- **Remote code**: None. All code is bundled in the package. The only network call is to the Gemini API (generativelanguage.googleapis.com) with the user's own key, to generate quizzes and digests.

## Data usage disclosures (Developer Dashboard > Privacy)

- Collected: "Website content" (post text, sent to Google Gemini only for the user's quiz/digest, only when the user supplied an API key); "Authentication information" (user-provided Gemini API key, stored locally and sent only to Google).
- Not sold, not used for unrelated purposes, not used for creditworthiness or lending. Certify all three limited-use statements.
- Privacy policy URL: the hosted PRIVACY.md.

## Assets

- Icon 128x128: `icons/icon128.png`
- Screenshots 1280x800 (or 640x400): `assets/quiz.png`, `assets/settings.png`, plus the scorecard and digest.
- Small promo tile 440x280 (optional).
