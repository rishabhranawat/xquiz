/**
 * XQuiz background service worker (entry point).
 *
 * Composition root only: registers listeners synchronously (required for MV3)
 * and merges each feature module's `messageHandlers` into one router.
 * State is persisted by the feature modules, so nothing here relies on the
 * worker staying alive.
 */

import { registerMessageRouter } from '../shared/messaging.js';
import { messageHandlers as digestHandlers, registerDigest } from './digest.js';
import { messageHandlers as quizGeneratorHandlers } from './quiz-generator.js';
import { messageHandlers as quizHistoryHandlers } from './quiz-history.js';
import { messageHandlers as quizQueueHandlers } from './quiz-queue.js';
import { messageHandlers as readingHandlers } from './reading-store.js';
import {
  messageHandlers as settingsHandlers,
  registerSettingsMigration,
} from './settings-handlers.js';
import { messageHandlers as sidePanelHandlers, registerSidePanel } from './side-panel.js';
import { messageHandlers as statsHandlers } from './stats.js';
import { messageHandlers as tweetHistoryHandlers } from './tweet-history.js';

registerSidePanel();
registerSettingsMigration();
registerDigest();

registerMessageRouter({
  ...quizGeneratorHandlers,
  ...quizQueueHandlers,
  ...quizHistoryHandlers,
  ...tweetHistoryHandlers,
  ...statsHandlers,
  ...settingsHandlers,
  ...sidePanelHandlers,
  ...readingHandlers,
  ...digestHandlers,
});
