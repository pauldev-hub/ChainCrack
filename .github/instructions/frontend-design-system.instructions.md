---
description: "Use when building React components, styling UI, or implementing frontend design. Defines color palette, typography, component patterns, Tailwind config, icons, and responsive design for ChainCrack's cyberpunk terminal aesthetic."
applyTo: "packages/frontend/src/**/*.jsx"
---

# Frontend Design System

## Design Identity
- **Aesthetic:** Terminal-inspired, cyberpunk, competitive gaming
- **Theme:** Dark mode with electric accents
- **Typography Pairing:** Syne (geometric headings/UI) + Space Mono (monospace data/codes)
- **Interaction:** High contrast, glowing accents, real-time feedback

---

## Color Palette

### Core Colors (Cyberpunk Terminal)
| Use Case | Color | Hex | CSS Class |
|----------|-------|-----|-----------|
| **Primary Action** | Electric Green | `#63ffb4` | `bg-emerald-400` / `text-emerald-400` |
| **Secondary** | Slate Gray | `#1e293b` | `bg-slate-800` / `border-slate-700` |
| **Error/Alert** | Red | `#ff5c5c` | `bg-red-500` / `text-red-500` |
| **Background (Near-Black)** | Almost Black | `#0a0a0f` | `bg-black` / `bg-slate-950` |
| **Text Primary** | White | `#ffffff` | `text-white` |
| **Text Secondary** | Slate 300 | `#cbd5e1` | `text-slate-300` |
| **Text Muted** | Slate 500 | `#64748b` | `text-slate-500` |
| **Pending/Neutral** | Slate 600 | `#475569` | `bg-slate-600` / `text-slate-600` |

### Color Usage Rules
- **Valid/Success:** `text-emerald-400` (same as primary action)
- **Invalid/Error:** `text-red-500` or `bg-red-500` with `hover:bg-red-600`
- **Pending/Waiting:** `text-slate-400`
- **Accent/Highlight:** `text-emerald-400` (glowing effect)
- **Borders:** `border-slate-700` (dark, subtle)
- **Focus State:** `focus:border-emerald-400`

### Tailwind Configuration (tailwind.config.js)
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'emerald-400': '#63ffb4',  // Electric green — primary action
        'red-500': '#ff5c5c',      // Error red
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

### Font Import (CSS or Google Fonts)
```html
<!-- In index.html or main CSS -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

---

## Typography System

### Font Stack
| Element | Font | Weight | Size | Example |
|---------|------|--------|------|---------|
| **Page Heading** | Syne | Bold (700) | `text-3xl` / `text-4xl` | "ChainCrack", "Game Lobby" |
| **Section Heading** | Syne | Bold (700) | `text-xl` / `text-2xl` | "Players", "Leaderboard" |
| **UI Label** | Syne | Semibold (600) | `text-sm` | Button text, form labels |
| **Body Text** | Syne | Regular (400) | `text-base` | Instructions, descriptions |
| **Game Data** | Space Mono | Regular/Bold (400/700) | `text-sm` / `text-lg` | Words, codes, scores, timers |
| **Muted Text** | Syne | Regular (400) | `text-xs` | Metadata, timestamps, hints |

### Typography Classes
```css
/* Headings */
.heading-page = text-3xl sm:text-4xl font-bold font-syne text-white
.heading-section = text-xl sm:text-2xl font-bold font-syne text-white
.heading-card = text-lg font-bold font-syne text-white

/* Body */
.body-primary = text-base text-slate-300 font-syne
.body-secondary = text-sm text-slate-400 font-syne

/* Game Data (Monospace Hero) */
.data-game = font-mono text-slate-200 text-lg
.data-highlight = font-mono text-emerald-400 font-bold text-lg
.data-code = font-mono text-xs text-emerald-400 bg-slate-900 px-2 py-1 rounded

/* Labels & Metadata */
.label = text-xs text-slate-500 font-syne uppercase tracking-wide
.muted = text-xs text-slate-600 font-syne
```

---

## Component Patterns

### Button Patterns

#### Primary Action Button (Green)
```javascript
<button className="px-4 py-2 rounded font-semibold font-syne transition-colors bg-emerald-500 hover:bg-emerald-600 text-black">
  Submit Word
</button>
```
- **Hover Effect:** Darker green (`hover:bg-emerald-600`)
- **Active State:** Slight scale or glow
- **Disabled:** `opacity-50 cursor-not-allowed`

#### Error/Secondary Button (Red)
```javascript
<button className="px-4 py-2 rounded font-semibold font-syne transition-colors bg-red-500 hover:bg-red-600 text-white">
  Leave Game
