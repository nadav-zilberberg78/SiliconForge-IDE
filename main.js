const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const readline = require('node:readline');
const { spawn, execFile } = require('node:child_process');
const staticBoards = require('./src/boards.json');
const { scaffold, retarget, boardOptions } = require('./src/scaffold');
const { ErrorParser } = require('./src/errors');
const { TOUCH_STEP, resetToBootloader } = require('./src/touch');
const { listExamples, readExample } = require('./src/examples');
const market = require('./src/market');
const extensions = require('./src/extensions');

const IGNORE = new Set(['.git', 'build', 'target', 'node_modules', '__pycache__']);

// shortcut: only Arduino's bundled tools (avr-gcc, avrdude, ...) are auto-discovered; grow into a managed toolchain store.
function toolchainEnv() {
  const home = { win32: path.join(process.env.LOCALAPPDATA || '', 'Arduino15'), darwin: path.join(os.homedir(), 'Library/Arduino15') }[process.platform]
    ?? path.join(os.homedir(), '.arduino15');
  const tools = path.join(home, 'packages', 'arduino', 'tools');
  let bins = [];
  try {
    bins = fs.readdirSync(tools).flatMap((t) => fs.readdirSync(path.join(tools, t)).map((v) => path.join(tools, t, v, 'bin'))).filter((p) => fs.existsSync(p));
  } catch {} // no Arduino tools installed
  const key = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'; // "Path" on Windows
  return { ...process.env, [key]: [...bins, process.env[key]].join(path.delimiter) };
}
const env = toolchainEnv();
let win;
let child = null;
let lintChild = null;
let boards = staticBoards; // plus whatever cores arduino-cli has installed

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, title: 'SiliconForge IDE', backgroundColor: '#1e1e1e',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  const ses = win.webContents.session;
  ses.setPermissionCheckHandler(() => true);
  ses.setDevicePermissionHandler((d) => d.deviceType === 'serial');
  ses.on('select-serial-port', async (event, ports, _wc, callback) => {
    event.preventDefault();
    if (!ports.length) return callback('');
    const { response } = await dialog.showMessageBox(win, {
      message: 'Select a serial port',
      buttons: [...ports.map((p) => (p.displayName ? `${p.portName} — ${p.displayName}` : p.portName)), 'Cancel'],
      cancelId: ports.length,
    });
    callback(ports[response]?.portId ?? '');
  });
  win.loadFile(path.join(__dirname, 'renderer/index.html'));
}

function tree(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !IGNORE.has(e.name))
    .sort((a, b) => b.isDirectory() - a.isDirectory() || a.name.localeCompare(b.name))
    .map((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? { name: e.name, path: p, children: tree(p) } : { name: e.name, path: p };
    });
}

const send = (msg) => win.webContents.send('console', msg);

const killTree = (proc) => {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
  else process.kill(-proc.pid, 'SIGTERM');
};

// detached on POSIX so Stop can kill the whole process group, not just the shell
const runStep = (cmd, cwd, parser) => pipeToConsole(spawn(cmd, { cwd, env, shell: true, detached: process.platform !== 'win32' }), parser);

function pipeToConsole(proc, parser) {
  child = proc;
  return new Promise((resolve) => {
    for (const stream of [child.stdout, child.stderr]) {
      readline.createInterface({ input: stream }).on('line', (text) => send({ text, diag: parser.feed(text) }));
    }
    child.on('error', (e) => { send({ text: e.message, kind: 'err' }); resolve(-1); });
    child.on('close', resolve);
  });
}

// Tools the marketplaces read from; arguments are never parsed by a shell.
function exec(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { env: { ...env, ...options.env }, cwd: options.cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err?.code === 'ENOENT') reject(new Error(`${cmd} is not installed or not on PATH`));
      else if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout);
    });
  });
}
const marketCtx = { exec, fetch };

function findBoard(id) {
  const board = boards.find((b) => b.id === id);
  if (!board) throw new Error(`Unknown board ${id}`);
  return board;
}

