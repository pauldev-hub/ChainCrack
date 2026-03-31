/**
 * Socket.IO client service
 * 
 * Manages WebSocket connection and real-time event handling
 * 
 * @file packages/frontend/src/services/socketService.js
 */

import { io } from 'socket.io-client';

let socketInstance = null;

/**
 * Normalizes room code values to uppercase canonical format.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase();
}

/**
 * Converts socket error payload into a user-friendly message.
 * @param {unknown} payload
 * @returns {string}
 */
export function normalizeSocketError(payload) {
  if (!payload) {
    return 'Unexpected socket error';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  return payload.message || 'Unexpected socket error';
}

/**
 * Checks whether payload belongs to current room context.
 * @param {unknown} payload
 * @param {{roomCode?: string, gameId?: string}} context
 * @returns {boolean}
 */
export function matchesRoomPayload(payload, context = {}) {
  const payloadCode = normalizeRoomCode(payload?.code);
  const currentCode = normalizeRoomCode(context.roomCode);
  if (payloadCode && currentCode) {
    return payloadCode === currentCode;
  }

  const payloadGameId = String(payload?.gameId || '').trim();
  const currentGameId = String(context.gameId || '').trim();
  if (payloadGameId && currentGameId) {
    return payloadGameId === currentGameId;
  }

  return false;
}

/**
 * Returns a shared socket connection for the whole app lifecycle.
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
  if (socketInstance) {
    return socketInstance;
  }

  socketInstance = io(import.meta.env.VITE_WS_URL || 'ws://localhost:5000', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  return socketInstance;
}

/**
 * Safely disconnects and clears shared socket instance.
 * @returns {void}
 */
export function resetSocket() {
  if (!socketInstance) {
    return;
  }

  socketInstance.disconnect();
  socketInstance = null;
}

export default {
  getSocket,
  resetSocket,
  normalizeRoomCode,
  normalizeSocketError,
  matchesRoomPayload,
};
