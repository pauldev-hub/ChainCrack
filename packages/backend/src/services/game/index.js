/**
 * Game Service Module
 *
 * Handles core game logic:
 * - Room lifecycle and phase transitions
 * - Word-chain validation and scoring
 * - Voting and round finalization
 *
 * @file packages/backend/src/services/game/index.js
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createGame as createGameQuery,
  updateGamePhaseState,
  getGameById,
  getGameByCode,
  updateGameStatus,
  deleteGameCascade,
  addPlayer,
  reactivatePlayer,
  reassignPlayerToGame,
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
  createSubmission,
  updateSubmissionValidation,
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
} from '../../db/queries.js';
import { validateWordChain } from '../ai/index.js';
import { getRandomWordPair } from '../wordService.js';
import {
  isValidUuid,
  isValidRoomCode,
  normalizeRoomCode,
  normalizeGameMode,
  normalizeMemorySubmission,
} from '../../utils/validation.js';

const ROOM_EXPIRY_MS = Number(process.env.ROOM_EXPIRY_MS || 300000);
const ROOM_CODE_ATTEMPTS = 20;
const RACE_SECONDS = Number(process.env.RACE_PHASE_SECONDS || 60);
const REVEAL_DELAY_MS = Number(process.env.REVEAL_DELAY_MS || 3000);
const VOTE_SECONDS = Number(process.env.VOTE_PHASE_SECONDS || 30);
const AI_WAIT_TIMEOUT_MS = Number(process.env.AI_PHASE_WAIT_TIMEOUT_MS || 10000);
const MEMORY_REVEAL_MS = Number(process.env.MEMORY_REVEAL_MS || 20000);
const MEMORY_RECALL_MS = Number(process.env.MEMORY_RECALL_MS || 30000);
const MEMORY_WORD_COUNT = Number(process.env.MEMORY_WORD_COUNT || 10);

const roomExpiryTimers = new Map();
const gameValidationCounts = new Map();

function createGameError(message, code = 'INVALID_OPERATION', statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function ensureUuid(value, label) {
  if (!isValidUuid(value)) {
    throw createGameError(`${label} must be a valid UUID`, 'VALIDATION_ERROR', 400);
  }
}

function ensureRoomCode(value, label = 'code') {
  const normalized = normalizeRoomCode(value);
  if (!isValidRoomCode(normalized)) {
    throw createGameError(
      `${label} must be an alphanumeric room code`,
      'VALIDATION_ERROR',
      400,
    );
  }
  return normalized;
}

function ensureWord(word) {
  if (typeof word !== 'string' || !word.trim()) {
    throw createGameError('Word is required', 'VALIDATION_ERROR', 400);
  }

  const trimmed = word.trim();
  if (trimmed.length < 3 || trimmed.length > 50 || !/^[\x20-\x7E]+$/.test(trimmed)) {
    throw createGameError(
      'Word must be 3-50 ASCII characters',
      'VALIDATION_ERROR',
      400,
    );
  }

  return trimmed;
}

function ensureExplanation(explanation) {
  if (typeof explanation !== 'string' || !explanation.trim()) {
    throw createGameError('Explanation is required', 'VALIDATION_ERROR', 400);
  }

  const trimmed = explanation.trim();
  if (trimmed.length < 10 || trimmed.length > 500) {
    throw createGameError(
      'Explanation must be 10-500 characters',
      'VALIDATION_ERROR',
      400,
    );
  }

  return trimmed;
}

function ensurePlayerName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw createGameError('Player name is required', 'VALIDATION_ERROR', 400);
  }

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw createGameError('Player name must be 1-50 characters', 'VALIDATION_ERROR', 400);
  }
  return trimmed;
}

function generateRoomCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    output += alphabet[randomIndex];
  }

  return output;
}

function isRoomCodeConstraintError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('games.code') || message.includes('idx_games_code');
}

function cancelRoomExpiry(gameId) {
  const timer = roomExpiryTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    roomExpiryTimers.delete(gameId);
  }
}

function scheduleRoomExpiry(gameId) {
  cancelRoomExpiry(gameId);
  const timer = setTimeout(async () => {
    try {
      const activePlayers = await countActivePlayers(gameId);
      if (activePlayers === 0) {
        await deleteGameCascade(gameId);
      }
    } catch (error) {
      console.error(`[Game] Room expiry cleanup failed for ${gameId}`, error);
    } finally {
      roomExpiryTimers.delete(gameId);
    }
  }, ROOM_EXPIRY_MS);
  roomExpiryTimers.set(gameId, timer);
}

function registerValidationStart(gameId) {
  const current = Number(gameValidationCounts.get(gameId) || 0);
  gameValidationCounts.set(gameId, current + 1);
}

function registerValidationEnd(gameId) {
  const current = Number(gameValidationCounts.get(gameId) || 0);
  if (current <= 1) {
    gameValidationCounts.delete(gameId);
    return;
  }
  gameValidationCounts.set(gameId, current - 1);
}

async function waitForValidations(gameId, timeoutMs = AI_WAIT_TIMEOUT_MS) {
  const start = Date.now();
  while (Number(gameValidationCounts.get(gameId) || 0) > 0) {
    if (Date.now() - start >= timeoutMs) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function toIsoAfterSeconds(seconds) {
  return new Date(Date.now() + (seconds * 1000)).toISOString();
}

function toIsoAfterMs(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function createFrequencyMap(words) {
  const map = new Map();
  for (const word of words) {
    if (!word) {
      continue;
    }
    map.set(word, Number(map.get(word) || 0) + 1);
  }
  return map;
}

/**
 * Computes memory-round score with exact and misplaced matches.
 * @param {string[]} targetWords
 * @param {string[]} submittedWords
 * @returns {{exactMatches:number,misplacedMatches:number,fullOrderBonus:number,totalScore:number}}
 */
