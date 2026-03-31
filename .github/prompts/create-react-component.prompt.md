---
description: "Build a React component for ChainCrack UI. Use when creating game UI pieces like Timer, PlayerCard, ChainStep input, ScoreDisplay, or RoomCodeBadge."
name: "Create React Component"
argument-hint: "Component name and core purpose (e.g., 'PlayerCard to display player name and score')"
agent: "agent"
---

# React Component Creation

Build a production-ready React component for ChainCrack's game UI.

## File Location
- Components live in `packages/frontend/src/components/`
- **One component per file**, named `ComponentName.jsx`
- Export as default: `export default ComponentName`

## Structure & Props

### JSDoc Type Definition
Always define prop types with JSDoc at the top of the component file:
```javascript
/**
 * PlayerCard - Displays player info and real-time score
 * @component
 * @param {Object} props
 * @param {string} props.playerId - UUID of the player
 * @param {string} props.playerName - Display name
 * @param {number} props.score - Current score
 * @param {boolean} [props.isCurrentPlayer=false] - Highlight if current user
 * @param {Function} [props.onCardClick] - Callback when clicked
 * @returns {React.ReactElement}
 */
function PlayerCard({ playerId, playerName, score, isCurrentPlayer = false, onCardClick }) {
  // component logic
}
```

### Props Pattern
- **Required props** are destructured without defaults
- **Optional props** use `prop = defaultValue` in destructuring
- **Never mutate props** — use `useState` for local state
- **Event handlers** are optional callbacks passed from parent

## Styling with Tailwind

### Required Tailwind Config
Add these custom colors and fonts to `tailwind.config.js` before building components:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'emerald-400': '#63ffb4',  // Electric green — primary action
        'red-500': '#ff5c5c',       // Error red
      },
      fontFamily: {
        'syne': ['Syne', 'sans-serif'],        // Headings & UI
        'mono': ['Space Mono', 'monospace'],   // Game data & codes
      },
      backgroundColor: {
        'black': '#0a0a0f',  // Near-black background
      }
    }
  }
};
```
**Note:** Import these fonts in your CSS (Google Fonts or self-hosted).

### Color Palette (Terminal-Inspired, Cyberpunk)
Use these colors consistently across all components (terminal-inspired, cyberpunk aesthetic):
- **Primary (Game Action):** `text-emerald-400` / `bg-emerald-500` with `hover:bg-emerald-600` — electric green (#63ffb4) for submit, confirm, play, valid states
- **Secondary (Neutral):** `bg-slate-800` / `border-slate-700` — info containers, UI structure
- **Success:** `text-emerald-400` — valid submissions, chain progress (integrated with primary)
- **Warning/Neutral:** `text-slate-400` — pending, waiting, metadata
- **Error:** `text-red-500` / `bg-red-500` with `hover:bg-red-600` — (#ff5c5c) for invalid steps, timeouts, disconnects
- **Accent:** `text-emerald-400` — highlights, data indicators, glowing elements
- **Background:** `bg-black` / `bg-slate-950` — near-black (#0a0a0f) game board
- **Text:** `text-white` (primary), `text-slate-300` (secondary), `text-slate-500` (muted)

### Mobile-First Approach
1. **Base styles** apply to mobile (no breakpoint prefix)
2. **Progressive enhancement** with `sm:`, `md:`, `lg:` breakpoints
3. **Never use desktop-first** (`max-w-*` classes)

Example:
```javascript
<div className="flex flex-col gap-2 sm:gap-4 md:flex-row">
  <button className="w-full px-3 py-2 sm:w-auto md:px-4">
    Submit
  </button>
</div>
```

### Reusable Patterns
- **Containers:** `bg-slate-900 rounded-lg p-4 border border-slate-800`
- **Buttons:** `px-4 py-2 rounded font-semibold transition-colors` + `bg-emerald-500 hover:bg-emerald-600 text-black` (primary) or `bg-red-500 hover:bg-red-600 text-white` (error)
- **Inputs:** `px-3 py-2 bg-slate-900 text-white rounded border border-slate-700 focus:border-emerald-400 focus:outline-none`
- **Cards:** `bg-slate-900 rounded-lg p-4 border border-slate-800`
- **Badges/Pills:** `inline-block px-2 py-1 rounded text-xs font-bold bg-slate-800 text-emerald-400 border border-slate-700`
- **Chain Dots:** `w-2 h-2 rounded-full bg-emerald-400` (valid) or `bg-slate-600` (pending)
- **Glowing text:** `text-emerald-400 text-shadow glow-effect` for high-emphasis data

## Icons & Typography

### Font Stack
- **Headings & UI labels:** Use `font-syne` (Syne) — bold, geometric, cyberpunk vibe
- **Game data (words, codes, scores, timers):** Use `font-mono` (Space Mono) — monospace for "encrypted data" feel
- This sans/mono pairing is the core identity — data-driven and terminal-inspired

### Lucide React Icons
Import as needed from `lucide-react`:
```javascript
import { Play, Pause, Trophy, Clock, Users, Check, X } from 'lucide-react';

