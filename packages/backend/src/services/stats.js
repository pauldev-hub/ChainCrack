import {
  getLeaderboard as getLeaderboardQuery,
  getPlayerStats as getPlayerStatsQuery,
  getGameStats as getGameStatsQuery,
} from '../db/queries.js';

/**
 * Gets leaderboard rows.
 * @param {number} limit
 * @returns {Promise<Array<{playerName:string,totalScore:number,wins:number}>>}
 */
export async function getLeaderboard(limit = 10) {
  return getLeaderboardQuery(limit);
}

/**
 * Gets one player stats bundle.
 * @param {string} playerId
 * @returns {Promise<{stats: object, history: object[]}|null>}
 */
export async function getPlayerStats(playerId) {
  return getPlayerStatsQuery(playerId);
}

/**
 * Gets one game stats bundle.
 * @param {string} gameId
 * @returns {Promise<{game:object,players:object[],submissions:object[],scores:object[]}|null>}
 */
export async function getGameStats(gameId) {
  return getGameStatsQuery(gameId);
}

export default {
  getLeaderboard,
  getPlayerStats,
  getGameStats,
};
