/**
 * ChainCrack Backend Server
 *
 * Main Express + Socket.IO server entry point.
 *
 * @file packages/backend/src/server.js
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import {
  initDatabase,
  closeDatabase,
} from './db/init.js';
import apiRoutes from './routes/index.js';
import { sendHttpError } from './utils/http.js';
import { isValidUuid } from './utils/validation.js';
import {
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
  endGame,
  getAuthorizedPlayer,
  getRoomHost,
  startRoom,
  getPhaseConfig,
  clearRoomTimers,
} from './services/game/index.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_PATH = process.env.DATABASE_PATH || './gamestate.db';
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const socketSession = new Map();
const roomPhaseTimers = new Map();

function toSocketErrorPayload(error, data) {
  const code = String(error?.code || 'SERVER_ERROR');
  const errorType = ['VALIDATION_ERROR', 'TIMEOUT', 'INVALID_OPERATION'].includes(code)
    ? code
    : code === 'AI_RATE_LIMIT'
      ? 'INVALID_OPERATION'
      : 'SERVER_ERROR';

  return {
    message: error?.message || 'Internal server error',
    errorType,
    ...(data ? { data } : {}),
  };
}

async function requireSocketPlayer(socket, payload, options = {}) {
  const { allowJoin = false } = options;
  const gameId = payload?.gameId;
  const playerId = payload?.playerId;

  if (!isValidUuid(playerId)) {
    throw Object.assign(new Error('playerId must be a valid UUID'), {
      code: 'VALIDATION_ERROR',
    });
  }

  if (allowJoin) {
    return;
  }

  const player = await getAuthorizedPlayer(playerId, gameId);
  if (!player) {
    throw Object.assign(new Error('Player is not authorized for this game'), {
      code: 'INVALID_OPERATION',
    });
  }
}

function getNormalizedPlayerName(payload = {}) {
  return payload.playerName || payload.name;
}

async function resolveSocketGame(payload = {}) {
  return resolveGameReference({
    gameId: payload.gameId,
    code: payload.code,
  });
}

async function resolveSocketGameOrSession(payload = {}, session = null) {
  if (payload?.gameId || payload?.code) {
    return resolveSocketGame(payload);
  }

  if (session?.gameId) {
    return {
      gameId: session.gameId,
      code: session.code,
    };
  }

  throw Object.assign(new Error('gameId or code is required'), {
    code: 'VALIDATION_ERROR',
  });
}

function emitPlayerJoined(gameId, joined) {
  const eventPayload = {
    playerId: joined.playerId,
    playerName: joined.playerName,
    playerCount: joined.playerCount,
    timestamp: joined.timestamp,
  };

  io.to(gameId).emit('room:playerJoined', eventPayload);
  io.to(gameId).emit('player_joined', eventPayload);
}

function emitPlayerLeft(gameId, left) {
  const eventPayload = {
    playerId: left.playerId,
    remainingPlayers: left.remainingPlayers,
  };

  io.to(gameId).emit('room:playerLeft', eventPayload);
  io.to(gameId).emit('player_left', eventPayload);
}

function emitGameResults(gameId, ended) {
  io.to(gameId).emit('game:results', ended);
  io.to(gameId).emit('game_ended', ended);
}

function emitGameTick(gameId, code, remainingSeconds, phase) {
  io.to(gameId).emit('game:tick', {
    gameId,
    code,
    remainingSeconds,
    phase,
    timestamp: new Date().toISOString(),
  });
}

function stopRoomLifecycle(gameId) {
  const timers = roomPhaseTimers.get(gameId);
  if (!timers) {
    return;
  }

  if (timers.raceInterval) {
    clearInterval(timers.raceInterval);
  }
  if (timers.revealTimeout) {
    clearTimeout(timers.revealTimeout);
  }
  if (timers.voteInterval) {
    clearInterval(timers.voteInterval);
  }

  roomPhaseTimers.delete(gameId);
}

async function emitScoreUpdate(gameId) {
  const scores = await requestScores({ gameId });
  io.to(gameId).emit('scores_updated', scores);
  io.to(gameId).emit('room:scores', scores);
}

async function startRoomLifecycle(gameId, code) {
  if (roomPhaseTimers.has(gameId)) {
    return;
  }

  const phaseConfig = getPhaseConfig();
  const timers = {
    raceInterval: null,
    revealTimeout: null,
    voteInterval: null,
  };
  roomPhaseTimers.set(gameId, timers);

  let raceRemaining = phaseConfig.raceSeconds;
  emitGameTick(gameId, code, raceRemaining, 'race');

  timers.raceInterval = setInterval(async () => {
    raceRemaining -= 1;
    emitGameTick(gameId, code, Math.max(raceRemaining, 0), 'race');

    if (raceRemaining > 0) {
      return;
    }

    if (timers.raceInterval) {
      clearInterval(timers.raceInterval);
      timers.raceInterval = null;
    }

    try {
      const revealPayload = await prepareRevealPhase({ gameId });
      io.to(gameId).emit('reveal_chains', revealPayload);
      const gameState = await requestGameState({ gameId });
      io.to(gameId).emit('room:state', gameState);

      timers.revealTimeout = setTimeout(async () => {
        try {
          const votePhase = await openVotePhase({ gameId });
          io.to(gameId).emit('vote_phase_started', {
            gameId,
            voteEndsAt: votePhase.voteEndsAt,
            durationSeconds: phaseConfig.voteSeconds,
          });

          let voteRemaining = phaseConfig.voteSeconds;
          emitGameTick(gameId, code, voteRemaining, 'vote');

          timers.voteInterval = setInterval(async () => {
            voteRemaining -= 1;
            emitGameTick(gameId, code, Math.max(voteRemaining, 0), 'vote');

            if (voteRemaining > 0) {
              return;
            }

            if (timers.voteInterval) {
              clearInterval(timers.voteInterval);
              timers.voteInterval = null;
            }

            try {
              const votingClosed = await closeVotePhase({ gameId });
              io.to(gameId).emit('voting_closed', votingClosed);
              await emitScoreUpdate(gameId);
              emitGameResults(gameId, votingClosed);
            } catch (error) {
              io.to(gameId).emit('error', toSocketErrorPayload(error, { action: 'vote:close' }));
            } finally {
              stopRoomLifecycle(gameId);
            }
          }, 1000);
        } catch (error) {
          io.to(gameId).emit('error', toSocketErrorPayload(error, { action: 'vote:open' }));
          stopRoomLifecycle(gameId);
        }
      }, phaseConfig.revealDelayMs);
    } catch (error) {
      io.to(gameId).emit('error', toSocketErrorPayload(error, { action: 'race:reveal' }));
      stopRoomLifecycle(gameId);
    }
  }, 1000);
}

async function handleJoinRoom(socket, payload = {}) {
  const gameRef = await resolveSocketGame(payload);
  const gameId = gameRef.gameId;
  const playerId = payload.playerId;
  const playerName = getNormalizedPlayerName(payload);

  await requireSocketPlayer(socket, { gameId, playerId }, { allowJoin: true });
  const joined = await joinGame({ gameId, playerId, playerName });

  socket.join(gameId);
  socketSession.set(socket.id, {
    gameId,
    code: gameRef.code,
    playerId,
  });

  emitPlayerJoined(gameId, joined);

  const { host } = await getRoomHost({ gameId });
  socket.emit('room:joined', {
    code: gameRef.code,
    gameId,
    hostId: host?.id || null,
    playerId: joined.playerId,
    playerName: joined.playerName,
    playerCount: joined.playerCount,
    status: joined.game?.status || 'waiting',
    phase: joined.game?.phase || 'race',
    startWord: joined.game?.start_word || null,
    endWord: joined.game?.end_word || null,
  });

  return {
    gameId,
    code: gameRef.code,
    joined,
    hostId: host?.id || null,
  };
}

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS policy blocked this socket origin'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization',
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(origin)) {
      res.status(403).json({ success: false, error: 'CORS origin not allowed' });
      return;
    }
    res.status(204).end();
    return;
  }

  if (origin && !isOriginAllowed(origin)) {
    res.status(403).json({ success: false, error: 'CORS origin not allowed' });
    return;
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.status(200).json({
    success: true,
    data: {
      message: 'ChainCrack backend is running',
      frontend: frontendUrl,
      health: '/health',
      api: '/api',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api', apiRoutes);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('room:create', async (payload = {}) => {
    try {
      if (!isValidUuid(payload?.playerId)) {
        throw Object.assign(new Error('playerId must be a valid UUID'), {
          code: 'VALIDATION_ERROR',
        });
      }

      const playerName = getNormalizedPlayerName(payload);
      if (typeof playerName !== 'string' || playerName.trim().length < 1 || playerName.trim().length > 50) {
        throw Object.assign(new Error('playerName must be between 1 and 50 characters'), {
          code: 'VALIDATION_ERROR',
        });
      }

      const created = await createGame({
        startWord: payload.startWord,
        endWord: payload.endWord,
        maxPlayers: payload.maxPlayers,
      });

      const roomJoin = await handleJoinRoom(socket, {
        gameId: created.gameId,
        playerId: payload.playerId,
        playerName,
      });

      socket.emit('room:created', {
        code: created.code,
        gameId: created.gameId,
        hostId: roomJoin.hostId,
        playerId: roomJoin.joined.playerId,
        playerName: roomJoin.joined.playerName,
        playerCount: roomJoin.joined.playerCount,
        status: created.status,
        startWord: created.startWord,
        endWord: created.endWord,
      });
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'room:create' }));
    }
  });

  socket.on('room:join', async (payload = {}) => {
    try {
      await handleJoinRoom(socket, payload);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'room:join' }));
    }
  });

  socket.on('join_game', async (payload = {}) => {
    try {
      await handleJoinRoom(socket, payload);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'join_game' }));
    }
  });

  socket.on('room:start', async (payload = {}) => {
    try {
      const gameRef = await resolveSocketGameOrSession(
        payload,
        socketSession.get(socket.id),
      );
      const gameId = gameRef.gameId;
      const playerId = payload.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const started = await startRoom({ gameId, playerId });
      const host = await getRoomHost({ gameId });
      const gameState = await requestGameState({ gameId });

      io.to(gameId).emit('room:started', {
        code: gameRef.code,
        gameId,
        hostId: host.host?.id || null,
        status: started.status,
        phase: gameState.game?.phase || 'race',
        startedAt: started.startedAt,
        raceEndsAt: started.raceEndsAt,
        startWord: gameState.game?.start_word || null,
        endWord: gameState.game?.end_word || null,
      });
      io.to(gameId).emit('room:state', gameState);
      await startRoomLifecycle(gameId, gameRef.code);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'room:start' }));
    }
  });

  socket.on('submit_word', async (payload = {}) => {
    try {
      const gameRef = await resolveSocketGameOrSession(
        payload,
        socketSession.get(socket.id),
      );
      const gameId = gameRef.gameId;
      const playerId = payload.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const submissionResult = await submitWord({
        gameId,
        playerId,
        word: payload.word,
        explanation: payload.explanation,
      });

      socket.emit('submission_received', submissionResult.submissionReceived);
      io.to(gameId).emit('submission_validated', submissionResult.submissionValidated);
      io.to(gameId).emit('scores_updated', submissionResult.scoresUpdated);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'submit_word' }));
    }
  });

  socket.on('vote_chain', async (payload = {}) => {
    try {
      const gameRef = await resolveSocketGameOrSession(
        payload,
        socketSession.get(socket.id),
      );
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || socketSession.get(socket.id)?.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const voteResult = await submitVotes({
        gameId,
        voterId: playerId,
        votedChainOwnerIds: payload.votedChainOwnerIds,
        votedChainOwnerId: payload.votedChainOwnerId,
      });

      io.to(gameId).emit('vote_counts_updated', voteResult);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'vote_chain' }));
    }
  });

  socket.on('leave_game', async (payload = {}) => {
    try {
      const session = socketSession.get(socket.id);
      const gameRef = await resolveSocketGameOrSession(payload, session);
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || session?.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const left = await leaveGame({
        gameId,
        playerId,
      });

      socket.leave(gameId);
      socketSession.delete(socket.id);
      emitPlayerLeft(gameId, left);
      if (left.remainingPlayers === 0) {
        stopRoomLifecycle(gameId);
      }
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'leave_game' }));
    }
  });

  socket.on('room:state:request', async (payload = {}) => {
    try {
      const session = socketSession.get(socket.id);
      const gameRef = await resolveSocketGameOrSession(payload, session);
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || session?.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const gameState = await requestGameState({
        gameId,
      });
      socket.emit('room:state', gameState);
      socket.emit('game_state', gameState);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'room:state:request' }));
    }
  });

  socket.on('request_game_state', async (payload = {}) => {
    try {
      const session = socketSession.get(socket.id);
      const gameRef = await resolveSocketGameOrSession(payload, session);
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || session?.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const gameState = await requestGameState({ gameId });
      socket.emit('room:state', gameState);
      socket.emit('game_state', gameState);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'request_game_state' }));
    }
  });

  socket.on('room:scores:request', async (payload = {}) => {
    try {
      const session = socketSession.get(socket.id);
      const gameRef = await resolveSocketGameOrSession(payload, session);
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || session?.playerId;

      if (playerId) {
        await requireSocketPlayer(socket, { gameId, playerId });
      }

      const scores = await requestScores({ gameId });
      socket.emit('room:scores', scores);
      socket.emit('scores_updated', scores);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'room:scores:request' }));
    }
  });

  socket.on('request_scores', async (payload = {}) => {
    try {
      const session = socketSession.get(socket.id);
      const gameRef = await resolveSocketGameOrSession(payload, session);
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || session?.playerId;

      if (playerId) {
        await requireSocketPlayer(socket, { gameId, playerId });
      }

      const scores = await requestScores({ gameId });
      socket.emit('room:scores', scores);
      socket.emit('scores_updated', scores);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'request_scores' }));
    }
  });

  socket.on('end_game', async (payload = {}) => {
    try {
      const session = socketSession.get(socket.id);
      const gameRef = await resolveSocketGameOrSession(payload, session);
      const gameId = gameRef.gameId;
      const playerId = payload.playerId || session?.playerId;

      await requireSocketPlayer(socket, { gameId, playerId });
      const ended = await endGame({
        gameId,
        winnerId: payload.winnerId,
      });
      stopRoomLifecycle(gameId);
      emitGameResults(gameId, ended);
    } catch (error) {
      socket.emit('error', toSocketErrorPayload(error, { action: 'end_game' }));
    }
  });

  socket.on('disconnect', async () => {
    const session = socketSession.get(socket.id);
    if (session) {
      try {
        const left = await leaveGame({
          gameId: session.gameId,
          playerId: session.playerId,
        });
        emitPlayerLeft(session.gameId, left);
        if (left.remainingPlayers === 0) {
          stopRoomLifecycle(session.gameId);
        }
      } catch (error) {
        console.error('[Socket] disconnect cleanup failed', error);
      } finally {
        socketSession.delete(socket.id);
      }
    }

    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  sendHttpError(res, err);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down backend...`);

  io.close();
  for (const gameId of roomPhaseTimers.keys()) {
    stopRoomLifecycle(gameId);
  }
  await new Promise((resolve) => {
    httpServer.close(() => {
      resolve();
    });
  });

  clearRoomTimers();
  await closeDatabase();
  console.log('Shutdown complete');
}

async function startServer() {
  await initDatabase(DATABASE_PATH);

  await new Promise((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`? ChainCrack backend running on http://localhost:${PORT}`);
      console.log('? WebSocket server ready for connections');
      console.log(`? SQLite initialized at ${DATABASE_PATH}`);
      resolve();
    });
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT').finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').finally(() => process.exit(0));
});

startServer().catch((error) => {
  console.error('Backend startup failed', error);
  process.exit(1);
});