export function scoreMemorySubmission(targetWords, submittedWords) {
  const safeTarget = Array.isArray(targetWords) ? targetWords : [];
  const safeSubmitted = Array.isArray(submittedWords) ? submittedWords : [];
  const length = Math.max(safeTarget.length, safeSubmitted.length);
  const target = [];
  const submitted = [];
  for (let index = 0; index < length; index += 1) {
    target.push(String(safeTarget[index] || '').trim().toLowerCase());
    submitted.push(String(safeSubmitted[index] || '').trim().toLowerCase());
  }

  let exactMatches = 0;
  const unmatchedTarget = [];
  const unmatchedSubmitted = [];

  for (let index = 0; index < length; index += 1) {
    if (target[index] && target[index] === submitted[index]) {
      exactMatches += 1;
      continue;
    }

    unmatchedTarget.push(target[index]);
    unmatchedSubmitted.push(submitted[index]);
  }

  const targetFreq = createFrequencyMap(unmatchedTarget);
  let misplacedMatches = 0;
  for (const word of unmatchedSubmitted) {
    if (!word) {
      continue;
    }

    const available = Number(targetFreq.get(word) || 0);
    if (available <= 0) {
      continue;
    }

    misplacedMatches += 1;
    targetFreq.set(word, available - 1);
  }

  const fullOrderBonus = exactMatches === safeTarget.length && safeTarget.length > 0 ? 5 : 0;
  const totalScore = exactMatches + (misplacedMatches * 0.5) + fullOrderBonus;

  return {
    exactMatches,
    misplacedMatches,
    fullOrderBonus,
    totalScore,
  };
}

/**
 * Normalizes submission slots to fixed word-count length.
 * @param {unknown} words
 * @param {number} wordCount
 * @returns {string[]}
 */
export function normalizeMemorySubmissionWords(words, wordCount = MEMORY_WORD_COUNT) {
  return normalizeMemorySubmission(words, wordCount);
}

function groupChainsByPlayer(chains, activePlayers) {
  const grouped = new Map();

  for (const player of activePlayers) {
    grouped.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      words: [],
      steps: [],
      submittedAt: null,
      aiScore: 0,
      chainLength: 0,
      isEmptyChain: true,
    });
  }

  for (const step of chains) {
    if (!grouped.has(step.playerId)) {
      grouped.set(step.playerId, {
        playerId: step.playerId,
        playerName: step.playerName || 'Unknown',
        words: [],
        steps: [],
        submittedAt: null,
        aiScore: 0,
        chainLength: 0,
        isEmptyChain: true,
      });
    }

    const entry = grouped.get(step.playerId);
    entry.steps.push(step);
    if (step.word) {
      entry.words.push(step.word);
      entry.chainLength += 1;
      entry.isEmptyChain = false;
      if (!entry.submittedAt || String(step.submittedAt) < String(entry.submittedAt)) {
        entry.submittedAt = step.submittedAt;
      }
    }
    if (step.isValid && step.word) {
      entry.aiScore += Number(step.aiScore || 0);
    }
  }

  return grouped;
}

