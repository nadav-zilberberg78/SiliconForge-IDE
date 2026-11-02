const $ = (s) => document.querySelector(s);
const LANG_LABELS = { cpp: 'C++ (Arduino)', c: 'C', rust: 'Rust', python: 'MicroPython' };
const LANG_DETAILS = { cpp: 'C++ (Arduino sketch, library support)', c: 'C (bare-metal or vendor SDK)', rust: 'Rust (embedded, defmt logging)', python: 'MicroPython' };
const cleanIpcError = (e) => e.message.replace(/^Error invoking remote method '[\w-]+': (Error: )?/, '');

let editor = null;
let root = null;
let project = null; // parsed siliconforge.json of the open project
let current = null;
let busy = false;
const models = new Map(); // file path -> Monaco model
const diags = new Map(); // file path -> build diagnostics
const lintDiags = new Map(); // file path -> diagnostics of the last background check
let boards = [];

// ---------- Settings (per-user conveniences, so localStorage is enough) ----------
const DEFAULTS = {
  theme: 'purple', accent: '', density: 'comfortable', corners: '4', uiScale: 100, uiFont: '', sidebarSide: 'left', sidebarWidth: 240,
  streamSize: 12.5, statusBar: true, iconsOnly: false, hiddenTools: [], keys: {}, enabledExtensions: [],
  fontSize: 14, tabSize: '4', wordWrap: false, minimap: true, lineNumbers: true, codeFont: '', lineHeight: 0, ligatures: true,
  cursorStyle: 'line', cursorBlink: 'smooth', whitespace: 'selection', bracketColors: true, autoClose: true, stickyScroll: false, smoothCaret: true,
  autoSave: true, clearConsole: true, monitorAfterUpload: true,
  sidebar: true, panel: true, panelHeight: 280,
  baud: '115200', frame: '8N1', lineEnding: 'lf', timestamps: false, autoscroll: true, hex: false,
  plotAxis: 'channel', plotWindow: '500', recent: [], lint: true, boardUrls: '', projectsDir: '',
};
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sf-settings')) }; } catch {}
const persist = () => { try { localStorage.setItem('sf-settings', JSON.stringify(settings)); } catch {} };

function syncControls() {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const v = settings[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = v;
    else if (el.type === 'radio') el.checked = el.value === v;
    else if (el.type === 'color') el.value = v || css('--gold');
    else el.value = v;
  });
}

// delegated, because the theme choices are generated
document.addEventListener('change', ({ target: el }) => {
  const key = el.dataset?.setting;
  if (!key) return;
  settings[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? +el.value : el.value;
  persist();
  applySettings();
  if (key === 'lint') checkProject();
  if (key === 'lint' || key === 'baud') models.forEach(quickLint);
  if ((key === 'baud' || key === 'frame') && port) serialReconnect();
});

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const TOOLS = [
  ['new', 'New'], ['open', 'Open'], ['save', 'Save'], ['open-examples', 'Examples'], ['open-libraries', 'Libraries'], ['open-boards', 'Boards'],
  ['verify', 'Verify'], ['upload', 'Upload'], ['stop', 'Stop'], ['board-badge', 'Board'], ['port-wrap', 'Port'],
];

function applyLook() {
  const html = document.documentElement;
  const theme = sfTheme.THEMES.find((t) => t.id === settings.theme) ?? sfTheme.THEMES[0];
  html.dataset.theme = theme.colors ? (theme.base === 'light' ? 'schematic' : 'purple') : theme.id;
  for (const token of [...sfTheme.THEME_TOKENS, 'selection']) html.style.removeProperty(`--${token}`);
  for (const [token, value] of Object.entries(theme.colors ?? {})) html.style.setProperty(`--${token}`, value);
  if (settings.accent) for (const [token, value] of Object.entries(sfTheme.accentPalette(settings.accent))) html.style.setProperty(`--${token}`, value);
  const setOr = (name, value) => (value ? html.style.setProperty(name, value) : html.style.removeProperty(name));
  setOr('--ui', settings.uiFont && `${settings.uiFont}, system-ui, sans-serif`);
  setOr('--code', settings.codeFont && `${settings.codeFont}, Consolas, monospace`);
  html.style.setProperty('--radius', `${settings.corners}px`);
  html.style.setProperty('--side-w', `${settings.sidebarWidth}px`);
  html.style.setProperty('--stream-size', `${settings.streamSize}px`);
  document.body.dataset.density = settings.density;
  document.body.classList.toggle('sidebar-right', settings.sidebarSide === 'right');
  document.body.classList.toggle('no-status', !settings.statusBar);
  document.body.classList.toggle('icons-only', settings.iconsOnly);
  for (const [id] of TOOLS) $(`#${id}`).hidden = settings.hiddenTools.includes(id);
  sf.setZoom(settings.uiScale / 100);
}

function applySettings() {
  applyLook();
  document.body.classList.toggle('no-sidebar', !settings.sidebar);
  document.body.classList.toggle('no-panel', !settings.panel);
  document.body.style.setProperty('--panel-h', `${settings.panelHeight}px`);
  $('#toggle-sidebar').setAttribute('aria-pressed', settings.sidebar);
  $('#toggle-panel').setAttribute('aria-pressed', settings.panel);
  plotColors = [1, 2, 3, 4, 5, 6].map((i) => css(`--plot-${i}`));
  for (const s of series) s.splice(0, s.length - +settings.plotWindow);
  plotDirty = true;
  if (!editor) return;
  const hex = (n) => css(n).slice(1);
  const name = `sf-${settings.theme}`.replace(/[^a-z0-9-]/gi, '-');
  monaco.editor.defineTheme(name, {
    base: document.documentElement.dataset.theme === 'schematic' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: hex('--silk-faint'), fontStyle: 'italic' },
      { token: 'keyword', foreground: hex('--gold-hi') },
      { token: 'string', foreground: hex('--string') },
      { token: 'number', foreground: hex('--number') },
      { token: 'type', foreground: hex('--type') },
      { token: 'keyword.directive', foreground: hex('--preproc') },
      { token: 'delimiter', foreground: hex('--silk-dim') },
    ],
    colors: {
      'editor.background': css('--substrate'), 'editor.foreground': css('--silk'),
      'editorLineNumber.foreground': css('--silk-faint'), 'editorLineNumber.activeForeground': css('--gold-hi'),
      'editorCursor.foreground': css('--gold-hi'), 'editor.lineHighlightBackground': css('--line-hi'),
      'editor.selectionBackground': css('--selection'), 'editorWidget.background': css('--mask'),
      'minimap.background': css('--substrate'), 'scrollbarSlider.background': css('--scroll'),
      'editorWidget.border': css('--edge'), 'editorSuggestWidget.background': css('--mask'), 'editorSuggestWidget.border': css('--edge'),
      'editorSuggestWidget.selectedBackground': css('--mask-raised'), 'editorSuggestWidget.highlightForeground': css('--gold-hi'),
      'editorHoverWidget.background': css('--mask'), 'editorHoverWidget.border': css('--edge'),
      'list.hoverBackground': css('--mask-raised'), 'list.activeSelectionBackground': css('--mask-raised'), 'list.activeSelectionForeground': css('--silk'),
      'list.focusBackground': css('--mask-raised'), 'list.highlightForeground': css('--gold-hi'), 'focusBorder': css('--gold-hi'),
      'quickInput.background': css('--mask'), 'quickInputList.focusBackground': css('--mask-raised'), 'input.background': css('--substrate'), 'input.border': css('--edge'),
      'menu.background': css('--mask'), 'menu.selectionBackground': css('--mask-raised'), 'editorBracketMatch.border': css('--gold-hi'),
      'editorIndentGuide.background1': css('--line-hi'), 'editorBracketHighlight.foreground1': css('--gold-hi'),
      'editorBracketHighlight.foreground2': css('--type'), 'editorBracketHighlight.foreground3': css('--preproc'),
    },
  });
  monaco.editor.setTheme(name);
  editor.updateOptions({
    fontSize: settings.fontSize, wordWrap: settings.wordWrap ? 'on' : 'off',
    minimap: { enabled: settings.minimap }, lineNumbers: settings.lineNumbers ? 'on' : 'off',
    fontFamily: css('--code'), fontLigatures: settings.ligatures, lineHeight: settings.lineHeight, cursorStyle: settings.cursorStyle,
    cursorBlinking: settings.cursorBlink, renderWhitespace: settings.whitespace, bracketPairColorization: { enabled: settings.bracketColors },
    autoClosingBrackets: settings.autoClose ? 'languageDefined' : 'never', autoClosingQuotes: settings.autoClose ? 'languageDefined' : 'never',
    stickyScroll: { enabled: settings.stickyScroll }, cursorSmoothCaretAnimation: settings.smoothCaret ? 'on' : 'off',
  });
  monaco.editor.remeasureFonts();
  models.forEach((m) => m.updateOptions({ tabSize: +settings.tabSize }));
}

