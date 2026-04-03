/**
 * Memory mode gameplay page.
 *
 * @file packages/frontend/src/pages/Memory.jsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Brain, CheckCircle2, Clock, Send } from 'lucide-react';
import {
  getSocket,
  matchesRoomPayload,
  normalizeRoomCode,
} from '../services/socketService';
import {
  getActiveRoom,
  getOrCreatePlayerId,
  getPlayerName,
  setActiveRoom,
  setGameplayState,
  setLastResults,
} from '../services/sessionService';

function getTimerStyle(secondsLeft) {
  if (secondsLeft < 15) {
    return {
      iconClass: 'text-red-500 animate-pulse',
      textClass: 'text-red-500 animate-pulse',
      label: 'critical',
    };
  }

  if (secondsLeft <= 30) {
    return {
      iconClass: 'text-amber-400',
      textClass: 'text-amber-400',
      label: 'warning',
    };
  }

  return {
    iconClass: 'text-emerald-400',
    textClass: 'text-emerald-400',
    label: 'normal',
  };
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * @param {{code: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Memory({ code, navigate }) {
  const socket = useMemo(() => getSocket(), []);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);
  const roomCode = useMemo(() => normalizeRoomCode(code), [code]);

  const [gameId, setGameId] = useState('');
  const [phase, setPhase] = useState('memory_reveal');
  const [revealVariant, setRevealVariant] = useState('flash_all');
  const [sequence, setSequence] = useState([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [revealTotalSeconds, setRevealTotalSeconds] = useState(0);
  const [inputSlots, setInputSlots] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [error, setError] = useState('');

  const gameIdRef = React.useRef('');
  const autoSubmittedRef = React.useRef(false);
  const lastStateRequestAtRef = React.useRef(0);

  const requestRoomState = React.useCallback(() => {
    const now = Date.now();
    if (now - lastStateRequestAtRef.current < 1000) {
      return;
    }

    lastStateRequestAtRef.current = now;
    socket.emit('room:state:request', {
      code: roomCode,
      playerId,
    });
  }, [playerId, roomCode, socket]);

  const updateGameId = React.useCallback((nextGameId) => {
    const resolved = String(nextGameId || '');
    setGameId(resolved);
    gameIdRef.current = resolved;
  }, []);

  const submitSequence = React.useCallback((force = false) => {
    if (!gameIdRef.current || (isSubmitted && !force)) {
      return;
    }

    socket.emit('memory:submit', {
      gameId: gameIdRef.current,
      playerId,
      words: inputSlots,
    });
  }, [inputSlots, isSubmitted, playerId, socket]);

  useEffect(() => {
    if (!playerName) {
      navigate('/');
      return undefined;
    }

    const cachedRoom = getActiveRoom();
    if (cachedRoom?.code === roomCode) {
      updateGameId(cachedRoom.gameId || '');
    }

    const onRoomJoined = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      if (payload.mode !== 'memory') {
        navigate(`/game/${encodeURIComponent(roomCode)}`);
        return;
      }

      updateGameId(payload.gameId || '');
      setActiveRoom({
        code: payload.code || roomCode,
        gameId: payload.gameId,
        hostId: payload.hostId,
        startWord: payload.startWord,
        endWord: payload.endWord,
        status: payload.status,
        gameMode: payload.mode,
      });

      // Request state again after confirmed join so reveal data is recoverable even if memory:started was missed.
      requestRoomState();
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

      if (state.game.mode !== 'memory') {
        navigate(`/game/${encodeURIComponent(roomCode)}`);
        return;
      }

      updateGameId(state.game.id || '');
      setActiveRoom({
        code: state.game.code || roomCode,
        gameId: state.game.id,
        startWord: state.game.start_word,
        endWord: state.game.end_word,
        status: state.game.status,
        gameMode: 'memory',
      });

      const resolvedWordCount = Number(state.game.memory_word_count || 0);
      const stateWords = Array.isArray(state.game.memory_words) ? state.game.memory_words : [];
      const statePhase = state.game.phase === 'memory_recall' ? 'memory_recall' : 'memory_reveal';

      setRevealVariant(state.game.reveal_variant || 'flash_all');
      setPhase(statePhase);

      if (statePhase === 'memory_reveal' && stateWords.length > 0) {
        setSequence(stateWords);
        setInputSlots((existing) => (
          existing.length === stateWords.length ? existing : new Array(stateWords.length).fill('')
        ));
        setSubmitStatus('Memorize the sequence before it disappears.');
      }

      if (statePhase === 'memory_recall' && resolvedWordCount > 0) {
        setInputSlots((existing) => (
          existing.length === resolvedWordCount ? existing : new Array(resolvedWordCount).fill('')
        ));
        if (!isSubmitted) {
          setSubmitStatus('Recall phase is live. Fill the slots in order.');
        }
      }

      const revealEndsAt = state.game.memory_reveal_ends_at ? Date.parse(state.game.memory_reveal_ends_at) : null;
      if (statePhase === 'memory_reveal' && Number.isFinite(revealEndsAt)) {
        const secondsLeft = Math.max(0, Math.ceil((revealEndsAt - Date.now()) / 1000));
        setRemainingSeconds(secondsLeft);
      }

      const recallEndsAt = state.game.memory_recall_ends_at ? Date.parse(state.game.memory_recall_ends_at) : null;
      if (statePhase === 'memory_recall' && Number.isFinite(recallEndsAt)) {
        const secondsLeft = Math.max(0, Math.ceil((recallEndsAt - Date.now()) / 1000));
        setRemainingSeconds(secondsLeft);
      }

      if (state.game.status === 'ended') {
        navigate(`/results/${encodeURIComponent(state.game.id)}`);
      }
    };

    const onMemoryStarted = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      const words = Array.isArray(payload.words) ? payload.words : [];
      updateGameId(payload.gameId || gameIdRef.current);
      setSequence(words);
      setRevealVariant(payload.revealVariant || 'flash_all');
      setPhase('memory_reveal');
      setRevealTotalSeconds(Math.ceil(Number(payload.revealMs || 0) / 1000));
      setRemainingSeconds(Math.ceil(Number(payload.revealMs || 0) / 1000));
      setInputSlots(new Array(words.length).fill(''));
      setIsSubmitted(false);
      autoSubmittedRef.current = false;
      setSubmitStatus('Memorize the sequence before it disappears.');
    };

    const onMemoryHide = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      setPhase('memory_recall');
      setRemainingSeconds(Math.ceil(Number(payload.recallMs || 0) / 1000));
      setSubmitStatus('Recall phase is live. Fill the slots in order.');
    };

    const onMemoryTick = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      const nextPhase = payload.phase === 'recall' ? 'memory_recall' : 'memory_reveal';
      setPhase(nextPhase);
      setRemainingSeconds(Number(payload.secondsLeft || 0));

      if (nextPhase === 'memory_reveal' && sequence.length === 0) {
        requestRoomState();
      }
    };

    const onMemorySubmit = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      if (payload.playerId !== playerId) {
        return;
      }

      setIsSubmitted(true);
      setSubmitStatus('Sequence submitted. Waiting for results...');
    };

    const onMemoryResults = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      setLastResults(payload);
      setGameplayState({
        code: payload.code || roomCode,
        gameId: payload.gameId,
        phase: 'results',
        gameMode: 'memory',
      });
      navigate(`/results/${encodeURIComponent(payload.gameId)}`);
    };

    const onError = (payload) => {
      setError(payload?.message || 'Socket error');
    };

    socket.on('room:joined', onRoomJoined);
    socket.on('room:state', onRoomState);
    socket.on('memory:started', onMemoryStarted);
    socket.on('memory:hide', onMemoryHide);
    socket.on('memory:tick', onMemoryTick);
    socket.on('memory:submit', onMemorySubmit);
    socket.on('memory:results', onMemoryResults);
    socket.on('error', onError);

    socket.emit('room:join', {
      code: roomCode,
      playerId,
      playerName,
    });

    requestRoomState();

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('room:state', onRoomState);
      socket.off('memory:started', onMemoryStarted);
      socket.off('memory:hide', onMemoryHide);
      socket.off('memory:tick', onMemoryTick);
      socket.off('memory:submit', onMemorySubmit);
      socket.off('memory:results', onMemoryResults);
      socket.off('error', onError);
    };
  }, [
    isSubmitted,
    navigate,
    playerId,
    playerName,
    requestRoomState,
    roomCode,
    sequence.length,
    socket,
    updateGameId,
  ]);

  useEffect(() => {
    if (phase !== 'memory_recall' || remainingSeconds > 0 || isSubmitted || autoSubmittedRef.current) {
      return;
    }

    autoSubmittedRef.current = true;
    submitSequence(true);
  }, [isSubmitted, phase, remainingSeconds, submitSequence]);

  const timerStyle = getTimerStyle(remainingSeconds);
  const canSubmit = phase === 'memory_recall' && remainingSeconds > 0 && !isSubmitted;

  let visibleWords = [];
  if (phase === 'memory_reveal') {
    if (revealVariant === 'one_by_one') {
      const elapsed = Math.max(0, revealTotalSeconds - remainingSeconds);
      const currentIndex = Math.min(elapsed, Math.max(0, sequence.length - 1));
      visibleWords = sequence.length > 0 ? [sequence[currentIndex]] : [];
    } else {
      visibleWords = sequence;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Memory Round</p>
          <div className="mt-2 flex items-center gap-2">
            <Brain size={18} className="text-emerald-400" />
            <h2 className="text-xl font-bold font-syne text-white">Recall The Sequence</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge">mode: memory</span>
            <span className="badge">variant: {revealVariant.replace('_', ' ')}</span>
            <span className="font-mono text-slate-300">room: {roomCode}</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Score: +1 exact, +0.5 misplaced, +5 full sequence bonus.</p>
        </div>

        <div className="card flex items-center justify-between md:flex-col md:items-start md:justify-center">
          <div className="flex items-center gap-2">
            <Clock size={18} className={timerStyle.iconClass} />
            <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Time Left</p>
          </div>
          <p className={`mt-1 font-mono text-3xl font-bold ${timerStyle.textClass}`}>
            {formatTime(remainingSeconds)}
          </p>
          <p className="mt-1 text-xs font-mono text-slate-500">state: {timerStyle.label}</p>
        </div>
      </section>

      <section className="card">
        <h3 className="text-lg font-bold font-syne text-white">
          {phase === 'memory_reveal' ? 'Memorize' : 'Recall'}
        </h3>

        {phase === 'memory_reveal' ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {visibleWords.map((word, index) => (
              <div
                key={`${word}-${index}`}
                className="rounded border border-emerald-400/60 bg-emerald-400/10 px-3 py-4 text-center font-mono text-sm text-emerald-300"
              >
                {word}
              </div>
            ))}
            {visibleWords.length === 0 && (
              <p className="text-sm text-slate-500">Waiting for reveal data...</p>
            )}
          </div>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitSequence(false);
            }}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {inputSlots.map((value, index) => (
                <input
                  key={`slot-${index + 1}`}
                  type="text"
                  className="input w-full text-sm font-mono"
                  placeholder={`#${index + 1}`}
                  value={value}
                  disabled={!canSubmit}
                  onChange={(event) => {
                    const next = [...inputSlots];
                    next[index] = event.target.value;
                    setInputSlots(next);
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit}
            >
              <Send size={16} />
              <span>{isSubmitted ? 'Submitted' : 'Submit Sequence'}</span>
            </button>
          </form>
        )}

        {submitStatus && (
          <p className="mt-3 inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-300">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{submitStatus}</span>
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
