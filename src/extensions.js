// Extensions are folders holding extension.json and, optionally, one script.
// Everything here is untrusted input: the manifest is validated field by field, and scripts only ever run in a sandboxed Worker.
const fs = require('node:fs');
const path = require('node:path');
const { THEME_TOKENS } = require('../renderer/theme');

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAIN = /^[\w-]+\.js$/; // a bare file name, so it cannot point outside the extension
const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const LANGUAGES = ['cpp', 'c', 'rust', 'python'];

const text = (value, what, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${what} must be text of up to ${max} characters`);
  return value;
};
const id = (value, what) => {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${what} must use only a-z, 0-9 and -`);
  return value;
};

function validateTheme(t) {
  const colors = Object.entries(t.colors ?? {});
  for (const [key, value] of colors) {
    if (!THEME_TOKENS.includes(key)) throw new Error(`Unknown theme color "${key}"`);
    if (typeof value !== 'string' || !COLOR.test(value)) throw new Error(`Theme color ${key} must look like #rrggbb`);
  }
  if (!colors.length) throw new Error('A theme needs at least one color');
  if (t.base !== undefined && t.base !== 'dark' && t.base !== 'light') throw new Error('Theme base must be "dark" or "light"');
  return { id: id(t.id, 'Theme id'), label: text(t.label, 'Theme label', 40), base: t.base ?? 'dark', colors: t.colors };
}

// Returns only the fields that were checked, so unknown manifest keys never reach the page.
function validateManifest(m) {
  const contributes = m?.contributes ?? {};
  const snippets = Object.fromEntries(Object.entries(contributes.snippets ?? {}).map(([lang, list]) => {
    if (!LANGUAGES.includes(lang)) throw new Error(`Unknown snippet language "${lang}"`);
    return [lang, list.map(([label, body, doc]) => [text(label, 'Snippet label', 60), text(body, 'Snippet body', 5000), doc === undefined ? '' : text(doc, 'Snippet description')])];
  }));
  if (m?.main !== undefined && (typeof m.main !== 'string' || !MAIN.test(m.main))) throw new Error('main must be a .js file in the extension folder');
  const commands = (contributes.commands ?? []).map((c) => ({ id: id(c.id, 'Command id'), title: text(c.title, 'Command title', 60) }));
  if (commands.length && !m.main) throw new Error('Commands need a main script');
  return {
    id: id(m?.id, 'Extension id'), name: text(m.name, 'Extension name', 60), version: text(m.version, 'Version', 20),
    description: m.description === undefined ? '' : text(m.description, 'Description', 300),
    main: m.main, themes: (contributes.themes ?? []).map(validateTheme), snippets, commands,
  };
}

const readManifest = (dir) => validateManifest(JSON.parse(fs.readFileSync(path.join(dir, 'extension.json'), 'utf8')));

// A broken extension is listed with its error rather than hiding the others.
function listExtensions(builtinDir, userDir) {
  const scan = (dir, builtin) => {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch {} // nothing installed yet
    return names.map((name) => {
      try {
        return { ...readManifest(path.join(dir, name)), builtin };
      } catch (e) {
        return { id: name, name, error: e.message, builtin, themes: [], snippets: {}, commands: [] };
      }
    });
  };
  const builtin = scan(builtinDir, true);
  return [...builtin, ...scan(userDir, false).filter((e) => !builtin.some((b) => b.id === e.id))];
}

// Copies only the two files an extension can use, so an install cannot bring along anything else.
function installExtension(source, userDir, builtinDir) {
  const manifest = readManifest(source);
  if (fs.existsSync(path.join(builtinDir, manifest.id))) throw new Error(`"${manifest.id}" is the name of a built-in extension`);
  const code = manifest.main && fs.readFileSync(path.join(source, manifest.main), 'utf8');
  const target = path.join(userDir, manifest.id);
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(path.join(source, 'extension.json'), path.join(target, 'extension.json'));
  if (manifest.main) fs.writeFileSync(path.join(target, manifest.main), code);
  return manifest;
}

function removeExtension(extensionId, userDir) {
  fs.rmSync(path.join(userDir, id(extensionId, 'Extension id')), { recursive: true, force: true });
}

function extensionCode(extensionId, builtinDir, userDir) {
  const dir = [builtinDir, userDir].map((d) => path.join(d, id(extensionId, 'Extension id'))).find((d) => fs.existsSync(path.join(d, 'extension.json')));
  if (!dir) throw new Error(`Extension ${extensionId} is not installed`);
  const { main } = readManifest(dir);
  return main ? fs.readFileSync(path.join(dir, main), 'utf8') : null;
}

module.exports = { validateManifest, listExtensions, installExtension, removeExtension, extensionCode };
