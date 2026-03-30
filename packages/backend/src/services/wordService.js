/**
 * Word pair source service.
 *
 * Provides curated start/end word pairs for game creation.
 *
 * @file packages/backend/src/services/wordService.js
 */

const WORD_PAIRS = [
  { startWord: 'cat', endWord: 'dog' },
  { startWord: 'sun', endWord: 'moon' },
  { startWord: 'rain', endWord: 'fire' },
  { startWord: 'book', endWord: 'movie' },
  { startWord: 'seed', endWord: 'forest' },
  { startWord: 'river', endWord: 'ocean' },
  { startWord: 'bread', endWord: 'butter' },
  { startWord: 'coffee', endWord: 'tea' },
  { startWord: 'pencil', endWord: 'keyboard' },
  { startWord: 'song', endWord: 'dance' },
  { startWord: 'paper', endWord: 'cloud' },
  { startWord: 'light', endWord: 'shadow' },
  { startWord: 'mountain', endWord: 'valley' },
  { startWord: 'train', endWord: 'airport' },
  { startWord: 'phone', endWord: 'letter' },
  { startWord: 'apple', endWord: 'orange' },
  { startWord: 'school', endWord: 'career' },
  { startWord: 'winter', endWord: 'summer' },
  { startWord: 'doctor', endWord: 'teacher' },
  { startWord: 'robot', endWord: 'human' },
  { startWord: 'desert', endWord: 'jungle' },
  { startWord: 'city', endWord: 'village' },
  { startWord: 'castle', endWord: 'bridge' },
  { startWord: 'planet', endWord: 'galaxy' },
  { startWord: 'flower', endWord: 'tree' },
  { startWord: 'storm', endWord: 'rainbow' },
  { startWord: 'paint', endWord: 'music' },
  { startWord: 'camera', endWord: 'memory' },
  { startWord: 'clock', endWord: 'calendar' },
  { startWord: 'glass', endWord: 'mirror' },
  { startWord: 'road', endWord: 'map' },
  { startWord: 'ship', endWord: 'harbor' },
  { startWord: 'lion', endWord: 'eagle' },
  { startWord: 'ice', endWord: 'steam' },
  { startWord: 'forest', endWord: 'city' },
  { startWord: 'battery', endWord: 'engine' },
  { startWord: 'milk', endWord: 'cheese' },
  { startWord: 'mind', endWord: 'heart' },
  { startWord: 'island', endWord: 'continent' },
  { startWord: 'bridge', endWord: 'tunnel' },
  { startWord: 'novel', endWord: 'podcast' },
  { startWord: 'helmet', endWord: 'seatbelt' },
  { startWord: 'forest', endWord: 'factory' },
  { startWord: 'game', endWord: 'tournament' },
  { startWord: 'chalk', endWord: 'marker' },
  { startWord: 'window', endWord: 'door' },
  { startWord: 'salt', endWord: 'sugar' },
  { startWord: 'planet', endWord: 'asteroid' },
  { startWord: 'beach', endWord: 'mountain' },
  { startWord: 'thread', endWord: 'fabric' },
];

/**
 * Returns all available pairs.
 * @returns {Array<{startWord:string,endWord:string}>}
 */
export function getAllWordPairs() {
  return [...WORD_PAIRS];
}

/**
 * Deterministic pair getter for tests.
 * @param {number} index
 * @returns {{startWord:string,endWord:string}}
 */
export function getWordPairByIndex(index) {
  if (!Number.isInteger(index)) {
    throw new Error('Word pair index must be an integer');
  }

  if (WORD_PAIRS.length === 0) {
    throw new Error('No word pairs configured');
  }

  const normalized = ((index % WORD_PAIRS.length) + WORD_PAIRS.length) % WORD_PAIRS.length;
  return WORD_PAIRS[normalized];
}

/**
 * Random pair picker.
 * @returns {{startWord:string,endWord:string}}
 */
export function getRandomWordPair() {
  const index = Math.floor(Math.random() * WORD_PAIRS.length);
  return WORD_PAIRS[index];
}

const wordService = {
  getAllWordPairs,
  getWordPairByIndex,
  getRandomWordPair,
};

export default wordService;
