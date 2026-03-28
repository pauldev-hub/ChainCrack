/**
 * Type definitions for ChainCrack backend
 * 
 * JSDoc type definitions used across backend services
 * No TypeScript — types defined as comments for compatibility
 * 
 * @file packages/backend/src/types/index.js
 */

/**
 * @typedef {Object} Game
 * @property {string} id - UUID
 * @property {string} start_word
 * @property {string} end_word
 * @property {string} status - 'waiting' | 'active' | 'ended'
 * @property {number} max_players
 * @property {string} created_at - ISO 8601
 * @property {string?} started_at - ISO 8601
 * @property {string?} ended_at - ISO 8601
 */

/**
 * @typedef {Object} Player
 * @property {string} id - UUID
 * @property {string} game_id - Foreign key
 * @property {string} name
 * @property {string} joined_at - ISO 8601
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} WordChain
 * @property {string} id - UUID
 * @property {string} game_id - Foreign key
 * @property {string} player_id - Foreign key
 * @property {number} step_number
 * @property {string} word
 * @property {string} explanation
 * @property {boolean} is_valid
 * @property {number} ai_score
 * @property {string} submitted_at - ISO 8601
 */

/**
 * @typedef {Object} AIValidationResult
 * @property {boolean} valid
 * @property {number} score - 0-100
 * @property {string} reason - max 100 chars
 */

export default {};
