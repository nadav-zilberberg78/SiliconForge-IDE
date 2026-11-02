// Menu bar, keyboard shortcuts and the Settings dialog's generated pages.
const extensionActions = () => Object.keys(ACTIONS).filter((a) => a.startsWith('ext:'));
const inEditor = (id) => () => {
  if (!editor?.getModel()) return setTask('Open a file first.'); // Monaco ignores its actions without a file
  editor.focus();
  editor.trigger('menu', id, null);
};

function zoomBy(step) {
  settings.uiScale = step ? Math.min(200, Math.max(70, +settings.uiScale + step)) : 100;
  persist();
  syncControls();
  applySettings();
}

Object.assign(ACTIONS, {
  stop: () => sf.stop(),
  changeBoard: () => openWizard('change'),
  undo: inEditor('undo'), redo: inEditor('redo'), find: inEditor('actions.find'), replace: inEditor('editor.action.startFindReplaceAction'),
  gotoLine: inEditor('editor.action.gotoLine'), comment: inEditor('editor.action.commentLine'), palette: inEditor('editor.action.quickCommand'),
  zoomIn: () => zoomBy(10), zoomOut: () => zoomBy(-10), zoomReset: () => zoomBy(0),
  extensions: () => openExtensions(),
  appearance: () => openSettings('appearance'), customizeToolbar: () => openSettings('toolbar'), shortcuts: () => openSettings('shortcuts'),
  devtools: () => sf.toggleDevTools(),
});

const ACTION_LABELS = {
  new: 'New project', open: 'Open folder', save: 'Save all', examples: 'Examples', settings: 'Settings', verify: 'Verify', upload: 'Upload', stop: 'Stop task',
  libraries: 'Library Manager', boards: 'Boards Manager', changeBoard: 'Change board or options', serial: 'Serial monitor', plotter: 'Plotter',
  sidebar: 'Show files', panel: 'Show bottom panel', palette: 'Command palette', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Reset zoom',
  undo: 'Undo', redo: 'Redo', find: 'Find', replace: 'Find and replace', gotoLine: 'Go to line', comment: 'Comment line',
  extensions: 'Manage extensions', appearance: 'Colors and layout', customizeToolbar: 'Toolbar buttons', shortcuts: 'Keyboard shortcuts', devtools: 'Developer tools',
};
// Monaco already handles these while typing; they are shown in menus, not captured, so Ctrl+Z still works in text boxes.
const EDITOR_KEYS = { undo: 'Ctrl+Z', redo: 'Ctrl+Y', find: 'Ctrl+F', replace: 'Ctrl+H', gotoLine: 'Ctrl+G', comment: 'Ctrl+/' };
const actionItem = (action) => ({ label: ACTION_LABELS[action], run: ACTIONS[action], key: keyOf(action) || EDITOR_KEYS[action] });
const settingItem = (key, label) => ({
  label, checked: () => !!settings[key],
  run: () => { settings[key] = !settings[key]; persist(); syncControls(); applySettings(); },
});
const choiceItem = (key, value, label) => ({
  label, radio: true, checked: () => settings[key] === value,
  run: () => { settings[key] = value; persist(); syncControls(); applySettings(); },
});

const MENUS = () => [
  ['File', [
    ...['new', 'open', 'examples'].map(actionItem),
    ...(settings.recent.length ? ['-', { heading: 'Recent projects' }, ...settings.recent.map((p) => ({ label: p.split(/[\\/]/).pop(), title: p, run: () => openProject(p) }))] : []),
    '-', actionItem('save'), '-', actionItem('settings'),
  ]],
  ['Edit', [...['undo', 'redo'].map(actionItem), '-', ...['find', 'replace', 'gotoLine'].map(actionItem), '-', actionItem('comment')]],
  ['Sketch', [...['verify', 'upload', 'stop'].map(actionItem), '-', actionItem('libraries')]],
  ['Tools', [
    ...['boards', 'changeBoard'].map(actionItem), '-', ...['serial', 'plotter'].map(actionItem), '-', actionItem('palette'),
    settingItem('lint', 'Check code while typing and on save'),
  ]],
  ['View', [
    ...['sidebar', 'panel'].map(actionItem).map((item, i) => ({ ...item, checked: () => settings[['sidebar', 'panel'][i]] })),
    settingItem('statusBar', 'Show status bar'), settingItem('minimap', 'Show minimap'), settingItem('wordWrap', 'Wrap long lines'), settingItem('lineNumbers', 'Show line numbers'),
    '-', ...['zoomIn', 'zoomOut', 'zoomReset'].map(actionItem), '-', actionItem('devtools'),
  ]],
  ['Customize', [
    { heading: 'Theme' }, ...sfTheme.THEMES.map((t) => choiceItem('theme', t.id, t.label)),
    '-', { heading: 'Spacing' }, choiceItem('density', 'comfortable', 'Comfortable'), choiceItem('density', 'compact', 'Compact'),
    '-', ...['appearance', 'customizeToolbar', 'shortcuts'].map(actionItem),
  ]],
  ['Extensions', [
    actionItem('extensions'),
    ...(extensionActions().length ? ['-', ...extensionActions().map(actionItem)] : []),
  ]],
  ['Help', [actionItem('shortcuts'), actionItem('palette')]],
];

// ---------- Menu bar ----------
const menubar = $('#menubar');
const popup = $('#menu-pop');
let openIndex = -1;

function closeMenu(refocus) {
  const button = menubar.children[openIndex];
  popup.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
  openIndex = -1;
  if (refocus) button?.focus();
}

