/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'wave': 'wave 8s ease-in-out infinite',
        'wave-reverse': 'wave 8s ease-in-out infinite reverse',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': {
            transform: 'translateY(0) scale(1)',
            opacity: '0.2',
          },
          '50%': {
            transform: 'translateY(-20px) scale(1.1)',
            opacity: '0.3',
          },
        },
        pulse: {
          '0%, 100%': {
            opacity: '0.2',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '0.3',
            transform: 'scale(1.1)',
          },
        },
      },
    },
  },
  plugins: [],
} 