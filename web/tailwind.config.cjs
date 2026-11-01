/** Tailwind 3.4 (v4 needs Safari 16.4+/Chrome 111+ which old WebViews lack). Colours are CSS variables
 * (src/styles/main.css) so the dark theme switches without rebuilding classes. */
const v = (name) => `var(--c-${name})`
module.exports = {
  content: [__dirname + '/index.html', __dirname + '/src/**/*.{vue,ts}'],
  darkMode: ['variant', '.dark &'], // plain descendant selector (the default uses :is() which old WebViews lack)
  theme: {
    screens: { sm: '640px', md: '900px', lg: '1200px' },
    extend: {
      colors: {
        primary: v('primary'), 'primary-soft': v('primary-soft'), accent: v('accent'), bg: v('bg'), surface: v('surface'),
        surface2: v('surface2'), fg: v('fg'), muted: v('muted'), line: v('line'), highlight: v('highlight'), error: v('error'),
        link: v('link'), si: v('si'), pi: v('pi'), en: v('en'),
      },
      fontFamily: { ui: ['var(--font-ui)'], text: ['var(--font-text)'] },
    },
  },
  // opacity utilities emit rgb(r g b / a) and css variables that old WebViews do not support
  corePlugins: { backgroundOpacity: false, textOpacity: false, borderOpacity: false, divideOpacity: false, placeholderOpacity: false, ringOpacity: false },
}
