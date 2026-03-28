/**
 * Root React component
 * 
 * Main application wrapper with routing and Socket.IO connection
 * Cyberpunk dark theme with emerald accents
 * 
 * @file packages/frontend/src/App.jsx
 */

import React from 'react';

/**
 * App Component
 * 
 * @returns {JSX.Element} Root application element
 */
export default function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-slate-950 border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold font-syne text-emerald-400">ChainCrack</h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base">Real-time word chain game with AI validation</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-16">
          <p className="text-slate-300 text-lg font-syne">Welcome to ChainCrack</p>
          <p className="text-slate-500 mt-2 text-sm font-mono">Build the shortest word chain between two words</p>
        </div>
      </main>
    </div>
  );
}