// ---------- Editor ----------
require.config({ paths: { vs: '../node_modules/monaco-editor/min/vs' } });
require(['vs/editor/editor.main'], () => {
  editor = monaco.editor.create($('#editor'), {
    automaticLayout: true, model: null, fontFamily: css('--code'), fontLigatures: true,
    renderLineHighlight: 'all', smoothScrolling: true, padding: { top: 8 },
  });
  editor.onDidChangeCursorPosition(({ position }) => { $('#st-cursor').textContent = `Ln ${position.lineNumber}, Col ${position.column}`; });
  let typing;
  editor.onDidChangeModelContent(() => { clearTimeout(typing); typing = setTimeout(() => quickLint(editor.getModel()), 300); });
  registerAssist();
  applySettings();
  window.dispatchEvent(new Event('sf-editor-ready'));
});

async function openFile(file, line) {
  let model = models.get(file);
  if (!model) {
    model = monaco.editor.createModel(await sf.readFile(file), file.endsWith('.ino') ? 'cpp' : undefined, monaco.Uri.file(file));
    model.updateOptions({ tabSize: +settings.tabSize });
    models.set(file, model);
    applyMarkers(file);
    quickLint(model);
  }
  editor.setModel(model);
  current = file;
  $('#welcome').hidden = true;
  $('#st-lang').textContent = model.getLanguageId();
  document.querySelectorAll('#tree button').forEach((b) => b.classList.toggle('active', b.dataset.path === file));
  if (line) {
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
  }
  editor.focus();
}

function applyMarkers(file) {
  const model = models.get(file);
  if (!model) return;
  const toMarker = (d) => {
    const line = Math.min(d.line, model.getLineCount());
    return {
      startLineNumber: line, startColumn: d.col, endLineNumber: line, endColumn: d.endCol ?? model.getLineMaxColumn(line),
      message: d.message, severity: { error: monaco.MarkerSeverity.Error, info: monaco.MarkerSeverity.Info }[d.severity] ?? monaco.MarkerSeverity.Warning,
    };
  };
  monaco.editor.setModelMarkers(model, 'build', (diags.get(file) || []).map(toMarker));
  monaco.editor.setModelMarkers(model, 'lint', (lintDiags.get(file) || []).map(toMarker));
}

// ---------- Code assistance ----------
const isSketch = (model) => model.uri.path.endsWith('.ino');
const rulesFor = (model) => (['c', 'cpp'].includes(model.getLanguageId()) ? sfLint.lintRules(model.getValue(), { sketch: isSketch(model), baud: settings.baud }) : []);

