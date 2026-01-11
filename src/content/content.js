// XQuiz Content Script - Extracts tweets from Twitter/X

const seenTweetIds = new Set();
const seenTweetHashes = new Set(); // Content-based deduplication
let tweetBuffer = [];
let tweetsPerQuiz = 5;
let isActive = false;
let statusIndicator = null;
// Auto-open state for the side panel – we need a user gesture to request it.
let autoOpenEnabled = true;
let autoOpenListenersAttached = false;
let autoOpenRequestInFlight = false;
let removeVideosFromFeed = false;
let allowedPages = new Set(['home']);
const VIDEO_HIDE_STYLE_ID = 'xquiz-hide-videos-style';
const RESERVED_USER_SLUGS = new Set([
  'home', 'explore', 'notifications', 'messages', 'settings', 'search',
  'i', 'tos', 'privacy', 'compose', 'signup', 'login', 'about', 'support'
]);

// Attention tracking: tweets currently being hovered
const tweetHoverTimers = new Map(); // tweetElement -> { startTime, timeoutId }
let requiredViewTimeMs = 2000; // default hover time before counting

function handleAutoOpenGesture() {
  if (!autoOpenEnabled || autoOpenRequestInFlight) {
    return;
  }

  autoOpenRequestInFlight = true;
  detachAutoOpenListeners();

  if (!isExtensionValid()) {
    autoOpenRequestInFlight = false;
    autoOpenEnabled = true;
    attachAutoOpenListeners();
    return;
  }

  chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (response) => {
    autoOpenRequestInFlight = false;
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError || !response?.success) {
      // Try again on the next user gesture if Chrome rejected the request.
      attachAutoOpenListeners();
      return;
    }

    // We successfully opened the panel; wait for the background script to re-arm us.
    autoOpenEnabled = false;
  });
}

function attachAutoOpenListeners() {
  if (!autoOpenEnabled || autoOpenListenersAttached || autoOpenRequestInFlight) {
    return;
  }

  window.addEventListener('pointerdown', handleAutoOpenGesture, true);
  window.addEventListener('keydown', handleAutoOpenGesture, true);
  autoOpenListenersAttached = true;
}

function detachAutoOpenListeners() {
  if (!autoOpenListenersAttached) {
    return;
  }

  window.removeEventListener('pointerdown', handleAutoOpenGesture, true);
  window.removeEventListener('keydown', handleAutoOpenGesture, true);
  autoOpenListenersAttached = false;
}

attachAutoOpenListeners();

function updateAllowedPages(newPages) {
  if (Array.isArray(newPages) && newPages.length) {
    allowedPages = new Set(newPages);
  } else {
    allowedPages = new Set(['home']);
  }
}

function isProfilePath(segments) {
  if (!segments.length) return false;
  const handle = segments[0].toLowerCase();
  if (RESERVED_USER_SLUGS.has(handle)) return false;
  return /^[a-z0-9_]{1,15}$/i.test(handle);
}

function isOnTrackedPage() {
  const path = window.location.pathname || '/';
  const segments = path.split('/').filter(Boolean);

  if (allowedPages.has('home') && (path === '/' || path === '/home')) {
    return true;
  }

  if (allowedPages.has('profiles') && isProfilePath(segments)) {
    return true;
  }

  return false;
}

function tweetContainsVideo(tweetElement) {
  if (!tweetElement) return false;
  return !!tweetElement.querySelector('video, [data-testid="videoPlayer"], [aria-label="Video"]');
}

