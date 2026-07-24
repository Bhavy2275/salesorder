/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
      animation: {
        'in': 'fadeIn 0.2s ease-out',
        'slide-in-from-right': 'slideInFromRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideInFromRight: { from: { transform: 'translateX(40px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
};