function quickLint(model) {
  if (!model || model.isDisposed()) return;
  const markers = settings.lint ? rulesFor(model).map((d) => ({
    startLineNumber: d.line, startColumn: d.col, endLineNumber: d.line, endColumn: d.endCol, message: d.message, source: 'SiliconForge',
    severity: { error: monaco.MarkerSeverity.Error, info: monaco.MarkerSeverity.Info }[d.severity] ?? monaco.MarkerSeverity.Warning,
  })) : [];
  monaco.editor.setModelMarkers(model, 'rules', markers);
}

// The compiler's warnings for what is on disk, shown as squiggles.
async function checkProject() {
  if (!settings.lint || !root || busy) { lintDiags.clear(); models.forEach((_, f) => applyMarkers(f)); return; }
  const checked = root;
  const found = await sf.lint(checked).catch(() => null);
  if (!found || checked !== root) return; // superseded, or the project changed meanwhile
  lintDiags.clear();
  for (const d of found) lintDiags.set(d.file, [...(lintDiags.get(d.file) || []), d]);
  models.forEach((_, f) => applyMarkers(f));
}

function registerAssist() {
  const lastWord = (model, position) => {
    const before = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
    const typed = before.match(/[\w.]*$/)[0];
    return { typed, range: { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: position.column - typed.length, endColumn: position.column } };
  };
  for (const language of ['cpp', 'c', 'rust', 'python']) {
    const api = sfApi[language] ?? [];
    const available = (model) => [...(language === 'cpp' && !isSketch(model) ? [] : api), ...(sfApi.extra[language] ?? [])];
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const { range } = lastWord(model, position);
        return {
          suggestions: available(model).map(([label, insertText, documentation]) => ({
            label, insertText, documentation, range, kind: monaco.languages.CompletionItemKind.Function, detail: LANG_LABELS[language],
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          })),
        };
      },
    });
    monaco.languages.registerHoverProvider(language, {
      provideHover(model, position) {
        const line = model.getLineContent(position.lineNumber);
        const word = [...line.matchAll(/[\w.]+/g)].find((m) => m.index < position.column && position.column <= m.index + m[0].length + 1)?.[0];
        const entry = word && api.find(([label]) => label === word || label.endsWith(`.${word}`));
        return entry ? { contents: [{ value: `**${entry[0]}**` }, { value: entry[2] }] } : null;
      },
    });
  }
  monaco.editor.registerCommand('sf.findLibrary', (_, q) => openMarket('libraries', q));
  monaco.languages.registerCodeActionProvider(['c', 'cpp'], {
    provideCodeActions(model, range, context) {
      const fixes = rulesFor(model).filter((d) => d.fix && d.line >= range.startLineNumber && d.line <= range.endLineNumber).map((d) => {
        const edit = d.fix.insertAfter === undefined
          ? { range: { startLineNumber: d.line, endLineNumber: d.line, startColumn: d.col, endColumn: d.endCol }, text: d.fix.text }
          : { range: { startLineNumber: d.fix.insertAfter + 2, endLineNumber: d.fix.insertAfter + 2, startColumn: 1, endColumn: 1 }, text: `${d.fix.text}\n` };
        return { title: d.fix.title, kind: 'quickfix', isPreferred: true, edit: { edits: [{ resource: model.uri, textEdit: edit, versionId: model.getVersionId() }] } };
      });
      for (const marker of context.markers) {
        const header = marker.message.match(/([\w/.-]+)\.h: No such file/)?.[1];
        if (header) fixes.push({ title: `Find a library for ${header}.h`, kind: 'quickfix', command: { id: 'sf.findLibrary', title: 'Find library', arguments: [header] } });
      }
      return { actions: fixes, dispose() {} };
    },
  });
}

async function saveAll() {
  await Promise.all([...models].map(([file, model]) => sf.writeFile(file, model.getValue())));
}

// ---------- Project ----------
function renderTree(nodes) {
  const ul = document.createElement('ul');
  for (const n of nodes) {
    const li = document.createElement('li');
    if (n.children) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = n.name;
      details.open = true;
      details.append(summary, renderTree(n.children));
      li.append(details);
    } else {
      const b = document.createElement('button');
      b.textContent = n.name;
      b.dataset.path = n.path;
      b.onclick = () => openFile(n.path);
      li.append(b);
    }
    ul.append(li);
  }
  return ul;
}

function setBadge(board, manifest) {
  const badge = $('#board-badge');
  badge.classList.toggle('empty', !board);
  badge.disabled = !manifest;
  $('.fp-name').textContent = board ? board.name : manifest ? 'Unknown board' : 'No project open';
  const spec = board ? [board.cpu, board.flashKB && `${board.flashKB} KB flash`, board.ramKB && `${board.ramKB} KB RAM`, LANG_LABELS[manifest.language].replace(' (Arduino)', '')].filter(Boolean) : [];
  $('.fp-spec').replaceChildren(...spec.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
  badge.title = board ? [board.clockHz ? `${board.family}, ${board.clockHz / 1e6} MHz` : board.family, board.pins.length && `Pins: ${board.pins.join(', ')}`, 'Click to change the board or its options'].filter(Boolean).join('\n') : '';
}

async function openProject(dir) {
  models.forEach((m) => m.dispose());
  models.clear();
  diags.clear();
  lintDiags.clear();
  current = null;
  project = null;
  editor?.setModel(null);
  let nodes;
  try {
    nodes = await sf.tree(dir);
  } catch {
    settings.recent = settings.recent.filter((p) => p !== dir);
    persist();
    renderRecent();
    return log(`Can't open ${dir}: the folder no longer exists.`, 'err');
  }
  root = dir;
  $('#tree').replaceChildren(renderTree(nodes));
  settings.recent = [dir, ...settings.recent.filter((p) => p !== dir)].slice(0, 6);
  persist();
  renderRecent();
  try {
    const manifest = JSON.parse(await sf.readFile(`${dir}/siliconforge.json`));
    project = manifest;
    setBadge(boards.find((b) => b.id === manifest.board), manifest);
    if (manifest.baud) { settings.baud = String(manifest.baud); persist(); syncControls(); }
    // take the path from the tree so it is normalized the same way as build diagnostics
    const flat = (ns) => ns.flatMap((n) => (n.children ? flat(n.children) : [n]));
    const entry = flat(nodes).find((n) => n.path.replaceAll('\\', '/').endsWith(`/${manifest.entry}`));
    if (entry) await openFile(entry.path);
    checkProject();
  } catch {
    setBadge(null, null);
    $('.fp-name').textContent = 'Not a SiliconForge project';
  }
}

function renderRecent() {
  $('#recent-wrap').hidden = !settings.recent.length;
  $('#recent').replaceChildren(...settings.recent.map((p) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    const name = p.split(/[\\/]/).pop();
    b.append(Object.assign(document.createElement('strong'), { textContent: name }), Object.assign(document.createElement('span'), { textContent: p }));
    b.onclick = () => openProject(p);
    li.append(b);
    return li;
  }));
}

