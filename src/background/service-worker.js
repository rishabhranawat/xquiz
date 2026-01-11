// XQuiz Background Service Worker

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

let quizQueue = [];
let usedTweetHashes = new Set(); // Track tweets already used in quizzes
let stats = {
  totalQuestions: 0,
  correctAnswers: 0,
  currentStreak: 0,
  bestStreak: 0
};

// Load stats and used tweets from storage
chrome.storage.local.get(['stats', 'usedTweetHashes'], (result) => {
  if (result.stats) {
    stats = result.stats;
  }
  if (result.usedTweetHashes) {
    usedTweetHashes = new Set(result.usedTweetHashes);
  }
});

// Open side panel when extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Auto enable/disable side panel based on the current tab's URL.
const X_HOSTNAMES = ['x.com', 'twitter.com'];

async function updateSidePanel(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    // Ensure the tab has a URL before proceeding.
    if (!tab.url) {
      return;
    }

    const url = new URL(tab.url);
    if (X_HOSTNAMES.includes(url.hostname)) {
      // Enable the side panel for X/Twitter, allowing it to be opened by the user.
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'src/sidepanel/index.html',
        enabled: true,
      });
      // Notify the content script so it can request an automatic open on user gesture.
      chrome.tabs.sendMessage(tabId, { type: 'XQUIZ_ENABLE_AUTO_OPEN' }).catch(() => {});
    } else {
      // Disable the side panel for all other sites. This will cause it to close.
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: false,
      });
    }
  } catch (error) {
    // This can happen if the tab is closed before the update completes.
    console.warn(`[XQuiz] Failed to update side panel for tab ${tabId}:`, error.message);
  }
}

// Update the side panel when a tab's URL changes.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We only need to act when the tab has finished loading and has a URL.
  if (changeInfo.status === 'complete' && tab.url) {
    updateSidePanel(tabId);
  }
});

// Update the side panel when the user switches to a different tab.
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateSidePanel(activeInfo.tabId);
});

function filterUnusedTweets(tweets) {
  return tweets.filter(tweet => {
    const hash = tweet.contentHash || tweet.id;
    return !usedTweetHashes.has(hash);
  });
}

function markTweetsAsUsed(tweets) {
  tweets.forEach(tweet => {
    const hash = tweet.contentHash || tweet.id;
    usedTweetHashes.add(hash);
  });

  // Persist to storage (keep last 1000 hashes to prevent unbounded growth)
  const hashArray = Array.from(usedTweetHashes).slice(-1000);
  usedTweetHashes = new Set(hashArray);
  chrome.storage.local.set({ usedTweetHashes: hashArray });
}

