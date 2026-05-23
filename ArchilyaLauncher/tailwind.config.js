/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Manrope', 'sans-serif'],
      },
      colors: {
        archilya: {
          dark: '#0a0a0a',      // Vantablack
          panel: '#141414',     // Koyu Panel
          gold: '#D4AF37',      // Lüks Altın
          'gold-dim': '#8a701e', // Sönük Altın
          text: '#e0e0e0',      // Ana Metin
          'text-dim': '#666666' // Pasif Metin
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'subtle-gradient': 'linear-gradient(to bottom right, #141414, #0a0a0a)',
      }
    },
  },
  plugins: [],
}
