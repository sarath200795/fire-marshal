/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f5',
          100: '#ffe3e3',
          200: '#ffc9c9',
          300: '#ffa8a8',
          400: '#ff6b6b',
          500: '#f73838',
          600: '#e11d1d',
          700: '#bd1414',
          800: '#9c1414',
          900: '#7f1818',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d9e2',
          300: '#aeb7c7',
          400: '#8290a8',
          500: '#62718c',
          600: '#4d5a73',
          700: '#3f495d',
          800: '#373f4f',
          900: '#1c2230',
          950: '#11151d',
        },
        // Warm coral-clay neutrals: peach/ivory base so raised "clay" surfaces pop
        // while keeping the brand (coral) identity for accents.
        clay: {
          bg: '#f2e8e2',
          surface: '#fbf4ef',
          50: '#fdf8f5',
          100: '#f7ede7',
          200: '#efe0d7',
          300: '#e3ccbf',
          400: '#d3b3a3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        clay: '1.5rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(247,56,56,0.15), 0 10px 40px -10px rgba(247,56,56,0.35)',
        card: '0 1px 2px rgba(16,24,40,0.06), 0 12px 32px -12px rgba(16,24,40,0.18)',
        // Claymorphism (refined/subtle), warm-tinted: dark bottom-right drop +
        // light top-left highlight. Inset variants for recessed inputs/pressed.
        clay: '6px 6px 14px rgba(190,160,148,0.40), -6px -6px 14px rgba(255,255,255,0.90)',
        'clay-sm': '3px 3px 8px rgba(190,160,148,0.35), -3px -3px 8px rgba(255,255,255,0.85)',
        'clay-inset':
          'inset 4px 4px 8px rgba(190,160,148,0.40), inset -4px -4px 8px rgba(255,255,255,0.90)',
        'clay-pressed':
          'inset 5px 5px 10px rgba(190,160,148,0.50), inset -4px -4px 8px rgba(255,255,255,0.80)',
        'clay-brand':
          '5px 5px 12px rgba(247,56,56,0.28), -5px -5px 12px rgba(255,255,255,0.75)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(247,56,56,0.5)' },
          '70%': { boxShadow: '0 0 0 14px rgba(247,56,56,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(247,56,56,0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        float: 'float 6s ease-in-out infinite',
        pulseRing: 'pulseRing 2s infinite',
      },
    },
  },
  plugins: [],
}