</button>
```
- **Hover Effect:** Darker red (`hover:bg-red-600`)
- **Size Variants:** `px-3 py-1` (small), `px-6 py-3` (large)

#### Outline Button (Subtle)
```javascript
<button className="px-4 py-2 rounded font-semibold font-syne border border-slate-700 hover:border-emerald-400 text-slate-300 hover:text-emerald-400 transition-colors">
  Secondary Action
</button>
```
- **Border Color:** `border-slate-700`
- **Hover:** Border + text animate to emerald

---

### Card/Container Patterns

#### Standard Card
```javascript
<div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
  {/* content */}
</div>
```

#### Elevated Card (Highlighted)
```javascript
<div className="bg-slate-900 rounded-lg p-4 border border-emerald-400 shadow-lg shadow-emerald-400/20">
  {/* highlighted content */}
</div>
```

#### Dark Overlay Container
```javascript
<div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-slate-800">
  {/* modal/overlay content */}
</div>
```

---

### Input Patterns

#### Text Input
```javascript
<input
  type="text"
  className="px-3 py-2 rounded bg-slate-900 text-white border border-slate-700 focus:border-emerald-400 focus:outline-none transition-colors"
  placeholder="Enter word..."
/>
```

#### Textarea (Explanation Field)
```javascript
<textarea
  className="px-3 py-2 rounded bg-slate-900 text-white border border-slate-700 focus:border-emerald-400 focus:outline-none transition-colors resize-none"
  placeholder="Explain connection..."
  rows={3}
/>
```

#### Disabled Input
```javascript
<input
  disabled
  className="px-3 py-2 rounded bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
/>
```

---

### Badge/Pill Patterns

#### Success Badge (Valid)
```javascript
<span className="inline-block px-2 py-1 rounded text-xs font-bold bg-slate-800 text-emerald-400 border border-slate-700">
  Valid
</span>
```

#### Error Badge (Invalid)
```javascript
<span className="inline-block px-2 py-1 rounded text-xs font-bold bg-red-500/10 text-red-400 border border-red-700">
  Invalid
</span>
```

#### Pending Badge
```javascript
<span className="inline-block px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
  Pending
</span>
```

---

### Data Display Patterns

#### Game Code/Room Code (Monospace Hero)
```javascript
<div className="font-mono text-emerald-400 text-2xl font-bold tracking-wider bg-slate-950 px-4 py-2 rounded border border-slate-800">
  GAME-4A7F
</div>
```
- **Always monospace**
- **Always emerald-400**
- **Always on dark background**

#### Score Display
```javascript
<div className="flex flex-col items-center px-4 py-3 bg-slate-900 rounded-lg border border-slate-800">
  <p className="text-xs text-slate-500 font-syne uppercase">Score</p>
  <p className="font-mono text-3xl font-bold text-emerald-400">1250</p>
</div>
```

#### Progress Indicator (Chain Dots)
```javascript
<div className="flex items-center gap-2">
  {/* Valid step */}
  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
  {/* Pending step */}
  <div className="w-2 h-2 rounded-full bg-slate-600"></div>
  {/* Invalid step */}
  <div className="w-2 h-2 rounded-full bg-red-500"></div>
</div>
```

---

### Chain Step Component

#### Full Example: ChainStep.jsx
```javascript
/**
 * ChainStep - Displays a single word in the chain with visual connection
 * @component
 * @param {Object} props
 * @param {number} props.stepNumber - Position in chain (1, 2, 3...)
 * @param {string} props.word - The word to display
 * @param {boolean} [props.isValid] - Whether submission is valid
 * @param {boolean} [props.isCurrentStep=false] - Highlight if editing
 * @returns {React.ReactElement}
 */
