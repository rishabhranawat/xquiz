// XQuiz Content Script - Extracts tweets from Twitter/X

const seenTweetIds = new Set();
const seenTweetHashes = new Set(); // Content-based deduplication
let tweetBuffer = [];
let tweetsPerQuiz = 5;
let isActive = false;
let statusIndicator = null;

// Attention tracking: tweets currently being viewed
const tweetViewTimers = new Map(); // tweetElement -> { startTime, timeoutId }
const REQUIRED_VIEW_TIME = 2000; // 2 seconds
const VISIBILITY_THRESHOLD = 0.5; // 50% visible

// Check if extension context is still valid
function isExtensionValid() {
  try {
    return chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Check if we're on the home feed (not profile, tweet, settings, etc.)
function isOnHomeFeed() {
  const path = window.location.pathname;
  const validPaths = ['/home', '/'];

  // Check for home feed or "For You" / "Following" tabs
  if (validPaths.includes(path)) return true;

  // Also check for x.com without path
  if (path === '' || path === '/') {
    // Make sure we're not on a subdomain or different page
    return true;
  }

  return false;
}

// Create floating status indicator
function createStatusIndicator() {
  if (statusIndicator) return;
  if (!document.body) {
    console.log('[XQuiz] Body not ready, retrying...');
    setTimeout(createStatusIndicator, 100);
    return;
  }

  // Remove any existing indicator
  const existing = document.getElementById('xquiz-status');
  if (existing) existing.remove();

  statusIndicator = document.createElement('div');
  statusIndicator.id = 'xquiz-status';
  statusIndicator.innerHTML = `
    <div class="xquiz-status-dot"></div>
    <span class="xquiz-status-text">XQuiz</span>
    <span class="xquiz-status-label">NOT READING</span>
    <span class="xquiz-status-count">0/${tweetsPerQuiz}</span>
  `;

  const style = document.createElement('style');
  style.id = 'xquiz-status-style';
  style.textContent = `
    #xquiz-status {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      background: rgba(10, 10, 10, 0.95) !important;
      border: 1px solid rgba(239, 68, 68, 0.5) !important;
      border-radius: 20px !important;
      padding: 8px 14px !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      color: #a1a1aa !important;
      z-index: 2147483647 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.3s ease !important;
      cursor: default !important;
      user-select: none !important;
      pointer-events: auto !important;
    }

    #xquiz-status:hover {
      background: rgba(20, 20, 20, 0.98) !important;
    }

    /* Active/Reading state - GREEN */
    #xquiz-status.reading {
      border-color: rgba(34, 197, 94, 0.5) !important;
    }

    #xquiz-status.reading .xquiz-status-dot {
      background: #22c55e !important;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.8) !important;
      animation: xquiz-flash-green 1s ease-in-out infinite !important;
    }

    #xquiz-status.reading .xquiz-status-label {
      color: #22c55e !important;
    }

    /* Inactive/Not Reading state - RED */
    #xquiz-status:not(.reading) {
      border-color: rgba(239, 68, 68, 0.5) !important;
    }

    #xquiz-status:not(.reading) .xquiz-status-dot {
      background: #ef4444 !important;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.8) !important;
      animation: xquiz-flash-red 1.5s ease-in-out infinite !important;
    }

    #xquiz-status:not(.reading) .xquiz-status-label {
      color: #ef4444 !important;
    }

    #xquiz-status:not(.reading) .xquiz-status-count {
      display: none !important;
    }

    .xquiz-status-dot {
      width: 10px !important;
      height: 10px !important;
      border-radius: 50% !important;
      flex-shrink: 0 !important;
    }

    @keyframes xquiz-flash-green {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
      }
      50% {
        opacity: 0.7;
        box-shadow: 0 0 20px rgba(34, 197, 94, 1);
      }
    }

    @keyframes xquiz-flash-red {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }
      50% {
        opacity: 0.5;
        box-shadow: 0 0 4px rgba(239, 68, 68, 0.4);
      }
    }

    .xquiz-status-text {
      color: #fafafa !important;
      font-weight: 600 !important;
    }

    .xquiz-status-label {
      font-size: 10px !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }

    .xquiz-status-count {
      color: #3b82f6 !important;
      font-weight: 600 !important;
      background: rgba(59, 130, 246, 0.1) !important;
      padding: 2px 8px !important;
      border-radius: 10px !important;
    }
  `;

  // Remove existing style if any
  const existingStyle = document.getElementById('xquiz-status-style');
  if (existingStyle) existingStyle.remove();

  document.head.appendChild(style);
  document.body.appendChild(statusIndicator);

  console.log('[XQuiz] Status indicator created');
}

function updateStatusIndicator(active, count = 0) {
  if (!statusIndicator) return;

  const countEl = statusIndicator.querySelector('.xquiz-status-count');
  const labelEl = statusIndicator.querySelector('.xquiz-status-label');

  if (active) {
    statusIndicator.classList.add('reading');
    labelEl.textContent = 'READING';
    countEl.textContent = `${count}/${tweetsPerQuiz}`;
    countEl.style.display = 'inline';
  } else {
    statusIndicator.classList.remove('reading');
    labelEl.textContent = 'NOT READING';
    countEl.style.display = 'none';
  }
}

function removeStatusIndicator() {
  if (statusIndicator) {
    statusIndicator.remove();
    statusIndicator = null;
  }
}

// Load settings
chrome.storage.sync.get(['tweetsPerQuiz'], (result) => {
  if (result.tweetsPerQuiz) {
    tweetsPerQuiz = result.tweetsPerQuiz;
  }
});

// Listen for settings updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.tweetsPerQuiz) {
    tweetsPerQuiz = changes.tweetsPerQuiz.newValue;
  }
});