async function refreshBoards() {
  try {
    boards = [...staticBoards, ...market.installedBoards(JSON.parse(await exec('arduino-cli', ['board', 'listall', '--format', 'json'])), staticBoards)];
  } catch {} // no arduino-cli: the built-in list still works
}

ipcMain.handle('boards', async () => (await refreshBoards(), boards).map((b) => ({ ...b, options: Object.fromEntries(Object.keys(b.langs).map((l) => [l, boardOptions(b, l)])) })));
ipcMain.handle('pick-folder', async () => (await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })).filePaths[0]);
ipcMain.handle('tree', (_, root) => tree(root));
ipcMain.handle('read-file', (_, p) => fs.readFileSync(p, 'utf8'));
ipcMain.handle('write-file', (_, p, text) => fs.writeFileSync(p, text));

function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
}

ipcMain.handle('examples', () => listExamples());
ipcMain.handle('read-example', (_, ref) => readExample(ref));

ipcMain.handle('create-project', (_, { name, dir, boardId, lang, options, opt, example }) => {
  if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw new Error('Project name must start with a letter and use only a-z, 0-9, - or _');
  const board = findBoard(boardId);
  const root = path.join(dir, name);
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error(`${root} already exists and is not empty`);
  writeFiles(root, { ...scaffold({ name, board, lang, options, opt }), ...(example && readExample({ board: boardId, example, lang }, name)) });
  return root;
});

ipcMain.handle('change-board', (_, { root, boardId, options, opt }) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'siliconforge.json'), 'utf8'));
  const read = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; } };
  const { write, kept, stale } = retarget({ manifest, from: findBoard(manifest.board), to: findBoard(boardId), options, opt, read });
  writeFiles(root, write);
  for (const rel of stale) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    // build dirs are pure output; a config file such as sdkconfig is kept as a backup
    if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.renameSync(p, `${p}.old`);
  }
  return { changed: Object.keys(write), kept };
});

const serialPorts = async () => JSON.parse(await exec('arduino-cli', ['board', 'list', '--format', 'json'])).detected_ports
  ?.filter((d) => d.port.protocol === 'serial')
  .map((d) => ({ address: d.port.address, board: d.matching_boards?.[0]?.name ?? d.port.protocol_label })) ?? [];

ipcMain.handle('ports', () => serialPorts().catch(() => []));

ipcMain.handle('run', async (_, { root, action, port }) => {
  if (child) throw new Error('A task is already running');
  lintChild?.kill();
  if (!/^[\w.:/\\-]+$/.test(port)) throw new Error(`Invalid port "${port}"`); // it is pasted into a shell command
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'siliconforge.json'), 'utf8'));
  const steps = action === 'upload' ? [...manifest.build, ...manifest.upload] : manifest.build;
  const parser = new ErrorParser(root);
  // mpremote understands "auto" itself; everything else needs a real port, which is unambiguous when one board is plugged in
  if (port === 'auto' && manifest.language !== 'python' && steps.some((s) => s.includes('{port}'))) {
    const ports = await serialPorts().catch(() => []);
    if (ports.length === 1) {
      port = ports[0].address;
      send({ text: `Using ${port} (${ports[0].board})` });
    }
  }
  for (const step of steps) {
    if (step === TOUCH_STEP) {
      if (port === 'auto') {
        send({ text: 'This board needs its serial port: set Port in the toolbar (e.g. COM5).', kind: 'err' });
        return false;
      }
      send({ text: `> ${TOUCH_STEP} ${port}`, kind: 'cmd' });
      try {
        const next = await resetToBootloader(port);
        if (next !== port) send({ text: `Bootloader appeared on ${next}` });
        port = next;
      } catch (e) {
        send({ text: `Could not reset the board through ${port}: ${e.message.trim()}`, kind: 'err' });
        return false;
      }
      continue;
    }
    const cmd = step.replaceAll('{port}', port);
    send({ text: `> ${cmd}`, kind: 'cmd' });
    const code = await runStep(cmd, root, parser);
    child = null;
    if (code !== 0) {
      send({ text: code === null ? '■ Stopped' : `✗ Exited with code ${code}`, kind: 'err' });
      return false;
    }
  }
  send({ text: action === 'upload' ? '✓ Upload complete' : '✓ Build complete', kind: 'ok' });
  return true;
});

