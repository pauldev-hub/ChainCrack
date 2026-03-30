/**
 * Raw SQL queries for ChainCrack backend
 * 
 * All database operations are written as raw SQL queries here
 * No ORM usage — direct query execution for full control and transparency
 * 
 * @file packages/backend/src/db/queries.js
 */

import { getDb } from './init.js';
import { isValidUuid, normalizeRoomCode } from '../utils/validation.js';

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const raw = String(value);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const withZone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`;

  return new Date(withZone).toISOString();
}

function mapGame(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    created_at: normalizeTimestamp(row.created_at),
    started_at: normalizeTimestamp(row.started_at),
    ended_at: normalizeTimestamp(row.ended_at),
    race_ends_at: normalizeTimestamp(row.race_ends_at),
    reveal_at: normalizeTimestamp(row.reveal_at),
    vote_phase_ends_at: normalizeTimestamp(row.vote_phase_ends_at),
  };
}

function mapPlayer(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    is_active: Boolean(row.is_active),
    joined_at: normalizeTimestamp(row.joined_at),
    left_at: normalizeTimestamp(row.left_at),
  };
}

function mapWordChain(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    is_valid: Boolean(row.is_valid),
    auto_submitted: Boolean(row.auto_submitted),
    submitted_at: normalizeTimestamp(row.submitted_at),
  };
}

function mapVote(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    created_at: normalizeTimestamp(row.created_at),
  };
}

function mapSubmission(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    submitted_at: normalizeTimestamp(row.submitted_at),
    validated_at: normalizeTimestamp(row.validated_at),
  };
}

function run(sql, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function all(sql, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows ?? []);
    });
  });
}

/**
 * Creates a game row.
 * @param {{ id: string, code: string, startWord: string, endWord: string, maxPlayers: number, status?: string, timeLimitSeconds?: number }} payload
 * @returns {Promise<object>}
 */
export async function createGame(payload) {
  const {
    id,
    code,
    startWord,
    endWord,
    maxPlayers,
    status = 'waiting',
    timeLimitSeconds = 300,
  } = payload;

  await run(
    `INSERT INTO games (id, code, start_word, end_word, status, max_players, time_limit_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, normalizeRoomCode(code), startWord, endWord, status, maxPlayers, timeLimitSeconds],
  );

  return getGameById(id);
}

/**
 * Updates mutable game phase fields.
 * @param {{gameId: string, phase?: 'race'|'reveal'|'vote'|'results', raceEndsAt?: string|null, revealAt?: string|null, votePhaseEndsAt?: string|null, chainOfRoundPlayerId?: string|null}} payload
 * @returns {Promise<object|null>}
 */
export async function updateGamePhaseState(payload) {
  const {
    gameId,
    phase,
    raceEndsAt,
    revealAt,
    votePhaseEndsAt,
    chainOfRoundPlayerId,
  } = payload;

  const updates = [];
  const params = [];

  if (phase !== undefined) {
    updates.push('phase = ?');
    params.push(phase);
  }
  if (raceEndsAt !== undefined) {
    updates.push('race_ends_at = ?');
    params.push(raceEndsAt);
  }
  if (revealAt !== undefined) {
    updates.push('reveal_at = ?');
    params.push(revealAt);
  }
  if (votePhaseEndsAt !== undefined) {
    updates.push('vote_phase_ends_at = ?');
    params.push(votePhaseEndsAt);
  }
  if (chainOfRoundPlayerId !== undefined) {
    updates.push('chain_of_round_player_id = ?');
    params.push(chainOfRoundPlayerId);
  }

  if (updates.length === 0) {
    return getGameById(gameId);
  }

  params.push(gameId);
  await run(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`, params);
  return getGameById(gameId);
}

/**
 * Returns game by id.
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
export async function getGameById(gameId) {
  const row = await get(`SELECT * FROM games WHERE id = ?`, [gameId]);
  return mapGame(row);
}

/**
 * Returns game by short room code.
 * @param {string} code
 * @returns {Promise<object|null>}
 */
export async function getGameByCode(code) {
  const row = await get(`SELECT * FROM games WHERE code = ?`, [
    normalizeRoomCode(code),
  ]);
  return mapGame(row);
}

/**
 * Resolves a game using either UUID game id or short room code.
 * @param {string} value
 * @returns {Promise<object|null>}
 */
export async function getGameByIdentifier(value) {
  if (isValidUuid(value)) {
    return getGameById(value);
  }

  return getGameByCode(value);
}

/**
 * Updates game status.
 * @param {string} gameId
 * @param {'waiting'|'active'|'ended'} status
 * @returns {Promise<object|null>}
 */
export async function updateGameStatus(gameId, status) {
  if (status === 'active') {
    await run(
      `UPDATE games
       SET status = ?, started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
       WHERE id = ?`,
      [status, gameId],
    );
  } else if (status === 'ended') {
    await run(
      `UPDATE games
       SET status = ?, ended_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, gameId],
    );
  } else {
    await run(`UPDATE games SET status = ? WHERE id = ?`, [status, gameId]);
  }

  return getGameById(gameId);
}