function computeSpeedBonus(firstSubmissionTimes) {
  const speedBonus = new Map();
  const ordered = firstSubmissionTimes
    .filter((row) => row.firstSubmittedAt)
    .sort((left, right) => String(left.firstSubmittedAt).localeCompare(String(right.firstSubmittedAt)));

  const awardByRank = [30, 20, 10];
  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index];
    speedBonus.set(row.playerId, awardByRank[index] || 0);
  }

  return speedBonus;
}

function computeVoteCounts(votes) {
  const counts = new Map();
  for (const vote of votes) {
    const key = vote.voted_chain_owner_id;
    counts.set(key, Number(counts.get(key) || 0) + 1);
  }
  return counts;
}

function resolveChainOfRound(activePlayers, groupedChains, voteCounts, majorityThreshold) {
  let topVoteCount = 0;
  for (const player of activePlayers) {
    if (groupedChains.get(player.id)?.isEmptyChain) {
      continue;
    }
    topVoteCount = Math.max(topVoteCount, Number(voteCounts.get(player.id) || 0));
  }

  if (topVoteCount < majorityThreshold || topVoteCount <= 0) {
    return {
      topVoteCount,
      tiedTopPlayerIds: [],
      chainOfRoundPlayerId: null,
    };
  }

  const tiedTopPlayerIds = activePlayers
    .map((player) => player.id)
    .filter((playerId) => {
      const chain = groupedChains.get(playerId);
      if (!chain || chain.isEmptyChain) {
        return false;
      }
      return Number(voteCounts.get(playerId) || 0) === topVoteCount;
    });

  if (tiedTopPlayerIds.length === 0) {
    return {
      topVoteCount,
      tiedTopPlayerIds,
      chainOfRoundPlayerId: null,
    };
  }

  if (tiedTopPlayerIds.length === 1) {
    return {
      topVoteCount,
      tiedTopPlayerIds,
      chainOfRoundPlayerId: tiedTopPlayerIds[0],
    };
  }

  const sortedTies = [...tiedTopPlayerIds].sort((leftId, rightId) => {
    const leftChain = groupedChains.get(leftId);
    const rightChain = groupedChains.get(rightId);
    if (Number(rightChain.aiScore || 0) !== Number(leftChain.aiScore || 0)) {
      return Number(rightChain.aiScore || 0) - Number(leftChain.aiScore || 0);
    }
    return String(leftChain.submittedAt || '').localeCompare(String(rightChain.submittedAt || ''));
  });

  return {
    topVoteCount,
    tiedTopPlayerIds,
    chainOfRoundPlayerId: sortedTies[0],
  };
}

async function ensureTimeoutEntries(gameId) {
  const activePlayers = (await getPlayersByGameId(gameId)).filter((player) => player.is_active);
  const allChains = await getChainsForReveal(gameId);
  const hasAnyStepByPlayer = new Set(allChains.map((row) => row.playerId));

  for (const player of activePlayers) {
    if (hasAnyStepByPlayer.has(player.id)) {
      continue;
    }

    const wordChainId = uuidv4();
    const submissionId = uuidv4();
    const stepNumber = await getNextStepNumber(gameId);

    await createWordChain({
      id: wordChainId,
      gameId,
      playerId: player.id,
      stepNumber,
      word: '',
      explanation: 'Player timed out without submitting a chain step.',
      isValid: false,
      aiScore: 0,
      aiFeedback: 'Auto-submitted timeout',
      autoSubmitted: true,
    });

    await createSubmission({
      id: submissionId,
      gameId,
      playerId: player.id,
      wordChainId,
      status: 'rejected',
    });

    await updateSubmissionValidation({
      id: submissionId,
      status: 'rejected',
      validationMs: 0,
      providerUsed: null,
    });
  }
}

async function buildRevealPayload(gameId) {
  const activePlayers = (await getPlayersByGameId(gameId)).filter((player) => player.is_active);
  const chains = await getChainsForReveal(gameId);
  const grouped = groupChainsByPlayer(chains, activePlayers);

  return {
    gameId,
    chains: [...grouped.values()].map((entry) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      words: entry.words,
      steps: entry.steps,
      submittedAt: entry.submittedAt,
      aiScore: entry.aiScore,
      chainLength: entry.chainLength,
      isEmptyChain: entry.isEmptyChain,
    })),
  };
}

