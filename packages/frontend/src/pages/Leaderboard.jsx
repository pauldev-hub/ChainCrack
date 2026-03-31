/**
 * Leaderboard page.
 *
 * @file packages/frontend/src/pages/Leaderboard.jsx
 */

import React, { useEffect, useState } from 'react';
import { Home, Trophy } from 'lucide-react';
import apiClient from '../services/apiClient';

/**
 * Leaderboard page component.
 * @param {{navigate: (path: string) => void}} props
 * @returns {JSX.Element}
 */
export default function Leaderboard({ navigate }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setError('');
        setIsLoading(true);

        const response = await apiClient.get('/api/leaderboard?limit=25');
        if (!mounted) {
          return;
        }

        const data = response?.data?.data;
        setRows(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        setError(requestError?.response?.data?.error || requestError?.message || 'Failed to load leaderboard');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
      <section className="card">
        <div className="flex items-center gap-3">
          <Trophy size={24} className="text-emerald-400" />
          <h2 className="text-2xl font-bold font-syne text-white">Global Leaderboard</h2>
        </div>
        <p className="mt-2 text-slate-400 text-sm">Ranked by total score and wins.</p>
      </section>

      {isLoading && (
        <section className="card">
          <p className="text-slate-400">Loading leaderboard...</p>
        </section>
      )}

      {error && (
        <section className="card border-red-500/40">
          <p className="text-red-500">{error}</p>
        </section>
      )}

      {!isLoading && !error && (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 font-syne">
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Total Score</th>
                  <th className="px-3 py-2">Wins</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.playerName}-${index}`} className="border-b border-slate-800/60">
                    <td className="px-3 py-3 font-mono text-emerald-400">#{index + 1}</td>
                    <td className="px-3 py-3 font-syne text-slate-200">{row.playerName}</td>
                    <td className="px-3 py-3 font-mono text-slate-200">{row.totalScore}</td>
                    <td className="px-3 py-3 font-mono text-slate-200">{row.wins}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>No leaderboard data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          onClick={() => navigate('/')}
        >
          <Home size={16} />
          <span>Back Home</span>
        </button>
      </section>
    </div>
  );
}