/**
 * Deletes game and related rows.
 * @param {string} gameId
 * @returns {Promise<void>}
 */
export async function deleteGameCascade(gameId) {
  await run(`DELETE FROM games WHERE id = ?`, [gameId]);
}

/**
 * Inserts a player for a game.
 * @param {{ id: string, gameId: string, name: string }} payload
 * @returns {Promise<object>}
 */
export async function addPlayer(payload) {
  const { id, gameId, name } = payload;
  await run(
    `INSERT INTO players (id, game_id, name, is_active, left_at)
     VALUES (?, ?, ?, 1, NULL)`,
    [id, gameId, name],
  );
  return getPlayerInGame(id, gameId);
}

/**
 * Reactivates existing player in a game.
 * @param {{ id: string, gameId: string, name: string }} payload
 * @returns {Promise<object|null>}
 */
export async function reactivatePlayer(payload) {
  const { id, gameId, name } = payload;
  await run(
    `UPDATE players
     SET is_active = 1, left_at = NULL, name = ?
     WHERE id = ? AND game_id = ?`,
    [name, id, gameId],
  );
  return getPlayerInGame(id, gameId);
}

/**
 * Moves an existing player membership to another game.
 * @param {{ id: string, gameId: string, name: string }} payload
 * @returns {Promise<object|null>}
 */