/**
 * Creates a new game instance.
 * @param {{startWord?:string,endWord?:string,maxPlayers?:number,gameId?:string,code?:string}} payload
 * @returns {Promise<{gameId:string,code:string,status:string,startWord:string,endWord:string}>}
 */
export const createGame = async (payload = {}) => {
  const {
    startWord,
    endWord,
    maxPlayers = 4,
    gameId,
    code,
    mode,
  } = payload;

  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
    throw createGameError('maxPlayers must be between 2 and 4', 'VALIDATION_ERROR', 400);
  }

  const pair = startWord && endWord
    ? { startWord: ensureWord(startWord), endWord: ensureWord(endWord) }
    : getRandomWordPair();

  const id = gameId || uuidv4();
  ensureUuid(id, 'gameId');

  const existing = await getGameById(id);
  if (existing) {
    throw createGameError('Game already exists', 'INVALID_OPERATION', 400);
  }

  const requestedCode = code ? ensureRoomCode(code) : null;
  let createdGame = null;

  for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt += 1) {
    const roomCode = requestedCode || generateRoomCode();

    try {
      createdGame = await createGameQuery({
        id,
        code: roomCode,
        startWord: pair.startWord,
        endWord: pair.endWord,
        maxPlayers,
      });
      break;
    } catch (error) {
      if (requestedCode || !isRoomCodeConstraintError(error)) {
        throw error;
      }
    }
  }

  if (!createdGame) {
    throw createGameError(
      'Could not allocate unique room code, try again',
      'SERVER_ERROR',
      500,
    );
  }

  return {
    gameId: createdGame.id,
    code: createdGame.code,
    status: createdGame.status,
    startWord: createdGame.start_word,
    endWord: createdGame.end_word,
    mode: normalizeGameMode(mode),
  };
};

/**
 * Resolves room identity payload into canonical gameId + code pair.
 * @param {{gameId?:string,code?:string}} payload
 * @returns {Promise<{gameId:string,code:string,game:object}>}
 */
export async function resolveGameReference(payload = {}) {
  if (payload.gameId) {
    ensureUuid(payload.gameId, 'gameId');
    const byId = await getGameById(payload.gameId);
    if (!byId) {
      throw createGameError('Game not found', 'INVALID_OPERATION', 404);
    }

    return {
      gameId: byId.id,
      code: byId.code,
      game: byId,
    };
  }

  if (payload.code) {
    const safeCode = ensureRoomCode(payload.code, 'code');
    const byCode = await getGameByCode(safeCode);
    if (!byCode) {
      throw createGameError('Room not found', 'INVALID_OPERATION', 404);
    }

    return {
      gameId: byCode.id,
      code: byCode.code,
      game: byCode,
    };
  }

  throw createGameError('gameId or code is required', 'VALIDATION_ERROR', 400);
}

/**
 * Joins or re-joins a game.
 * @param {{gameId:string,playerId:string,playerName:string}} payload
 * @returns {Promise<{playerId:string,playerName:string,playerCount:number,timestamp:string,game:object}>}
 */
export async function joinGame(payload) {
  const { gameId, playerId, playerName } = payload;
  ensureUuid(gameId, 'gameId');
  ensureUuid(playerId, 'playerId');
  const safeName = ensurePlayerName(playerName);

  let game = await getGameById(gameId);
  if (!game) {
    await createGame({ gameId });
    game = await getGameById(gameId);
  }

  if (game.status === 'ended') {
    throw createGameError('Game already ended', 'INVALID_OPERATION', 400);
  }

  const activePlayers = await countActivePlayers(gameId);
  if (activePlayers >= game.max_players) {
    const existingPlayer = await getPlayerInGame(playerId, gameId);
    if (!existingPlayer || !existingPlayer.is_active) {
      throw createGameError('Game is full', 'INVALID_OPERATION', 400);
    }
  }

  const existingPlayer = await getPlayerInGame(playerId, gameId);
  if (existingPlayer) {
    await reactivatePlayer({ id: playerId, gameId, name: safeName });
  } else {
    const globalPlayer = await getPlayerById(playerId);
    if (globalPlayer && globalPlayer.game_id !== gameId) {
      const previousGameId = globalPlayer.game_id;
      const previousGame = await getGameById(previousGameId);
      const previousStatus = String(previousGame?.status || '');
      const previousActivePlayers = await countActivePlayers(previousGameId);

      const canReassign = !globalPlayer.is_active
        || previousStatus === 'ended'
        || previousActivePlayers <= 1;

      if (!canReassign) {
        throw createGameError(
          'Player is already registered in another game',
          'INVALID_OPERATION',
          400,
        );
      }

      await reassignPlayerToGame({ id: playerId, gameId, name: safeName });

      if (previousActivePlayers <= 1) {
        scheduleRoomExpiry(previousGameId);
      }
    } else if (globalPlayer) {
      await reactivatePlayer({ id: playerId, gameId, name: safeName });
    } else {
      await addPlayer({ id: playerId, gameId, name: safeName });
    }
  }

  cancelRoomExpiry(gameId);

  const updatedCount = await countActivePlayers(gameId);
  game = await getGameById(gameId);

  return {
    playerId,
    playerName: safeName,
    playerCount: updatedCount,
    timestamp: new Date().toISOString(),
    game,
  };
}

