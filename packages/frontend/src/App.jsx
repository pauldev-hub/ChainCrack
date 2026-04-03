/**
 * Root React component
 * 
 * Main application wrapper with routing and Socket.IO connection
 * Cyberpunk dark theme with emerald accents
 * 
 * @file packages/frontend/src/App.jsx
 */

import React from 'react';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Memory from './pages/Memory';
import Reveal from './pages/Reveal';
import Vote from './pages/Vote';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';
import Replay from './pages/Replay';

function parseRoute(pathname) {
  if (pathname === '/') {
    return { page: 'home' };
  }

  const lobbyMatch = pathname.match(/^\/lobby\/([^/]+)$/);
  if (lobbyMatch) {
    return { page: 'lobby', code: decodeURIComponent(lobbyMatch[1]) };
  }

  const gameMatch = pathname.match(/^\/game\/([^/]+)$/);
  if (gameMatch) {
    return { page: 'game', code: decodeURIComponent(gameMatch[1]) };
  }

  const memoryMatch = pathname.match(/^\/memory\/([^/]+)$/);
  if (memoryMatch) {
    return { page: 'memory', code: decodeURIComponent(memoryMatch[1]) };
  }

  const revealMatch = pathname.match(/^\/reveal\/([^/]+)$/);
  if (revealMatch) {
    return { page: 'reveal', code: decodeURIComponent(revealMatch[1]) };
  }

  const voteMatch = pathname.match(/^\/vote\/([^/]+)$/);
  if (voteMatch) {
    return { page: 'vote', code: decodeURIComponent(voteMatch[1]) };
  }

  const resultsMatch = pathname.match(/^\/results\/([^/]+)$/);
  if (resultsMatch) {
    return { page: 'results', gameId: decodeURIComponent(resultsMatch[1]) };
  }

  if (pathname === '/leaderboard') {
    return { page: 'leaderboard' };
  }

  const replayMatch = pathname.match(/^\/replay\/([^/]+)$/);
  if (replayMatch) {
    return { page: 'replay', gameId: decodeURIComponent(replayMatch[1]) };
  }

  return { page: 'not-found' };
}

/**
 * App Component
 * 
 * @returns {JSX.Element} Root application element
 */
export default function App() {
  const [pathname, setPathname] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const navigate = React.useCallback((to) => {
    if (to === window.location.pathname) {
      return;
    }

    window.history.pushState({}, '', to);
    setPathname(to);
  }, []);

  const route = parseRoute(pathname);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-slate-950 border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            type="button"
            className="text-left"
            onClick={() => navigate('/')}
          >
            <h1 className="text-4xl font-bold font-syne text-emerald-400">ChainCrack</h1>
          </button>
          <p className="text-slate-400 mt-2 text-sm sm:text-base">Real-time word chain game with AI validation</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
        {route.page === 'home' && <Home navigate={navigate} />}
        {route.page === 'lobby' && <Lobby code={route.code} navigate={navigate} />}
        {route.page === 'game' && <Game code={route.code} navigate={navigate} />}
        {route.page === 'memory' && <Memory code={route.code} navigate={navigate} />}
        {route.page === 'reveal' && <Reveal code={route.code} navigate={navigate} />}
        {route.page === 'vote' && <Vote code={route.code} navigate={navigate} />}
        {route.page === 'results' && <Results gameId={route.gameId} navigate={navigate} />}
        {route.page === 'leaderboard' && <Leaderboard navigate={navigate} />}
        {route.page === 'replay' && <Replay gameId={route.gameId} navigate={navigate} />}
        {route.page === 'not-found' && (
          <div className="card mx-auto mt-8 max-w-xl text-center">
            <p className="font-syne text-xl text-white">Page not found</p>
            <button type="button" className="btn-primary mt-4" onClick={() => navigate('/')}>
              Back To Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
