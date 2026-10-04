import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseJsonLoose,
  parseQuizResponse,
  removeTrailingCommas,
  validateQuiz,
} from '../src/background/quiz-parser.js';

const mc = {
  type: 'multiple_choice',
  question: 'Who?',
  options: ['a) x', 'b) y', 'c) z', 'd) w'],
  answer: 'b',
  explanation: 'Because.',
};

test('parseJsonLoose parses plain JSON', () => {
  assert.deepEqual(parseJsonLoose(JSON.stringify(mc)), mc);
});

test('parseJsonLoose strips markdown code fences', () => {
  assert.deepEqual(parseJsonLoose('```json\n' + JSON.stringify(mc) + '\n```'), mc);
  assert.deepEqual(parseJsonLoose('```\n{"a": 1}\n```'), { a: 1 });
});

test('parseJsonLoose repairs trailing commas', () => {
  assert.deepEqual(parseJsonLoose('{"a": [1, 2,], "b": "x",}'), { a: [1, 2], b: 'x' });
});

test('parseJsonLoose extracts the object from surrounding prose', () => {
  assert.deepEqual(parseJsonLoose('Here you go: {"a": 1} Hope it helps!'), { a: 1 });
});

test('parseJsonLoose throws a friendly error on garbage', () => {
  assert.throws(() => parseJsonLoose('not json at all'), /Invalid JSON response/);
  assert.throws(() => parseJsonLoose('{"a": '), /Invalid JSON response/);
});

test('removeTrailingCommas leaves commas inside strings alone', () => {
  assert.equal(removeTrailingCommas('{"a": "x, }", }'), '{"a": "x, }" }');
  assert.equal(removeTrailingCommas('{"a": "q\\", ]"}'), '{"a": "q\\", ]"}');
});

test('validateQuiz normalizes a multiple choice quiz', () => {
  assert.deepEqual(validateQuiz({ ...mc, question: '  Who?  ' }), mc);
});

test('validateQuiz forces true/false options and fill-blank null options', () => {
  const tf = validateQuiz({ type: 'true_false', question: 'Q', answer: 'true', options: ['x'] });
  assert.deepEqual(tf.options, ['True', 'False']);
  assert.equal(tf.explanation, '');
  const fb = validateQuiz({ type: 'fill_blank', question: 'A ___', answer: 'b', options: ['x'] });
  assert.equal(fb.options, null);
});

test('validateQuiz rejects malformed quizzes', () => {
  assert.throws(() => validateQuiz(null), /not an object/);
  assert.throws(() => validateQuiz({ ...mc, type: 'essay' }), /unknown type/);
  assert.throws(() => validateQuiz({ ...mc, question: '' }), /missing question/);
  assert.throws(() => validateQuiz({ ...mc, answer: undefined }), /missing answer/);
  assert.throws(() => validateQuiz({ ...mc, options: undefined }), /missing options/);
});

test('parseQuizResponse combines parsing and validation', () => {
  assert.equal(parseQuizResponse('```json\n' + JSON.stringify(mc) + ',\n```').answer, 'b');
});
