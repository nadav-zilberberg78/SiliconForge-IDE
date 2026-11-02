// Extension host. Scripts run in a Worker built from this bootstrap, so all they can reach is what EXTENSION_API answers.
const COMMAND_TIMEOUT_MS = 10000;
const BUILTIN_THEMES = sfTheme.THEMES.length;

const BOOTSTRAP = `
// Second layer behind the page's connect-src 'none'. The prototype chain matters: self.fetch alone leaves WorkerGlobalScope.prototype.fetch.
for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'Worker', 'SharedWorker', 'indexedDB', 'caches', 'FileReaderSync', 'WebTransport']) {
  for (let scope = self; scope; scope = Object.getPrototypeOf(scope)) { try { delete scope[name]; } catch {} }
  try { Object.defineProperty(self, name, { value: undefined, configurable: false }); } catch {}
}
const pending = new Map();
const commands = new Map();
let seq = 0;
const call = (method, ...args) => new Promise((resolve, reject) => { pending.set(++seq, { resolve, reject }); postMessage({ method, id: seq, args }); });
const siliconforge = Object.freeze({
  registerCommand: (id, handler) => { commands.set(id, handler); },
  getText: () => call('getText'), getSelection: () => call('getSelection'), getProject: () => call('getProject'),
  setText: (text) => call('setText', text), insertText: (text) => call('insertText', text),
  insertAtTop: (text) => call('insertAtTop', text), showMessage: (text) => call('showMessage', text),
});
self.onmessage = async ({ data }) => {
  if (data.reply) {
    const p = pending.get(data.reply);
    pending.delete(data.reply);
    return data.error ? p?.reject(new Error(data.error)) : p?.resolve(data.value);
  }
  try {
    if (!commands.has(data.run)) throw new Error('This command was not registered');
    await commands.get(data.run)();
    postMessage({ done: data.run });
  } catch (e) {
    postMessage({ done: data.run, error: String(e?.message ?? e) });
  }
};
`;

let extensions = [];
const hosts = new Map(); // extension id -> { worker, name, timers }
const paletteEntries = [];

const editorModel = () => {
  const model = editor?.getModel();
  if (!model) throw new Error('Open a file first');
  return model;
};
const EXTENSION_API = {
  getText: () => editor?.getModel()?.getValue() ?? null,
  getSelection: () => { const model = editorModel(); return model.getValueInRange(editor.getSelection()); },
  getProject: () => project && { name: project.name, board: project.board, language: project.language },
  setText: (text) => { editor.executeEdits('extension', [{ range: editorModel().getFullModelRange(), text: String(text) }]); },
  insertText: (text) => { editorModel(); editor.executeEdits('extension', [{ range: editor.getSelection(), text: String(text) }]); },
  insertAtTop: (text) => { editorModel(); editor.executeEdits('extension', [{ range: new monaco.Range(1, 1, 1, 1), text: String(text) }]); },
};

const actionId = (ext, command) => `ext:${ext.id}:${command.id}`;

async function startHost(ext) {
  const code = await sf.extensionCode(ext.id);
  const url = URL.createObjectURL(new Blob([`${BOOTSTRAP}\n;${code}`], { type: 'text/javascript' }));
  const worker = new Worker(url);
  const host = { worker, timers: new Map() };
  hosts.set(ext.id, host);
  worker.onerror = (e) => { e.preventDefault(); showPanel('console'); log(`${ext.name}: ${e.message}`, 'err'); };
  worker.onmessage = ({ data }) => {
    if (data.done !== undefined) {
      clearTimeout(host.timers.get(data.done));
      host.timers.delete(data.done);
      if (data.error) { showPanel('console'); log(`${ext.name}: ${data.error}`, 'err'); }
      return;
    }
    if (data.method === 'showMessage') {
      showPanel('console');
      log(`${ext.name}: ${String(data.args[0]).slice(0, 2000)}`);
      return worker.postMessage({ reply: data.id });
    }
    const fn = Object.hasOwn(EXTENSION_API, data.method) ? EXTENSION_API[data.method] : null;
    try {
      if (!fn) throw new Error(`Unknown call ${data.method}`);
      worker.postMessage({ reply: data.id, value: fn(...data.args) });
    } catch (e) {
      worker.postMessage({ reply: data.id, error: e.message });
    }
  };
  URL.revokeObjectURL(url);
}