async function openFolder() { const dir = await sf.pickFolder(); if (dir) openProject(dir); }

// ---------- Build & upload ----------
function log(text, cls) {
  const out = $('#console-out');
  const el = document.createElement('div');
  el.textContent = text;
  if (cls) el.className = cls;
  out.append(el);
  out.scrollTop = out.scrollHeight;
  return el;
}

sf.onConsole(({ text, kind, diag }) => {
  $('#m-status').textContent = text;
  if (!diag) return log(text, kind);
  const b = document.createElement('button');
  b.textContent = text;
  b.className = diag.severity;
  b.onclick = () => openFile(diag.file, diag.line);
  log('').replaceWith(b);
  diags.set(diag.file, [...(diags.get(diag.file) || []), diag]);
  applyMarkers(diag.file);
});

function setTask(text, cls = '') {
  $('#st-task').textContent = text;
  $('#st-task').className = cls;
  document.body.dataset.task = cls;
}

function setBusy(on) {
  busy = on;
  for (const id of ['#verify', '#upload', '#new', '#open', '#e-open']) $(id).disabled = on;
  document.querySelectorAll('#m-list button').forEach((b) => { b.disabled = on; });
  $('#stop').disabled = !on;
}

async function run(action) {
  if (busy) return;
  showPanel('console');
  if (!root) return log('Create or open a project first.', 'err');
  if (settings.autoSave) await saveAll();
  if (action === 'upload') await serialDisconnect(); // the flasher needs the port
  if (settings.clearConsole) $('#console-out').replaceChildren();
  diags.clear();
  lintDiags.clear();
  models.forEach((_, file) => applyMarkers(file));
  setBusy(true);
  setTask(action === 'upload' ? 'Uploading…' : 'Building…', 'busy');
  let ok = false;
  try {
    ok = await sf.run({ root, action, port: $('#port').value.trim() || 'auto' });
  } catch (e) {
    log(cleanIpcError(e), 'err');
  } finally {
    setBusy(false);
  }
  const what = action === 'upload' ? 'Upload' : 'Build';
  setTask(ok ? `${what} succeeded` : `${what} failed`, ok ? 'ok' : 'err');
  if (ok && action === 'upload' && settings.monitorAfterUpload && lastPort) {
    showPanel('serial');
    serialConnect(lastPort);
  }
}

// ---------- Layout ----------
function selectTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  document.querySelectorAll('.tab-body').forEach((el) => { el.hidden = el.id !== name; });
  plotDirty = true;
}
function showPanel(tab) {
  if (!settings.panel) { settings.panel = true; persist(); applySettings(); }
  selectTab(tab);
}
function toggle(key) { settings[key] = !settings[key]; persist(); applySettings(); }
document.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => selectTab(b.dataset.tab); });

const resizer = $('#resizer');
const setPanelHeight = (h) => { settings.panelHeight = Math.round(Math.min(Math.max(h, 120), innerHeight - 220)); applySettings(); };
resizer.onpointerdown = (e) => {
  resizer.setPointerCapture(e.pointerId);
  resizer.classList.add('dragging');
  const startY = e.clientY;
  const startH = settings.panelHeight;
  resizer.onpointermove = (m) => setPanelHeight(startH + startY - m.clientY);
  resizer.onpointerup = () => { resizer.onpointermove = null; resizer.classList.remove('dragging'); persist(); };
};
resizer.onkeydown = (e) => {
  const step = { ArrowUp: 24, ArrowDown: -24 }[e.key];
  if (step) { e.preventDefault(); setPanelHeight(settings.panelHeight + step); persist(); }
};

// ---------- Serial monitor (Web Serial) ----------
let port = null;
let lastPort = null; // already-granted port, reopened without the chooser
let reader = null;
let closed = null;
let atLineStart = true;
const serialOut = $('#serial-out');
const LINE_ENDINGS = { none: '', lf: '\n', cr: '\r', crlf: '\r\n' };

function stamp(text) {
  let out = '';
  for (const part of text.split(/(?<=\n)/)) {
    if (settings.timestamps && atLineStart && part) out += `[${new Date().toLocaleTimeString([], { hour12: false })}.${String(Date.now() % 1000).padStart(3, '0')}] `;
    out += part;
    atLineStart = part.endsWith('\n');
  }
  return out;
}

function serialAppend(text) {
  serialOut.textContent = (serialOut.textContent + stamp(text)).slice(-200_000);
  if (settings.autoscroll) serialOut.scrollTop = serialOut.scrollHeight;
}

