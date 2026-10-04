/**
 * Pure parsing/validation of the model's quiz output (no chrome/DOM APIs).
 *
 * Gemini is asked for JSON via `responseMimeType`, so the happy path is a
 * plain JSON.parse. A minimal fallback handles the two failure modes seen in
 * practice: markdown code fences and trailing commas.
 */

import { QUIZ_TYPES } from '../shared/constants.js';

const TRUE_FALSE_OPTIONS = ['True', 'False'];

/** Removes a surrounding ```json ... ``` fence, if any. */
function stripCodeFence(text) {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text.trim();
}

/**
 * Removes trailing commas before `}` / `]`, leaving string contents untouched.
 * @param {string} json
 */
export function removeTrailingCommas(json) {
  let out = '';
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (inString) {
      out += char;
      if (char === '\\') out += json[++i] ?? '';
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === ',' && /^\s*[}\]]/.test(json.slice(i + 1))) {
      // drop the comma
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * Parses model output as JSON, repairing code fences / stray text around the
 * object and trailing commas if the first attempt fails.
 * @param {string} text
 * @returns {unknown}
 * @throws {Error} when the text cannot be parsed.
 */
export function parseJsonLoose(text) {
  const unfenced = stripCodeFence(text);
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    const candidate = start !== -1 && end > start ? unfenced.slice(start, end + 1) : unfenced;
    try {
      return JSON.parse(removeTrailingCommas(candidate));
    } catch {
      throw new Error('Invalid JSON response from API. Please try again.');
    }
  }
}

/**
 * Checks and normalizes a parsed quiz so the UI can rely on its shape.
 * @param {any} raw
 * @returns {{type: string, question: string, options: string[] | null,
 *   answer: string, explanation: string}}
 * @throws {Error} when required fields are missing or inconsistent.
 */
export function validateQuiz(raw) {
  const invalid = (reason) => new Error(`Invalid quiz from API: ${reason}`);
  if (!raw || typeof raw !== 'object') throw invalid('not an object');

  const { type, question, answer } = raw;
  if (!Object.values(QUIZ_TYPES).includes(type)) throw invalid(`unknown type "${type}"`);
  if (typeof question !== 'string' || !question.trim()) throw invalid('missing question');
  if (typeof answer !== 'string' || !answer.trim()) throw invalid('missing answer');

  let options = null;
  if (type === QUIZ_TYPES.TRUE_FALSE) {
    options = TRUE_FALSE_OPTIONS;
  } else if (type === QUIZ_TYPES.MULTIPLE_CHOICE) {
    if (!Array.isArray(raw.options) || raw.options.length < 2) throw invalid('missing options');
    options = raw.options.map(String);
  }

  return {
    type,
    question: question.trim(),
    options,
    answer: answer.trim(),
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
  };
}

/**
 * Parses and validates raw model text into a quiz.
 * @param {string} text
 */
export function parseQuizResponse(text) {
  return validateQuiz(parseJsonLoose(text));
}