function ensureVideoHideStyle() {
  if (document.getElementById(VIDEO_HIDE_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = VIDEO_HIDE_STYLE_ID;
  style.textContent = `
    html.xquiz-hide-videos article[data-testid="tweet"]:has(video),
    html.xquiz-hide-videos article[data-testid="tweet"]:has([data-testid="videoPlayer"]),
    html.xquiz-hide-videos article[data-testid="tweet"]:has([aria-label="Video"]) {
      display: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

function applyVideoRemovalSetting() {
  if (removeVideosFromFeed) {
    ensureVideoHideStyle();
    document.documentElement.classList.add('xquiz-hide-videos');
  } else {
    document.documentElement.classList.remove('xquiz-hide-videos');
    const existing = document.getElementById(VIDEO_HIDE_STYLE_ID);
    if (existing) {
      existing.remove();
    }
  }
}

// Check if extension context is still valid
function isExtensionValid() {
  try {
    return chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
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
chrome.storage.sync.get(['tweetsPerQuiz', 'removeVideos', 'viewTimeMs', 'allowedPages'], (result) => {
  if (result.tweetsPerQuiz) {
    tweetsPerQuiz = result.tweetsPerQuiz;
  }
  removeVideosFromFeed = !!result.removeVideos;
  if (result.viewTimeMs) {
    requiredViewTimeMs = result.viewTimeMs;
  }
  updateAllowedPages(result.allowedPages);
  applyVideoRemovalSetting();
});

// Listen for settings updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.tweetsPerQuiz) {
    tweetsPerQuiz = changes.tweetsPerQuiz.newValue;
  }
  if (changes.removeVideos) {
    removeVideosFromFeed = !!changes.removeVideos.newValue;
    applyVideoRemovalSetting();
  }
  if (changes.viewTimeMs) {
    requiredViewTimeMs = changes.viewTimeMs.newValue;
  }
  if (changes.allowedPages) {
    updateAllowedPages(changes.allowedPages.newValue);
    // re-evaluate immediately
    isActive = isOnTrackedPage();
    updateStatusIndicator(isActive, tweetBuffer.length);
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

// Handle mouse entering a tweet
function handleTweetMouseEnter(event) {
  const tweetElement = event.currentTarget;

  if (!isExtensionValid() || !isActive) return;

  // Don't start a new timer if one is already running
  if (tweetHoverTimers.has(tweetElement)) return;

  // Add subtle tracking indicator
  tweetElement.style.transition = 'box-shadow 0.3s ease';
  tweetElement.style.boxShadow = 'inset 0 0 0 2px rgba(59, 130, 246, 0.3)';

  const timeoutId = setTimeout(() => {
    // Tweet has been hovered for required time - process it
    tweetHoverTimers.delete(tweetElement);

    // Flash green to show it was counted
    tweetElement.style.boxShadow = 'inset 0 0 0 2px rgba(34, 197, 94, 0.5)';
    setTimeout(() => {
      tweetElement.style.boxShadow = 'none';
    }, 500);

    processTweet(tweetElement);

    // Remove hover listeners since tweet is processed
    tweetElement.removeEventListener('mouseenter', handleTweetMouseEnter);
    tweetElement.removeEventListener('mouseleave', handleTweetMouseLeave);
  }, requiredViewTimeMs);

  tweetHoverTimers.set(tweetElement, {
    startTime: Date.now(),
    timeoutId
  });
}

// Handle mouse leaving a tweet
function handleTweetMouseLeave(event) {
  const tweetElement = event.currentTarget;

  const timerData = tweetHoverTimers.get(tweetElement);
  if (timerData) {
    clearTimeout(timerData.timeoutId);
    tweetHoverTimers.delete(tweetElement);
    // Remove tracking indicator
    tweetElement.style.boxShadow = 'none';
  }
}

// Track tweets we've already attached hover listeners to
const observedTweets = new WeakSet();

function scanForTweets() {
  if (!isExtensionValid()) {
    console.log('[XQuiz] Extension context invalidated, stopping');
    domObserver.disconnect();
    removeStatusIndicator();
    return;
  }

  // Check if we're on a tracked page
  const onFeed = isOnTrackedPage();

  if (onFeed !== isActive) {
    isActive = onFeed;
    updateStatusIndicator(isActive, tweetBuffer.length);

    if (isActive) {
      console.log('[XQuiz] Now on a tracked page - tracking active');
    } else {
      console.log('[XQuiz] Left tracked pages - tracking paused');
      // Clear any pending hover timers when leaving feed
      for (const [element, timerData] of tweetHoverTimers) {
        clearTimeout(timerData.timeoutId);
        element.style.boxShadow = 'none';
      }
      tweetHoverTimers.clear();
    }
  }

  // Only scan if on tracked pages
  if (!isActive) return;

  const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');

  for (const tweet of tweetArticles) {
    if (removeVideosFromFeed && tweetContainsVideo(tweet)) {
      continue;
    }

    // Skip if already tracking this tweet
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

    // Attach hover listeners to track this tweet
    observedTweets.add(tweet);
    tweet.addEventListener('mouseenter', handleTweetMouseEnter);
    tweet.addEventListener('mouseleave', handleTweetMouseLeave);
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
    const feedStatus = isOnTrackedPage() ? 'TRACKING' : 'NOT TRACKING';
    console.log(`[XQuiz] Initialized - ${feedStatus}`);
    console.log(`[XQuiz] Found ${tweetCount} tweets on page`);
    const hoverSeconds = (requiredViewTimeMs / 1000).toFixed(1).replace(/\.0$/, '');
    console.log(`[XQuiz] Settings: ${tweetsPerQuiz} tweets per quiz, ${hoverSeconds}s hover time required`);
  }, 1000);

  console.log('[XQuiz] Content script loaded');
console.log('[XQuiz] Only active on selected pages - look for the indicator in bottom right');
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
    updateStatusIndicator(isOnTrackedPage(), tweetBuffer.length);
  }
}, 2000);

console.log('[XQuiz] Content script fully loaded');

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'XQUIZ_ENABLE_AUTO_OPEN') {
    autoOpenEnabled = true;
    autoOpenRequestInFlight = false;
    attachAutoOpenListeners();
  }
});
