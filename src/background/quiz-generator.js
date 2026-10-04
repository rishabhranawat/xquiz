/**
 * Turns collected tweets into a quiz question via the Gemini API, and handles
 * the TWEETS_COLLECTED message that kicks the whole flow off.
 */

import { GEMINI_API_URL, MESSAGE_TYPES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { broadcast } from '../shared/messaging.js';
import { loadSettings } from '../shared/storage.js';
import { parseQuizResponse } from './quiz-parser.js';
import { enqueueQuiz } from './quiz-queue.js';
import { claimUnusedTweets } from './tweet-history.js';

const NO_NEW_TWEETS_ERROR =
  'All these tweets have been used in previous quizzes. Keep scrolling for new content!';
const NO_API_KEY_ERROR = 'API key not configured. Please add your Gemini API key in settings.';

/**
 * Builds the model prompt for a batch of tweets.
 * @param {{author: string, text: string, mediaAlt?: string[]}[]} tweets
 * @returns {string}
 */
export function buildQuizPrompt(tweets) {
  const tweetContext = tweets
    .map((t, i) => {
      const media = t.mediaAlt?.length ? ` [Image: ${t.mediaAlt.join(', ')}]` : '';
      return `Tweet ${i + 1} by @${t.author}: "${t.text}"${media}`;
    })
    .join('\n\n');

  return `You are a quiz generator testing a user's attention and retention of content they just scrolled past on Twitter.

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
}

/**
 * Calls Gemini and returns the raw text of the first candidate. The API key
 * travels in a header, never in the URL, so it cannot leak into logs or
 * error messages.
 * @param {string} apiKey
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function requestGeminiText(apiKey, prompt) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || 'API request failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content in response');
  return text;
}

/**
 * Generates one quiz from tweets that have not been quizzed before.
 * Used tweets are marked as seen before the API call so concurrent batches
 * cannot produce duplicate quizzes.
 * @param {object[]} tweets
 * @returns {Promise<{quiz: object} | {error: string}>}
 */
export async function generateQuiz(tweets) {
  const { apiKey } = await loadSettings();
  if (!apiKey) return { error: NO_API_KEY_ERROR };

  const unusedTweets = await claimUnusedTweets(tweets);
  if (unusedTweets.length === 0) {
    logger.debug('All tweets were used before; skipping quiz generation');
    return { error: NO_NEW_TWEETS_ERROR };
  }

  try {
    const text = await requestGeminiText(apiKey, buildQuizPrompt(unusedTweets));
    const quiz = parseQuizResponse(text);
    logger.debug(`Generated quiz from ${unusedTweets.length} tweets`);
    return { quiz: { ...quiz, tweets: unusedTweets, tweetCount: unusedTweets.length } };
  } catch (error) {
    logger.error('Quiz generation error:', error.message);
    return { error: `Failed to generate quiz: ${error.message}` };
  }
}

/** Keeps only well-formed tweet objects from an untrusted message payload. */
function sanitizeTweets(tweets) {
  if (!Array.isArray(tweets)) return [];
  return tweets.filter(
    (t) =>
      t && typeof t.text === 'string' && typeof t.author === 'string' && (t.contentHash || t.id)
  );
}

export const messageHandlers = {
  [MESSAGE_TYPES.TWEETS_COLLECTED]: async (message) => {
    const tweets = sanitizeTweets(message.tweets);
    const result = tweets.length
      ? await generateQuiz(tweets)
      : { error: 'No valid tweets received.' };

    if ('error' in result) {
      await broadcast(MESSAGE_TYPES.QUIZ_ERROR, { message: result.error });
      return { success: false, error: result.error };
    }

    await enqueueQuiz(result.quiz);
    await broadcast(MESSAGE_TYPES.QUIZ_READY);
    return { success: true };
  },
};
