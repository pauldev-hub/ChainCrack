/**
 * Client session helpers for guest identity persistence.
 *
 * @file packages/frontend/src/services/sessionService.js
 */

const PLAYER_ID_KEY = 'chaincrack.playerId';
const PLAYER_NAME_KEY = 'chaincrack.playerName';
const ACTIVE_ROOM_KEY = 'chaincrack.activeRoom';
const LAST_RESULTS_KEY = 'chaincrack.lastResults';
const GAMEPLAY_STATE_KEY = 'chaincrack.gameplayState';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function clearPlayerNameOnHomeReload() {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return;
  }

  const navigationEntries = performance.getEntriesByType?.('navigation') || [];
  const navigationType = navigationEntries[0]?.type;
  if (navigationType !== 'reload') {
    return;
  }

  const path = String(window.location?.pathname || '');
  if (path !== '/' && path !== '') {
    return;
  }

  getStorage()?.removeItem(PLAYER_NAME_KEY);
}

clearPlayerNameOnHomeReload();

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // RFC4122 fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Returns persisted player UUID or creates one.
 * @returns {string}
 */
export function getOrCreatePlayerId() {
  const storage = getStorage();
  const existing = storage?.getItem(PLAYER_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = generateUuid();
  storage?.setItem(PLAYER_ID_KEY, created);
  return created;
}

/**
 * Persists current player name.
 * @param {string} name
 * @returns {void}
 */
export function setPlayerName(name) {
  getStorage()?.setItem(PLAYER_NAME_KEY, name);
}

/**
 * Reads stored player name.
 * @returns {string}
 */
export function getPlayerName() {
  return getStorage()?.getItem(PLAYER_NAME_KEY) || '';
}

/**
 * Persists active room identity for routing and socket payloads.
 * @param {{code:string,gameId:string,startWord?:string,endWord?:string,hostId?:string|null,status?:string,gameMode?:string|null}} room
 * @returns {void}
 */
export function setActiveRoom(room) {
  const payload = {
    code: String(room?.code || '').trim().toUpperCase(),
    gameId: String(room?.gameId || '').trim(),
    startWord: room?.startWord || null,
    endWord: room?.endWord || null,
    hostId: room?.hostId || null,
    status: room?.status || null,
    gameMode: room?.gameMode || null,
  };

  getStorage()?.setItem(ACTIVE_ROOM_KEY, JSON.stringify(payload));
}

/**
 * Returns active room identity if available.
 * @returns {{code:string,gameId:string,startWord?:string|null,endWord?:string|null,hostId?:string|null,status?:string|null,gameMode?:string|null}|null}
 */
export function getActiveRoom() {
  const raw = getStorage()?.getItem(ACTIVE_ROOM_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.gameId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clears active room identity from storage.
 * @returns {void}
 */
export function clearActiveRoom() {
  getStorage()?.removeItem(ACTIVE_ROOM_KEY);
}

/**
 * Persists final game results for results page hydration.
 * @param {object} results
 * @returns {void}
 */
export function setLastResults(results) {
  getStorage()?.setItem(LAST_RESULTS_KEY, JSON.stringify(results || null));
}

/**
 * Returns persisted results payload if present.
 * @returns {object|null}
 */
export function getLastResults() {
  const raw = getStorage()?.getItem(LAST_RESULTS_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears persisted results payload.
 * @returns {void}
 */
export function clearLastResults() {
  getStorage()?.removeItem(LAST_RESULTS_KEY);
}

/**
 * Persists transient gameplay lifecycle state.
 * @param {{
 *   code?: string,
 *   gameId?: string,
 *   phase?: string,
 *   startWord?: string|null,
 *   endWord?: string|null,
 *   revealChains?: Array,
 *   voteCounts?: Record<string, number>,
 *   voteEndsAt?: string|null,
 *   gameMode?: string|null,
 *   updatedAt?: string,
 * }} payload
 * @returns {void}
 */
export function setGameplayState(payload) {
  const state = {
    code: String(payload?.code || '').trim().toUpperCase(),
    gameId: String(payload?.gameId || '').trim(),
    phase: String(payload?.phase || '').trim() || null,
    startWord: payload?.startWord || null,
    endWord: payload?.endWord || null,
    revealChains: Array.isArray(payload?.revealChains) ? payload.revealChains : [],
    voteCounts: payload?.voteCounts && typeof payload.voteCounts === 'object'
      ? payload.voteCounts
      : {},
    voteEndsAt: payload?.voteEndsAt || null,
    gameMode: payload?.gameMode || null,
    updatedAt: payload?.updatedAt || new Date().toISOString(),
  };

  getStorage()?.setItem(GAMEPLAY_STATE_KEY, JSON.stringify(state));
}

/**
 * Returns persisted gameplay lifecycle state.
 * @returns {{
 *   code: string,
 *   gameId: string,
 *   phase: string|null,
 *   startWord: string|null,
 *   endWord: string|null,
 *   revealChains: Array,
 *   voteCounts: Record<string, number>,
 *   voteEndsAt: string|null,
 *   gameMode: string|null,
 *   updatedAt: string,
 * }|null}
 */
export function getGameplayState() {
  const raw = getStorage()?.getItem(GAMEPLAY_STATE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.code && !parsed?.gameId) {
      return null;
    }
    return {
      code: String(parsed.code || '').toUpperCase(),
      gameId: String(parsed.gameId || ''),
      phase: parsed.phase || null,
      startWord: parsed.startWord || null,
      endWord: parsed.endWord || null,
      revealChains: Array.isArray(parsed.revealChains) ? parsed.revealChains : [],
      voteCounts: parsed.voteCounts && typeof parsed.voteCounts === 'object'
        ? parsed.voteCounts
        : {},
      voteEndsAt: parsed.voteEndsAt || null,
      gameMode: parsed.gameMode || null,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return null;
  }
}

/**
 * Clears persisted gameplay lifecycle state.
 * @returns {void}
 */
export function clearGameplayState() {
  getStorage()?.removeItem(GAMEPLAY_STATE_KEY);
}

export default {
  getOrCreatePlayerId,
  setPlayerName,
  getPlayerName,
  setActiveRoom,
  getActiveRoom,
  clearActiveRoom,
  setLastResults,
  getLastResults,
  clearLastResults,
  setGameplayState,
  getGameplayState,
  clearGameplayState,
};
