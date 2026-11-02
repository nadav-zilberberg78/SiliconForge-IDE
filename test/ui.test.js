const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { THEMES, THEME_TOKENS, contrast, accentPalette } = require('../renderer/theme');
const ext = require('../src/extensions');

const builtinDir = path.join(__dirname, '..', 'extensions');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-ext-'));
const write = (dir, files) => { for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text); return dir; };
const manifest = (extra = {}) => JSON.stringify({ id: 'demo', name: 'Demo', version: '1.0.0', ...extra });

function themeColors(id) {
  const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'style.css'), 'utf8');
  const block = css.match(new RegExp(`\\[data-theme="${id}"\\][^{]*\\{([^}]*)\\}`))[1];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6,8})/gi)].map((m) => [m[1], m[2]]));
}

test('every built-in theme defines all colors and keeps text readable', () => {
  for (const { id } of THEMES) {
    const c = themeColors(id);
    for (const token of THEME_TOKENS) assert.ok(c[token], `${id} is missing --${token}`);
    for (const surface of ['substrate', 'mask', 'mask-raised']) {
      assert.ok(contrast(c.silk, c[surface]) >= 7, `${id}: silk on ${surface}`);
      assert.ok(contrast(c['silk-dim'], c[surface]) >= 4.5, `${id}: silk-dim on ${surface}`);
    }
    assert.ok(contrast(c['silk-faint'], c.substrate) >= 4.5, `${id}: faint text and comments`);
    assert.ok(contrast(c['silk-faint'], c.mask) >= 4.5, `${id}: hints on the chrome`);
    assert.ok(contrast(c['gold-ink'], c.gold) >= 4.5, `${id}: text on the primary button`);
    assert.ok(contrast(c['gold-hi'], c.mask) >= 3, `${id}: focus ring and accents`);
    for (const code of ['gold-hi', 'string', 'number', 'type', 'preproc', 'err', 'warn', 'ok']) {
      assert.ok(contrast(c[code], c.substrate) >= 4.5, `${id}: ${code} on the editor`);
    }
  }
});

test('an accent color always gets readable text on it', () => {
  assert.strictEqual(accentPalette('#ffd400')['gold-ink'], '#14161a');
  assert.strictEqual(accentPalette('#1a237e')['gold-ink'], '#ffffff');
  assert.strictEqual(accentPalette('#808080').gold, '#808080');
  assert.match(accentPalette('#123456')['gold-hi'], /^#[0-9a-f]{6}$/);
  for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ff8800', '#7f7f7f']) {
    const p = accentPalette(hex);
    assert.ok(contrast(p['gold-ink'], hex) >= 4.5, hex);
  }
});

test('extensions that ship with the app are valid, and their theme is readable', () => {
  const list = ext.listExtensions(builtinDir, path.join(tmp(), 'none'));
  assert.deepStrictEqual(list.map((e) => [e.id, e.error]).sort(), [['phosphor-theme', undefined], ['sketch-helpers', undefined]]);
  const { colors } = list.find((e) => e.id === 'phosphor-theme').themes[0];
  assert.ok(contrast(colors.silk, colors.substrate) >= 7);
  assert.ok(contrast(colors['silk-faint'], colors.substrate) >= 4.5);
  assert.ok(contrast(colors['gold-ink'], colors.gold) >= 4.5);
  assert.match(ext.extensionCode('sketch-helpers', builtinDir, tmp()), /registerCommand/);
});

test('manifests are validated field by field', () => {
  const bad = [
    [{ id: '../evil', name: 'x', version: '1' }, /Extension id/],
    [{ id: 'a', name: 'x', version: '1', main: '../../main.js' }, /main must be/],
    [{ id: 'a', name: 'x', version: '1', main: 'C:\\x.js' }, /main must be/],
    [{ id: 'a', name: 'x', version: '1', contributes: { commands: [{ id: 'c', title: 't' }] } }, /need a main/],
    [{ id: 'a', name: 'x', version: '1', contributes: { snippets: { cobol: [] } } }, /snippet language/],
    [{ id: 'a', name: 'x', version: '1', contributes: { themes: [{ id: 't', label: 'T', colors: { gold: 'url(http://x)' } }] } }, /#rrggbb/],
    [{ id: 'a', name: 'x', version: '1', contributes: { themes: [{ id: 't', label: 'T', colors: { '--evil': '#ffffff' } }] } }, /Unknown theme color/],
    [{ id: 'a', name: 'x', version: '1', contributes: { themes: [{ id: 't', label: 'T', colors: {} }] } }, /at least one/],
  ];
  for (const [input, error] of bad) assert.throws(() => ext.validateManifest(input), error);
  assert.deepStrictEqual(Object.keys(ext.validateManifest({ id: 'a', name: 'x', version: '1', surprise: true })).includes('surprise'), false);
});

test('install copies only the manifest and script; remove leaves other extensions alone', () => {
  const user = tmp();
  const source = write(tmp(), { 'extension.json': manifest({ main: 'main.js' }), 'main.js': '// code', 'secret.txt': 'do not copy' });
  ext.installExtension(source, user, builtinDir);
  assert.deepStrictEqual(fs.readdirSync(path.join(user, 'demo')).sort(), ['extension.json', 'main.js']);
  assert.strictEqual(ext.extensionCode('demo', builtinDir, user), '// code');

  write(fs.mkdirSync(path.join(user, 'other'), { recursive: true }) && path.join(user, 'other'), { 'extension.json': manifest({ id: 'other' }) });
  ext.removeExtension('demo', user);
  assert.deepStrictEqual(fs.readdirSync(user), ['other']);
  assert.throws(() => ext.removeExtension('../..', user), /Extension id/);
  assert.throws(() => ext.installExtension(write(tmp(), { 'extension.json': manifest({ id: 'sketch-helpers' }) }), user, builtinDir), /built-in/);
});

test('the page policy blocks all connections, which is what keeps extension workers off local files', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  assert.match(html.match(/Content-Security-Policy" content="([^"]*)"/)[1], /connect-src 'none'/);
});

test('a broken extension is reported without hiding the working ones', () => {
  const user = tmp();
  fs.mkdirSync(path.join(user, 'broken'));
  write(path.join(user, 'broken'), { 'extension.json': '{ not json' });
  const list = ext.listExtensions(builtinDir, user);
  assert.ok(list.find((e) => e.id === 'broken').error);
  assert.ok(list.find((e) => e.id === 'sketch-helpers'));
});
