/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#070812',
        surface: '#0B1020',
        's2': '#101729',
        's3': '#141D33',
        ist: {
          50:  '#EDF7FA',
          100: '#D5ECF2',
          200: '#A8D5E2',
          300: '#7CBBD0',
          400: '#5A9AB1',
          500: '#427A91',
          600: '#286680',
          700: '#155A72',
          800: '#0F455C',
          900: '#0A3346',
          950: '#061D2A',
        },
        success: '#46D39A',
        warning: '#F6C85F',
        danger: '#FF6B7A',
        info: '#5AA7FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.25rem',
      },
      boxShadow: {
        'glow': '0 0 42px rgba(90,154,177,0.28)',
        'glow-sm': '0 0 24px rgba(90,154,177,0.18)',
        'glow-lg': '0 0 60px rgba(90,154,177,0.36)',
        'deep': '0 28px 90px rgba(0,0,0,0.46)',
        'card': '0 18px 50px rgba(0,0,0,0.34)',
        'card-sm': '0 8px 24px rgba(0,0,0,0.22)',
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(255,255,255,0.105) 0%, rgba(255,255,255,0.035) 100%)',
        'gradient-progress': 'linear-gradient(90deg, #7CBBD0 0%, #286680 100%)',
        'gradient-hero': 'radial-gradient(circle at 20% 10%, rgba(90,154,177,0.28) 0%, transparent 34%), radial-gradient(circle at 80% 20%, rgba(40,102,128,0.22) 0%, transparent 32%), linear-gradient(135deg, #070812 0%, #0B1020 52%, #061D2A 100%)',
        'gradient-teal': 'linear-gradient(135deg, #155A72 0%, #0F455C 50%, #061D2A 100%)',
        'gradient-navy': 'linear-gradient(135deg, #0A3346 0%, #070812 100%)',
      },
    },
  },
  plugins: [],
}