export async function reassignPlayerToGame(payload) {
  const { id, gameId, name } = payload;
  await run(
    `UPDATE players
     SET game_id = ?, name = ?, is_active = 1, left_at = NULL, joined_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [gameId, name, id],
  );
  return getPlayerInGame(id, gameId);
}

/**
 * Returns any player row by uuid.
 * @param {string} playerId
 * @returns {Promise<object|null>}
 */
export async function getPlayerById(playerId) {
  const row = await get(`SELECT * FROM players WHERE id = ?`, [playerId]);
  return mapPlayer(row);
}

/**
 * Returns player row by player+game.
 * @param {string} playerId
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
export async function getPlayerInGame(playerId, gameId) {
  const row = await get(
    `SELECT * FROM players WHERE id = ? AND game_id = ?`,
    [playerId, gameId],
  );
  return mapPlayer(row);
}

/**
 * Returns active player row by player+game.
 * @param {string} playerId
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
export async function getActivePlayerInGame(playerId, gameId) {
  const row = await get(
    `SELECT * FROM players WHERE id = ? AND game_id = ? AND is_active = 1`,
    [playerId, gameId],
  );
  return mapPlayer(row);
}

/**
 * Marks a player inactive.
 * @param {string} playerId
 * @param {string} gameId
 * @returns {Promise<void>}
 */
export async function markPlayerLeft(playerId, gameId) {
  await run(
    `UPDATE players
     SET is_active = 0, left_at = CURRENT_TIMESTAMP
     WHERE id = ? AND game_id = ?`,
    [playerId, gameId],
  );
}

/**
 * Returns all players in game.
 * @param {string} gameId
 * @returns {Promise<object[]>}
 */
export async function getPlayersByGameId(gameId) {
  const rows = await all(
    `SELECT * FROM players WHERE game_id = ? ORDER BY joined_at ASC`,
    [gameId],
  );
  return rows.map(mapPlayer);
}

/**
 * Returns the host player for a game (earliest join).
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
export async function getHostPlayerByGameId(gameId) {
  const row = await get(
    `SELECT *
     FROM players
     WHERE game_id = ?
     ORDER BY joined_at ASC
     LIMIT 1`,
    [gameId],
  );

  return mapPlayer(row);
}

/**
 * Returns game row with its players.
 * @param {string} gameId
 * @returns {Promise<{game:object,players:object[]}|null>}
 */
export async function getGameWithPlayers(gameId) {
  const game = await getGameById(gameId);
  if (!game) {
    return null;
  }

  const players = await getPlayersByGameId(gameId);
  return { game, players };
}

/**
 * Counts active players in game.
 * @param {string} gameId
 * @returns {Promise<number>}
 */
export async function countActivePlayers(gameId) {
  const row = await get(
    `SELECT COUNT(*) AS count FROM players WHERE game_id = ? AND is_active = 1`,
    [gameId],
  );
  return Number(row?.count ?? 0);
}

/**
 * Returns next chain step number for game.
 * @param {string} gameId
 * @returns {Promise<number>}
 */
export async function getNextStepNumber(gameId) {
  const row = await get(
    `SELECT COALESCE(MAX(step_number), 0) + 1 AS next_step
     FROM word_chains
     WHERE game_id = ?`,
    [gameId],
  );
  return Number(row?.next_step ?? 1);
}

/**
 * Returns true if word already exists in game chain.
 * @param {string} gameId
 * @param {string} word
 * @returns {Promise<boolean>}
 */
export async function isDuplicateWord(gameId, word) {
  const row = await get(
    `SELECT 1 AS duplicate_found
     FROM word_chains
     WHERE game_id = ? AND lower(word) = lower(?)
     LIMIT 1`,
    [gameId, word],
  );
  return Boolean(row?.duplicate_found);
}

/**
 * Returns latest submitted chain word for game.
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
export async function getLastChainWord(gameId) {
  const row = await get(
    `SELECT *
     FROM word_chains
     WHERE game_id = ?
     ORDER BY step_number DESC
     LIMIT 1`,
    [gameId],
  );
  return mapWordChain(row);
}

/**
 * Inserts word chain entry.
 * @param {{ id: string, gameId: string, playerId: string, stepNumber: number, word: string, explanation: string, isValid: boolean, aiScore: number, aiFeedback: string, autoSubmitted?: boolean }} payload
 * @returns {Promise<object|null>}
 */
export async function createWordChain(payload) {
  const {
    id,
    gameId,
    playerId,
    stepNumber,
    word,
    explanation,
    isValid,
    aiScore,
    aiFeedback,
    autoSubmitted = false,
  } = payload;

  await run(
    `INSERT INTO word_chains (id, game_id, player_id, step_number, word, explanation, is_valid, ai_score, ai_feedback, auto_submitted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      gameId,
      playerId,
      stepNumber,
      word,
      explanation,
      isValid ? 1 : 0,
      aiScore,
      aiFeedback,
      autoSubmitted ? 1 : 0,
    ],
  );

  const row = await get(`SELECT * FROM word_chains WHERE id = ?`, [id]);
  return mapWordChain(row);
}

/**
 * Returns chain entries in game.
 * @param {string} gameId
 * @returns {Promise<object[]>}
 */
