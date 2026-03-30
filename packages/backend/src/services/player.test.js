import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGuestProfile } from './player.js';

test('createGuestProfile should create valid payload with generated uuid', () => {
  const result = createGuestProfile({ name: 'Alice' });
  assert.ok(result.playerId);
  assert.equal(result.name, 'Alice');
});

test('createGuestProfile should preserve client uuid when valid', () => {
  const playerId = randomUUID();
  const result = createGuestProfile({ playerId, name: 'Bob' });
  assert.equal(result.playerId, playerId);
  assert.equal(result.name, 'Bob');
});

test('createGuestProfile should reject invalid name', () => {
  assert.throws(
    () => createGuestProfile({ name: ' ' }),
    (error) => Number(error?.statusCode) === 400,
  );
});

test('createGuestProfile should reject invalid uuid when provided', () => {
  assert.throws(
    () => createGuestProfile({ playerId: 'not-uuid', name: 'Valid Name' }),
    (error) => Number(error?.statusCode) === 400,
  );
});
