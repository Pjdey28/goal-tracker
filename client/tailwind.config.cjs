module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  safelist: [
    /^bg-/,
    /^text-/,
    /^hover:bg-/,
    /^dark:/,
    /^shadow-/,
    /^rounded-/,
    /^p-/,
    /^m-/,
    /^w-/,
    /^h-/,
    /^grid-/,
    /^flex-/,
    /^items-/,
    /^justify-/,
    /^max-w-/,
    /^min-h-/,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
