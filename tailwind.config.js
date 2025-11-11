/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // STRI Brand Colors
      colors: {
        'stri': {
          'teal': '#00BFB8',          // Pantone 3262 - Primary brand color
          'teal-light': '#71DCDF',    // Pantone 3242 - Secondary/hover
          'blue-deep': '#4E6584',     // Pantone 7693 - Professional blue
          'green-success': '#8ED8B2', // Pantone 344 - Success states
          'green-growth': '#43B12E',  // Pantone 361 - Growth/design
          'yellow': '#E2E200',        // Pantone 396 - Attention/build
          'blue-info': '#00B6ED',     // Pantone 306 - Info/plan
          'blue-research': '#0072BC', // Pantone 3005 - Research sub-brand
          'grey-dark': '#545860',     // Cool Grey 11 - Primary text
          'grey': '#A7A8AA',          // Cool Grey 6 - Secondary text/borders
        },
      },
      // STRI Brand Typography
      fontFamily: {
        'sans': ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
        'montserrat': ['Montserrat', 'sans-serif'],
      },
      fontWeight: {
        'light': 300,
        'normal': 400,
        'book': 400,
        'medium': 500,
        'semibold': 600,
        'bold': 700,
      },
    },
  },
  plugins: [],
}
