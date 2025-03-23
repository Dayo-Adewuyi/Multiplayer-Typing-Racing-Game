/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        'secondary': {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        'racing': {
          'asphalt': '#1e1e24',
          'lane': '#2a2a2f', 
          'marking': '#dddddd',
          'highlight': '#ffcc00',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
        'display': ['Racing Sans One', 'ui-sans-serif', 'system-ui']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-limited': 'bounce 1s ease-in-out 2',
        'slide-in': 'slideIn 0.5s ease-out',
        'count-down': 'countDown 1s linear forwards',
        'car-move': 'carMove 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        countDown: {
          '0%': { transform: 'scale(2)', opacity: 0 },
          '20%': { transform: 'scale(1.5)', opacity: 1 },
          '80%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(0.5)', opacity: 0 },
        },
        carMove: {
          '0%': { transform: 'translateX(0) skewX(0deg)' },
          '30%': { transform: 'translateX(2px) skewX(5deg)' },
          '100%': { transform: 'translateX(0) skewX(0deg)' },
        }
      },
      boxShadow: {
        'neon': '0 0 5px theme(colors.primary.400), 0 0 20px theme(colors.primary.300)',
        'winner': '0 0 10px theme(colors.racing.highlight), 0 0 20px theme(colors.racing.highlight)',
      },
      backgroundImage: {
        'track-pattern': "url('/src/assets/images/tracks/track-bg.png')",
        'finish-line': "url('/src/assets/images/tracks/finish-line.png')",
        'confetti': "url('/src/assets/images/effects/confetti.png')",
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}


