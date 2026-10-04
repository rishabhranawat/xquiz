/**
 * XQuiz side panel (entry point).
 *
 * Creates each view and connects them to the background through messages.
 * To add a view: create `<name>-view.js` exporting `create<Name>View()`,
 * add its markup to index.html and instantiate it in `init()`.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { listenForMessages, sendMessage } from '../shared/messaging.js';
import { createEmptyStats } from '../shared/stats.js';
import { createDigestView } from './digest-view.js';
import { createHistoryView } from './history-view.js';
import { createQuizView } from './quiz-view.js';
import { createSettingsView } from './settings-view.js';
import { createShareView } from './share-view.js';
import { createStatsView } from './stats-view.js';

async function init() {
  const statsView = createStatsView();
  const historyView = createHistoryView();

  const quizView = createQuizView({
    async onAnswer(isCorrect) {
      const response = await sendMessage(MESSAGE_TYPES.SUBMIT_ANSWER, { isCorrect });
      if (response?.stats) statsView.render(response.stats);
    },
    async onNext() {
      const { quiz } = await sendMessage(MESSAGE_TYPES.REQUEST_QUIZ, {}, { quiz: null });
      if (quiz) quizView.show(quiz);
      else quizView.showIdle();
    },
  });

  const settingsView = createSettingsView({
    onSaved: (settings) => quizView.setTweetsPerQuiz(settings.tweetsPerQuiz),
    onStatsReset: (stats) => statsView.render(stats),
  });

  createShareView();
  const digestView = createDigestView();

  /** Pulls the next queued quiz (if any) into the panel. */
  async function fetchAndDisplayQuiz() {
    const response = await sendMessage(MESSAGE_TYPES.REQUEST_QUIZ, {}, { quiz: null });
    if (response.quiz) {
      quizView.show(response.quiz);
      await historyView.load();
    } else if (response.message) {
      quizView.showMessage(response.message, 'Keep scrolling');
    }
  }

  listenForMessages({
    [MESSAGE_TYPES.QUIZ_READY]: () => {
      quizView.showNotification();
      quizView.updateProgress(0, quizView.getTweetsPerQuiz());
      if (!quizView.hasActiveQuiz()) fetchAndDisplayQuiz();
    },
    [MESSAGE_TYPES.TWEET_PROGRESS]: ({ current, total }) => quizView.updateProgress(current, total),
    [MESSAGE_TYPES.QUIZ_ERROR]: ({ message }) =>
      quizView.showMessage(message || 'Unable to generate quiz. Check your settings.'),
  });

  const settings = await settingsView.load();
  quizView.setTweetsPerQuiz(settings.tweetsPerQuiz);

  const statsResponse = await sendMessage(MESSAGE_TYPES.GET_STATS, {}, null);
  statsView.render(statsResponse?.stats ?? createEmptyStats());

  await historyView.load();
  digestView.refreshStatus();
  await fetchAndDisplayQuiz();
}

init();
