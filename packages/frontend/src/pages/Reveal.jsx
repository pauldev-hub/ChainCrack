/**
 * Reveal phase page.
 *
 * @file packages/frontend/src/pages/Reveal.jsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Users } from 'lucide-react';
import {
  getSocket,
  matchesRoomPayload,
  normalizeRoomCode,
} from '../services/socketService';
import {
  getActiveRoom,
  getGameplayState,
  getOrCreatePlayerId,
  getPlayerName,
  setActiveRoom,
  setGameplayState,
  setLastResults,
} from '../services/sessionService';

function normalizeRevealChains(chains) {
  if (!Array.isArray(chains)) {
    return [];
  }

  return chains.map((chain) => ({
    playerId: chain.playerId,
    playerName: chain.playerName || 'Player',
    words: Array.isArray(chain.words) ? chain.words : [],
    aiScore: Number(chain.aiScore || 0),
    chainLength: Number(chain.chainLength || 0),
    isEmptyChain: Boolean(chain.isEmptyChain),
  }));
}

function buildRevealChainsFromState(players, wordChains) {
  const activePlayers = (Array.isArray(players) ? players : [])
    .filter((player) => player.is_active !== false)
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      words: [],
      aiScore: 0,
      chainLength: 0,
      isEmptyChain: true,
    }));

  const byId = new Map(activePlayers.map((entry) => [entry.playerId, entry]));
  const steps = Array.isArray(wordChains) ? [...wordChains] : [];
  steps.sort((left, right) => Number(left.step_number || 0) - Number(right.step_number || 0));

  for (const step of steps) {
    const playerId = step.player_id;
    if (!playerId) {
      continue;
    }

    if (!byId.has(playerId)) {
      byId.set(playerId, {
        playerId,
        playerName: 'Player',
        words: [],
        aiScore: 0,
        chainLength: 0,
        isEmptyChain: true,
      });
    }

    const entry = byId.get(playerId);
    const word = String(step.word || '').trim();
    if (word.length > 0) {
      entry.words.push(word);
      entry.chainLength += 1;
      entry.isEmptyChain = false;
      if (step.is_valid) {
        entry.aiScore += Number(step.ai_score || 0);
      }
    }
  }

  return [...byId.values()];
}

/**
 * Reveal page component.
 * @param {{code: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Reveal({ code, navigate }) {
  const socket = useMemo(() => getSocket(), []);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);
  const roomCode = useMemo(() => normalizeRoomCode(code), [code]);

  const [gameId, setGameId] = useState('');
  const [startWord, setStartWord] = useState('');
  const [endWord, setEndWord] = useState('');
  const [chains, setChains] = useState([]);
  const [error, setError] = useState('');

  const gameIdRef = React.useRef('');

  const updateGameId = React.useCallback((nextGameId) => {
    const resolved = String(nextGameId || '');
    setGameId(resolved);
    gameIdRef.current = resolved;
  }, []);

  const navigateToResults = React.useCallback((payload = {}) => {
    const resolvedGameId = String(payload.gameId || gameIdRef.current || '').trim();
    if (!resolvedGameId) {
      return;
    }

    setLastResults(payload);
    setGameplayState({
      code: payload.code || roomCode,
      gameId: resolvedGameId,
      phase: 'results',
      startWord,
      endWord,
      voteCounts: payload.voteCounts || {},
    });
    navigate(`/results/${encodeURIComponent(resolvedGameId)}`);
  }, [endWord, navigate, roomCode, startWord]);

  useEffect(() => {
    if (!playerName) {
      navigate('/');
      return undefined;
    }

    const cachedRoom = getActiveRoom();
    if (cachedRoom?.code === roomCode) {
      updateGameId(cachedRoom.gameId || '');
      setStartWord(cachedRoom.startWord || '');
      setEndWord(cachedRoom.endWord || '');
    }

    const cachedGameplay = getGameplayState();
    if (cachedGameplay?.code === roomCode) {
      updateGameId(cachedGameplay.gameId || '');
      setStartWord(cachedGameplay.startWord || cachedRoom?.startWord || '');
      setEndWord(cachedGameplay.endWord || cachedRoom?.endWord || '');
      setChains(normalizeRevealChains(cachedGameplay.revealChains));

      if (cachedGameplay.phase === 'vote') {
        navigate(`/vote/${encodeURIComponent(roomCode)}`);
        return undefined;
      }
      if (cachedGameplay.phase === 'results' && cachedGameplay.gameId) {
        navigate(`/results/${encodeURIComponent(cachedGameplay.gameId)}`);
        return undefined;
      }
    }

    const onRoomJoined = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      updateGameId(payload.gameId || '');
      setStartWord(payload.startWord || '');
      setEndWord(payload.endWord || '');

      setActiveRoom({
        code: payload.code || roomCode,
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
        { roomCode, gameId: gameIdRef.current },
      ) && gameIdRef.current) {
        return;
      }

      updateGameId(state.game.id || '');
      setStartWord(state.game.start_word || '');
      setEndWord(state.game.end_word || '');

      if (state.game.phase === 'race') {
        navigate(`/game/${encodeURIComponent(roomCode)}`);
        return;
      }

      if (state.game.phase === 'vote') {
        const fallbackChains = buildRevealChainsFromState(state.players, state.wordChains);
        setGameplayState({
          code: state.game.code || roomCode,
          gameId: state.game.id,
          phase: 'vote',
          startWord: state.game.start_word,
          endWord: state.game.end_word,
          revealChains: fallbackChains,
          voteEndsAt: state.game.vote_phase_ends_at || null,
        });
        navigate(`/vote/${encodeURIComponent(roomCode)}`);
        return;
      }

      if (state.game.phase === 'results' || state.game.status === 'ended') {
        navigateToResults({ gameId: state.game.id, code: state.game.code || roomCode });
        return;
      }

      const fallbackChains = buildRevealChainsFromState(state.players, state.wordChains);
      setChains(fallbackChains);
      setGameplayState({
        code: state.game.code || roomCode,
        gameId: state.game.id,
        phase: 'reveal',
        startWord: state.game.start_word,
        endWord: state.game.end_word,
        revealChains: fallbackChains,
      });
    };

    const onRevealChains = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      const normalized = normalizeRevealChains(payload.chains);
      setChains(normalized);
      setGameplayState({
        code: roomCode,
        gameId: payload.gameId || gameIdRef.current,
        phase: 'reveal',
        startWord,
        endWord,
        revealChains: normalized,
      });
    };

    const onVotePhaseStarted = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      const existing = getGameplayState();
      setGameplayState({
        code: roomCode,
        gameId: payload.gameId || gameIdRef.current,
        phase: 'vote',
        startWord,
        endWord,
        revealChains: chains.length > 0 ? chains : (existing?.revealChains || []),
        voteCounts: existing?.voteCounts || {},
        voteEndsAt: payload.voteEndsAt || null,
      });
      navigate(`/vote/${encodeURIComponent(roomCode)}`);
    };

    const onVotingClosed = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      navigateToResults(payload);
    };

    const onGameResults = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      navigateToResults(payload);
    };

    const onError = (payload) => {
      setError(payload?.message || 'Socket error');
    };

    socket.on('room:joined', onRoomJoined);
    socket.on('room:state', onRoomState);
    socket.on('reveal_chains', onRevealChains);
    socket.on('vote_phase_started', onVotePhaseStarted);
    socket.on('voting_closed', onVotingClosed);
    socket.on('game:results', onGameResults);
    socket.on('error', onError);

    socket.emit('room:join', {
      code: roomCode,
      playerId,
      playerName,
    });

    socket.emit('room:state:request', {
      code: roomCode,
      playerId,
    });

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('room:state', onRoomState);
      socket.off('reveal_chains', onRevealChains);
      socket.off('vote_phase_started', onVotePhaseStarted);
      socket.off('voting_closed', onVotingClosed);
      socket.off('game:results', onGameResults);
      socket.off('error', onError);
    };
  }, [
    chains,
    endWord,
    navigate,
    navigateToResults,
    playerId,
    playerName,
    roomCode,
    socket,
    startWord,
    updateGameId,
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="card">
        <div className="flex items-center gap-3">
          <Eye size={24} className="text-emerald-400" />
          <div>
            <h2 className="text-2xl font-bold font-syne text-white">Reveal Phase</h2>
            <p className="text-sm text-slate-400">All chains are now visible. Voting starts automatically.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="badge">room {roomCode}</span>
          <span className="font-mono text-slate-300">{startWord || 'start'} {'->'} {endWord || 'end'}</span>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-emerald-400" />
          <h3 className="text-lg font-bold font-syne text-white">Player Chains</h3>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {chains.map((chain) => (
            <article key={chain.playerId} className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-syne text-slate-200">{chain.playerName}</p>
                <p className="text-xs font-mono text-slate-500">length {chain.chainLength}</p>
              </div>
              <p className="mt-2 text-xs text-slate-500 font-syne uppercase tracking-wide">Path</p>
              <p className="mt-1 font-mono text-emerald-400 break-all">
                {chain.isEmptyChain ? `${startWord || 'start'} -> [no submission] -> ${endWord || 'end'}` : `${startWord || 'start'} -> ${chain.words.join(' -> ')} -> ${endWord || 'end'}`}
              </p>
              <p className="mt-2 text-xs font-mono text-slate-500">AI score total: {chain.aiScore}</p>
            </article>
          ))}

          {chains.length === 0 && (
            <p className="text-sm text-slate-500">Waiting for reveal data...</p>
          )}
        </div>
      </section>

      {error && (
        <section className="card border-red-500/40">
          <p className="text-sm text-red-500">{error}</p>
        </section>
      )}
    </div>
  );
}
