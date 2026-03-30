import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { closeDatabase, initDatabase } from '../../db/init.js';
import { countActivePlayers, getGameById, getPlayerInGame } from '../../db/queries.js';

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test('room expiry timer should be cancelled when a player rejoins before timeout', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-room-${Date.now()}-${Math.random()}.sqlite`);
  const originalRoomExpiry = process.env.ROOM_EXPIRY_MS;

  process.env.ROOM_EXPIRY_MS = '40';

  try {
    await initDatabase(dbPath);

    const moduleUrl = new URL(`./index.js?room-expiry=${Date.now()}-${Math.random()}`, import.meta.url);
    const { joinGame, leaveGame, clearRoomTimers } = await import(moduleUrl.href);

    const gameId = randomUUID();
    const playerId = randomUUID();

    await joinGame({
      gameId,
      playerId,
      playerName: 'timer-tester',
    });

    await leaveGame({ gameId, playerId });

    await joinGame({
      gameId,
      playerId,
      playerName: 'timer-tester',
    });

    await wait(120);
    const game = await getGameById(gameId);

    assert.ok(game, 'game should still exist after rejoin cancels pending expiry timer');

    clearRoomTimers();
  } finally {
    process.env.ROOM_EXPIRY_MS = originalRoomExpiry;
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});

test('startRoom should allow only host to start an active room', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-start-host-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);

    const moduleUrl = new URL(`./index.js?start-room-host=${Date.now()}-${Math.random()}`, import.meta.url);
    const { joinGame, startRoom, clearRoomTimers } = await import(moduleUrl.href);

    const gameId = randomUUID();
    const hostId = randomUUID();
    const guestId = randomUUID();

    await joinGame({ gameId, playerId: hostId, playerName: 'host' });
    await joinGame({ gameId, playerId: guestId, playerName: 'guest' });

    await assert.rejects(
      startRoom({ gameId, playerId: guestId }),
      (error) => error?.code === 'INVALID_OPERATION',
    );

    const started = await startRoom({ gameId, playerId: hostId });
    assert.equal(started.status, 'active');

    clearRoomTimers();
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});

test('startRoom should allow start with one active host player', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-start-min-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);

    const moduleUrl = new URL(`./index.js?start-room-min=${Date.now()}-${Math.random()}`, import.meta.url);
    const { joinGame, startRoom, clearRoomTimers } = await import(moduleUrl.href);

    const gameId = randomUUID();
    const hostId = randomUUID();

    await joinGame({ gameId, playerId: hostId, playerName: 'host' });

    const started = await startRoom({ gameId, playerId: hostId });
    assert.equal(started.status, 'active');

    clearRoomTimers();
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});

test('joinGame should allow moving a player from an inactive previous game', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-reassign-inactive-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);

    const moduleUrl = new URL(`./index.js?reassign-inactive=${Date.now()}-${Math.random()}`, import.meta.url);
    const { joinGame, leaveGame, clearRoomTimers } = await import(moduleUrl.href);

    const gameA = randomUUID();
    const gameB = randomUUID();
    const playerId = randomUUID();

    await joinGame({ gameId: gameA, playerId, playerName: 'mio' });
    await leaveGame({ gameId: gameA, playerId });

    const joined = await joinGame({ gameId: gameB, playerId, playerName: 'mio' });

    assert.equal(joined.game.id, gameB);
    const playerInNewGame = await getPlayerInGame(playerId, gameB);
    assert.ok(playerInNewGame, 'player should be present in the new game');
    assert.equal(playerInNewGame.is_active, true);

    clearRoomTimers();
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});

test('joinGame should allow moving an active player only when they are solo in previous room', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-reassign-solo-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);

    const moduleUrl = new URL(`./index.js?reassign-solo=${Date.now()}-${Math.random()}`, import.meta.url);
    const { joinGame, clearRoomTimers } = await import(moduleUrl.href);

    const gameA = randomUUID();
    const gameB = randomUUID();
    const playerId = randomUUID();

    await joinGame({ gameId: gameA, playerId, playerName: 'solo' });
    const moved = await joinGame({ gameId: gameB, playerId, playerName: 'solo' });

    assert.equal(moved.game.id, gameB);
    assert.equal(await countActivePlayers(gameA), 0);
    assert.equal(await countActivePlayers(gameB), 1);

    clearRoomTimers();
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});

test('joinGame should block moving an active player out of a room with other active players', async () => {
  const dbPath = path.join(tmpdir(), `chaincrack-reassign-block-${Date.now()}-${Math.random()}.sqlite`);

  try {
    await initDatabase(dbPath);

    const moduleUrl = new URL(`./index.js?reassign-block=${Date.now()}-${Math.random()}`, import.meta.url);
    const { joinGame, clearRoomTimers } = await import(moduleUrl.href);

    const gameA = randomUUID();
    const gameB = randomUUID();
    const playerId = randomUUID();
    const teammateId = randomUUID();

    await joinGame({ gameId: gameA, playerId, playerName: 'host' });
    await joinGame({ gameId: gameA, playerId: teammateId, playerName: 'teammate' });

    await assert.rejects(
      joinGame({ gameId: gameB, playerId, playerName: 'host' }),
      (error) => error?.code === 'INVALID_OPERATION'
        && String(error?.message || '').includes('already registered in another game'),
    );

    assert.equal(await countActivePlayers(gameA), 2);

    clearRoomTimers();
  } finally {
    await closeDatabase();
    await rm(dbPath, { force: true });
  }
});
