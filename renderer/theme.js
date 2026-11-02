// Theme data shared by the page and the extension validator. Plain script in the page, CommonJS in main and the tests.
(function (exports) {
  // Colors a theme may set; style.css defines them for the built-in themes.
  const THEME_TOKENS = [
    'substrate', 'mask', 'mask-raised', 'edge', 'silk', 'silk-dim', 'silk-faint', 'gold', 'gold-hi', 'gold-ink',
    'string', 'number', 'type', 'preproc', 'err', 'warn', 'ok',
  ];

  const THEMES = [
    { id: 'purple', label: 'Purple mask', swatch: ['#231b3a', '#e8bd63', '#181228'] },
    { id: 'green', label: 'Green mask', swatch: ['#123023', '#e8bd63', '#0b2017'] },
    { id: 'blue', label: 'Blue mask', swatch: ['#132a43', '#f0c04f', '#0c1c2f'] },
    { id: 'black', label: 'Black mask', swatch: ['#1f2228', '#d4dbe3', '#17191e'] },
    { id: 'schematic', label: 'Schematic', swatch: ['#eceff5', '#0f5fa8', '#fbfcfe'] },
  ];

  const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  function luminance(hex) {
    const [r, g, b] = channels(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // WCAG contrast ratio of two #rrggbb colors.
  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Everything that follows from a user's accent color, with text that stays readable on it.
  function accentPalette(hex) {
    const hi = `#${channels(hex).map((v) => Math.round(v + (255 - v) * 0.2).toString(16).padStart(2, '0')).join('')}`;
    const ink = contrast(hex, '#ffffff') >= contrast(hex, '#14161a') ? '#ffffff' : '#14161a';
    return { gold: hex, 'gold-hi': hi, 'gold-ink': ink, selection: `${hex}40` };
  }

  Object.assign(exports, { THEME_TOKENS, THEMES, contrast, accentPalette });
})(typeof module === 'object' ? module.exports : (window.sfTheme = {}));