function setSerialState(on) {
  $('#connect span').textContent = on ? 'Disconnect' : 'Connect';
  $('#connect').classList.toggle('pad', !on);
  $('#reset-board').disabled = !on;
  $('#st-serial').textContent = on ? `Serial connected at ${settings.baud} baud, ${settings.frame}` : 'Serial disconnected';
  $('#st-serial').classList.toggle('on', on);
}

async function readLoop() {
  const decoder = new TextDecoder();
  let pending = '';
  while (port?.readable) {
    reader = port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (settings.hex) {
          serialAppend([...value].map((b) => b.toString(16).padStart(2, '0')).join(' ') + ' ');
          continue;
        }
        const text = decoder.decode(value, { stream: true });
        serialAppend(text);
        const lines = (pending + text).split(/\r?\n/);
        pending = lines.pop();
        lines.forEach(plotLine);
      }
    } catch (e) {
      serialAppend(`\n[${e.message}]\n`);
    } finally {
      reader.releaseLock();
    }
    if (reader.cancelled) break;
  }
  await port.close().catch(() => {});
  port = null;
  setSerialState(false);
}

async function serialConnect(existing) {
  const [dataBits, parity, stopBits] = settings.frame;
  try {
    port = existing ?? await navigator.serial.requestPort();
    await port.open({
      baudRate: +settings.baud, dataBits: +dataBits, stopBits: +stopBits,
      parity: { N: 'none', E: 'even', O: 'odd' }[parity],
    });
  } catch (e) {
    port = null;
    if (e.name !== 'NotFoundError') serialAppend(`\n[Couldn't open the port: ${e.message}]\n`); // NotFoundError = chooser cancelled
    return;
  }
  lastPort = port;
  setSerialState(true);
  closed = readLoop();
}

async function serialDisconnect() {
  if (!port) return;
  reader.cancelled = true;
  await reader.cancel();
  await closed;
}

async function serialReconnect() {
  const p = port;
  await serialDisconnect();
  await serialConnect(p);
}

$('#connect').onclick = () => (port ? serialDisconnect() : serialConnect());
$('#reset-board').onclick = async () => {
  if (!port) return;
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await new Promise((r) => setTimeout(r, 100));
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
};
$('#clear-serial').onclick = () => { serialOut.textContent = ''; atLineStart = true; };
$('#serial-send').onsubmit = async (e) => {
  e.preventDefault();
  if (!port?.writable) return serialAppend('\n[Connect to a board before sending.]\n');
  const writer = port.writable.getWriter();
  await writer.write(new TextEncoder().encode($('#serial-input').value + LINE_ENDINGS[settings.lineEnding]));
  writer.releaseLock();
  $('#serial-input').value = '';
};

// ---------- Plotter: comma/space separated numbers per line ----------
let plotColors = [];
const series = [];
const hiddenChannels = new Set();
const plotLabels = [];
let plotDirty = false;
let plotPaused = false;

function plotLine(line) {
  if (plotPaused || !line.trim()) return;
  // Arduino's plotter format: "label:value" names the channel, plain numbers stay ch1, ch2, ...
  const parts = line.trim().split(/[,\s]+/).map((p) => p.match(/^(?:([^:]+):)?(.*)$/));
  const nums = parts.map((m) => Number(m[2]));
  if (nums.some(Number.isNaN)) return;
  const max = +settings.plotWindow;
  nums.forEach((v, i) => {
    const s = (series[i] ??= []);
    s.push(v);
    if (s.length > max) s.shift();
    if (parts[i][1]) plotLabels[i] = parts[i][1];
  });
  plotDirty = true;
}

function renderLegend() {
  $('#legend').replaceChildren(...series.map((s, i) => {
    const b = document.createElement('button');
    b.style.setProperty('--c', plotColors[i % plotColors.length]);
    b.setAttribute('aria-pressed', !hiddenChannels.has(i));
    b.textContent = `${plotLabels[i] ?? `ch${i + 1}`}  ${s.at(-1)}  (${Math.min(...s)} … ${Math.max(...s)})`;
    b.onclick = () => { hiddenChannels.has(i) ? hiddenChannels.delete(i) : hiddenChannels.add(i); plotDirty = true; };
    return b;
  }));
}

function drawPlot() {
  requestAnimationFrame(drawPlot);
  if (!plotDirty || $('#plotter').hidden) return;
  plotDirty = false;
  $('#plot-empty').hidden = series.length > 0;
  const canvas = $('#plot');
  const dpr = devicePixelRatio;
  const w = (canvas.width = canvas.clientWidth * dpr);
  const h = (canvas.height = canvas.clientHeight * dpr);
  const ctx = canvas.getContext('2d');
  const pad = 12 * dpr;
  // trace grows from the left until the window is full, then scrolls
  const span = Math.max(2, Math.min(+settings.plotWindow, ...series.map((s) => s.length)));

  ctx.strokeStyle = css('--grid');
  ctx.lineWidth = dpr;
  for (let i = 0; i <= 4; i++) {
    const y = Math.round(pad + (i * (h - 2 * pad)) / 4) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const visible = series.map((s, i) => [s, i]).filter(([, i]) => !hiddenChannels.has(i));
  const range = (vals) => { const lo = Math.min(...vals); const hi = Math.max(...vals); return lo === hi ? [lo - 1, hi + 1] : [lo, hi]; };
  const shared = settings.plotAxis === 'shared' && visible.length ? range(visible.flatMap(([s]) => s)) : null;
  if (shared) {
    ctx.fillStyle = css('--silk-faint');
    ctx.font = `${11 * dpr}px ${css('--code')}`;
    ctx.fillText(String(+shared[1].toPrecision(5)), 6 * dpr, pad + 12 * dpr);
    ctx.fillText(String(+shared[0].toPrecision(5)), 6 * dpr, h - pad - 4 * dpr);
  }
  ctx.lineWidth = 1.75 * dpr;
  ctx.lineJoin = 'round';
  for (const [s, i] of visible) {
    const [lo, hi] = shared ?? range(s);
    ctx.strokeStyle = plotColors[i % plotColors.length];
    ctx.beginPath();
    s.forEach((v, j) => ctx.lineTo(w - (s.length - 1 - j) * (w / (span - 1)), h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad)));
    ctx.stroke();
  }
  renderLegend();
}
requestAnimationFrame(drawPlot);

