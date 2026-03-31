/**
 * Lobby page for room coordination before game start.
 *
 * @file packages/frontend/src/pages/Lobby.jsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Users, Play } from 'lucide-react';
import {
  getSocket,
  matchesRoomPayload,
  normalizeRoomCode,
} from '../services/socketService';
import {
  getOrCreatePlayerId,
  getPlayerName,
  getActiveRoom,
  setActiveRoom,
} from '../services/sessionService';

function normalizePlayerRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((player) => ({
    id: player.id,
    name: player.name,
    isActive: player.is_active !== false,
    joinedAt: player.joined_at || null,
  }));
}

function deduceHostId(rows) {
  if (!rows.length) {
    return null;
  }

  const sorted = [...rows].sort((left, right) => {
    const leftValue = left.joinedAt || '';
    const rightValue = right.joinedAt || '';
    return leftValue.localeCompare(rightValue);
  });

  return sorted[0].id;
}

/**
 * Lobby Page
 * @param {{code: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Lobby({ code, navigate }) {
  const socket = useMemo(() => getSocket(), []);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);
  const normalizedCode = useMemo(
    () => normalizeRoomCode(code),
    [code],
  );

  const [players, setPlayers] = useState([]);
  const [gameId, setGameId] = useState('');
  const [startWord, setStartWord] = useState('');
  const [endWord, setEndWord] = useState('');
  const [hostId, setHostId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const activePlayers = players.filter((player) => player.isActive);
  const isHost = hostId === playerId;

  useEffect(() => {
    if (!playerName) {
      navigate('/');
      return undefined;
    }

    const cachedRoom = getActiveRoom();
    if (cachedRoom?.code === normalizedCode) {
      setGameId(cachedRoom.gameId);
      setHostId(cachedRoom.hostId || null);
      setStartWord(cachedRoom.startWord || '');
      setEndWord(cachedRoom.endWord || '');
    }

    const onRoomJoined = (payload) => {
      if (!payload) {
        return;
      }
      if (!matchesRoomPayload(payload, { roomCode: normalizedCode, gameId })) {
        return;
      }

      setGameId(payload.gameId || '');
      setStartWord(payload.startWord || '');
      setEndWord(payload.endWord || '');

      if (payload.hostId) {
        setHostId(payload.hostId);
      }

      setActiveRoom({
        code: payload.code,
        gameId: payload.gameId,
        hostId: payload.hostId,
        startWord: payload.startWord,
        endWord: payload.endWord,
        status: payload.status,
      });
    };

    const onRoomState = (state) => {
      if (!state?.game) {
        return;
      }

      if (!matchesRoomPayload(
        { code: state.game.code, gameId: state.game.id },
        { roomCode: normalizedCode, gameId },
      ) && gameId) {
        return;
      }

      const normalized = normalizePlayerRows(state.players);
      const resolvedHostId = deduceHostId(normalized);
      setPlayers(normalized);
      setHostId((currentHostId) => currentHostId || resolvedHostId);
      setGameId(state.game.id || '');
      setStartWord(state.game.start_word || '');
      setEndWord(state.game.end_word || '');

      setActiveRoom({
        code: state.game.code || normalizedCode,
        gameId: state.game.id,
        hostId: resolvedHostId,
        startWord: state.game.start_word,
        endWord: state.game.end_word,
        status: state.game.status,
      });

      if (state.game.status === 'active' && state.game.started_at) {
        navigate(`/game/${encodeURIComponent(normalizedCode)}`);
      }
    };

    const onPlayerJoined = (payload) => {
      if (!payload?.playerId) {
        return;
      }

      setPlayers((existing) => {
        const index = existing.findIndex((row) => row.id === payload.playerId);
        if (index === -1) {
          const withNew = [
            ...existing,
            {
              id: payload.playerId,
              name: payload.playerName || 'Player',
              isActive: true,
              joinedAt: new Date().toISOString(),
            },
          ];

          setHostId((currentHostId) => currentHostId || deduceHostId(withNew));
          return withNew;
        }

        const next = [...existing];
        next[index] = {
          ...next[index],
          name: payload.playerName || next[index].name,
          isActive: true,
        };
        return next;
      });
    };

    const onPlayerLeft = (payload) => {
      if (!payload?.playerId) {
        return;
      }

      setPlayers((existing) => existing.map((row) => (
        row.id === payload.playerId
          ? { ...row, isActive: false }
          : row
      )));
    };

    const onRoomStarted = (payload) => {
      if (!payload) {
        return;
      }
      if (!matchesRoomPayload(payload, { roomCode: normalizedCode, gameId })) {
        return;
      }

      const cachedRoom = getActiveRoom();

      setGameId(payload.gameId || '');
      setActiveRoom({
        code: payload.code,
        gameId: payload.gameId,
        hostId: payload.hostId,
        startWord: payload.startWord || cachedRoom?.startWord,
        endWord: payload.endWord || cachedRoom?.endWord,
        status: payload.status,
      });

      navigate(`/game/${encodeURIComponent(normalizedCode)}`);
    };

    const onError = (payload) => {
      setError(payload?.message || 'Socket error');
    };

    socket.on('room:joined', onRoomJoined);
    socket.on('room:state', onRoomState);
    socket.on('room:playerJoined', onPlayerJoined);
    socket.on('room:playerLeft', onPlayerLeft);
    socket.on('room:started', onRoomStarted);
    socket.on('error', onError);

    socket.emit('room:join', {
      code: normalizedCode,
      playerId,
      playerName,
    });

    socket.emit('room:state:request', {
      code: normalizedCode,
      playerId,
    });

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('room:state', onRoomState);
      socket.off('room:playerJoined', onPlayerJoined);
      socket.off('room:playerLeft', onPlayerLeft);
      socket.off('room:started', onRoomStarted);
      socket.off('error', onError);
    };
  }, [
    navigate,
    normalizedCode,
    playerId,
    playerName,
    socket,
  ]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError('Could not copy room code');
    }
  };

  const handleStartGame = () => {
    if (!isHost || activePlayers.length < 1) {
      return;
    }

    socket.emit('room:start', {
      code: normalizedCode,
      gameId: gameId || undefined,
      playerId,
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
      <section className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-emerald-400" size={22} />
            <h2 className="text-2xl font-bold font-syne text-white">Lobby</h2>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-emerald-400 transition-colors hover:border-emerald-400"
            onClick={handleCopyCode}
          >
            <span>{normalizedCode}</span>
            <Copy size={16} />
          </button>
        </div>

        {copied && (
          <p className="mt-2 text-sm text-emerald-400">Room code copied.</p>
        )}

        {(startWord || endWord) && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Target Path</p>
            <p className="mt-1 font-mono text-emerald-400">
              {startWord || 'start'} {'->'} {endWord || 'end'}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Players</p>
          <ul className="mt-2 space-y-2">
            {players.map((player) => (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded border px-3 py-2 ${
                  player.isActive
                    ? 'border-slate-700 bg-slate-900'
                    : 'border-slate-800 bg-slate-950 opacity-60'
                }`}
              >
                <span className="font-syne text-slate-200">{player.name}</span>
                <div className="flex items-center gap-2">
                  {player.id === hostId && (
                    <span className="badge">Host</span>
                  )}
                  <span className={`text-xs font-mono ${player.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {player.isActive ? 'online' : 'left'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          {isHost ? (
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={activePlayers.length < 1}
              onClick={handleStartGame}
            >
              <Play size={16} />
              <span>Start Game</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary cursor-not-allowed opacity-60"
              disabled
            >
              Waiting for host
            </button>
          )}

          {isHost && activePlayers.length < 1 && (
            <p className="mt-2 text-sm text-slate-400">Need at least 1 active player to start.</p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
