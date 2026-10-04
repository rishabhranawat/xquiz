/**
 * The quiz card: question, answer options / fill-in input, result, the
 * "tweets collected" counter and the empty/error state. All model- and
 * tweet-derived text is written with textContent.
 */

import { QUIZ_TYPES, QUIZ_TYPE_LABELS } from '../shared/constants.js';
import { isFillBlankCorrect, isOptionCorrect } from './answer-check.js';
import { byId, createElement, setHidden } from './dom.js';

/**
 * @param {object} callbacks
 * @param {(isCorrect: boolean) => Promise<void>} callbacks.onAnswer Records the answer.
 * @param {() => Promise<void>} callbacks.onNext Loads the next quiz after "Next Question".
 */
export function createQuizView({ onAnswer, onNext }) {
  const el = {
    notificationDot: byId('notification-dot'),
    emptyState: byId('empty-state'),
    quizCard: byId('quiz-card'),
    quizType: byId('quiz-type'),
    question: byId('quiz-question'),
    options: byId('options-container'),
    fillBlank: byId('fill-blank-container'),
    fillBlankInput: byId('fill-blank-input'),
    submitFillBlank: byId('submit-fill-blank'),
    result: byId('result'),
    resultIcon: byId('result-icon'),
    resultText: byId('result-text'),
    explanation: byId('explanation'),
    nextButton: byId('next-btn'),
    counter: byId('tweet-counter'),
    counterBar: byId('counter-bar'),
    tweetsSeen: byId('tweets-seen'),
    tweetsNeeded: byId('tweets-needed'),
  };

  let currentQuiz = null;
  let answered = false;
  let tweetsPerQuiz = Number(el.tweetsNeeded.textContent) || 5;

  /** Hides the quiz card and result, ready for the next quiz. */
  function reset() {
    currentQuiz = null;
    answered = false;
    setHidden(el.quizCard, true);
    setHidden(el.result, true);
    el.fillBlankInput.disabled = false;
    el.submitFillBlank.disabled = false;
  }

  function updateProgress(current, total) {
    tweetsPerQuiz = total;
    el.tweetsSeen.textContent = current;
    el.tweetsNeeded.textContent = total;
    el.counterBar.style.width = `${Math.min((current / total) * 100, 100)}%`;
    // Show the counter while collecting, hide it while a quiz is on screen.
    setHidden(el.counter, currentQuiz !== null);
  }

  async function submitAnswer(isCorrect) {
    if (answered) return;
    answered = true;
    await onAnswer(isCorrect);
    showResult(isCorrect);
  }

  function showResult(isCorrect) {
    setHidden(el.result, false);
    el.resultIcon.textContent = isCorrect ? '✓' : '✗';
    el.resultIcon.className = `result-icon ${isCorrect ? 'correct' : 'incorrect'}`;
    el.resultText.textContent = isCorrect ? 'Correct!' : 'Not quite';
    el.resultText.className = `result-text ${isCorrect ? 'correct' : 'incorrect'}`;

    let explanation = currentQuiz.explanation;
    if (!isCorrect && currentQuiz.type === QUIZ_TYPES.FILL_BLANK) {
      explanation = `The answer was: "${currentQuiz.answer}"\n\n${explanation}`;
    }
    el.explanation.textContent = explanation;
  }

  function selectOption(index, button) {
    if (answered) return;
    const isCorrect = isOptionCorrect(currentQuiz, index);

    el.options.querySelectorAll('.option-btn').forEach((optionButton, i) => {
      optionButton.disabled = true;
      if (isOptionCorrect(currentQuiz, i)) optionButton.classList.add('reveal');
    });
    button.classList.add(isCorrect ? 'correct' : 'incorrect');

    return submitAnswer(isCorrect);
  }

  function submitFillBlank() {
    if (answered) return;
    el.fillBlankInput.disabled = true;
    el.submitFillBlank.disabled = true;
    return submitAnswer(isFillBlankCorrect(el.fillBlankInput.value, currentQuiz.answer));
  }

  function renderOptions(options) {
    el.options.replaceChildren(
      ...options.map((option, index) => {
        const button = createElement('button', 'option-btn', option);
        button.addEventListener('click', () => selectOption(index, button));
        return button;
      })
    );
  }

  el.submitFillBlank.addEventListener('click', submitFillBlank);
  el.fillBlankInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitFillBlank();
  });
  el.nextButton.addEventListener('click', async () => {
    reset();
    await onNext();
  });

  return {
    /** True while a quiz is on screen. */
    hasActiveQuiz: () => currentQuiz !== null,

    /** Total tweets needed per quiz, for the progress counter. */
    getTweetsPerQuiz: () => tweetsPerQuiz,

    updateProgress,

    /** Updates the "needed" total without touching the collected count. */
    setTweetsPerQuiz(total) {
      tweetsPerQuiz = total;
      el.tweetsNeeded.textContent = total;
    },

    showNotification: () => setHidden(el.notificationDot, false),

    /** Displays a quiz returned by the background. */
    show(quiz) {
      currentQuiz = quiz;
      answered = false;
      setHidden(el.notificationDot, true);
      setHidden(el.emptyState, true);
      setHidden(el.counter, true);
      setHidden(el.quizCard, false);
      setHidden(el.result, true);

      el.quizType.textContent = QUIZ_TYPE_LABELS[quiz.type] || quiz.type;
      el.question.textContent = quiz.question;
      el.options.replaceChildren();
      el.fillBlankInput.value = '';
      el.fillBlankInput.disabled = false;
      el.submitFillBlank.disabled = false;

      const isFillBlank = quiz.type === QUIZ_TYPES.FILL_BLANK;
      setHidden(el.fillBlank, !isFillBlank);
      if (isFillBlank) el.fillBlankInput.focus();
      else renderOptions(quiz.options);
    },

    /** Shows the empty state with a custom title and message (also used for errors). */
    showMessage(message, title = 'Error') {
      setHidden(el.emptyState, false);
      setHidden(el.quizCard, true);
      el.emptyState.querySelector('.empty-text').textContent = title;
      el.emptyState.querySelector('.empty-subtext').textContent = message;
    },

    /** Shows the empty state and the progress counter (no quiz queued). */
    showIdle() {
      setHidden(el.emptyState, false);
      setHidden(el.counter, false);
      updateProgress(0, tweetsPerQuiz);
    },
  };
}