$('#plot-pause').onclick = () => {
  plotPaused = !plotPaused;
  $('#plot-pause').setAttribute('aria-pressed', plotPaused);
  $('#plot-pause span').textContent = plotPaused ? 'Resume' : 'Pause';
};
$('#plot-clear').onclick = () => { series.length = 0; plotLabels.length = 0; hiddenChannels.clear(); plotDirty = true; };

// ---------- New project / change board wizard ----------
const wizard = $('#wizard');
const selectedBoard = () => boards.find((b) => b.id === $('#w-board').value);
const selectedLang = () => document.querySelector('[name=lang]:checked')?.value;
const changing = () => wizard.classList.contains('change');
// Changing board keeps the project layout, so only boards on the same toolchain qualify.
const projectKind = () => boards.find((b) => b.id === project?.board)?.langs[project.language];

function renderBoardList() {
  const q = $('#w-search').value.trim().toLowerCase();
  const prev = $('#w-board').value;
  const families = new Map();
  for (const b of boards) {
    if (q && !`${b.name} ${b.cpu} ${b.family}`.toLowerCase().includes(q)) continue;
    if (changing() && b.langs[project.language] !== projectKind()) continue;
    if (!families.has(b.family)) families.set(b.family, Object.assign(document.createElement('optgroup'), { label: b.family }));
    families.get(b.family).append(new Option(b.name, b.id));
  }
  $('#w-board').replaceChildren(...families.values());
  $('#w-board').value = prev;
  if (!$('#w-board').value && $('#w-board').options.length) $('#w-board').selectedIndex = 0;
  renderBoard();
}

function renderBoard() {
  const board = selectedBoard();
  $('#w-board-info').replaceChildren();
  $('#w-lang').querySelectorAll('label').forEach((l) => l.remove());
  if (!board) return;
  const info = {
    Chip: board.cpu, Core: board.family, Clock: board.clockHz && `${board.clockHz / 1e6} MHz`, Flash: board.flashKB && `${board.flashKB} KB`,
    RAM: board.ramKB && `${board.ramKB} KB`, Pins: board.pins.join(', '),
  };
  $('#w-board-info').replaceChildren(...Object.entries(info).filter(([, v]) => v).flatMap(([k, v]) => [
    Object.assign(document.createElement('dt'), { textContent: k }),
    Object.assign(document.createElement('dd'), { textContent: v }),
  ]));
  const first = changing() ? project.language : Object.keys(board.langs)[0];
  $('#w-lang').append(...Object.keys(LANG_DETAILS).map((lang) => {
    const label = document.createElement('label');
    const input = Object.assign(document.createElement('input'), {
      type: 'radio', name: 'lang', value: lang, checked: lang === first, disabled: !board.langs[lang] || (changing() && lang !== first),
    });
    label.append(input, board.langs[lang] ? LANG_DETAILS[lang] : `${LANG_DETAILS[lang]}: not available for this board`);
    return label;
  }));
  updateOptionRows();
}

// Board options (programmer, probe, flash size, ...) come from the toolchain; the project's own choices win on its current board.
function updateOptionRows() {
  const board = selectedBoard();
  const lang = selectedLang();
  $('#w-opt-row').hidden = board?.langs[lang] === 'micropython';
  $('#w-options').querySelectorAll('[data-option]').forEach((l) => l.remove());
  const keep = changing() && board?.id === project.board ? project.options ?? {} : {};
  for (const o of board?.options[lang] ?? []) {
    const select = Object.assign(document.createElement('select'), { name: o.id });
    select.append(...o.values.map(([v, text]) => new Option(text, v)));
    select.value = o.values.some(([v]) => v === keep[o.id]) ? keep[o.id] : o.default;
    const label = Object.assign(document.createElement('label'), { textContent: o.label });
    label.dataset.option = o.id;
    label.append(select);
    $('#w-options').append(label);
  }
}

const selectedOptions = () => Object.fromEntries([...$('#w-options').querySelectorAll('[data-option] select')].map((s) => [s.name, s.value]));

function openWizard(mode = 'new') {
  if (busy || (mode === 'change' && !project)) return;
  wizard.classList.toggle('change', mode === 'change');
  $('#w-title').textContent = mode === 'change' ? 'Change board' : 'New project';
  $('#w-submit').textContent = mode === 'change' ? 'Apply' : 'Create project';
  $('#w-name').disabled = mode === 'change'; // hidden, so it must not block submit
  $('#w-error').textContent = '';
  if (mode === 'change') {
    $('#w-search').value = '';
    $('#w-board').value = project.board;
    $('#w-opt').value = project.opt ?? 'size';
  }
  renderBoardList();
  wizard.showModal();
  $('#w-search').focus();
}

$('#w-search').oninput = renderBoardList;
$('#w-search').onkeydown = (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); $('#w-board').focus(); } };
$('#w-board').onchange = renderBoard;
$('#w-lang').onchange = updateOptionRows;
$('#w-browse').onclick = async () => { const dir = await sf.pickFolder(); if (dir) $('#w-dir').value = dir; };
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => b.closest('dialog').close(); });

