/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0E0E0E',
        'bg-deep': '#0a0a0a',
        surface: '#161616',
        'surface-2': '#1E1E1E',
        gold: '#C9A84C',
        'gold-dim': 'rgba(201,168,76,0.18)',
        'text-primary': '#F0EDE6',
        'text-muted': '#888580',
        success: '#4CAF7D',
        danger: '#E05252',
        'border-dim': 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