export async function getWordChainsByGameId(gameId) {
  const rows = await all(
    `SELECT * FROM word_chains WHERE game_id = ? ORDER BY step_number ASC`,
    [gameId],
  );
  return rows.map(mapWordChain);
}

/**
 * Creates submission row.
 * @param {{ id: string, gameId: string, playerId: string, wordChainId: string, status?: 'pending'|'validated'|'rejected' }} payload
 * @returns {Promise<object|null>}
 */
export async function createSubmission(payload) {
  const { id, gameId, playerId, wordChainId, status = 'pending' } = payload;
  await run(
    `INSERT INTO submissions (id, game_id, player_id, word_chain_id, status)
     VALUES (?, ?, ?, ?, ?)`,
    [id, gameId, playerId, wordChainId, status],
  );
  return getSubmissionById(id);
}

/**
 * Updates submission validation result.
 * @param {{ id: string, status: 'validated'|'rejected', validationMs: number, providerUsed: 'groq'|'gemini'|'llama'|null }} payload
 * @returns {Promise<object|null>}
 */
export async function updateSubmissionValidation(payload) {
  const { id, status, validationMs, providerUsed } = payload;
  await run(
    `UPDATE submissions
     SET status = ?, validated_at = CURRENT_TIMESTAMP, validation_ms = ?, provider_used = ?
     WHERE id = ?`,
    [status, validationMs, providerUsed, id],
  );
  return getSubmissionById(id);
}

/**
 * Returns submission row.
 * @param {string} submissionId
 * @returns {Promise<object|null>}
 */
export async function getSubmissionById(submissionId) {
  const row = await get(`SELECT * FROM submissions WHERE id = ?`, [submissionId]);
  return mapSubmission(row);
}

/**
 * Upserts score for player in game.
 * @param {{ id: string, gameId: string, playerId: string, scoreDelta: number, chainDelta: number, aiScoreDelta?: number }} payload
 * @returns {Promise<object|null>}
 */
