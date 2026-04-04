/**
 * Race phase page.
 *
 * @file packages/frontend/src/pages/Game.jsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, Send, Trophy } from 'lucide-react';
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

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function normalizeScores(scores) {
  if (!Array.isArray(scores)) {
    return [];
  }

  return [...scores].sort((left, right) => {
    const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return Number(left.chainLength || 0) - Number(right.chainLength || 0);
  });
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
 * Game page component.
 * @param {{code: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Game({ code, navigate }) {
  const socket = useMemo(() => getSocket(), []);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);
  const roomCode = useMemo(() => normalizeRoomCode(code), [code]);

  const [gameId, setGameId] = useState('');
  const [phase, setPhase] = useState('race');
  const [status, setStatus] = useState('waiting');
  const [startWord, setStartWord] = useState('');
  const [endWord, setEndWord] = useState('');
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [word, setWord] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [error, setError] = useState('');

  const gameIdRef = React.useRef('');
  const pendingSubmissionIdRef = React.useRef('');

  const updateGameId = React.useCallback((nextGameId) => {
    const resolved = String(nextGameId || '');
    setGameId(resolved);
    gameIdRef.current = resolved;
  }, []);

  const navigateToPhase = React.useCallback((nextPhase, nextGameId = '') => {
    if (nextPhase === 'reveal') {
      navigate(`/reveal/${encodeURIComponent(roomCode)}`);
      return;
    }

    if (nextPhase === 'vote') {
      navigate(`/vote/${encodeURIComponent(roomCode)}`);
      return;
    }

    if (nextPhase === 'results') {
      const resolvedGameId = String(nextGameId || gameIdRef.current || '').trim();
      if (resolvedGameId) {
        navigate(`/results/${encodeURIComponent(resolvedGameId)}`);
      }
    }
  }, [navigate, roomCode]);

  const canSubmit = (
    phase === 'race'
    && status === 'active'
    && remainingSeconds > 0
    && !isSubmitting
    && word.trim().length >= 3
    && explanation.trim().length >= 10
  );

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
      setStatus(cachedRoom.status || 'waiting');
      if (cachedRoom.gameMode === 'memory' && cachedRoom.status === 'active') {
        navigate(`/memory/${encodeURIComponent(roomCode)}`);
        return undefined;
      }
    }

    const cachedGameplay = getGameplayState();
    if (cachedGameplay?.code === roomCode && cachedGameplay.phase && cachedGameplay.phase !== 'race') {
      navigateToPhase(cachedGameplay.phase, cachedGameplay.gameId);
      return undefined;
    }

    const onRoomJoined = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      updateGameId(payload.gameId || '');
      setStartWord(payload.startWord || '');
      setEndWord(payload.endWord || '');
      setStatus(payload.status || 'waiting');
      setPhase(payload.phase || 'race');

      if (payload.mode === 'memory') {
        navigate(`/memory/${encodeURIComponent(roomCode)}`);
        return;
      }

      setActiveRoom({
        code: payload.code || roomCode,
        gameId: payload.gameId,
        hostId: payload.hostId,
        startWord: payload.startWord,
        endWord: payload.endWord,
        status: payload.status,
        gameMode: payload.mode || 'race',
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
      setStatus(state.game.status || 'waiting');
      setPhase(state.game.phase || 'race');
      setPlayers(Array.isArray(state.players) ? state.players : []);

      if (state.game.mode === 'memory') {
        setActiveRoom({
          code: state.game.code || roomCode,
          gameId: state.game.id,
          startWord: state.game.start_word,
          endWord: state.game.end_word,
          status: state.game.status,
          gameMode: 'memory',
        });
        navigate(`/memory/${encodeURIComponent(roomCode)}`);
        return;
      }

      setActiveRoom({
        code: state.game.code || roomCode,
        gameId: state.game.id,
        startWord: state.game.start_word,
        endWord: state.game.end_word,
        status: state.game.status,
        gameMode: state.game.mode || 'race',
      });

      const nextPhase = state.game.phase || 'race';
      if (nextPhase === 'reveal') {
        const fallbackChains = buildRevealChainsFromState(state.players, state.wordChains);
        setGameplayState({
          code: state.game.code || roomCode,
          gameId: state.game.id,
          phase: 'reveal',
          startWord: state.game.start_word,
          endWord: state.game.end_word,
          revealChains: fallbackChains,
        });
        navigateToPhase('reveal', state.game.id);
        return;
      }

      if (nextPhase === 'vote') {
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
        navigateToPhase('vote', state.game.id);
        return;
      }

      if (nextPhase === 'results' || state.game.status === 'ended') {
        navigateToPhase('results', state.game.id);
      }
    };

    const onTick = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      if (payload.phase) {
        setPhase(payload.phase);
      }

      setRemainingSeconds(Number(payload.remainingSeconds || 0));
    };

    const onScores = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        if (!gameIdRef.current && payload?.gameId) {
          updateGameId(payload.gameId);
        } else {
          return;
        }
      }

      if (Array.isArray(payload?.scores)) {
        setScores(normalizeScores(payload.scores));
      }
    };

    const onSubmissionReceived = (payload) => {
      if (!payload?.submissionId) {
        return;
      }

      pendingSubmissionIdRef.current = payload.submissionId;
      setValidationMessage('Submission received. Waiting for AI validation...');
      setIsSubmitting(true);
      setWord('');
      setExplanation('');
    };

    const onSubmissionValidated = (payload) => {
      if (!payload?.submissionId) {
        return;
      }

      if (payload.submissionId === pendingSubmissionIdRef.current) {
        setIsSubmitting(false);
        pendingSubmissionIdRef.current = '';
        setValidationMessage(
          payload.isValid
            ? `Accepted (+${payload.score}) ${payload.reason}`
            : `Rejected (0) ${payload.reason}`,
        );
      }
    };

    const onPlayerJoined = (payload) => {
      if (!payload?.playerId) {
        return;
      }

      setPlayers((existing) => {
        const index = existing.findIndex((row) => row.id === payload.playerId);
        if (index === -1) {
          return [
            ...existing,
            {
              id: payload.playerId,
              name: payload.playerName || 'Player',
              is_active: true,
            },
          ];
        }

        const next = [...existing];
        next[index] = {
          ...next[index],
          name: payload.playerName || next[index].name,
          is_active: true,
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
          ? { ...row, is_active: false }
          : row
      )));
    };

    const onRevealChains = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      setGameplayState({
        code: roomCode,
        gameId: payload.gameId || gameIdRef.current,
        phase: 'reveal',
        startWord,
        endWord,
        revealChains: Array.isArray(payload.chains) ? payload.chains : [],
      });
      navigateToPhase('reveal', payload.gameId || gameIdRef.current);
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
        revealChains: existing?.revealChains || [],
        voteCounts: existing?.voteCounts || {},
        voteEndsAt: payload.voteEndsAt || null,
      });
      navigateToPhase('vote', payload.gameId || gameIdRef.current);
    };

    const onVotingClosed = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      setLastResults(payload);
      setGameplayState({
        code: payload.code || roomCode,
        gameId: payload.gameId || gameIdRef.current,
        phase: 'results',
        startWord,
        endWord,
        voteCounts: payload.voteCounts || {},
      });
      navigateToPhase('results', payload.gameId || gameIdRef.current);
    };

    const onGameResults = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      setLastResults(payload);
      navigateToPhase('results', payload.gameId || gameIdRef.current);
    };

    const onError = (payload) => {
      setIsSubmitting(false);
      setError(payload?.message || 'Socket error');
    };

    socket.on('room:joined', onRoomJoined);
    socket.on('room:state', onRoomState);
    socket.on('room:scores', onScores);
    socket.on('scores_updated', onScores);
    socket.on('game:tick', onTick);
    socket.on('submission_received', onSubmissionReceived);
    socket.on('submission_validated', onSubmissionValidated);
    socket.on('room:playerJoined', onPlayerJoined);
    socket.on('room:playerLeft', onPlayerLeft);
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

    socket.emit('room:scores:request', {
      code: roomCode,
      playerId,
    });

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('room:state', onRoomState);
      socket.off('room:scores', onScores);
      socket.off('scores_updated', onScores);
      socket.off('game:tick', onTick);
      socket.off('submission_received', onSubmissionReceived);
      socket.off('submission_validated', onSubmissionValidated);
      socket.off('room:playerJoined', onPlayerJoined);
      socket.off('room:playerLeft', onPlayerLeft);
      socket.off('reveal_chains', onRevealChains);
      socket.off('vote_phase_started', onVotePhaseStarted);
      socket.off('voting_closed', onVotingClosed);
      socket.off('game:results', onGameResults);
      socket.off('error', onError);
    };
  }, [
    endWord,
    navigate,
    navigateToPhase,
    playerId,
    playerName,
    roomCode,
    socket,
    startWord,
    updateGameId,
  ]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!gameId) {
      setError('Game is not ready yet. Wait for state sync.');
      return;
    }

    const safeWord = String(word || '').trim();
    const safeExplanation = String(explanation || '').trim();
    if (safeWord.length < 3) {
      setError('Word must be at least 3 characters');
      return;
    }

    if (safeExplanation.length < 10 || safeExplanation.length > 500) {
      setError('Explanation must be 10-500 characters');
      return;
    }

    setError('');
    setIsSubmitting(true);

    socket.emit('submit_word', {
      gameId,
      playerId,
      word: safeWord,
      explanation: safeExplanation,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Race Phase</p>
          <p className="mt-1 font-mono text-emerald-400 text-xl">{roomCode}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge">{status}</span>
            <span className="badge">phase: {phase}</span>
            <span className="font-mono text-slate-300">{startWord || 'start'} {'->'} {endWord || 'end'}</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Chains are hidden during race and will be revealed together after timeout.</p>
          {gameId && (
            <p className="mt-2 text-xs font-mono text-slate-500">gameId: {gameId}</p>
          )}
        </div>

        <div className="card flex items-center justify-between md:flex-col md:items-start md:justify-center">
          <div className="flex items-center gap-2">
            <Clock size={18} className={remainingSeconds <= 20 ? 'text-red-500' : 'text-emerald-400'} />
            <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Time Left</p>
          </div>
          <p className={`mt-1 font-mono text-3xl font-bold ${remainingSeconds <= 20 ? 'text-red-500' : 'text-emerald-400'}`}>
            {formatTime(remainingSeconds)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-bold font-syne text-white">Race Rules</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Submit only one word at a time.</li>
            <li>Word must be unique in the chain and at least 3 characters.</li>
            <li>Add a clear explanation (10-500 chars) for each step.</li>
            <li>Reveal starts automatically after race timeout.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-bold font-syne text-white">Scores</h3>
            <ul className="mt-3 space-y-2">
              {scores.map((row) => (
                <li key={row.playerId} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <div>
                    <p className="font-syne text-sm text-slate-200">{row.playerName}</p>
                    <p className="text-xs font-mono text-slate-500">chain {row.chainLength}</p>
                  </div>
                  <p className="font-mono text-emerald-400 font-bold">{row.score}</p>
                </li>
              ))}
              {scores.length === 0 && (
                <li className="text-sm text-slate-500">No scores yet.</li>
              )}
            </ul>
          </div>

          <div className="card">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold font-syne text-white">Players</h3>
            </div>
            <ul className="mt-3 space-y-2">
              {players.map((player) => (
                <li key={player.id} className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <p className="font-syne text-sm text-slate-200">
                    {player.name}
                    {player.id === playerId ? ' (you)' : ''}
                  </p>
                </li>
              ))}
              {players.length === 0 && (
                <li className="text-sm text-slate-500">Waiting for room sync...</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="text-lg font-bold font-syne text-white">Submit Next Word</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="word" className="text-xs text-slate-500 font-syne uppercase tracking-wide">Word</label>
            <input
              id="word"
              type="text"
              className="input mt-1 w-full font-mono"
              value={word}
              maxLength={50}
              disabled={isSubmitting || remainingSeconds <= 0 || status !== 'active' || phase !== 'race'}
              onChange={(event) => setWord(event.target.value)}
              placeholder="Enter next connection word"
            />
          </div>

          <div>
            <label htmlFor="explanation" className="text-xs text-slate-500 font-syne uppercase tracking-wide">Explanation</label>
            <textarea
              id="explanation"
              className="input mt-1 w-full resize-none"
              value={explanation}
              maxLength={500}
              rows={3}
              disabled={isSubmitting || remainingSeconds <= 0 || status !== 'active' || phase !== 'race'}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="Explain why this word connects to the previous word"
            />
          </div>

          <button
            type="submit"
            className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit}
          >
            <Send size={16} />
            <span>{isSubmitting ? 'Submitting...' : 'Submit Word'}</span>
          </button>
        </form>

        {validationMessage && (
          <p className="mt-3 rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-300">
            {validationMessage}
          </p>
        )}

        {error && (
          <p className="mt-3 inline-flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-500">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </p>
        )}
      </section>
    </div>
  );
}
