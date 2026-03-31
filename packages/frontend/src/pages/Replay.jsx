/**
 * Replay page.
 *
 * @file packages/frontend/src/pages/Replay.jsx
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Home, PlayCircle } from 'lucide-react';
import apiClient from '../services/apiClient';

function buildVoteCounts(votes) {
  const counts = {};
  if (!Array.isArray(votes)) {
    return counts;
  }

  for (const vote of votes) {
    const target = String(vote.voted_chain_owner_id || '').trim();
    if (!target) {
      continue;
    }
    counts[target] = Number(counts[target] || 0) + 1;
  }

  return counts;
}

/**
 * Replay page component.
 * @param {{gameId: string, navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Replay({ gameId, navigate }) {
  const [replay, setReplay] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const voteCounts = buildVoteCounts(replay?.votes || []);

  useEffect(() => {
    let mounted = true;

    const loadReplay = async () => {
      try {
        setError('');
        setIsLoading(true);

        const response = await apiClient.get(`/api/matches/${encodeURIComponent(gameId)}/replay`);
        if (!mounted) {
          return;
        }

        setReplay(response?.data?.data || null);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        setError(requestError?.response?.data?.error || requestError?.message || 'Failed to load replay');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadReplay();
    return () => {
      mounted = false;
    };
  }, [gameId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="card">
        <div className="flex items-center gap-3">
          <PlayCircle size={24} className="text-emerald-400" />
          <div>
            <h2 className="text-2xl font-bold font-syne text-white">Replay Viewer</h2>
            <p className="text-sm font-mono text-slate-400">gameId: {gameId}</p>
          </div>
        </div>
      </section>

      {isLoading && (
        <section className="card">
          <p className="text-slate-400">Loading replay...</p>
        </section>
      )}

      {error && (
        <section className="card border-red-500/40">
          <p className="text-red-500">{error}</p>
        </section>
      )}

      {!isLoading && replay && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card md:col-span-2">
              <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Words</p>
              <p className="mt-1 font-mono text-emerald-400 text-xl">
                {replay.game?.start_word || 'start'} {'->'} {replay.game?.end_word || 'end'}
              </p>
              <p className="mt-2 text-xs text-slate-500">status: {replay.game?.status || 'unknown'}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500 font-syne uppercase tracking-wide">Players</p>
              <p className="mt-1 font-mono text-emerald-400 text-3xl">{Array.isArray(replay.players) ? replay.players.length : 0}</p>
            </div>
          </section>

          <section className="card">
            <h3 className="text-lg font-bold font-syne text-white">Timeline</h3>
            <ul className="mt-3 space-y-2">
              {(replay.timeline || []).map((step) => (
                <li
                  key={step.wordChainId}
                  className={`rounded border px-3 py-2 ${step.isValid ? 'border-slate-800 bg-slate-950' : 'border-red-500/40 bg-red-500/10'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-emerald-400">{step.word}</p>
                    <p className="text-xs font-mono text-slate-500">step {step.stepNumber}</p>
                  </div>
                  <p className="mt-1 text-xs font-mono text-slate-500">
                    {step.playerName} • {step.status} • ai {step.aiScore}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{step.aiFeedback || 'No feedback'}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3 className="text-lg font-bold font-syne text-white">Final Scores</h3>
            <ul className="mt-3 space-y-2">
              {(replay.scores || []).map((row) => (
                <li key={row.playerId} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <div>
                    <p className="font-syne text-slate-200">{row.playerName}</p>
                    <p className="text-xs font-mono text-slate-500">rank {row.rank || '-'} • chain {row.chainLength}</p>
                    <p className="mt-1 text-xs font-mono text-slate-500">
                      ai {Number(row.aiScore || 0)} + speed {Number(row.speedBonus || 0)} + crowd {Number(row.crowdBonus || 0)}
                    </p>
                  </div>
                  <p className="font-mono text-emerald-400 font-bold">{row.score}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3 className="text-lg font-bold font-syne text-white">Vote Distribution</h3>
            <ul className="mt-3 space-y-2">
              {(replay.scores || []).map((row) => (
                <li key={`vote-${row.playerId}`} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <p className="font-syne text-slate-200">{row.playerName}</p>
                  <p className="font-mono text-emerald-400">{Number(voteCounts[row.playerId] || 0)}</p>
                </li>
              ))}
              {(!Array.isArray(replay.scores) || replay.scores.length === 0) && (
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
          onClick={() => navigate(`/results/${encodeURIComponent(gameId)}`)}
        >
          <ArrowLeft size={16} />
          <span>Back Results</span>
        </button>

        <button
          type="button"
          className="btn-primary inline-flex items-center justify-center gap-2"
          onClick={() => navigate('/')}
        >
          <Home size={16} />
          <span>Back Home</span>
        </button>
      </section>
    </div>
  );
}