function renderItem(item) {
  if (item === '-') return Object.assign(document.createElement('div'), { className: 'menu-sep', role: 'separator' });
  if (item.heading) return Object.assign(document.createElement('div'), { className: 'menu-heading', textContent: item.heading });
  const b = Object.assign(document.createElement('button'), { type: 'button', tabIndex: -1, title: item.title ?? '' });
  b.setAttribute('role', item.checked ? (item.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem');
  if (item.checked) b.setAttribute('aria-checked', !!item.checked());
  b.append(Object.assign(document.createElement('span'), { className: 'menu-tick' }), Object.assign(document.createElement('span'), { textContent: item.label }));
  if (item.key) b.append(Object.assign(document.createElement('kbd'), { textContent: item.key }));
  b.onclick = () => { closeMenu(); item.run(); };
  return b;
}

function openMenu(index, focusFirst) {
  closeMenu();
  const [, items] = MENUS()[index];
  popup.replaceChildren(...items.map(renderItem));
  const button = menubar.children[index];
  popup.style.left = `${button.getBoundingClientRect().left}px`;
  popup.style.top = `${button.getBoundingClientRect().bottom}px`;
  popup.setAttribute('aria-label', button.textContent);
  popup.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  openIndex = index;
  if (focusFirst) popup.querySelector('button')?.focus();
}

MENUS().forEach(([name], i) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: name });
  b.setAttribute('role', 'menuitem');
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.onclick = () => (openIndex === i ? closeMenu() : openMenu(i));
  b.onpointerenter = () => { if (openIndex >= 0 && openIndex !== i) openMenu(i); };
  menubar.append(b);
});

menubar.onkeydown = (e) => {
  const buttons = [...menubar.children];
  const i = buttons.indexOf(document.activeElement);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length].focus();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    openMenu(i, true);
  }
};

popup.onkeydown = (e) => {
  const items = [...popup.querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
  if (step) {
    e.preventDefault();
    items[(i + step + items.length) % items.length].focus();
  } else if (e.key === 'Escape') {
    closeMenu(true);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const n = menubar.children.length;
    openMenu((openIndex + (e.key === 'ArrowRight' ? 1 : -1) + n) % n, true);
  }
};

window.addEventListener('pointerdown', (e) => { if (openIndex >= 0 && !popup.contains(e.target) && !menubar.contains(e.target)) closeMenu(); });
window.addEventListener('blur', () => closeMenu());

// ---------- Settings dialog ----------
function selectSettingsPage(name) {
  document.querySelectorAll('[data-stab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.stab === name));
  document.querySelectorAll('[data-spage]').forEach((p) => { p.hidden = p.dataset.spage !== name; });
}
document.querySelectorAll('[data-stab]').forEach((b) => { b.onclick = () => selectSettingsPage(b.dataset.stab); });

function openSettings(page = 'appearance') {
  renderThemeChoices();
  renderToolChoices();
  renderShortcuts();
  syncControls();
  selectSettingsPage(page);
  if (!$('#settings').open) $('#settings').showModal();
}

function renderThemeChoices() {
  $('#s-themes').replaceChildren(...sfTheme.THEMES.map((t) => {
    const label = Object.assign(document.createElement('label'), { className: 'theme-swatch' });
    const [chrome, accent, editorColor] = t.swatch ?? [t.colors.mask, t.colors.gold, t.colors.substrate];
    label.style.setProperty('--swatch', `linear-gradient(90deg, ${chrome} 60%, ${accent ?? '#888888'} 60% 72%, ${editorColor ?? chrome} 72%)`);
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'theme', value: t.id });
    input.dataset.setting = 'theme';
    label.append(input, Object.assign(document.createElement('span'), { textContent: t.label }));
    return label;
  }));
}

function renderToolChoices() {
  $('#s-tools').replaceChildren(...TOOLS.map(([id, text]) => {
    const label = Object.assign(document.createElement('label'), { className: 'switch' });
    const input = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !settings.hiddenTools.includes(id) });
    input.setAttribute('role', 'switch');
    input.onchange = () => {
      settings.hiddenTools = input.checked ? settings.hiddenTools.filter((t) => t !== id) : [...settings.hiddenTools, id];
      persist();
      applySettings();
    };
    label.append(input, text);
    return label;
  }));
}

$('#s-accent-reset').onclick = () => { settings.accent = ''; persist(); applySettings(); syncControls(); };
$('#s-reset').onclick = () => {
  if (!confirm('Reset every setting and shortcut to its default? Your projects are not affected.')) return;
  settings = { ...DEFAULTS, recent: settings.recent, enabledExtensions: settings.enabledExtensions };
  persist();
  applySettings();
  openSettings();
};

// ---------- Shortcut editor ----------
function renderShortcuts() {
  $('#s-keys').replaceChildren(...Object.keys(ACTIONS).filter((a) => ACTION_LABELS[a] && !EDITOR_KEYS[a]).map((action) => {
    const row = document.createElement('li');
    const set = Object.assign(document.createElement('button'), { type: 'button', textContent: keyOf(action) || 'Not set' });
    set.onclick = () => {
      set.textContent = 'Press keys, or Esc to cancel';
      keyCapture = (e) => {
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        keyCapture = null;
        if (e.key !== 'Escape') {
          const combo = comboOf(e);
          if (combo) {
            for (const other of boundActions()) if (keyOf(other) === combo) settings.keys[other] = ''; // a key does one thing
            settings.keys[action] = combo;
            persist();
          }
        }
        renderShortcuts();
      };
    };
    const reset = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Reset', hidden: !(action in settings.keys) });
    reset.onclick = () => { delete settings.keys[action]; persist(); renderShortcuts(); };
    row.append(Object.assign(document.createElement('span'), { textContent: ACTION_LABELS[action] }), set, reset);
    return row;
  }));
}
