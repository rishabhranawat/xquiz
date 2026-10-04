/**
 * Minimal Gemini client shared by quiz and digest generation.
 */

import { GEMINI_API_URL } from './constants.js';

/**
 * Calls Gemini (JSON mode) and returns the raw text of the first candidate.
 * The API key travels in a header, never in the URL, so it cannot leak into
 * logs or error messages.
 * @param {string} apiKey
 * @param {string} prompt
 * @param {{temperature?: number, maxOutputTokens?: number}} [options]
 * @returns {Promise<string>}
 */
export async function requestGeminiText(
  apiKey,
  prompt,
  { temperature = 0.7, maxOutputTokens = 500 } = {}
) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens, responseMimeType: 'application/json' },
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