/**
 * Leaves a game.
 * @param {{gameId:string,playerId:string}} payload
 * @returns {Promise<{playerId:string,remainingPlayers:number}>}
 */
export async function leaveGame(payload) {
  const { gameId, playerId } = payload;
  ensureUuid(gameId, 'gameId');
  ensureUuid(playerId, 'playerId');

  const player = await getPlayerInGame(playerId, gameId);
  if (!player) {
    throw createGameError('Player is not part of this game', 'INVALID_OPERATION', 404);
  }

  await markPlayerLeft(playerId, gameId);
  const remainingPlayers = await countActivePlayers(gameId);
  if (remainingPlayers === 0) {
    scheduleRoomExpiry(gameId);
  }

  return { playerId, remainingPlayers };
}

/**
 * Submits a word for validation and scoring.
 * @param {{gameId:string,playerId:string,word:string,explanation:string}} payload
 * @returns {Promise<{submissionReceived:object,submissionValidated:object,scoresUpdated:object}>}
 */
export async function submitWord(payload) {
  const { gameId, playerId, word, explanation } = payload;
  ensureUuid(gameId, 'gameId');
  ensureUuid(playerId, 'playerId');

  const safeWord = ensureWord(word);
  const safeExplanation = ensureExplanation(explanation);

  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  if (game.status === 'ended') {
    throw createGameError('Game already ended', 'INVALID_OPERATION', 400);
  }

  if (game.phase !== 'race') {
    throw createGameError('Word submissions are allowed only during race phase', 'INVALID_OPERATION', 400);
  }

  const player = await getActivePlayerInGame(playerId, gameId);
  if (!player) {
    throw createGameError('Player is not active in this game', 'INVALID_OPERATION', 403);
  }

  const duplicateWord = await isDuplicateWord(gameId, safeWord);
  if (duplicateWord) {
    throw createGameError('Word already used in this chain', 'VALIDATION_ERROR', 400);
  }

  const lastWord = await getLastChainWord(gameId);
  const previousWord = lastWord?.word || game.start_word;
  const stepNumber = await getNextStepNumber(gameId);

  const submissionId = uuidv4();
  const wordChainId = uuidv4();
  const submissionReceived = {
    submissionId,
    playerId,
    word: safeWord,
    status: 'pending',
  };

  registerValidationStart(gameId);
  const validationStart = Date.now();
  let validation;
  try {
    validation = await validateWordChain({
      gameId,
      playerId,
      previousWord,
      currentWord: safeWord,
      explanation: safeExplanation,
    });
  } finally {
    registerValidationEnd(gameId);
  }
  const validationMs = Date.now() - validationStart;

  await createWordChain({
    id: wordChainId,
    gameId,
    playerId,
    stepNumber,
    word: safeWord,
    explanation: safeExplanation,
    isValid: validation.valid,
    aiScore: validation.score,
    aiFeedback: validation.reason,
    autoSubmitted: false,
  });

  await createSubmission({
    id: submissionId,
    gameId,
    playerId,
    wordChainId,
    status: 'pending',
  });

  await updateSubmissionValidation({
    id: submissionId,
    status: validation.valid ? 'validated' : 'rejected',
    validationMs,
    providerUsed: ['groq', 'gemini', 'llama'].includes(validation.providerUsed)
      ? validation.providerUsed
      : null,
  });

  await upsertScore({
    id: uuidv4(),
    gameId,
    playerId,
    scoreDelta: validation.valid ? validation.score : 0,
    aiScoreDelta: validation.valid ? validation.score : 0,
    chainDelta: validation.valid ? 1 : 0,
  });

  const scores = await getScoresByGameId(gameId);

  return {
    submissionReceived,
    submissionValidated: {
      submissionId,
      isValid: validation.valid,
      score: validation.score,
      reason: validation.reason,
    },
    scoresUpdated: {
      gameId,
      code: game.code,
      scores: scores.map((row) => ({
        playerId: row.playerId,
        playerName: row.playerName,
        score: Number(row.score),
        aiScore: Number(row.aiScore || 0),
        speedBonus: Number(row.speedBonus || 0),
        crowdBonus: Number(row.crowdBonus || 0),
        chainLength: Number(row.chainLength),
      })),
    },
  };
}

