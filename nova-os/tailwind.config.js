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
        nova: {
          bg: '#05080d',
          bgElevated: '#0a1018',
          border: '#1a2533',
          borderBright: '#2a3a4a',
          text: '#e8f4f8',
          textMuted: '#6b8a99',
          textDim: '#3a5a6a',
          cyan: '#55E8FF',
          teal: '#55FFD1',
          violet: '#9A8CFF',
          amber: '#FFB84D',
          amberDim: '#ffb84d40',
          red: '#FF4D6A',
          redDim: '#ff4d6a40',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse': 'spin 15s linear infinite reverse',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 2s ease-in-out infinite',
        'particle': 'particle 8s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { opacity: '0.3' },
          '100%': { opacity: '0.8' },
        },
        scan: {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        particle: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '0.3' },
          '50%': { opacity: '0.8' },
          '100%': { transform: 'translateY(-100vh) rotate(360deg)', opacity: '0' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 30px #55E8FF40, 0 0 60px #55E8FF20',
        'glow-teal': '0 0 30px #55FFD140, 0 0 60px #55FFD120',
        'glow-violet': '0 0 30px #9A8CFF40, 0 0 60px #9A8CFF20',
        'glow-amber': '0 0 30px #FFB84D40, 0 0 60px #FFB84D20',
        'inner-glow': 'inset 0 0 30px #55E8FF20',
      },
    },
  },
  plugins: [],
}