export default function Timer({ isRunning, seconds }) {
  return (
    <div className="flex items-center gap-2 text-emerald-400">
      <Clock size={20} />
      <span className="font-mono text-lg">{seconds}s</span>
    </div>
  );
}
```

**Common icons for ChainCrack:**
- `Trophy` — scores, winners, chain complete
- `Clock` — timers, urgency, countdown
- `Users` — player count, multiplayer
- `Copy` — room code copy, share
- `Check` — valid submission, success
- `X` — invalid, error, timeout
- `Send` — submit, action
- `Zap` — energy, live state, glowing accent

### Typography
- **Headings:** `text-xl sm:text-2xl font-bold font-syne text-white`
- **Body:** `text-base text-slate-300 font-syne`
- **Game Data:** `font-mono text-slate-200` (words, codes, scores—this is the hero)
- **Labels:** `text-sm text-slate-500 font-syne uppercase tracking-wide`
- **Glowing Data:** `font-mono text-emerald-400` (active/valid chain steps)

## Component Examples

### Timer Component (Cyberpunk Style)
```javascript
function Timer({ seconds, isActive }) {
  return (
    <div className={`px-4 py-2 rounded-lg font-mono text-lg font-bold transition-all ${
      isActive 
        ? 'bg-emerald-500 text-black animate-pulse border border-emerald-400' 
        : 'bg-slate-900 text-emerald-400 border border-slate-700'
    }`}>
      {seconds}s
    </div>
  );
}
```

### RoomCodeBadge Component (Encrypted Data)
```javascript
function RoomCodeBadge({ code, onCopy }) {
  return (
    <button
      onClick={onCopy}
      className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded border border-slate-700 hover:border-emerald-400 font-mono text-emerald-400 transition-colors"
    >
      <span className="text-sm">{code}</span>
      <Copy size={16} />
    </button>
  );
}
```

### Chain Step Component (Dot Connector)
```javascript
function ChainStep({ stepNumber, word, isValid, isCurrentStep }) {
  return (
    <div className="flex items-center">
      {stepNumber > 1 && (
        <div className="flex flex-col items-center mr-3">
          <div className={`w-1 h-8 ${isValid ? 'bg-emerald-400' : 'bg-slate-700'}`} />
          <div className={`w-2 h-2 rounded-full ${isValid ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        </div>
      )}
      <div className={`px-3 py-2 rounded-lg font-mono text-sm border ${
        isCurrentStep 
          ? 'bg-emerald-500 text-black border-emerald-400'
          : isValid
          ? 'bg-slate-900 text-emerald-400 border-slate-700'
          : 'bg-slate-900 text-slate-500 border-slate-700'
      }`}>
        {word}
      </div>
    </div>
  );
}
```

## State & Effects

- **Local state only** in components (no global state props)
- **Use `useEffect` for:** Socket.IO listeners, timers, animations
- **Clean up effects:** Always return cleanup function for listeners/timers
- **No infinite loops:** Include proper dependency arrays
- **No side effects in render:** Never call async functions or listeners in render code

## Real-time Updates via Socket.IO

Components receive updates as props from parent (typically a page/container). **Never connect components directly to Socket.IO**:

❌ Don't do this in a component:
```javascript
useEffect(() => {
  socket.on('score_updated', setScore);
}, [socket]);
```

✅ Do this in parent, pass to component:
```javascript
// In page/container
const [scores, setScores] = useState({});
useEffect(() => {
  socket.on('score_updated', (data) => setScores(data));
}, [socket]);

// Pass to component
<ScoreBoard scores={scores} />
```

## Implementation Checklist

- [ ] Component file: `packages/frontend/src/components/ComponentName.jsx`
- [ ] JSDoc types defined for all props (required + optional)
- [ ] Mobile-first Tailwind styles (base → sm/md/lg breakpoints)
- [ ] **Cyberpunk color palette applied** (emerald-400 primary, red-500 error, dark backgrounds)
- [ ] **Typography:** Headings use `font-syne`, game data uses `font-mono` (Space Mono)
- [ ] Lucide icons imported and sized appropriately, colored with emerald-400 or red-500
- [ ] No prop mutations or side effects in render
- [ ] `useEffect` cleanup functions included (if any)
- [ ] Fully responsive on mobile (320px), tablet (768px), desktop (1024px)
- [ ] No hardcoded strings — all text parameterized or from props
- [ ] Tested with sample props in parent component
- [ ] High-contrast dark background with glowing accent elements

## Related Patterns

- **Layout Pages:** Keep logic in pages, pass state down to components
- **Socket.IO Integration:** Parent components listen & update state, pass props to UI components
- **Reusable Buttons/Inputs:** Create utility components (Button.jsx, Input.jsx) if patterns repeat