/**
 * Prepares reveal payload after race timeout.
 * @param {{gameId:string}} payload
 * @returns {Promise<{gameId:string,chains:Array}>}
 */
export async function prepareRevealPhase(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');

  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  await ensureTimeoutEntries(gameId);
  await waitForValidations(gameId, AI_WAIT_TIMEOUT_MS);

  await updateGamePhaseState({
    gameId,
    phase: 'reveal',
    revealAt: toIsoAfterMs(REVEAL_DELAY_MS),
  });

  return buildRevealPayload(gameId);
}

/**
 * Opens vote phase.
 * @param {{gameId:string}} payload
 * @returns {Promise<{gameId:string,voteEndsAt:string}>}
 */
export async function openVotePhase(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');

  const voteEndsAt = toIsoAfterSeconds(VOTE_SECONDS);
  await updateGamePhaseState({
    gameId,
    phase: 'vote',
    votePhaseEndsAt: voteEndsAt,
  });

  return {
    gameId,
    voteEndsAt,
  };
}

/**
 * Records votes for one voter (up to two targets).
 * @param {{gameId:string,voterId:string,votedChainOwnerIds?:string[],votedChainOwnerId?:string}} payload
 * @returns {Promise<{gameId:string,voteCounts:Record<string,number>}>}
 */
export async function submitVotes(payload) {
  const {
    gameId,
    voterId,
    votedChainOwnerIds,
    votedChainOwnerId,
  } = payload;

  ensureUuid(gameId, 'gameId');
  ensureUuid(voterId, 'voterId');

  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }
  if (game.phase !== 'vote') {
    throw createGameError('Voting is closed', 'INVALID_OPERATION', 400);
  }

  const activePlayers = (await getPlayersByGameId(gameId)).filter((player) => player.is_active);
  const allowSelfVote = activePlayers.length < 3;
  const activePlayerIds = new Set(activePlayers.map((player) => player.id));

  const normalizedTargets = [...new Set(
    (Array.isArray(votedChainOwnerIds) ? votedChainOwnerIds : [votedChainOwnerId])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];

  if (normalizedTargets.length === 0) {
    throw createGameError('At least one vote target is required', 'VALIDATION_ERROR', 400);
  }

  if (normalizedTargets.length > 2) {
    throw createGameError('A player can vote for at most 2 chains', 'VALIDATION_ERROR', 400);
  }

  for (const targetId of normalizedTargets) {
    ensureUuid(targetId, 'votedChainOwnerId');
    if (!activePlayerIds.has(targetId)) {
      throw createGameError('Vote target must be an active player', 'VALIDATION_ERROR', 400);
    }
    if (!allowSelfVote && targetId === voterId) {
      throw createGameError('Self-voting is disabled in rooms with 3+ active players', 'INVALID_OPERATION', 400);
    }
  }

  await deleteVotesByVoter(gameId, voterId);
  for (const targetId of normalizedTargets) {
    await createVote({
      id: uuidv4(),
      gameId,
      voterId,
      votedChainOwnerId: targetId,
    });
  }

  const allVotes = await getVotesByGameId(gameId);
  const voteCountsMap = computeVoteCounts(allVotes);
  const voteCounts = {};
  for (const player of activePlayers) {
    voteCounts[player.id] = Number(voteCountsMap.get(player.id) || 0);
  }

  return {
    gameId,
    voteCounts,
  };
}

/**
 * Finalizes vote phase and computes round results.
 * @param {{gameId:string}} payload
 * @returns {Promise<{gameId:string,code:string,voteCounts:Record<string,number>,chainOfRoundPlayerId:string|null,winnerId:string|null,winnerName:string,finalScores:Array,timestamp:string}>}
 */
