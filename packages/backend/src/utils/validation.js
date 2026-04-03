/**
 * Shared validation helpers.
 * @file packages/backend/src/utils/validation.js
 */

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,10}$/;
const MEMORY_MODES = new Set(['race', 'memory']);
const MEMORY_VARIANTS = new Set(['flash_all', 'one_by_one']);

/**
 * Returns true when value is a UUID v4-style string.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidUuid(value) {
  return UUID_V4_PATTERN.test(String(value || ''));
}

/**
 * Normalizes user-provided room code.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase();
}

/**
 * Returns true when value is a valid room code.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidRoomCode(value) {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(value));
}

/**
 * Returns normalized room mode.
 * @param {unknown} value
 * @returns {'race'|'memory'}
 */
export function normalizeGameMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (MEMORY_MODES.has(normalized)) {
    return normalized;
  }
  return 'race';
}

/**
 * Returns true when mode is supported.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidGameMode(value) {
  return MEMORY_MODES.has(String(value || '').trim().toLowerCase());
}

/**
 * Returns normalized reveal variant.
 * @param {unknown} value
 * @returns {'flash_all'|'one_by_one'}
 */
export function normalizeMemoryRevealVariant(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (MEMORY_VARIANTS.has(normalized)) {
    return normalized;
  }
  return 'flash_all';
}

/**
 * Returns true when reveal variant is supported.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidMemoryRevealVariant(value) {
  return MEMORY_VARIANTS.has(String(value || '').trim().toLowerCase());
}

/**
 * Normalizes a memory submission into fixed-length slots.
 * Missing values are filled with empty strings.
 * @param {unknown} value
 * @param {number} wordCount
 * @returns {string[]}
 */
export function normalizeMemorySubmission(value, wordCount) {
  const safeCount = Math.max(1, Number(wordCount || 0));
  const raw = Array.isArray(value) ? value : [];
  const result = [];

  for (let index = 0; index < safeCount; index += 1) {
    const current = raw[index];
    result.push(String(current || '').trim().toLowerCase());
  }

  return result;
}

export default {
  isValidUuid,
  normalizeRoomCode,
  isValidRoomCode,
  normalizeGameMode,
  isValidGameMode,
  normalizeMemoryRevealVariant,
  isValidMemoryRevealVariant,
  normalizeMemorySubmission,
};
