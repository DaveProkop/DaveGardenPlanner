/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        garden: {
          50:  '#F0F4E8',
          100: '#DDE8CC',
          200: '#BBCF9B',
          500: '#4A7C3F',
          600: '#3D6833',
          700: '#2D5016',
          800: '#1E3510',
        }
      }
    }
  },
  plugins: []
}