export async function closeVotePhase(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');

  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  const activePlayers = (await getPlayersByGameId(gameId)).filter((player) => player.is_active);
  const revealRows = await getChainsForReveal(gameId);
  const groupedChains = groupChainsByPlayer(revealRows, activePlayers);
  const votes = await getVotesByGameId(gameId);
  const voteCountsMap = computeVoteCounts(votes);

  const voteCounts = {};
  for (const player of activePlayers) {
    voteCounts[player.id] = Number(voteCountsMap.get(player.id) || 0);
  }

  const firstSubmissionTimes = await getFirstSubmissionTimes(gameId);
  const speedBonusMap = computeSpeedBonus(firstSubmissionTimes);
  const majorityThreshold = Math.ceil(activePlayers.length / 2);
  const {
    topVoteCount,
    tiedTopPlayerIds,
    chainOfRoundPlayerId,
  } = resolveChainOfRound(activePlayers, groupedChains, voteCountsMap, majorityThreshold);

  const crowdBonusMap = new Map();
  for (const player of activePlayers) {
    const chain = groupedChains.get(player.id);
    if (!chain || chain.isEmptyChain) {
      crowdBonusMap.set(player.id, 0);
      continue;
    }

    const rawVotes = Number(voteCountsMap.get(player.id) || 0);
    if (rawVotes <= 0) {
      crowdBonusMap.set(player.id, 0);
      continue;
    }

    if (topVoteCount > 0 && tiedTopPlayerIds.includes(player.id) && tiedTopPlayerIds.length > 1) {
      crowdBonusMap.set(player.id, rawVotes / tiedTopPlayerIds.length);
      continue;
    }

    crowdBonusMap.set(player.id, rawVotes);
  }

  for (const player of activePlayers) {
    const chain = groupedChains.get(player.id) || {
      aiScore: 0,
      chainLength: 0,
      isEmptyChain: true,
    };

    await setScoreBreakdown({
      gameId,
      playerId: player.id,
      aiScore: Number(chain.aiScore || 0),
      speedBonus: Number(speedBonusMap.get(player.id) || 0),
      crowdBonus: Number(crowdBonusMap.get(player.id) || 0),
      chainLength: Number(chain.chainLength || 0),
    });
  }

  await updateGamePhaseState({
    gameId,
    phase: 'results',
    chainOfRoundPlayerId,
  });
  await updateGameStatus(gameId, 'ended');
  const finalScores = await finalizeScores(gameId);

  const winnerId = finalScores.length > 0 ? finalScores[0].playerId : null;
  const winner = winnerId ? await getPlayerInGame(winnerId, gameId) : null;

  return {
    gameId,
    code: game.code,
    voteCounts,
    chainOfRoundPlayerId,
    winnerId,
    winnerName: winner?.name || 'Winner',
    finalScores,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Requests game state.
 * @param {{gameId:string}} payload
 * @returns {Promise<object>}
 */
export async function requestGameState(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');
  const state = await getGameState(gameId);
  if (!state) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }
  return state;
}

/**
 * Requests scores for a game.
 * @param {{gameId:string}} payload
 * @returns {Promise<{gameId:string,scores:Array}>}
 */
export async function requestScores(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');
  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }
  const scores = await getScoresByGameId(gameId);
  return {
    gameId,
    code: game.code,
    scores: scores.map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      score: Number(row.score),
      aiScore: Number(row.aiScore || 0),
      speedBonus: Number(row.speedBonus || 0),
      crowdBonus: Number(row.crowdBonus || 0),
      chainLength: Number(row.chainLength),
      rank: Number(row.rank || 0) || null,
    })),
  };
}

/**
 * Returns game details with players for REST responses.
 * @param {{gameId:string}} payload
 * @returns {Promise<object>}
 */
export async function getGameDetails(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');

  const room = await getGameWithPlayers(gameId);
  if (!room) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  return {
    ...room.game,
    players: room.players,
  };
}

/**
 * Ends a game and finalizes ranking.
 * @param {{gameId:string,winnerId:string}} payload
 * @returns {Promise<{winnerId:string,winnerName:string,finalScores:Array,timestamp:string}>}
 */
