module.exports = {
  mode: 'jit',
  content: ['./views/**/*.ejs', './public/css/**/*.css'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
