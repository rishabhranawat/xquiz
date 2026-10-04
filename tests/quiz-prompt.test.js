import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildQuizPrompt } from '../src/background/quiz-generator.js';

test('buildQuizPrompt lists every tweet with its author and image descriptions', () => {
  const prompt = buildQuizPrompt([
    { author: 'jack', text: 'first tweet', mediaAlt: ['a cat on a sofa'] },
    { author: 'jill', text: 'second tweet' },
  ]);
  assert.match(prompt, /Tweet 1 by @jack: "first tweet" \[Image: a cat on a sofa\]/);
  assert.match(prompt, /Tweet 2 by @jill: "second tweet"\n?/);
  assert.doesNotMatch(prompt, /Tweet 2 .*\[Image/);
});
