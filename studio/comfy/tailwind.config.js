import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const canvasRoot = path.resolve(__dirname, '../../canvas')
const overridesRoot = path.resolve(__dirname, 'overrides')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(canvasRoot, 'index.html'),
    path.join(canvasRoot, 'src/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(overridesRoot, 'src/**/*.{vue,js,ts,jsx,tsx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
    },
  },
  plugins: [],
}