ipcMain.handle('stop', () => { if (child) killTree(child); });
ipcMain.handle('toggle-devtools', (e) => e.sender.toggleDevTools());

const BUILTIN_EXTENSIONS = path.join(__dirname, 'extensions');
const userExtensions = () => path.join(app.getPath('userData'), 'extensions');

ipcMain.handle('extensions', () => extensions.listExtensions(BUILTIN_EXTENSIONS, userExtensions()));
ipcMain.handle('extension-code', (_, id) => extensions.extensionCode(id, BUILTIN_EXTENSIONS, userExtensions()));
ipcMain.handle('extension-remove', (_, id) => extensions.removeExtension(id, userExtensions()));
ipcMain.handle('extension-install', async () => {
  const { filePaths: [folder] } = await dialog.showOpenDialog(win, { title: 'Choose the folder holding extension.json', properties: ['openDirectory'] });
  return folder ? extensions.installExtension(folder, userExtensions(), BUILTIN_EXTENSIONS).id : null;
});
ipcMain.handle('extensions-folder', () => {
  fs.mkdirSync(userExtensions(), { recursive: true });
  return shell.openPath(userExtensions());
});

// Background checks: diagnostics go to the editor, never the console. A newer check or a build replaces a running one.
ipcMain.handle('lint', async (_, root) => {
  if (child) return null;
  lintChild?.kill();
  const steps = JSON.parse(fs.readFileSync(path.join(root, 'siliconforge.json'), 'utf8')).lint ?? [];
  const parser = new ErrorParser(root);
  const found = [];
  for (const step of steps) {
    const proc = lintChild = spawn(step, { cwd: root, env, shell: true });
    for (const stream of [proc.stdout, proc.stderr]) {
      readline.createInterface({ input: stream }).on('line', (text) => { const d = parser.feed(text); if (d) found.push(d); });
    }
    const code = await new Promise((resolve) => { proc.on('error', () => resolve(-1)); proc.on('close', resolve); });
    if (code === null) return null; // replaced
  }
  lintChild = null;
  return found;
});

let indexed = false;
async function refreshIndexes(urls) {
  await Promise.allSettled([
    exec('arduino-cli', ['core', 'update-index'], { env: market.boardEnv(urls) }),
    exec('arduino-cli', ['lib', 'update-index']),
  ]);
  indexed = true;
}

ipcMain.handle('market-search', async (_, { kind, force, ...query }) => {
  if ((force || !indexed) && (kind === 'boards' || query.lang === 'cpp')) await refreshIndexes(query.urls);
  if (kind === 'boards') return { note: 'Installed platforms add their boards to New Project.', rows: await market.searchBoards(query, marketCtx) };
  return market.searchLibraries(query, marketCtx);
});

ipcMain.handle('market-action', async (_, { kind, ...request }) => {
  if (child) throw new Error('A task is already running');
  const command = kind === 'boards' ? market.boardCommand(request) : market.libraryCommand(request);
  if (!command) return true; // handled without a tool
  send({ text: `> ${command.cmd} ${command.args.join(' ')}`, kind: 'cmd' });
  const code = await pipeToConsole(spawn(command.cmd, command.args, { cwd: command.cwd, env: { ...env, ...command.env } }), new ErrorParser(command.cwd ?? '.'));
  child = null;
  if (code !== 0) throw new Error(code === null ? 'Stopped' : `${command.cmd} exited with code ${code}; see the console`);
  return true;
});

if (process.platform !== 'darwin') Menu.setApplicationMenu(null); // frees Ctrl+R etc. for IDE shortcuts
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
