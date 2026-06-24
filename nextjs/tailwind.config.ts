import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f3fa',
          100: '#dae0f0',
          200: '#bcc6e4',
          300: '#8e9ed1',
          400: '#5f72bb',
          500: '#3f52a3',
          600: '#2f3d85',
          700: '#1a2340',
          800: '#121a30',
          900: '#0d1321',
        },
        gold: {
          50: '#fef7e6',
          100: '#fdebb8',
          200: '#fcdb85',
          300: '#f5c542',
          400: '#d4a017',
          500: '#b8860b',
          600: '#9a6f09',
          700: '#7c5907',
          800: '#5e4305',
          900: '#3f2d03',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Prompt', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