// Create a hash from tweet content for deduplication
function hashTweet(author, text) {
  const content = `${author}:${text.slice(0, 100)}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function extractTweetId(tweetElement) {
  // Try multiple methods to get a stable tweet ID

  // Method 1: From timestamp link (most reliable)
  const timestampLink = tweetElement.querySelector('time')?.parentElement;
  if (timestampLink?.tagName === 'A') {
    const href = timestampLink.getAttribute('href');
    if (href) {
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }
  }

  // Method 2: From any status link in the tweet
  const statusLinks = tweetElement.querySelectorAll('a[href*="/status/"]');
  for (const link of statusLinks) {
    const href = link.getAttribute('href');
    const match = href?.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  // Method 3: From tweet analytics link
  const analyticsLink = tweetElement.querySelector('a[href*="/analytics"]');
  if (analyticsLink) {
    const href = analyticsLink.getAttribute('href');
    const match = href?.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  return null;
}

function extractTweetData(tweetElement) {
  try {
    // Get tweet text
    const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextElement?.innerText || '';

    if (!tweetText) return null;

    // Get author handle
    const userNameElement = tweetElement.querySelector('[data-testid="User-Name"]');
    let authorHandle = 'unknown';

    // Try to get handle from the user link
    const userLinks = userNameElement?.querySelectorAll('a[href^="/"]');
    if (userLinks) {
      for (const link of userLinks) {
        const href = link.getAttribute('href');
        if (!href) continue;

        // Skip non-user links (like /status/, /hashtag/, /i/, etc.)
        const slashCount = (href.match(/\//g) || []).length;
        if (slashCount === 1 && !href.includes('?')) {
          // href is like "/username"
          const handle = href.slice(1);
          if (handle && !['i', 'home', 'explore', 'search', 'notifications', 'messages'].includes(handle)) {
            authorHandle = handle;
            break;
          }
        }
      }
    }

    // Get display name
    const displayNameElement = userNameElement?.querySelector('span')?.innerText || authorHandle;

    // Get tweet ID using robust extraction
    const tweetId = extractTweetId(tweetElement);

    // Create content hash for deduplication
    const contentHash = hashTweet(authorHandle, tweetText);

    // Skip if we've seen this content before (even if ID extraction failed)
    if (seenTweetHashes.has(contentHash)) {
      return null;
    }

    // Get media alt text if present
    const mediaElements = tweetElement.querySelectorAll('img[alt]:not([alt=""])');
    const mediaAltTexts = Array.from(mediaElements)
      .map(img => img.alt)
      .filter(alt => alt && !alt.includes('Avatar') && !alt.includes('Image') && alt.length > 10);

    return {
      id: tweetId || contentHash, // Use content hash as fallback ID
      contentHash,
      text: tweetText,
      author: authorHandle,
      displayName: displayNameElement,
      mediaAlt: mediaAltTexts,
      timestamp: Date.now()
    };
  } catch (e) {
    console.error('[XQuiz] Error extracting tweet:', e);
    return null;
  }
}

function processTweet(tweetElement) {
  const tweetData = extractTweetData(tweetElement);

  if (!tweetData) return;

  // Skip if already seen (by ID or content hash)
  if (seenTweetIds.has(tweetData.id) || seenTweetHashes.has(tweetData.contentHash)) {
    return;
  }

  // Skip very short tweets (likely not meaningful content)
  if (tweetData.text.length < 20) {
    return;
  }

  // Skip retweet indicators, ads, etc.
  if (tweetData.text.startsWith('Promoted') || tweetData.text.startsWith('Ad')) {
    return;
  }

  // Mark as seen
  seenTweetIds.add(tweetData.id);
  seenTweetHashes.add(tweetData.contentHash);
  tweetBuffer.push(tweetData);

  console.log(`[XQuiz] ✓ Read tweet ${tweetBuffer.length}/${tweetsPerQuiz} from @${tweetData.author}: "${tweetData.text.slice(0, 50)}..."`);

  // Send progress update
  sendProgressUpdate();

  // Send batch to background when we have enough tweets
  if (tweetBuffer.length >= tweetsPerQuiz) {
    sendTweetsToBackground();
  }
}

function sendProgressUpdate() {
  if (!isExtensionValid()) return;

  // Update the floating indicator
  updateStatusIndicator(isActive, tweetBuffer.length);

  chrome.runtime.sendMessage({
    type: 'TWEET_PROGRESS',
    current: tweetBuffer.length,
    total: tweetsPerQuiz
  }).catch(() => {
    // Side panel might not be open or extension reloaded
  });
}

function sendTweetsToBackground() {
  if (tweetBuffer.length === 0) return;
  if (!isExtensionValid()) return;

  const tweetsToSend = [...tweetBuffer];
  tweetBuffer = [];

  console.log(`[XQuiz] Sending ${tweetsToSend.length} tweets for quiz generation`);

  chrome.runtime.sendMessage({
    type: 'TWEETS_COLLECTED',
    tweets: tweetsToSend
  }).catch(err => {
    // Side panel might not be open or extension reloaded
    console.log('[XQuiz] Could not send tweets:', err.message);
  });

  // Reset progress counter
  sendProgressUpdate();
}

// Handle tweet entering/exiting viewport
function handleTweetVisibility(entries) {
  if (!isExtensionValid()) {
    visibilityObserver.disconnect();
    return;
  }

  // Don't process if not on home feed
  if (!isActive) return;

  for (const entry of entries) {
    const tweetElement = entry.target;

    if (entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD) {
      // Tweet is 50%+ visible - start timer if not already running
      if (!tweetViewTimers.has(tweetElement)) {
        // Add subtle tracking indicator
        tweetElement.style.transition = 'box-shadow 0.3s ease';
        tweetElement.style.boxShadow = 'inset 0 0 0 2px rgba(59, 130, 246, 0.3)';

        const timeoutId = setTimeout(() => {
          // Tweet has been visible for required time - process it
          tweetViewTimers.delete(tweetElement);

          // Flash green to show it was counted
          tweetElement.style.boxShadow = 'inset 0 0 0 2px rgba(34, 197, 94, 0.5)';
          setTimeout(() => {
            tweetElement.style.boxShadow = 'none';
          }, 500);

          processTweet(tweetElement);
          // Stop observing this tweet
          visibilityObserver.unobserve(tweetElement);
        }, REQUIRED_VIEW_TIME);

        tweetViewTimers.set(tweetElement, {
          startTime: Date.now(),
          timeoutId
        });
      }
    } else {
      // Tweet is no longer sufficiently visible - cancel timer
      const timerData = tweetViewTimers.get(tweetElement);
      if (timerData) {
        clearTimeout(timerData.timeoutId);
        tweetViewTimers.delete(tweetElement);
        // Remove tracking indicator
        tweetElement.style.boxShadow = 'none';
      }
    }
  }
}

// Set up Intersection Observer for visibility tracking
const visibilityObserver = new IntersectionObserver(handleTweetVisibility, {
  threshold: [0, VISIBILITY_THRESHOLD, 1.0], // Track at 0%, 50%, and 100% visibility
  rootMargin: '0px'
});

// Track tweets we're already observing
const observedTweets = new WeakSet();

function scanForTweets() {
  if (!isExtensionValid()) {
    console.log('[XQuiz] Extension context invalidated, stopping');
    visibilityObserver.disconnect();
    domObserver.disconnect();
    removeStatusIndicator();
    return;
  }

  // Check if we're on the home feed
  const onFeed = isOnHomeFeed();

  if (onFeed !== isActive) {
    isActive = onFeed;
    updateStatusIndicator(isActive, tweetBuffer.length);

    if (isActive) {
      console.log('[XQuiz] Now on home feed - tracking active');
    } else {
      console.log('[XQuiz] Left home feed - tracking paused');
      // Clear any pending timers when leaving feed
      for (const [element, timerData] of tweetViewTimers) {
        clearTimeout(timerData.timeoutId);
        element.style.boxShadow = 'none';
      }
      tweetViewTimers.clear();
    }
  }

  // Only scan if on home feed
  if (!isActive) return;

  const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');

  for (const tweet of tweetArticles) {
    // Skip if already observing this tweet
    if (observedTweets.has(tweet)) continue;

    // Skip if tweet content already processed
    const tweetTextElement = tweet.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextElement?.innerText || '';
    if (!tweetText || tweetText.length < 20) continue;

    // Get a quick hash to check if already seen
    const userNameElement = tweet.querySelector('[data-testid="User-Name"]');
    const authorLink = userNameElement?.querySelector('a[href^="/"]');
    const authorHandle = authorLink?.getAttribute('href')?.slice(1)?.split('/')[0] || 'unknown';
    const contentHash = hashTweet(authorHandle, tweetText);

    if (seenTweetHashes.has(contentHash)) continue;

    // Start observing this tweet for visibility
    observedTweets.add(tweet);
    visibilityObserver.observe(tweet);
  }
}

// Set up MutationObserver to watch for new tweets in DOM
const domObserver = new MutationObserver((mutations) => {
  let hasNewContent = false;

  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      hasNewContent = true;
      break;
    }
  }

  if (hasNewContent) {
    // Debounce the scan
    clearTimeout(window.xquizScanTimeout);
    window.xquizScanTimeout = setTimeout(scanForTweets, 300);
  }
});

// Start observing
function startObserving() {
  console.log('[XQuiz] startObserving called');

  // Create the status indicator first
  try {
    createStatusIndicator();
  } catch (e) {
    console.error('[XQuiz] Error creating status indicator:', e);
  }

  const timeline = document.querySelector('main') || document.body;

  domObserver.observe(timeline, {
    childList: true,
    subtree: true
  });

  // Watch for URL changes (Twitter is a SPA)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[XQuiz] URL changed, checking feed status...');
      scanForTweets(); // This will update active state
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    console.log('[XQuiz] Navigation detected, checking feed status...');
    setTimeout(scanForTweets, 100);
  });

  // Initial scan after a short delay
  setTimeout(() => {
    scanForTweets();
    const tweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
    const feedStatus = isOnHomeFeed() ? 'ON HOME FEED' : 'NOT on home feed';
    console.log(`[XQuiz] Initialized - ${feedStatus}`);
    console.log(`[XQuiz] Found ${tweetCount} tweets on page`);
    console.log(`[XQuiz] Settings: ${tweetsPerQuiz} tweets per quiz, 2s view time required`);
  }, 1000);

  console.log('[XQuiz] Content script loaded');
  console.log('[XQuiz] Only active on home feed - look for the indicator in bottom right');
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}

// Also scan on scroll (backup for virtualized content)
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(scanForTweets, 500);
}, { passive: true });

// Fallback: ensure indicator is created after a delay
setTimeout(() => {
  if (!document.getElementById('xquiz-status')) {
    console.log('[XQuiz] Fallback: creating indicator');
    createStatusIndicator();
    updateStatusIndicator(isOnHomeFeed(), tweetBuffer.length);
  }
}, 2000);

console.log('[XQuiz] Content script fully loaded');
