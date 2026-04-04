/**
 * Results page.
 *
 * @file packages/frontend/src/pages/Results.jsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Crown, Home, ListOrdered, Sparkles } from 'lucide-react';
import apiClient from '../services/apiClient';
import {
  clearGameplayState,
  clearActiveRoom,
  getLastResults,
} from '../services/sessionService';

function getWinner(resultsPayload, replayScores) {
  if (resultsPayload?.winnerId || resultsPayload?.winnerName) {
    return {
      winnerId: resultsPayload.winnerId || null,
      winnerName: resultsPayload.winnerName || 'Winner',
    };
  }

  if (!Array.isArray(replayScores) || replayScores.length === 0) {
    return {
      winnerId: null,
      winnerName: 'Winner',
    };
  }

  const [top] = [...replayScores].sort((left, right) => {
    if (Number(left.rank || 9999) !== Number(right.rank || 9999)) {
      return Number(left.rank || 9999) - Number(right.rank || 9999);
    }

    if (Number(left.score || 0) !== Number(right.score || 0)) {
      return Number(right.score || 0) - Number(left.score || 0);
    }

    return Number(left.chainLength || 0) - Number(right.chainLength || 0);
  });

  return {
    winnerId: top.playerId,
    winnerName: top.playerName || 'Winner',
  };
}

/**
 * Results page component.
 * @param {{gameId: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Results({ gameId, navigate }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState(null);
  const [resultsPayload, setResultsPayload] = useState(null);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        setError('');
        setIsLoading(true);

        const remembered = getLastResults();
        if (mounted && remembered && remembered.gameId === gameId) {
          setResultsPayload(remembered);
        }

        const response = await apiClient.get(`/api/matches/${encodeURIComponent(gameId)}/replay`);
        if (!mounted) {
          return;
        }

        setReplay(response?.data?.data || null);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        setError(requestError?.response?.data?.error || requestError?.message || 'Failed to load results');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [gameId]);

  const winner = getWinner(resultsPayload, replay?.scores || []);
  const finalScores = useMemo(
    () => (resultsPayload?.finalScores || replay?.scores || []),
    [replay?.scores, resultsPayload?.finalScores],
  );

  const chainOfRoundPlayerId = resultsPayload?.chainOfRoundPlayerId || null;
  const voteCounts = resultsPayload?.voteCounts && typeof resultsPayload.voteCounts === 'object'
    ? resultsPayload.voteCounts
    : {};

  const chainOfRoundPlayerName = useMemo(() => {
    if (!chainOfRoundPlayerId) {
      return null;
    }
    const row = finalScores.find((scoreRow) => scoreRow.playerId === chainOfRoundPlayerId);
    return row?.playerName || 'Player';
  }, [chainOfRoundPlayerId, finalScores]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="card border-emerald-400 shadow-lg shadow-emerald-400/20">
        <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Final Result</p>
        <div className="mt-2 flex items-center gap-3">
          <Crown className="text-emerald-400" size={28} />
          <div>
            <h2 className="text-2xl font-bold font-syne text-white">{winner.winnerName} wins</h2>
            <p className="text-sm text-slate-400 font-mono">gameId: {gameId}</p>
          </div>
        </div>
      </section>

      {isLoading && (
        <section className="card">
          <p className="text-slate-400">Loading match results...</p>
        </section>
      )}

      {error && (
        <section className="card border-red-500/40">
          <p className="text-red-500">{error}</p>
        </section>
      )}

      {!isLoading && (replay || finalScores.length > 0) && (
        <>
          {chainOfRoundPlayerId && (
            <section className="card border-emerald-400 shadow-lg shadow-emerald-400/20">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-emerald-400" />
                <h3 className="text-lg font-bold font-syne text-white">Chain Of The Round</h3>
              </div>
              <p className="mt-2 text-slate-200">
                <span className="font-semibold text-emerald-400">{chainOfRoundPlayerName}</span>
                {' '}won the crowd decision.
              </p>
              <p className="mt-1 text-xs font-mono text-slate-500">
                votes received: {Number(voteCounts[chainOfRoundPlayerId] || 0)}
              </p>
            </section>
          )}

          <section className="card">
            <h3 className="text-lg font-bold font-syne text-white">Final Scores</h3>
            <ul className="mt-3 space-y-2">
              {finalScores.map((row) => (
                <li
                  key={row.playerId}
                  className={`flex items-center justify-between rounded border px-3 py-2 ${row.playerId === chainOfRoundPlayerId ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-800 bg-slate-950'}`}
                >
                  <div>
                    <p className="font-syne text-slate-200">{row.playerName}</p>
                    <p className="text-xs font-mono text-slate-500">
                      rank {row.rank || '-'} • chain {row.chainLength}
                    </p>
                    <p className="mt-1 text-xs font-mono text-slate-500">
                      ai {Number(row.aiScore || 0)} + speed {Number(row.speedBonus || 0)} + crowd {Number(row.crowdBonus || 0)}
                    </p>
                  </div>
                  <p className="font-mono text-emerald-400 font-bold">{row.score}</p>
                </li>
              ))}
            </ul>
          </section>

          {replay && (
            <section className="card">
              <h3 className="text-lg font-bold font-syne text-white">Validation Timeline</h3>
              <ul className="mt-3 space-y-2">
                {(replay.timeline || []).map((step) => (
                  <li
                    key={step.wordChainId}
                    className={`rounded border px-3 py-2 ${step.isValid ? 'border-slate-800 bg-slate-950' : 'border-red-500/40 bg-red-500/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-emerald-400">{step.word}</p>
                      <p className="text-xs font-mono text-slate-500">step {step.stepNumber}</p>
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-500">
                      {step.playerName} • {step.status} • score {step.aiScore}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{step.aiFeedback || 'No AI feedback'}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h3 className="text-lg font-bold font-syne text-white">Vote Totals</h3>
            <ul className="mt-3 space-y-2">
              {finalScores.map((row) => (
                <li key={`vote-${row.playerId}`} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <p className="font-syne text-slate-200">{row.playerName}</p>
                  <p className="font-mono text-emerald-400">{Number(voteCounts[row.playerId] || 0)}</p>
                </li>
              ))}
              {finalScores.length === 0 && (
                <li className="text-sm text-slate-500">No vote data available.</li>
              )}
            </ul>
          </section>
        </>
      )}

      <section className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn-secondary inline-flex items-center justify-center gap-2"
          onClick={() => navigate(`/replay/${encodeURIComponent(gameId)}`)}
        >
          <ArrowRight size={16} />
          <span>Open Replay</span>
        </button>

        <button
          type="button"
          className="btn-secondary inline-flex items-center justify-center gap-2"
          onClick={() => navigate('/leaderboard')}
        >
          <ListOrdered size={16} />
          <span>Leaderboard</span>
        </button>

        <button
          type="button"
          className="btn-primary inline-flex items-center justify-center gap-2"
          onClick={() => {
            clearActiveRoom();
            clearGameplayState();
            navigate('/');
          }}
        >
          <Home size={16} />
          <span>Back Home</span>
        </button>
      </section>
    </div>
  );
}