async function generateQuiz(tweets) {
  // Filter out tweets we've already used
  const unusedTweets = filterUnusedTweets(tweets);

  if (unusedTweets.length === 0) {
    console.log('[XQuiz] All tweets have been used before, skipping quiz generation');
    return { error: 'All these tweets have been used in previous quizzes. Keep scrolling for new content!' };
  }

  const settings = await chrome.storage.sync.get(['apiKey']);
  const apiKey = settings.apiKey;

  if (!apiKey) {
    return { error: 'API key not configured. Please add your Gemini API key in settings.' };
  }

  // Mark tweets as used before generating (prevents race conditions)
  markTweetsAsUsed(unusedTweets);

  const tweetContext = unusedTweets.map((t, i) =>
    `Tweet ${i + 1} by @${t.author}: "${t.text}"${t.mediaAlt?.length ? ` [Image: ${t.mediaAlt.join(', ')}]` : ''}`
  ).join('\n\n');

  const prompt = `You are a quiz generator testing a user's attention and retention of content they just scrolled past on Twitter.

Here are the tweets they just read:

${tweetContext}

Generate exactly 1 quiz question to test their retention. Randomly choose one of these formats:
1. multiple_choice - A question with 4 options (a, b, c, d), only one correct
2. true_false - A true/false statement about the content
3. fill_blank - A sentence with a blank to fill in (use ___ for the blank)

IMPORTANT: The question should test actual content from the tweets - facts, claims, opinions, or details mentioned.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "type": "multiple_choice" | "true_false" | "fill_blank",
  "question": "The question text",
  "options": ["a) ...", "b) ...", "c) ...", "d) ..."],
  "answer": "The correct answer (for multiple choice use just the letter like 'a', for true_false use 'true' or 'false', for fill_blank the word/phrase)",
  "explanation": "Brief explanation of why this is correct, referencing the tweet"
}

For true_false, options should be ["True", "False"].
For fill_blank, options should be null.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error('No content in response');
    }

    // Parse the JSON response (handle potential markdown code blocks)
    let cleanJson = textContent.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const quiz = JSON.parse(cleanJson);
    quiz.tweets = unusedTweets; // Include source tweets for reference
    quiz.tweetCount = unusedTweets.length;

    console.log(`[XQuiz] Generated quiz from ${unusedTweets.length} tweets`);

    return quiz;
  } catch (error) {
    console.error('[XQuiz] Quiz generation error:', error);
    return { error: `Failed to generate quiz: ${error.message}` };
  }
}

function updateStats(isCorrect) {
  stats.totalQuestions++;

  if (isCorrect) {
    stats.correctAnswers++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }

  chrome.storage.local.set({ stats });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TWEETS_COLLECTED':
      // Generate quiz from collected tweets
      generateQuiz(message.tweets).then(quiz => {
        if (!quiz.error) {
          quizQueue.push(quiz);
          // Notify side panel that quiz is ready (don't send quiz, let them request it)
          chrome.runtime.sendMessage({ type: 'QUIZ_READY' }).catch(() => {
            // Side panel might not be listening
          });
        }
        sendResponse({ success: !quiz.error });
      });
      return true; // Async response

    case 'REQUEST_QUIZ':
      if (quizQueue.length > 0) {
        sendResponse({ quiz: quizQueue.shift() });
      } else {
        sendResponse({ quiz: null, message: 'Keep scrolling! Quiz will appear after reading more tweets.' });
      }
      break;

    case 'SUBMIT_ANSWER':
      updateStats(message.isCorrect);
      sendResponse({ stats });
      break;

    case 'GET_STATS':
      sendResponse({ stats });
      break;

    case 'GET_SETTINGS':
      chrome.storage.sync.get(['apiKey', 'tweetsPerQuiz'], (result) => {
        sendResponse({
          apiKey: result.apiKey || '',
          tweetsPerQuiz: result.tweetsPerQuiz || 5
        });
      });
      return true;

    case 'UPDATE_SETTINGS':
      chrome.storage.sync.set({
        apiKey: message.apiKey,
        tweetsPerQuiz: message.tweetsPerQuiz
      }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'RESET_STATS':
      stats = {
        totalQuestions: 0,
        correctAnswers: 0,
        currentStreak: 0,
        bestStreak: 0
      };
      chrome.storage.local.set({ stats });
      sendResponse({ stats });
      break;

    case 'CLEAR_TWEET_HISTORY':
      // Allow clearing the used tweet history to start fresh
      usedTweetHashes = new Set();
      chrome.storage.local.set({ usedTweetHashes: [] });
      sendResponse({ success: true });
      break;

    case 'TWEET_PROGRESS':
      // Relay progress to side panel
      chrome.runtime.sendMessage({
        type: 'TWEET_PROGRESS',
        current: message.current,
        total: message.total
      }).catch(() => {});
      break;

    case 'GENERATE_SCORECARD':
      // Scorecard is now generated client-side with canvas
      sendResponse({ useCanvas: true, accuracy: message.accuracy, streak: message.streak });
      break;

    case 'OPEN_SIDE_PANEL':
      if (sender.tab?.id != null) {
        chrome.sidePanel.open({ tabId: sender.tab.id })
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
      }
      sendResponse({ success: false, error: 'Missing tab information for side panel open request.' });
      break;
  }
});
