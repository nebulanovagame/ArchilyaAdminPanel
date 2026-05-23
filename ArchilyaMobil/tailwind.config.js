/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#0f1115',
        surface: '#1a1c23',
        primary: '#c6a87c', // Matte Gold
        secondary: '#2a2d36',
      },
    },
  },
  plugins: [],
}
