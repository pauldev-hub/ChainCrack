/**
 * Shared validation helpers.
 * @file packages/backend/src/utils/validation.js
 */

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,10}$/;

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

export default {
  isValidUuid,
  normalizeRoomCode,
  isValidRoomCode,
};
