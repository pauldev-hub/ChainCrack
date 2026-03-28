import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/**
 * PostCSS configuration
 * Processes Tailwind CSS and autoprefixes for cross-browser support
 * 
 * Fonts required (imported in index.css):
 * - Syne (headings, UI labels)
 * - Space Mono (game data, monospace)
 */
export default {
  plugins: [tailwindcss, autoprefixer],
};
