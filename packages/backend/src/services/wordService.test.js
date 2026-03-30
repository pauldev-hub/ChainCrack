import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllWordPairs,
  getWordPairByIndex,
  getRandomWordPair,
} from './wordService.js';

test('word service should expose a minimum pair set', () => {
  const pairs = getAllWordPairs();
  assert.ok(Array.isArray(pairs));
  assert.ok(pairs.length >= 20);
  assert.ok(typeof pairs[0].startWord === 'string');
  assert.ok(typeof pairs[0].endWord === 'string');
});

test('word service deterministic getter should wrap indexes', () => {
  const pairs = getAllWordPairs();
  const first = getWordPairByIndex(0);
  const wrapped = getWordPairByIndex(pairs.length);
  assert.deepEqual(wrapped, first);
});

test('word service random getter should return known pair shape', () => {
  const pair = getRandomWordPair();
  assert.ok(pair.startWord);
  assert.ok(pair.endWord);
});
