/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'emerald-400': '#63ffb4',  // Electric green — primary action
        'red-500': '#ff5c5c',       // Error red
      },
      fontFamily: {
        'syne': ['Syne', 'sans-serif'],           // Headings & UI labels
        'mono': ['Space Mono', 'monospace'],      // Game data, codes, timers
      },
      backgroundColor: {
        'black': '#0a0a0f',  // Near-black background
      },
    },
  },
  plugins: [],
};
