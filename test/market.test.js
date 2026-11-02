const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const boards = require('../src/boards.json');
const { scaffold, retarget } = require('../src/scaffold');
const { listExamples, readExample } = require('../src/examples');
const { generateTree } = require('../scripts/gen-examples');
const market = require('../src/market');
const { lintRules } = require('../renderer/lint');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));

test('the examples folder matches its generator and is laid out board/example/language', () => {
  const tree = generateTree();
  for (const [rel, text] of Object.entries(tree)) {
    assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'examples', rel), 'utf8'), text, rel);
  }
  const onDisk = listExamples();
  for (const board of boards) {
    assert.ok(onDisk[board.id], `${board.id} has no examples`);
    const langs = new Set(Object.values(onDisk[board.id]).flat());
    assert.deepStrictEqual([...langs].sort(), Object.keys(board.langs).sort(), board.id);
  }
  assert.ok(onDisk.uno.servo.includes('cpp') && onDisk.uno.servo.includes('c'));
  assert.deepStrictEqual(onDisk.uno.serial, ['cpp']);
  assert.ok(!onDisk['nucleo-f401re'].servo.includes('python')); // the stm32 port has no machine.PWM
});

test('an example takes the project name and replaces the starter sketch', () => {
  const files = readExample({ board: 'uno', example: 'servo', lang: 'cpp' }, 'sweeper');
  assert.deepStrictEqual(Object.keys(files), ['sweeper.ino']);
  assert.match(files['sweeper.ino'], /#include <Servo\.h>/);
  assert.match(readExample({ board: 'esp32-s3', example: 'servo', lang: 'cpp' })['servo.ino'], /ESP32Servo\.h/);
  assert.throws(() => readExample({ board: '..', example: 'servo', lang: 'cpp' }), /Invalid example path/);
});

test('C++ projects build through arduino-cli and survive a board change', () => {
  const find = (id) => boards.find((b) => b.id === id);
  const files = scaffold({ name: 'demo', board: find('pro-mini-8'), lang: 'cpp', opt: 'debug' });
  const m = JSON.parse(files['siliconforge.json']);
  assert.strictEqual(m.entry, 'demo.ino');
  assert.strictEqual(m.baud, 57600);
  assert.strictEqual(m.build[0], 'arduino-cli compile --fqbn arduino:avr:pro:cpu=8MHzatmega328 --build-path build --optimize-for-debug .');
  assert.match(m.upload[0], /-p \{port\} --input-dir build/);
  assert.strictEqual(JSON.parse(scaffold({ name: 'demo', board: find('uno'), lang: 'cpp' })['siliconforge.json']).build[0], 'arduino-cli compile --fqbn arduino:avr:uno --build-path build .');
  assert.throws(() => scaffold({ name: 'demo', board: { ...find('uno'), fqbn: 'a:b:c; rm -rf ~' }, lang: 'cpp' }), /Invalid FQBN/);

  const moved = retarget({ manifest: m, from: find('pro-mini-8'), to: find('esp32-devkitc'), read: (rel) => files[rel] ?? null });
  assert.match(JSON.parse(moved.write['siliconforge.json']).upload[0], /esp32:esp32:esp32 /);
  assert.deepStrictEqual(moved.stale, ['build']);
});

test('boards of installed cores are offered once, without shadowing the curated list', () => {
  const listall = { boards: [
    { name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }, { name: 'Pro', fqbn: 'arduino:avr:pro' },
    { name: 'Vendor Board', fqbn: 'acme:avr:thing', platform: { release: { name: 'Acme Boards' } } }, { name: 'No FQBN' },
  ] };
  const extra = market.installedBoards(listall, boards);
  assert.deepStrictEqual(extra.map((b) => b.id), ['acme:avr:thing']);
  assert.strictEqual(extra[0].family, 'Acme Boards');
  assert.match(scaffold({ name: 'demo', board: extra[0], lang: 'cpp' })['siliconforge.json'], /acme:avr:thing/);
});

test('board marketplace merges installed cores and validates its input', async () => {
  const exec = async (cmd, args, { env }) => {
    assert.match(env.ARDUINO_BOARD_MANAGER_ADDITIONAL_URLS, /package_esp32_index\.json .*https:\/\/vendor\.test\/i\.json$/);
    const platform = (id, installed) => ({ id, maintainer: 'M', latest_version: '2.0.0', installed_version: installed, releases: { '2.0.0': { name: `${id} boards`, boards: [{ name: 'One' }] } } });
    const deprecated = { ...platform('old:x'), releases: { '2.0.0': { name: '[DEPRECATED] Old boards' } } };
    return JSON.stringify({ platforms: args[1] === 'search' ? [deprecated, platform('a:b'), platform('c:d')] : [platform('c:d', '1.0.0')] });
  };
  const rows = await market.searchBoards({ q: '', urls: 'https://vendor.test/i.json' }, { exec });
  assert.deepStrictEqual(rows.map((r) => [r.name, r.installed]), [['c:d', '1.0.0'], ['a:b', ''], ['old:x', '']]);
  assert.deepStrictEqual(market.boardCommand({ action: 'install', name: 'c:d', version: '2.0.0' }).args, ['core', 'install', 'c:d@2.0.0']);
  assert.throws(() => market.boardCommand({ action: 'install', name: 'a; calc' }), /Invalid name/);
  assert.throws(() => market.boardEnv('http://insecure.test/i.json'), /https/);
});

test('library marketplace speaks each ecosystem', async () => {
  const arduino = async (_, args) => (args[1] === 'search'
    ? JSON.stringify({ libraries: [{ name: 'Servo', latest: { version: '1.3.0', sentence: 'Servos', author: 'A' } }, { name: 'Other', latest: { version: '1.0.0' } }] })
    : JSON.stringify({ installed_libraries: [{ library: { name: 'Servo', version: '1.2.0', provides_includes: ['Servo.h'], location: 'user' } }] }));
  const cpp = await market.searchLibraries({ lang: 'cpp', q: 'servo' }, { exec: arduino });
  assert.deepStrictEqual(cpp.rows.map((r) => [r.name, r.installed, r.version]), [['Servo', '1.2.0', '1.3.0']].concat([['Other', undefined, '1.0.0']]));
  assert.deepStrictEqual(market.libraryCommand({ action: 'install', lang: 'cpp', name: 'Adafruit NeoPixel', version: '1.12.0' }).args, ['lib', 'install', 'Adafruit NeoPixel@1.12.0']);
  const many = async (_, args) => JSON.stringify(args[1] === 'search'
    ? { libraries: [...Array.from({ length: 120 }, (_, i) => ({ name: `AServo${i}` })), { name: 'Servo' }, { name: 'ServoEasing' }] }
    : {});
  const ranked = await market.searchLibraries({ lang: 'cpp', q: 'servo' }, { exec: many });
  assert.deepStrictEqual(ranked.rows.slice(0, 2).map((r) => r.name), ['Servo', 'ServoEasing']);
  assert.strictEqual(ranked.rows.length, 100);
  assert.match((await market.searchLibraries({ lang: 'c' }, {})).note, /C\+\+ \(Arduino\)/);
  assert.throws(() => market.libraryCommand({ action: 'install', lang: 'c', name: 'x' }));

  const root = tmp();
  fs.writeFileSync(path.join(root, 'Cargo.toml'), '[package]\nname = "x"\n\n[dependencies]\ndefmt = "1"\ncortex-m = { version = "0.7", features = ["x"] }\n\n[profile.release]\ndebug = 2\n');
  const rust = await market.searchLibraries({ lang: 'rust', q: 'hal', root }, { exec: async () => 'embedded-hal = "1.0.0"    # HAL traits\n... and 5 crates more\n' });
  assert.deepStrictEqual(rust.rows.map((r) => r.name), ['embedded-hal']);
  assert.deepStrictEqual((await market.searchLibraries({ lang: 'rust', root }, {})).rows.map((r) => [r.name, r.installed]), [['defmt', '1'], ['cortex-m', '0.7']]);
  assert.deepStrictEqual(market.libraryCommand({ action: 'install', lang: 'rust', name: 'embedded-hal', version: '1.0.0', root }), { cmd: 'cargo', args: ['add', 'embedded-hal@1.0.0'], cwd: root });

  fs.writeFileSync(path.join(root, 'siliconforge.json'), JSON.stringify({ upload: ['mpremote cp'] }));
  assert.strictEqual(market.libraryCommand({ action: 'install', lang: 'python', name: 'ssd1306', root }), null);
  assert.strictEqual(market.libraryCommand({ action: 'install', lang: 'python', name: 'ssd1306', root }), null);
  const uploads = () => JSON.parse(fs.readFileSync(path.join(root, 'siliconforge.json'), 'utf8')).upload;
  assert.deepStrictEqual(uploads(), ['mpremote connect {port} mip install ssd1306', 'mpremote cp']);
  assert.deepStrictEqual((await market.searchLibraries({ lang: 'python', root }, {})).rows.map((r) => r.name), ['ssd1306']);
  market.libraryCommand({ action: 'remove', lang: 'python', name: 'ssd1306', root });
  assert.deepStrictEqual(uploads(), ['mpremote cp']);
  assert.match((await market.searchLibraries({ lang: 'rust' }, {})).note, /Open a project/);
});

test('code rules catch common sketch mistakes and stay quiet on correct code', () => {
  const sketch = (text, baud) => lintRules(text, { sketch: true, baud });
  const messages = (text, baud) => sketch(text, baud).map((d) => d.message);

  const good = 'void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(115200);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  Serial.println("if (a = 1);");\n  // if (a = 1);\n  if (x == 1) y();\n  while ((c = next()) != 0) {}\n}\n';
  assert.deepStrictEqual(sketch(good, '115200'), []);

  const [assign] = lintRules('int f(int a) {\n  if (a = 5) return 1;\n}\n');
  assert.deepStrictEqual([assign.line, assign.col, assign.endCol, assign.fix.text], [2, 9, 10, '==']);
  assert.match(lintRules('  if (ready);\n')[0].message, /ends this if/);
  assert.deepStrictEqual(lintRules('void f() { digitalWrite(1, 1); }'), []); // sketch rules skip plain C

  assert.match(messages('void setup() {}\n')[0], /void loop/);
  const noBegin = sketch('void setup() {\n}\nvoid loop() {\n  Serial.println(1);\n}\n', '9600')[0];
  assert.deepStrictEqual([noBegin.line, noBegin.fix.insertAfter, noBegin.fix.text], [4, 0, '  Serial.begin(9600);']);
  const noMode = sketch('void setup() {\n}\nvoid loop() {\n  digitalWrite(LED_BUILTIN, 1);\n  digitalWrite(LED_BUILTIN, 0);\n}\n');
  assert.strictEqual(noMode.length, 1);
  assert.match(noMode[0].message, /pinMode\(LED_BUILTIN/);
  assert.deepStrictEqual(sketch('void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {}\n', '115200').map((d) => d.severity), ['info']);
});