$('#wizard-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!selectedBoard()) return void ($('#w-error').textContent = 'Choose a board. Clear the search to see them all.');
  if (changing()) return changeBoard();
  if (!$('#w-dir').value) return void ($('#w-error').textContent = 'Choose a folder to create the project in.');
  try {
    const dir = await sf.createProject({
      name: $('#w-name').value, dir: $('#w-dir').value, boardId: $('#w-board').value,
      lang: selectedLang(), options: selectedOptions(), opt: $('#w-opt').value,
    });
    wizard.close();
    await openProject(dir);
  } catch (err) {
    $('#w-error').textContent = cleanIpcError(err);
  }
};

async function changeBoard() {
  const dir = root;
  try {
    await saveAll(); // reopening the project below drops editor buffers
    const { changed, kept } = await sf.changeBoard({ root: dir, boardId: $('#w-board').value, options: selectedOptions(), opt: $('#w-opt').value });
    wizard.close();
    await openProject(dir);
    showPanel('console');
    log(`Board set to ${selectedBoard().name}. Updated: ${changed.join(', ')}.`, 'ok');
    if (kept.length) log(`Kept your edits in ${kept.join(', ')}; check they still suit the new board.`, 'warning');
  } catch (err) {
    $('#w-error').textContent = cleanIpcError(err);
  }
}

// ---------- Examples ----------
let exampleTree = {};
const selectedExample = () => ({ board: $('#e-board').value, example: $('#e-example').value, lang: $('#e-lang').value });
const fillList = (select, items, keep) => {
  select.replaceChildren(...items.map(([value, text]) => new Option(text, value)));
  select.value = items.some(([v]) => v === keep) ? keep : items[0]?.[0] ?? '';
};

async function renderExample() {
  const ref = selectedExample();
  if (!ref.lang) return;
  const files = await sf.readExample(ref);
  const main = Object.keys(files).find((f) => !f.endsWith('.gitignore'));
  $('#e-preview').textContent = files[main];
}

function renderExampleLists() {
  const examples = exampleTree[$('#e-board').value] ?? {};
  fillList($('#e-example'), Object.keys(examples).map((e) => [e, e.replace('-', ' ')]), $('#e-example').value);
  const langs = examples[$('#e-example').value] ?? [];
  fillList($('#e-lang'), langs.map((l) => [l, LANG_LABELS[l]]), $('#e-lang').value);
  renderExample();
}

async function openExamples() {
  if (busy) return;
  exampleTree = await sf.examples();
  fillList($('#e-board'), boards.filter((b) => exampleTree[b.id]).map((b) => [b.id, b.name]), project?.board ?? $('#e-board').value);
  $('#e-error').textContent = '';
  renderExampleLists();
  $('#examples').showModal();
  $('#e-board').focus();
}

$('#e-board').onchange = renderExampleLists;
$('#e-example').onchange = renderExampleLists;
$('#e-lang').onchange = renderExample;
$('#e-open').onclick = async () => {
  const { board, example, lang } = selectedExample();
  const dir = await sf.pickFolder();
  if (!dir) return;
  // a sketch's name becomes its file name, so folders are numbered rather than renamed by hand
  for (let n = 1; n < 100; n++) {
    try {
      const made = await sf.createProject({ name: n === 1 ? example : `${example}-${n}`, dir, boardId: board, lang, example });
      $('#examples').close();
      return openProject(made);
    } catch (err) {
      if (!cleanIpcError(err).includes('already exists')) return void ($('#e-error').textContent = cleanIpcError(err));
    }
  }
};

// ---------- Boards and Library Manager ----------
const market = { kind: 'libraries', seq: 0 };
const marketLang = () => project?.language ?? 'cpp';

async function refreshMarket(force = false) {
  const seq = ++market.seq;
  const q = $('#m-search').value.trim();
  const query = market.kind === 'boards' ? { kind: 'boards', q, urls: settings.boardUrls, force } : { kind: 'libraries', q, lang: marketLang(), root, force };
  $('#m-error').textContent = '';
  $('#m-status').textContent = 'Searching…';
  try {
    const { note, rows } = await sf.marketSearch(query);
    if (seq !== market.seq) return; // a newer search is on its way
    $('#m-note').textContent = note;
    renderMarket(rows);
    $('#m-status').textContent = '';
  } catch (err) {
    if (seq !== market.seq) return;
    $('#m-status').textContent = '';
    $('#m-error').textContent = cleanIpcError(err);
  }
}

function marketButton(text, onclick, primary) {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text, onclick, disabled: busy });
  if (primary) b.className = 'pad';
  return b;
}

async function marketAction(action, row) {
  setBusy(true);
  $('#m-error').textContent = '';
  try {
    await sf.marketAction({ kind: market.kind, action, name: row.name, version: row.version, lang: marketLang(), root, urls: settings.boardUrls });
    if (market.kind === 'boards') await loadBoards();
    else if (project) project = JSON.parse(await sf.readFile(`${root}/siliconforge.json`));
    setBusy(false);
    await refreshMarket();
  } catch (err) {
    setBusy(false);
    $('#m-error').textContent = cleanIpcError(err);
  }
}

// Sketch > Include Library: adds the header at the top of the open file.
function includeLibrary(header) {
  const model = editor?.getModel();
  if (!model) return void ($('#m-error').textContent = 'Open a file first.');
  model.pushEditOperations([], [{ range: new monaco.Range(1, 1, 1, 1), text: `#include <${header}>\n` }], () => null);
  $('#market').close();
  editor.focus();
}

