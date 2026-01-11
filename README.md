# XQuiz

A Chrome extension that tests your attention and retention while scrolling Twitter/X.

## What it does

XQuiz monitors the tweets you scroll past on Twitter/X and periodically generates quiz questions to test how much you're actually absorbing. It uses Google's Gemini AI to create questions based on the content you've read.

## Features

- **Automatic tweet collection** - Tracks tweets as you scroll through your feed
- **AI-generated quizzes** - Creates multiple choice, true/false, and fill-in-the-blank questions
- **Progress tracking** - Monitors your score, accuracy percentage, and answer streaks
- **Shareable scorecards** - Generate and share your retention stats
- **Configurable** - Adjust how many tweets trigger a quiz
- **Video-free mode** - Optional toggle to hide videos from your feed when you want fewer distractions
- **Quiz history** - Review your most recent quiz questions and clear them whenever you like
- **Custom attention timer** - Pick how long a tweet must stay visible before it counts as “read”

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the project folder

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
├── manifest.json           # Extension configuration
├── src/
│   ├── background/
│   │   └── service-worker.js   # Quiz generation, stats, API calls
│   ├── content/
│   │   └── content.js          # Tweet collection from page
│   ├── sidepanel/
│   │   ├── index.html          # Side panel UI
│   │   ├── styles.css          # Styling
│   │   └── sidepanel.js        # Panel logic and interactions
│   └── shared/
│       └── constants.js        # Shared constants
└── icons/                  # Extension icons
```

## Requirements

- Chrome browser (Manifest V3)
- Gemini API key
