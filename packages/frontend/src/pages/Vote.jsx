/**
 * Vote phase page.
 *
 * @file packages/frontend/src/pages/Vote.jsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Vote as VoteIcon } from 'lucide-react';
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
 * Vote page component.
 * @param {{code: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Vote({ code, navigate }) {
  const socket = useMemo(() => getSocket(), []);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);
  const roomCode = useMemo(() => normalizeRoomCode(code), [code]);

  const [gameId, setGameId] = useState('');
  const [startWord, setStartWord] = useState('');
  const [endWord, setEndWord] = useState('');
  const [players, setPlayers] = useState([]);
  const [chains, setChains] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [selectedVotes, setSelectedVotes] = useState([]);
  const [voteEndsAt, setVoteEndsAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const gameIdRef = React.useRef('');
  const startWordRef = React.useRef('');
  const endWordRef = React.useRef('');
  const chainsRef = React.useRef([]);
  const voteCountsRef = React.useRef({});
  const voteEndsAtRef = React.useRef(null);
  const voteSubmitTimeoutRef = React.useRef(null);

  const clearVoteSubmitTimeout = React.useCallback(() => {
    if (!voteSubmitTimeoutRef.current) {
      return;
    }
    clearTimeout(voteSubmitTimeoutRef.current);
    voteSubmitTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    startWordRef.current = startWord;
  }, [startWord]);

  useEffect(() => {
    endWordRef.current = endWord;
  }, [endWord]);

  useEffect(() => {
    chainsRef.current = chains;
  }, [chains]);

  useEffect(() => {
    voteCountsRef.current = voteCounts;
  }, [voteCounts]);

  useEffect(() => {
    voteEndsAtRef.current = voteEndsAt;
  }, [voteEndsAt]);

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
      startWord: startWordRef.current,
      endWord: endWordRef.current,
      voteCounts: payload.voteCounts || voteCountsRef.current,
    });
    navigate(`/results/${encodeURIComponent(resolvedGameId)}`);
  }, [navigate, roomCode]);

  const activePlayers = useMemo(
    () => (Array.isArray(players) ? players : []).filter((player) => player.is_active !== false),
    [players],
  );

  const allowSelfVote = activePlayers.length < 3;

  useEffect(() => {
    if (!voteEndsAt) {
      return undefined;
    }

    const timer = setInterval(() => {
      const msRemaining = new Date(voteEndsAt).getTime() - Date.now();
      setRemainingSeconds(Math.max(Math.floor(msRemaining / 1000), 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [voteEndsAt]);

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
      setVoteCounts(cachedGameplay.voteCounts || {});
      setVoteEndsAt(cachedGameplay.voteEndsAt || null);

      if (cachedGameplay.phase === 'reveal') {
        navigate(`/reveal/${encodeURIComponent(roomCode)}`);
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
      setPlayers(Array.isArray(state.players) ? state.players : []);

      const fallbackChains = buildRevealChainsFromState(state.players, state.wordChains);
      if (fallbackChains.length > 0) {
        setChains(fallbackChains);
      }

      if (state.game.phase === 'race') {
        navigate(`/game/${encodeURIComponent(roomCode)}`);
        return;
      }

      if (state.game.phase === 'reveal') {
        setGameplayState({
          code: state.game.code || roomCode,
          gameId: state.game.id,
          phase: 'reveal',
          startWord: state.game.start_word,
          endWord: state.game.end_word,
          revealChains: fallbackChains,
        });
        navigate(`/reveal/${encodeURIComponent(roomCode)}`);
        return;
      }

      if (state.game.phase === 'results' || state.game.status === 'ended') {
        navigateToResults({ gameId: state.game.id, code: state.game.code || roomCode });
        return;
      }

      setVoteEndsAt(state.game.vote_phase_ends_at || null);
      setGameplayState({
        code: state.game.code || roomCode,
        gameId: state.game.id,
        phase: 'vote',
        startWord: state.game.start_word,
        endWord: state.game.end_word,
        revealChains: fallbackChains,
        voteCounts: voteCountsRef.current,
        voteEndsAt: state.game.vote_phase_ends_at || null,
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
        phase: 'vote',
        startWord: startWordRef.current,
        endWord: endWordRef.current,
        revealChains: normalized,
        voteCounts: voteCountsRef.current,
        voteEndsAt: voteEndsAtRef.current,
      });
    };

    const onVotePhaseStarted = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      setVoteEndsAt(payload.voteEndsAt || null);
      setRemainingSeconds(Number(payload.durationSeconds || 30));
      const existing = getGameplayState();

      setGameplayState({
        code: roomCode,
        gameId: payload.gameId || gameIdRef.current,
        phase: 'vote',
        startWord: startWordRef.current,
        endWord: endWordRef.current,
        revealChains: chainsRef.current.length > 0 ? chainsRef.current : (existing?.revealChains || []),
        voteCounts: existing?.voteCounts || voteCountsRef.current,
        voteEndsAt: payload.voteEndsAt || null,
      });
    };

    const onTick = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      if (payload.phase === 'vote') {
        setRemainingSeconds(Number(payload.remainingSeconds || 0));
      }
    };

    const onVoteCountsUpdated = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }

      const nextVoteCounts = payload.voteCounts && typeof payload.voteCounts === 'object'
        ? payload.voteCounts
        : {};
      setVoteCounts(nextVoteCounts);
      setGameplayState({
        code: roomCode,
        gameId: payload.gameId || gameIdRef.current,
        phase: 'vote',
        startWord: startWordRef.current,
        endWord: endWordRef.current,
        revealChains: chainsRef.current,
        voteCounts: nextVoteCounts,
        voteEndsAt: voteEndsAtRef.current,
      });
      clearVoteSubmitTimeout();
      setIsSubmitting(false);
    };

    const onVotingClosed = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      clearVoteSubmitTimeout();
      navigateToResults(payload);
    };

    const onGameResults = (payload) => {
      if (!matchesRoomPayload(payload, { roomCode, gameId: gameIdRef.current })) {
        return;
      }
      clearVoteSubmitTimeout();
      navigateToResults(payload);
    };

    const onError = (payload) => {
      clearVoteSubmitTimeout();
      setIsSubmitting(false);
      setError(payload?.message || 'Socket error');
    };

    socket.on('room:joined', onRoomJoined);
    socket.on('room:state', onRoomState);
    socket.on('reveal_chains', onRevealChains);
    socket.on('vote_phase_started', onVotePhaseStarted);
    socket.on('game:tick', onTick);
    socket.on('vote_counts_updated', onVoteCountsUpdated);
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
      clearVoteSubmitTimeout();
      socket.off('room:joined', onRoomJoined);
      socket.off('room:state', onRoomState);
      socket.off('reveal_chains', onRevealChains);
      socket.off('vote_phase_started', onVotePhaseStarted);
      socket.off('game:tick', onTick);
      socket.off('vote_counts_updated', onVoteCountsUpdated);
      socket.off('voting_closed', onVotingClosed);
      socket.off('game:results', onGameResults);
      socket.off('error', onError);
    };
  }, [
    navigate,
    navigateToResults,
    playerId,
    playerName,
    roomCode,
    socket,
    updateGameId,
    clearVoteSubmitTimeout,
  ]);

  const toggleVoteTarget = (targetId) => {
    const safeTarget = String(targetId || '').trim();
    if (!safeTarget) {
      return;
    }

    if (!allowSelfVote && safeTarget === playerId) {
      setError('Self-voting is disabled in rooms with 3 or more active players.');
      return;
    }

    setError('');
    setSelectedVotes((current) => {
      if (current.includes(safeTarget)) {
        return current.filter((value) => value !== safeTarget);
      }
      if (current.length >= 2) {
        setError('You can vote for at most 2 chains.');
        return current;
      }
      return [...current, safeTarget];
    });
  };

  const submitVotes = () => {
    if (!gameId) {
      setError('Game is not ready yet. Wait for state sync.');
      return;
    }

    if (selectedVotes.length === 0) {
      setError('Select at least one chain before submitting votes.');
      return;
    }

    setError('');
    clearVoteSubmitTimeout();
    setIsSubmitting(true);
    voteSubmitTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
      setError('Vote submission timed out. Please try again.');
      voteSubmitTimeoutRef.current = null;
    }, 10000);

    socket.emit('vote_chain', {
      gameId,
      playerId,
      votedChainOwnerIds: selectedVotes,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <div className="flex items-center gap-2">
            <VoteIcon size={22} className="text-emerald-400" />
            <h2 className="text-2xl font-bold font-syne text-white">Vote Phase</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">Choose up to 2 chains. The crowd score updates live during voting.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge">room {roomCode}</span>
            <span className="font-mono text-slate-300">{startWord || 'start'} {'->'} {endWord || 'end'}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {allowSelfVote ? 'Self-voting is enabled (fewer than 3 active players).' : 'Self-voting is disabled (3+ active players).'}
          </p>
        </div>

        <div className="card flex items-center justify-between md:flex-col md:items-start md:justify-center">
          <div className="flex items-center gap-2">
            <Clock size={18} className={remainingSeconds <= 10 ? 'text-red-500' : 'text-emerald-400'} />
            <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Vote Time Left</p>
          </div>
          <p className={`mt-1 font-mono text-3xl font-bold ${remainingSeconds <= 10 ? 'text-red-500' : 'text-emerald-400'}`}>
            {formatTime(remainingSeconds)}
          </p>
        </div>
      </section>

      <section className="card">
        <h3 className="text-lg font-bold font-syne text-white">Vote Targets</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {chains.map((chain) => {
            const isSelected = selectedVotes.includes(chain.playerId);
            const isSelf = chain.playerId === playerId;
            const disabledByRule = !allowSelfVote && isSelf;

            return (
              <article
                key={chain.playerId}
                className={`rounded border p-3 transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-800 bg-slate-950'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-syne text-slate-200">
                      {chain.playerName}
                      {isSelf ? ' (you)' : ''}
                    </p>
                    <p className="mt-1 text-xs font-mono text-slate-500">votes: {Number(voteCounts[chain.playerId] || 0)}</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabledByRule}
                      onChange={() => toggleVoteTarget(chain.playerId)}
                    />
                    <span>{isSelected ? 'Selected' : 'Vote'}</span>
                  </label>
                </div>

                <p className="mt-2 text-xs text-slate-500 font-syne uppercase tracking-wide">Path</p>
                <p className="mt-1 font-mono text-emerald-400 break-all">
                  {chain.isEmptyChain ? `${startWord || 'start'} -> [no submission] -> ${endWord || 'end'}` : `${startWord || 'start'} -> ${chain.words.join(' -> ')} -> ${endWord || 'end'}`}
                </p>
                <p className="mt-2 text-xs font-mono text-slate-500">AI score total: {chain.aiScore}</p>
                {disabledByRule && (
                  <p className="mt-2 text-xs text-slate-500">Self-vote unavailable in this room size.</p>
                )}
              </article>
            );
          })}

          {chains.length === 0 && (
            <p className="text-sm text-slate-500">Waiting for chains to vote on...</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || selectedVotes.length === 0}
            onClick={submitVotes}
          >
            <CheckCircle2 size={16} />
            <span>{isSubmitting ? 'Submitting votes...' : `Submit Votes (${selectedVotes.length}/2)`}</span>
          </button>
        </div>
      </section>

      {error && (
        <section className="card border-red-500/40">
          <p className="inline-flex items-center gap-2 text-sm text-red-500">
            <AlertCircle size={16} />
            <span>{error}</span>
          </p>
        </section>
      )}
    </div>
  );
}