function ChainStep({ stepNumber, word, isValid, isCurrentStep = false }) {
  return (
    <div className="flex items-center">
      {stepNumber > 1 && (
        <div className="flex flex-col items-center mr-3">
          {/* Connector line */}
          <div className={`w-1 h-8 ${isValid ? 'bg-emerald-400' : 'bg-slate-700'}`} />
          {/* Connector dot */}
          <div className={`w-2 h-2 rounded-full ${isValid ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        </div>
      )}
      {/* Word box */}
      <div
        className={`px-3 py-2 rounded-lg font-mono text-sm border transition-all ${
          isCurrentStep
            ? 'bg-emerald-500 text-black border-emerald-400'
            : isValid
            ? 'bg-slate-900 text-emerald-400 border-slate-700'
            : 'bg-slate-900 text-slate-500 border-slate-700'
        }`}
      >
        {word}
      </div>
    </div>
  );
}
```

---

## Icons (Lucide React)

### Installation
```bash
npm install lucide-react
```

### Common Icons for ChainCrack
```javascript
import {
  Trophy,      // Winners, scores, achievements
  Clock,       // Timers, countdown urgency
  Users,       // Player count, multiplayer
  Copy,        // Room code copy action
  Check,       // Valid submission, success
  X,           // Invalid, error, close
  Send,        // Submit action
  Zap,         // Live state, active, energy
  Play,        // Start game
  Pause,       // Pause/waiting
  ArrowRight,  // Next, forward, progression
  AlertCircle, // Warning, timeout
} from 'lucide-react';
```

### Icon Usage
```javascript
<Clock size={20} className="text-emerald-400" />
<Trophy size={24} className="text-emerald-400" />
<X size={16} className="text-red-500" />
```

**Sizing Convention:**
- Inline with text: `size={16}` or `size={20}`
- Card headers: `size={24}`
- Page elements: `size={32}`
- Always color with TW classes (`text-emerald-400`, `text-red-500`)

---

## Responsive Design (Mobile-First)

### Grid Breakpoints
| Breakpoint | Width | TW Prefix | Use Case |
|-----------|-------|-----------|----------|
| Mobile | 320px+ | (none) | Base styles |
| Tablet | 768px+ | `md:` | Medium screens |
| Desktop | 1024px+ | `lg:` | Large screens |

### Mobile-First Pattern
```javascript
// BASE (mobile): Full width, stacked
<div className="flex flex-col gap-2 w-full">
  {/* content */}
</div>

// MEDIUM: Side-by-side on tablet
<div className="flex flex-col gap-2 md:flex-row md:gap-4 w-full md:w-auto">
  {/* content */}
</div>

// LARGE: Multi-column on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* content */}
</div>
```

### Common Responsive Layout
```javascript
<div className="px-4 sm:px-6 md:px-8 py-6 max-w-4xl mx-auto">
  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Title</h1>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
    <Card />
    <Card />
  </div>
</div>
```

---

## Spacing & Sizing

### Tailwind Spacing Scale
```
gap/p/m: 1 (4px) → 2 (8px) → 4 (16px) → 6 (24px) → 8 (32px) → 12 (48px)
```

### Common Patterns
- **Page Padding:** `px-4 sm:px-6 md:px-8 py-6`
- **Card Padding:** `p-4`
- **Section Gap:** `gap-4 md:gap-6`
- **List Gap:** `gap-2`
- **Form Field Gap:** `gap-3`

---

## States & Animations

### Button States
```javascript
// Hover & Active
className="transition-all hover:scale-105 active:scale-95"

// Pulsing Animation (for urgent)
className="animate-pulse"

// Loading State
className="opacity-75 pointer-events-none"
```

### Glow Effect (Emerald)
```css
/* CSS in index.css or scoped */
.glow-emerald {
  box-shadow: 0 0 20px rgba(99, 255, 180, 0.4);
}
```

### Disabled State
```javascript
className={`opacity-50 cursor-not-allowed ${disabled ? 'pointer-events-none' : ''}`}
```

---

## Component Example: PlayerCard

```javascript
/**
 * PlayerCard - Displays player info and real-time score
 * @component
 * @param {Object} props
 * @param {string} props.playerId - UUID of player
 * @param {string} props.playerName - Display name
 * @param {number} props.score - Current score
 * @param {boolean} [props.isCurrentPlayer=false] - Highlight current user
 * @param {Function} [props.onCardClick] - Callback when clicked
 * @returns {React.ReactElement}
 */
import { Trophy } from 'lucide-react';

export default function PlayerCard({ playerId, playerName, score, isCurrentPlayer = false, onCardClick }) {
  return (
    <div
      onClick={onCardClick}
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isCurrentPlayer
          ? 'bg-emerald-500/10 border-emerald-400 shadow-lg shadow-emerald-400/20'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-syne uppercase">Player</p>
          <p className="text-lg font-bold font-syne text-white">{playerName}</p>
        </div>
        <Trophy size={20} className={isCurrentPlayer ? 'text-emerald-400' : 'text-slate-600'} />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 font-syne uppercase">Score</p>
        <p className="font-mono text-2xl font-bold text-emerald-400">{score}</p>
      </div>
    </div>
  );
}
```

---

## Component Example: SubmitWordForm

```javascript
/**
 * SubmitWordForm - Input form for word chain submission
 * @component
 * @param {Object} props
 * @param {Function} props.onSubmit - Callback with { word, explanation }
 * @param {boolean} [props.isLoading=false] - Disable during submission
 * @param {Array<string>} [props.excludeWords=[]] - Words to exclude (duplicates)
 * @returns {React.ReactElement}
 */
import { Send } from 'lucide-react';
import { useState } from 'react';

export default function SubmitWordForm({ onSubmit, isLoading = false, excludeWords = [] }) {
  const [word, setWord] = useState('');
  const [explanation, setExplanation] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (word.trim() && explanation.trim() && !excludeWords.includes(word)) {
      onSubmit({ word: word.trim(), explanation: explanation.trim() });
      setWord('');
      setExplanation('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-900 rounded-lg border border-slate-800">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-slate-500 font-syne uppercase">Word</label>
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 mt-1 rounded bg-slate-800 text-white border border-slate-700 focus:border-emerald-400 focus:outline-none transition-colors disabled:opacity-50"
            placeholder="Enter word..."
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-syne uppercase">Connection Explanation</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 mt-1 rounded bg-slate-800 text-white border border-slate-700 focus:border-emerald-400 focus:outline-none transition-colors resize-none disabled:opacity-50"
            placeholder="How does this word connect?"
            rows={3}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !word.trim() || !explanation.trim()}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black transition-colors"
        >
          <Send size={18} />
          Submit
        </button>
      </div>
    </form>
  );
}
```

---

## Component Example: Timer

```javascript
/**
 * Timer - Displays countdown with visual urgency
 * @component
 * @param {Object} props
 * @param {number} props.seconds - Remaining seconds
 * @param {boolean} [props.isActive=true] - Is timer running
 * @returns {React.ReactElement}
 */
import { Clock } from 'lucide-react';

export default function Timer({ seconds, isActive = true }) {
  const isUrgent = seconds < 30; // Red when < 30 sec

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold transition-all ${
        isActive && isUrgent
          ? 'bg-red-500 text-white animate-pulse border border-red-400'
          : isActive
          ? 'bg-emerald-500 text-black border border-emerald-400'
          : 'bg-slate-900 text-emerald-400 border border-slate-700'
      }`}
    >
      <Clock size={20} />
      <span>{seconds}s</span>
    </div>
  );
}
```

---

## Accessibility & Performance

### Accessibility Checklist
- [ ] All buttons have clear labels or aria-labels
- [ ] Color not the only indicator (use icons + text)
- [ ] Sufficient contrast: emerald-400 on black ✓, use `text-white` for body
- [ ] Focus states visible: `focus:border-emerald-400`
- [ ] Form inputs have associated labels
- [ ] Keyboard navigation supported

### Performance Tips
- [ ] Lazy load heavy components
- [ ] Memoize expensive renders: `React.memo(Component)`
- [ ] Use `useCallback` for event handlers passed to children
- [ ] Avoid inline functions in render
- [ ] Import only needed Lucide icons

---

## Implementation Checklist

- [ ] Tailwind config extended with Syne & Space Mono fonts + custom colors
- [ ] Both fonts imported from Google Fonts or self-hosted
- [ ] All buttons use btn class pattern (primary/secondary/outline)
- [ ] All text uses appropriate font: Syne (UI), Space Mono (data)
- [ ] Color palette respected: emerald-400 (action), red-500 (error)
- [ ] Dark background applied: `bg-black` or `bg-slate-950`
- [ ] Cards follow pattern: `bg-slate-900 rounded-lg border border-slate-800`
- [ ] Icons from lucide-react, sized & colored correctly
- [ ] Mobile-first responsive design (base → sm → md → lg)
- [ ] Focus states visible: `focus:border-emerald-400`
- [ ] All states covered: hover, active, disabled, loading
- [ ] Component examples tested with sample props
- [ ] No hardcoded colors outside TW classes (use CSS vars)

---

## Related Patterns

- **Hooks:** Real-time state sync via `useSocket.js`
- **Services:** Socket.IO communication in `socketService.js`
- **Pages:** Layout & data flow orchestration in `pages/`
- **API:** REST calls in `apiClient.js`
