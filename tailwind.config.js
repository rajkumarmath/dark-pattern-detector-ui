/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        'dark': {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9de',
          300: '#b8b9c2',
          400: '#9294a1',
          500: '#767885',
          600: '#5f616d',
          700: '#4d4f59',
          800: '#3f4049',
          850: '#2d2e35',
          900: '#1e1f25',
          950: '#121318',
        },
        'primary': {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        'accent': {
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
        },
        'success': '#10b981',
        'warning': '#f59e0b',
        'danger': '#ef4444',
        'info': '#3b82f6',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 15s ease infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}