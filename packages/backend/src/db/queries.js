/**
 * Raw SQL queries for ChainCrack backend
 * 
 * All database operations are written as raw SQL queries here
 * No ORM usage — direct query execution for full control and transparency
 * 
 * @file packages/backend/src/db/queries.js
 */

/**
 * SQL queries object containing all database operations
 * 
 * @typedef {Object} Queries
 * @property {Function} createGame
 * @property {Function} getGame
 * @property {Function} addPlayer
 * @property {Function} submitWord
 */

export const queries = {
  // Games
  createGame: () => 'INSERT INTO games (id, start_word, end_word, status, max_players) VALUES (?, ?, ?, ?, ?)',
  getGame: () => 'SELECT * FROM games WHERE id = ?',
  
  // Players
  addPlayer: () => 'INSERT INTO players (id, game_id, name) VALUES (?, ?, ?)',
  getPlayer: () => 'SELECT * FROM players WHERE id = ?',
  
  // Word chains
  submitWord: () => 'INSERT INTO word_chains (id, game_id, player_id, step_number, word, explanation) VALUES (?, ?, ?, ?, ?, ?)',
  
  // Placeholder for future queries
};

export default queries;