export async function endGame(payload) {
  const { gameId, winnerId } = payload;
  ensureUuid(gameId, 'gameId');
  ensureUuid(winnerId, 'winnerId');

  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  await updateGameStatus(gameId, 'ended');
  await updateGamePhaseState({ gameId, phase: 'results' });
  cancelRoomExpiry(gameId);

  const finalScores = await finalizeScores(gameId);
  const winner = await getPlayerInGame(winnerId, gameId);
  if (!winner) {
    throw createGameError('Winner is not part of this game', 'INVALID_OPERATION', 400);
  }

  return {
    gameId,
    code: game.code,
    winnerId,
    winnerName: winner.name,
    finalScores,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Returns player row for socket auth checks.
 * @param {string} playerId
 * @param {string} gameId
 * @returns {Promise<object|null>}
 */
export async function getAuthorizedPlayer(playerId, gameId) {
  return getPlayerInGame(playerId, gameId);
}

/**
 * Returns host player and room snapshot for a game.
 * @param {{gameId:string}} payload
 * @returns {Promise<{host: object|null, room: {game: object, players: object[]}|null}>}
 */
export async function getRoomHost(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');

  const room = await getGameWithPlayers(gameId);
  if (!room) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  const host = await getHostPlayerByGameId(gameId);
  return { host, room };
}

/**
 * Starts a room by host action.
 * @param {{gameId:string,playerId:string}} payload
 * @returns {Promise<{gameId:string,status:string,startedAt:string|null,raceEndsAt:string}>}
 */
export async function startRoom(payload) {
  const { gameId, playerId, mode } = payload;
  ensureUuid(gameId, 'gameId');
  ensureUuid(playerId, 'playerId');

  const room = await getGameWithPlayers(gameId);
  if (!room) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  const host = await getHostPlayerByGameId(gameId);
  if (!host || host.id !== playerId) {
    throw createGameError('Only the host can start the room', 'INVALID_OPERATION', 403);
  }

  const activePlayers = room.players.filter((player) => player.is_active);
  if (activePlayers.length < 1) {
    throw createGameError('At least one active player is required to start', 'VALIDATION_ERROR', 400);
  }

  if (room.game.status === 'ended') {
    throw createGameError('Game already ended', 'INVALID_OPERATION', 400);
  }

  const updatedGame = await updateGameStatus(gameId, 'active');
  const raceEndsAt = toIsoAfterSeconds(RACE_SECONDS);
  const normalizedMode = normalizeGameMode(mode);
  await updateGamePhaseState({
    gameId,
    phase: 'race',
    raceEndsAt,
    revealAt: null,
    votePhaseEndsAt: null,
    chainOfRoundPlayerId: null,
  });

  return {
    gameId,
    code: updatedGame.code,
    status: updatedGame.status,
    startedAt: updatedGame.started_at,
    raceEndsAt,
    mode: normalizedMode,
  };
}

/**
 * Returns current game phase snapshot.
 * @param {{gameId:string}} payload
 * @returns {Promise<{gameId:string,phase:string,raceEndsAt:string|null,revealAt:string|null,votePhaseEndsAt:string|null}>}
 */
export async function getPhaseState(payload) {
  const { gameId } = payload;
  ensureUuid(gameId, 'gameId');
  const game = await getGameById(gameId);
  if (!game) {
    throw createGameError('Game not found', 'INVALID_OPERATION', 404);
  }

  return {
    gameId: game.id,
    phase: game.phase,
    raceEndsAt: game.race_ends_at,
    revealAt: game.reveal_at,
    votePhaseEndsAt: game.vote_phase_ends_at,
  };
}

/**
 * Timing constants exposed for socket orchestration.
 * @returns {{raceSeconds:number,revealDelayMs:number,voteSeconds:number}}
 */
export function getPhaseConfig() {
  return {
    raceSeconds: RACE_SECONDS,
    revealDelayMs: REVEAL_DELAY_MS,
    voteSeconds: VOTE_SECONDS,
    memoryRevealMs: MEMORY_REVEAL_MS,
    memoryRecallMs: MEMORY_RECALL_MS,
    memoryWordCount: MEMORY_WORD_COUNT,
  };
}

/**
 * Clears all room timers on process shutdown.
 * @returns {void}
 */
export function clearRoomTimers() {
  for (const [gameId, timer] of roomExpiryTimers.entries()) {
    clearTimeout(timer);
    roomExpiryTimers.delete(gameId);
  }
}

export default {
  createGame,
  resolveGameReference,
  joinGame,
  leaveGame,
  submitWord,
  prepareRevealPhase,
  openVotePhase,
  submitVotes,
  closeVotePhase,
  requestGameState,
  requestScores,
  getGameDetails,
  endGame,
  getAuthorizedPlayer,
  getRoomHost,
  startRoom,
  getPhaseState,
  getPhaseConfig,
  scoreMemorySubmission,
  normalizeMemorySubmissionWords,
  clearRoomTimers,
};