function renderMarket(rows) {
  const shown = $('#m-installed').checked ? rows.filter((r) => r.installed) : rows;
  $('#m-list').replaceChildren(...shown.map((row) => {
    const li = document.createElement('li');
    const title = Object.assign(document.createElement('div'), { className: 'm-title', textContent: row.title ?? row.name });
    const stateText = row.installed ? `${row.installed} installed` : row.version;
    title.append(Object.assign(document.createElement('span'), { className: 'm-meta', textContent: [stateText, row.author].filter(Boolean).join(' · ') }));
    const actions = Object.assign(document.createElement('div'), { className: 'm-actions' });
    if (row.includes?.length) actions.append(marketButton('Include', () => includeLibrary(row.includes[0])));
    if (!row.installed) actions.append(marketButton('Install', () => marketAction('install', row), true));
    else if (row.version && row.version !== row.installed && row.installed !== 'on upload') actions.append(marketButton('Update', () => marketAction('install', row), true));
    if (row.installed && row.removable) actions.append(marketButton('Remove', () => marketAction('remove', row)));
    li.append(title, actions, Object.assign(document.createElement('div'), { className: 'm-text', textContent: row.description ?? '' }));
    return li;
  }));
  if (!shown.length) {
    const words = $('#m-search').value.trim();
    $('#m-list').replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: words ? `Nothing found for "${words}".` : 'Type above to search.' }));
  }
}

function openMarket(kind, q = '') {
  if (busy) return;
  market.kind = kind;
  $('#m-title').textContent = kind === 'boards' ? 'Boards Manager' : `Library Manager: ${LANG_LABELS[marketLang()]}`;
  $('#m-search').placeholder = kind === 'boards' ? 'Search platforms such as esp32, rp2040, stm32' : 'Search libraries such as Servo, NeoPixel, DHT';
  $('#m-urls').hidden = kind !== 'boards';
  $('#m-search').value = q;
  $('#m-installed').checked = false;
  $('#m-list').replaceChildren();
  $('#m-note').textContent = '';
  $('#market').showModal();
  $('#m-search').focus();
  refreshMarket();
}

let searching;
$('#m-search').oninput = () => { clearTimeout(searching); searching = setTimeout(refreshMarket, 300); };
$('#m-installed').onchange = () => refreshMarket();
$('#m-refresh').onclick = () => refreshMarket(true);

// ---------- Ports ----------
async function refreshPorts() {
  const ports = await sf.ports();
  $('#port-list').replaceChildren(new Option('Use the only plugged-in board', 'auto'), ...ports.map((p) => new Option(p.board, p.address)));
}
$('#port').onfocus = refreshPorts;

async function loadBoards() {
  boards = await sf.boards();
  $('#w-search').placeholder = `Search ${boards.length} boards by name, chip or core`;
  $('#board-count').textContent = boards.length;
  renderBoardList();
  if (project) setBadge(boards.find((b) => b.id === project.board), project);
}

// ---------- Wiring ----------
const ACTIONS = {
  new: () => openWizard('new'),
  open: openFolder,
  save: async () => { await saveAll(); models.forEach(quickLint); checkProject(); },
  examples: openExamples,
  libraries: () => openMarket('libraries'),
  boards: () => openMarket('boards'),
  plotter: () => showPanel('plotter'),
  verify: () => run('verify'),
  upload: () => run('upload'),
  settings: () => openSettings(),
  sidebar: () => toggle('sidebar'),
  panel: () => toggle('panel'),
  serial: () => showPanel('serial'),
};
$('#new').onclick = ACTIONS.new;
$('#open').onclick = ACTIONS.open;
$('#save').onclick = ACTIONS.save;
$('#verify').onclick = ACTIONS.verify;
$('#upload').onclick = ACTIONS.upload;
$('#stop').onclick = () => sf.stop();
$('#board-badge').onclick = () => openWizard('change');
$('#open-examples').onclick = ACTIONS.examples;
$('#open-libraries').onclick = ACTIONS.libraries;
$('#open-boards').onclick = ACTIONS.boards;
$('#open-settings').onclick = ACTIONS.settings;
$('#toggle-sidebar').onclick = ACTIONS.sidebar;
$('#toggle-panel').onclick = ACTIONS.panel;
$('#clear-console').onclick = () => $('#console-out').replaceChildren();
document.querySelectorAll('#welcome [data-action]').forEach((b) => { b.onclick = ACTIONS[b.dataset.action]; });

// Arduino-style defaults, which Settings can rebind; capture phase so they win over Monaco's own bindings.
const DEFAULT_KEYS = {
  new: 'Ctrl+N', open: 'Ctrl+O', save: 'Ctrl+S', verify: 'Ctrl+R', upload: 'Ctrl+U', settings: 'Ctrl+,', sidebar: 'Ctrl+B', panel: 'Ctrl+J',
  serial: 'Ctrl+Shift+M', plotter: 'Ctrl+Shift+L', examples: 'Ctrl+Shift+E', libraries: 'Ctrl+Shift+I', boards: 'Ctrl+Shift+B', palette: 'Ctrl+Shift+P',
  zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0',
};
const keyOf = (action) => settings.keys[action] ?? DEFAULT_KEYS[action] ?? '';
const boundActions = () => Object.keys({ ...DEFAULT_KEYS, ...settings.keys });
let keyCapture = null; // set while the shortcut editor waits for a key

// A combination needs Ctrl or Alt, or a function key: plain keys belong to whatever is being typed.
function comboOf(e) {
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const parts = [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean);
  return parts.length > 1 && (e.ctrlKey || e.metaKey || e.altKey) || /^F\d+$/.test(key) ? parts.join('+') : '';
}

window.addEventListener('keydown', (e) => {
  if (keyCapture) { e.preventDefault(); e.stopPropagation(); return keyCapture(e); }
  const combo = comboOf(e);
  const action = combo && boundActions().find((a) => keyOf(a) === combo);
  if (!action || !ACTIONS[action]) return;
  e.preventDefault();
  e.stopPropagation();
  ACTIONS[action]();
}, true);

syncControls();
applySettings();
renderRecent();
loadBoards();
refreshPorts();