export async function upsertScore(payload) {
  const {
    id,
    gameId,
    playerId,
    scoreDelta,
    chainDelta,
    aiScoreDelta = 0,
  } = payload;
  const existing = await get(
    `SELECT * FROM scores WHERE game_id = ? AND player_id = ?`,
    [gameId, playerId],
  );

  if (!existing) {
    await run(
      `INSERT INTO scores (id, game_id, player_id, total_score, ai_score, speed_bonus, crowd_bonus, chain_length)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
      [id, gameId, playerId, scoreDelta, aiScoreDelta, chainDelta],
    );
  } else {
    await run(
      `UPDATE scores
       SET total_score = total_score + ?, ai_score = ai_score + ?, chain_length = chain_length + ?
       WHERE game_id = ? AND player_id = ?`,
      [scoreDelta, aiScoreDelta, chainDelta, gameId, playerId],
    );
  }

  return get(
    `SELECT * FROM scores WHERE game_id = ? AND player_id = ?`,
    [gameId, playerId],
  );
}

/**
 * Sets final score breakdown fields for one player.
 * @param {{gameId: string, playerId: string, aiScore: number, speedBonus: number, crowdBonus: number, chainLength?: number}} payload
 * @returns {Promise<void>}
 */
export async function setScoreBreakdown(payload) {
  const {
    gameId,
    playerId,
    aiScore,
    speedBonus,
    crowdBonus,
    chainLength,
  } = payload;

  const totalScore = Number(aiScore || 0) + Number(speedBonus || 0) + Number(crowdBonus || 0);
  const existing = await get(
    `SELECT id FROM scores WHERE game_id = ? AND player_id = ?`,
    [gameId, playerId],
  );

  if (!existing) {
    await run(
      `INSERT INTO scores (
        id,
        game_id,
        player_id,
        total_score,
        ai_score,
        speed_bonus,
        crowd_bonus,
        chain_length
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${gameId}-${playerId}`,
        gameId,
        playerId,
        totalScore,
        Number(aiScore || 0),
        Number(speedBonus || 0),
        Number(crowdBonus || 0),
        Number(chainLength || 0),
      ],
    );
    return;
  }

  if (chainLength !== undefined) {
    await run(
      `UPDATE scores
       SET total_score = ?, ai_score = ?, speed_bonus = ?, crowd_bonus = ?, chain_length = ?
       WHERE game_id = ? AND player_id = ?`,
      [
        totalScore,
        Number(aiScore || 0),
        Number(speedBonus || 0),
        Number(crowdBonus || 0),
        Number(chainLength || 0),
        gameId,
        playerId,
      ],
    );
    return;
  }

  await run(
    `UPDATE scores
     SET total_score = ?, ai_score = ?, speed_bonus = ?, crowd_bonus = ?
     WHERE game_id = ? AND player_id = ?`,
    [
      totalScore,
      Number(aiScore || 0),
      Number(speedBonus || 0),
      Number(crowdBonus || 0),
      gameId,
      playerId,
    ],
  );
}

/**
 * Returns score board for game.
 * @param {string} gameId
 * @returns {Promise<Array<{playerId:string, playerName:string, score:number, chainLength:number}>>}
 */
export async function getScoresByGameId(gameId) {
  const rows = await all(
    `SELECT
      s.player_id AS playerId,
      p.name AS playerName,
      s.total_score AS score,
      s.ai_score AS aiScore,
      s.speed_bonus AS speedBonus,
      s.crowd_bonus AS crowdBonus,
      s.chain_length AS chainLength,
      s.time_taken_seconds AS timeTakenSeconds,
      s.rank AS rank,
      s.finalized_at AS finalizedAt
     FROM scores s
       INNER JOIN players p ON p.id = s.player_id
     WHERE s.game_id = ?
     ORDER BY s.total_score DESC, s.chain_length ASC, p.joined_at ASC`,
    [gameId],
  );

  return rows.map((row) => ({
    ...row,
    finalizedAt: normalizeTimestamp(row.finalizedAt),
  }));
}

/**
 * Finalizes score ranking for a game.
 * @param {string} gameId
 * @returns {Promise<Array<{playerId:string, playerName:string, score:number, chainLength:number}>>}
 */
export async function finalizeScores(gameId) {
  const rows = await getScoresByGameId(gameId);
  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    await run(
      `UPDATE scores
       SET rank = ?, finalized_at = CURRENT_TIMESTAMP
       WHERE game_id = ? AND player_id = ?`,
      [index + 1, gameId, current.playerId],
    );
  }
  return getScoresByGameId(gameId);
}

/**
 * Returns full game state object.
 * @param {string} gameId
 * @returns {Promise<{game: object, players: object[], wordChains: object[], submissions: object[]}|null>}
 */
export async function getGameState(gameId) {
  const game = await getGameById(gameId);
  if (!game) {
    return null;
  }

  const [players, wordChains, submissions, votes] = await Promise.all([
    getPlayersByGameId(gameId),
    getWordChainsByGameId(gameId),
    all(
      `SELECT * FROM submissions WHERE game_id = ? ORDER BY submitted_at ASC`,
      [gameId],
    ),
    all(
      `SELECT * FROM votes WHERE game_id = ? ORDER BY created_at ASC`,
      [gameId],
    ),
  ]);

  return {
    game,
    players,
    wordChains,
    submissions: submissions.map(mapSubmission),
    votes: votes.map(mapVote),
  };
}

/**
 * Creates a vote row.
 * @param {{id: string, gameId: string, voterId: string, votedChainOwnerId: string}} payload
 * @returns {Promise<object|null>}
 */
export async function createVote(payload) {
  const { id, gameId, voterId, votedChainOwnerId } = payload;
  await run(
    `INSERT INTO votes (id, game_id, voter_id, voted_chain_owner_id)
     VALUES (?, ?, ?, ?)`,
    [id, gameId, voterId, votedChainOwnerId],
  );

  const row = await get(`SELECT * FROM votes WHERE id = ?`, [id]);
  return mapVote(row);
}

/**
 * Deletes all votes cast by one voter in one game.
 * @param {string} gameId
 * @param {string} voterId
 * @returns {Promise<void>}
 */
export async function deleteVotesByVoter(gameId, voterId) {
  await run(
    `DELETE FROM votes WHERE game_id = ? AND voter_id = ?`,
    [gameId, voterId],
  );
}

/**
 * Returns votes by game.
 * @param {string} gameId
 * @returns {Promise<object[]>}
 */
export async function getVotesByGameId(gameId) {
  const rows = await all(
    `SELECT * FROM votes WHERE game_id = ? ORDER BY created_at ASC`,
    [gameId],
  );
  return rows.map(mapVote);
}

/**
 * Returns all chain steps grouped by player order context.
 * @param {string} gameId
 * @returns {Promise<object[]>}
 */
export async function getChainsForReveal(gameId) {
  const rows = await all(
    `SELECT
      wc.id AS id,
      wc.player_id AS playerId,
      p.name AS playerName,
      wc.step_number AS stepNumber,
      wc.word AS word,
      wc.is_valid AS isValid,
      wc.ai_score AS aiScore,
      wc.ai_feedback AS aiFeedback,
      wc.auto_submitted AS autoSubmitted,
      wc.submitted_at AS submittedAt
     FROM word_chains wc
     INNER JOIN players p ON p.id = wc.player_id
     WHERE wc.game_id = ?
     ORDER BY wc.player_id ASC, wc.step_number ASC`,
    [gameId],
  );

  return rows.map((row) => ({
    ...row,
    isValid: Boolean(row.isValid),
    autoSubmitted: Boolean(row.autoSubmitted),
    submittedAt: normalizeTimestamp(row.submittedAt),
  }));
}

/**
 * Returns first non-empty submission time per player for speed ranking.
 * @param {string} gameId
 * @returns {Promise<Array<{playerId:string,firstSubmittedAt:string|null}>>}
 */
export async function getFirstSubmissionTimes(gameId) {
  const rows = await all(
    `SELECT
      p.id AS playerId,
      MIN(CASE WHEN wc.word != '' THEN wc.submitted_at ELSE NULL END) AS firstSubmittedAt
     FROM players p
     LEFT JOIN word_chains wc ON wc.player_id = p.id AND wc.game_id = p.game_id
     WHERE p.game_id = ? AND p.is_active = 1
     GROUP BY p.id`,
    [gameId],
  );

  return rows.map((row) => ({
    playerId: row.playerId,
    firstSubmittedAt: normalizeTimestamp(row.firstSubmittedAt),
  }));
}

/**
 * Verifies whether player exists for game context.
 * @param {string} playerId
 * @param {string} gameId
 * @returns {Promise<boolean>}
 */
export async function isPlayerAuthorizedForGame(playerId, gameId) {
  const row = await get(
    `SELECT 1 AS allowed
     FROM players
     WHERE id = ? AND game_id = ?
     LIMIT 1`,
    [playerId, gameId],
  );
  return Boolean(row?.allowed);
}

/**
 * Leaderboard stats endpoint data.
 * @param {number} limit
 * @returns {Promise<Array<{playerName:string,totalScore:number,wins:number}>>}
 */
export async function getLeaderboard(limit = 10) {
  const rows = await all(
    `SELECT
      p.name AS playerName,
      COALESCE(SUM(s.total_score), 0) AS totalScore,
      COALESCE(SUM(CASE WHEN s.rank = 1 THEN 1 ELSE 0 END), 0) AS wins
     FROM players p
     LEFT JOIN scores s ON s.player_id = p.id
     WHERE p.game_id != '__registry__'
     GROUP BY p.id, p.name
     ORDER BY totalScore DESC, wins DESC, p.joined_at ASC
     LIMIT ?`,
    [limit],
  );

  return rows.map((row) => ({
    playerName: row.playerName,
    totalScore: Number(row.totalScore ?? 0),
    wins: Number(row.wins ?? 0),
  }));
}

/**
 * Returns player aggregated stats and history.
 * @param {string} playerId
 * @returns {Promise<{stats: object, history: object[]}|null>}
 */
export async function getPlayerStats(playerId) {
  const stats = await get(
    `SELECT
      p.id AS playerId,
      p.name AS playerName,
      COUNT(s.id) AS gamesPlayed,
      COALESCE(SUM(s.total_score), 0) AS totalScore,
      COALESCE(AVG(s.total_score), 0) AS averageScore,
      COALESCE(SUM(CASE WHEN s.rank = 1 THEN 1 ELSE 0 END), 0) AS wins
     FROM players p
     LEFT JOIN scores s ON s.player_id = p.id
     WHERE p.id = ?
     GROUP BY p.id, p.name`,
    [playerId],
  );

  if (!stats) {
    return null;
  }

  const history = await all(
    `SELECT
      s.game_id AS gameId,
      g.start_word AS startWord,
      g.end_word AS endWord,
      s.total_score AS totalScore,
      s.chain_length AS chainLength,
      s.rank AS rank,
      g.ended_at AS endedAt
     FROM scores s
     INNER JOIN games g ON g.id = s.game_id
     WHERE s.player_id = ?
     ORDER BY g.ended_at DESC`,
    [playerId],
  );

  return {
    stats: {
      ...stats,
      gamesPlayed: Number(stats.gamesPlayed ?? 0),
      totalScore: Number(stats.totalScore ?? 0),
      averageScore: Number(stats.averageScore ?? 0),
      wins: Number(stats.wins ?? 0),
    },
    history: history.map((entry) => ({
      ...entry,
      endedAt: normalizeTimestamp(entry.endedAt),
    })),
  };
}

/**
 * Returns full stats by game.
 * @param {string} gameId
 * @returns {Promise<{game:object,players:object[],submissions:object[],scores:object[]}|null>}
 */
export async function getGameStats(gameId) {
  const game = await getGameById(gameId);
  if (!game) {
    return null;
  }

  const [players, submissions, scores, wordChains, votes] = await Promise.all([
    getPlayersByGameId(gameId),
    all(`SELECT * FROM submissions WHERE game_id = ? ORDER BY submitted_at ASC`, [gameId]),
    getScoresByGameId(gameId),
    getWordChainsByGameId(gameId),
    getVotesByGameId(gameId),
  ]);

  return {
    game,
    players,
    wordChains,
    submissions: submissions.map(mapSubmission),
    votes,
    scores,
  };
}

const queries = {
  createGame,
  updateGamePhaseState,
  getGameById,
  getGameByCode,
  getGameByIdentifier,
  updateGameStatus,
  deleteGameCascade,
  addPlayer,
  reactivatePlayer,
  getPlayerById,
  getPlayerInGame,
  getActivePlayerInGame,
  markPlayerLeft,
  getPlayersByGameId,
  getHostPlayerByGameId,
  getGameWithPlayers,
  countActivePlayers,
  getNextStepNumber,
  isDuplicateWord,
  getLastChainWord,
  createWordChain,
  getWordChainsByGameId,
  createSubmission,
  updateSubmissionValidation,
  getSubmissionById,
  upsertScore,
  setScoreBreakdown,
  getScoresByGameId,
  finalizeScores,
  getGameState,
  createVote,
  deleteVotesByVoter,
  getVotesByGameId,
  getChainsForReveal,
  getFirstSubmissionTimes,
  isPlayerAuthorizedForGame,
  getLeaderboard,
  getPlayerStats,
  getGameStats,
};

export default queries;
