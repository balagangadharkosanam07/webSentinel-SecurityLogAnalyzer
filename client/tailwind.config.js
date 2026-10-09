/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        soc: {
          bg: '#070b14',          // Deepest background
          card: '#0d1527',        // Surface / Card background
          surface: '#111d35',     // Elevated card / input background
          border: '#1e293b',      // Subdued border
          borderLight: '#334155', // Hover / active border
          accent: '#06b6d4',      // SOC Cyan accent
          accentHover: '#0891b2', // Darker cyan
          cyanGlow: 'rgba(6, 182, 212, 0.15)',
        },
        severity: {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#f59e0b',
          low: '#3b82f6',
          info: '#94a3b8',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
