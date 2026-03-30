import { v4 as uuidv4 } from 'uuid';
import { getPlayerById as getPlayerByIdQuery } from '../db/queries.js';
import { isValidUuid } from '../utils/validation.js';

function createPlayerError(message, statusCode = 400, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function ensurePlayerName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw createPlayerError('name must be between 1 and 50 characters');
  }

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw createPlayerError('name must be between 1 and 50 characters');
  }

  return trimmed;
}

/**
 * Creates a guest profile payload with validated UUID and name.
 * @param {{name: string, playerId?: string}} payload
 * @returns {{playerId: string, name: string}}
 */
export function createGuestProfile(payload) {
  const safeName = ensurePlayerName(payload?.name);
  const resolvedPlayerId = payload?.playerId || uuidv4();

  if (!isValidUuid(resolvedPlayerId)) {
    throw createPlayerError('playerId must be a valid UUID');
  }

  return {
    playerId: resolvedPlayerId,
    name: safeName,
  };
}

/**
 * Gets player by UUID.
 * @param {string} playerId
 * @returns {Promise<object|null>}
 */
export async function getPlayerById(playerId) {
  if (!isValidUuid(playerId)) {
    throw createPlayerError('playerId must be a valid UUID');
  }

  return getPlayerByIdQuery(playerId);
}

export default {
  createGuestProfile,
  getPlayerById,
};
