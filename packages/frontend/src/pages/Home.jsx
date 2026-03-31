/**
 * Home page for guest onboarding and room entry.
 *
 * @file packages/frontend/src/pages/Home.jsx
 */

import React, { useMemo, useState } from 'react';
import { Users, ArrowRight } from 'lucide-react';
import apiClient from '../services/apiClient';
import {
  getSocket,
  normalizeRoomCode,
  normalizeSocketError,
} from '../services/socketService';
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
  setActiveRoom,
} from '../services/sessionService';

function onceWithTimeout(socket, eventName, timeoutMs = 10000, expectedAction = '') {
  return new Promise((resolve, reject) => {
    let completed = false;

    const timer = setTimeout(() => {
      if (completed) {
        return;
      }
      completed = true;
      socket.off(eventName, onSuccess);
      socket.off('error', onError);
      reject(new Error(`${eventName} timed out`));
    }, timeoutMs);

    const onSuccess = (payload) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timer);
      socket.off(eventName, onSuccess);
      socket.off('error', onError);
      resolve(payload);
    };

    const onError = (payload) => {
      const payloadAction = payload?.data?.action || '';
      if (expectedAction && payloadAction && payloadAction !== expectedAction) {
        return;
      }

      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timer);
      socket.off(eventName, onSuccess);
      socket.off('error', onError);
      reject(new Error(normalizeSocketError(payload)));
    };

    socket.once(eventName, onSuccess);
    socket.once('error', onError);
  });
}

/**
 * Home Page
 * @param {{navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Home({ navigate }) {
  const socket = useMemo(() => getSocket(), []);
  const [name, setName] = useState(getPlayerName());
  const [roomCode, setRoomCode] = useState('');
  const [joinExpanded, setJoinExpanded] = useState(false);
  const [soloMode, setSoloMode] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  const safeName = name.trim().slice(0, 32);
  const canStartAction = safeName.length > 0 && !isBusy;
  const canJoinNow = canStartAction && roomCode.trim().length > 0;

  const authorizeGuest = async () => {
    const playerId = getOrCreatePlayerId();
    const response = await apiClient.post('/api/auth/guest', {
      playerId,
      name: safeName,
    });

    const data = response?.data?.data;
    if (!data?.playerId || !data?.name) {
      throw new Error('Invalid guest auth response');
    }

    setPlayerName(data.name);
    return data;
  };

  const handleCreateRoom = async () => {
    let createdRoom = null;

    try {
      setError('');
      setIsBusy(true);

      const guest = await authorizeGuest();
      const createdPromise = onceWithTimeout(
        socket,
        'room:created',
        10000,
        'room:create',
      );

      socket.emit('room:create', {
        playerId: guest.playerId,
        playerName: guest.name,
      });

      const created = await createdPromise;
      createdRoom = created;
      setActiveRoom({
        code: created.code,
        gameId: created.gameId,
        hostId: created.hostId,
        startWord: created.startWord,
        endWord: created.endWord,
        status: created.status,
      });

      if (soloMode) {
        const startedPromise = onceWithTimeout(
          socket,
          'room:started',
          10000,
          'room:start',
        );

        socket.emit('room:start', {
          code: created.code,
          gameId: created.gameId,
          playerId: guest.playerId,
        });

        await startedPromise;
        navigate(`/game/${encodeURIComponent(created.code)}`);
        return;
      }

      navigate(`/lobby/${encodeURIComponent(created.code)}`);
    } catch (requestError) {
      if (createdRoom?.code) {
        setError('Solo start failed. Room was created; opening lobby so you can start manually.');
        navigate(`/lobby/${encodeURIComponent(createdRoom.code)}`);
      } else {
        setError(requestError?.message || 'Failed to create room');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinExpanded) {
      setJoinExpanded(true);
      return;
    }

    if (!canJoinNow) {
      return;
    }

    try {
      setError('');
      setIsBusy(true);

      const guest = await authorizeGuest();
      const code = normalizeRoomCode(roomCode);
      const joinedPromise = onceWithTimeout(
        socket,
        'room:joined',
        10000,
        'room:join',
      );

      socket.emit('room:join', {
        code,
        playerId: guest.playerId,
        playerName: guest.name,
      });

      const joined = await joinedPromise;
      const resolvedCode = normalizeRoomCode(joined.code || code);

      setActiveRoom({
        code: resolvedCode,
        gameId: joined.gameId,
        hostId: joined.hostId,
        startWord: joined.startWord,
        endWord: joined.endWord,
        status: joined.status,
      });

      navigate(`/lobby/${encodeURIComponent(resolvedCode)}`);
    } catch (requestError) {
      setError(requestError?.message || 'Failed to join room');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <section className="card">
        <div className="flex items-center gap-3">
          <Users className="text-emerald-400" size={24} />
          <h2 className="text-2xl font-bold font-syne text-white">Enter The Arena</h2>
        </div>

        <p className="mt-2 text-slate-400 font-syne">
          Choose your name to create or join a live room.
        </p>

        <div className="mt-6">
          <label htmlFor="playerName" className="text-xs text-slate-500 font-syne uppercase tracking-wide">
            Player Name
          </label>
          <input
            id="playerName"
            type="text"
            className="input mt-2 w-full"
            value={name}
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            placeholder="Type your name"
          />
          <p className="mt-1 text-xs text-slate-500 font-mono">{safeName.length}/32</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canStartAction}
            onClick={handleCreateRoom}
          >
            {isBusy ? (soloMode ? 'Starting Solo...' : 'Creating...') : (soloMode ? 'Play Solo' : 'Create Room')}
          </button>

          <button
            type="button"
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canStartAction}
            onClick={handleJoinRoom}
          >
            {joinExpanded ? 'Join Now' : 'Join Room'}
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
          <label htmlFor="soloMode" className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              id="soloMode"
              type="checkbox"
              className="h-4 w-4"
              checked={soloMode}
              disabled={isBusy}
              onChange={(event) => setSoloMode(event.target.checked)}
            />
            <span>Solo Mode (create room and auto-start immediately)</span>
          </label>
        </div>

        {joinExpanded && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <label htmlFor="roomCode" className="text-xs text-slate-500 font-syne uppercase tracking-wide">
              Room Code
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="roomCode"
                type="text"
                className="input w-full font-mono"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="Paste room code"
              />
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleJoinRoom}
                disabled={!canJoinNow}
              >
                <span>Go</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
