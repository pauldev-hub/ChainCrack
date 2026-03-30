import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { closeDatabase, initDatabase } from '../db/init.js';
import { joinGame, submitWord, clearRoomTimers } from './game/index.js';
import { getMatchReplay } from './replay.js';

test('getMatchReplay should return enriched timeline for persisted chain steps', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-replay-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);

    const gameId = randomUUID();
    const playerId = randomUUID();

    await joinGame({
      gameId,
      playerId,
      playerName: 'replay-player',
    });

    await submitWord({
      gameId,
      playerId,
      word: 'pet',
      explanation: 'Both words relate to domestic animals',
    });

    const replay = await getMatchReplay({ gameId });
    assert.ok(replay);
    assert.equal(replay.game.id, gameId);
    assert.equal(replay.players.length, 1);
    assert.equal(replay.timeline.length, 1);
    assert.equal(replay.timeline[0].word, 'pet');
    assert.equal(replay.timeline[0].playerName, 'replay-player');
    assert.equal(typeof replay.timeline[0].aiScore, 'number');
    assert.equal(replay.scores.length, 1);

    clearRoomTimers();
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});

test('getMatchReplay should reject invalid game UUID', async () => {
  await assert.rejects(
    getMatchReplay({ gameId: 'invalid-id' }),
    (error) => Number(error?.statusCode) === 400,
  );
});

test('getMatchReplay should return null for unknown game', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-replay-empty-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);
    const replay = await getMatchReplay({ gameId: randomUUID() });
    assert.equal(replay, null);
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});
