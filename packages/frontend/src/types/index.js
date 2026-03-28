/**
 * Type definitions for ChainCrack frontend
 * 
 * JSDoc type definitions used across React components and hooks
 * 
 * @file packages/frontend/src/types/index.js
 */

/**
 * @typedef {Object} GameStatus
 * @property {string} gameId
 * @property {string} startWord
 * @property {string} endWord
 * @property {string} status - 'waiting' | 'active' | 'ended'
 * @property {Array<{playerId: string, playerName: string}>} players
 */

/**
 * @typedef {Object} Player
 * @property {string} playerId
 * @property {string} playerName
 * @property {number} score
 * @property {number} chainLength
 */

/**
 * @typedef {Object} SocketEventPayload
 * @property {string} gameId
 * @property {string} playerId
 * @property {string} playerName
 */

export default {};