function runCommand(ext, command) {
  const host = hosts.get(ext.id);
  if (!host) return;
  host.timers.set(command.id, setTimeout(() => {
    host.worker.terminate();
    hosts.delete(ext.id);
    showPanel('console');
    log(`${ext.name}: "${command.title}" took too long and was stopped.`, 'err');
    startHost(ext);
  }, COMMAND_TIMEOUT_MS));
  host.worker.postMessage({ run: command.id });
}

function deactivateAll() {
  for (const { worker, timers } of hosts.values()) { timers.forEach(clearTimeout); worker.terminate(); }
  hosts.clear();
  sfTheme.THEMES.length = BUILTIN_THEMES;
  sfApi.extra = {};
  for (const a of extensionActions()) { delete ACTIONS[a]; delete ACTION_LABELS[a]; }
  paletteEntries.splice(0).forEach((d) => d.dispose());
}

async function loadExtensions() {
  deactivateAll();
  extensions = await sf.extensions();
  for (const ext of extensions.filter((e) => !e.error && settings.enabledExtensions.includes(e.id))) {
    sfTheme.THEMES.push(...ext.themes.map((t) => ({ ...t, id: `${ext.id}/${t.id}` })));
    for (const [lang, list] of Object.entries(ext.snippets)) (sfApi.extra[lang] ??= []).push(...list);
    if (ext.main) await startHost(ext).catch((e) => log(`${ext.name}: ${cleanIpcError(e)}`, 'err'));
    for (const command of ext.commands) {
      ACTIONS[actionId(ext, command)] = () => runCommand(ext, command);
      ACTION_LABELS[actionId(ext, command)] = command.title;
    }
  }
  registerPalette();
  renderThemeChoices();
  syncControls();
  applySettings();
}

// Every action in the F1 / Ctrl+Shift+P palette, including extension commands.
function registerPalette() {
  if (!editor) return;
  paletteEntries.splice(0).forEach((d) => d.dispose());
  for (const action of Object.keys(ACTIONS)) {
    if (!ACTION_LABELS[action] || action === 'palette') continue;
    paletteEntries.push(editor.addAction({ id: `sf.${action}`, label: ACTION_LABELS[action], run: () => ACTIONS[action]() }));
  }
}

// ---------- Manage extensions dialog ----------
function renderExtensions() {
  $('#x-list').replaceChildren(...extensions.map((ext) => {
    const li = document.createElement('li');
    const title = Object.assign(document.createElement('div'), { className: 'm-title', textContent: ext.name });
    title.append(Object.assign(document.createElement('span'), { className: 'm-meta', textContent: ext.error ? 'cannot be loaded' : `${ext.version}${ext.builtin ? ', included with the app' : ''}` }));
    const adds = [ext.themes.length && 'themes', Object.keys(ext.snippets).length && 'snippets', ext.commands.length && 'commands'].filter(Boolean);
    const about = ext.error ?? `${ext.description}${adds.length ? ` Adds ${adds.join(', ')}.` : ''}`;
    const actions = Object.assign(document.createElement('div'), { className: 'm-actions' });
    if (!ext.error) {
      const enabled = settings.enabledExtensions.includes(ext.id);
      actions.append(marketButton(enabled ? 'Turn off' : 'Turn on', () => setExtension(ext.id, !enabled), !enabled));
    }
    if (!ext.builtin) actions.append(marketButton('Remove', () => removeExtension(ext)));
    li.append(title, actions, Object.assign(document.createElement('div'), { className: ext.error ? 'm-text x-error' : 'm-text', textContent: about }));
    return li;
  }));
}

async function setExtension(id, on) {
  settings.enabledExtensions = on ? [...new Set([...settings.enabledExtensions, id])] : settings.enabledExtensions.filter((e) => e !== id);
  persist();
  await loadExtensions();
  renderExtensions();
}

async function removeExtension(ext) {
  if (!confirm(`Remove ${ext.name}?`)) return;
  await sf.extensionRemove(ext.id);
  await setExtension(ext.id, false);
}

async function openExtensions() {
  extensions = await sf.extensions();
  $('#x-error').textContent = '';
  renderExtensions();
  $('#extensions').showModal();
}

$('#x-install').onclick = async () => {
  $('#x-error').textContent = '';
  try {
    const id = await sf.extensionInstall();
    if (id) await setExtension(id, true);
  } catch (err) {
    $('#x-error').textContent = `Could not install: ${cleanIpcError(err)}`;
  }
};
$('#x-folder').onclick = () => sf.extensionsFolder();

window.addEventListener('sf-editor-ready', registerPalette);
loadExtensions();
