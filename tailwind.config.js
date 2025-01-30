/** @type {import('tailwindcss').Config} **/
module.exports = {
  content: ["./src/**/*.{js,jsx}",
    "./resources/**/*.{mp3,png,}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'hovesPro': ['HovesPro'],
      },
    },
  },
  plugins: [],
}

