const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const boards = require('../src/boards.json');
const { scaffold, retarget } = require('../src/scaffold');
const { ErrorParser } = require('../src/errors');
const { TOUCH_STEP, resetToBootloader } = require('../src/touch');

test('every board/language pair scaffolds a runnable manifest', () => {
  for (const board of boards) {
    for (const lang of Object.keys(board.langs)) {
      const files = scaffold({ name: 'demo', board, lang });
      const m = JSON.parse(files['siliconforge.json']);
      assert.ok(files[m.entry], `${board.id}/${lang}: entry ${m.entry} missing`);
      assert.ok(m.build.length && m.upload.length, `${board.id}/${lang}: empty pipeline`);
      assert.doesNotMatch(Object.values(files).join(''), /undefined/, `${board.id}/${lang}: unfilled template field`);
    }
  }
});

test('rust memory.x matches the board memory map', () => {
  const pico = boards.find((b) => b.id === 'pico');
  const files = scaffold({ name: 'demo', board: pico, lang: 'rust' });
  assert.match(files['memory.x'], /BOOT2 : ORIGIN = 0x10000000/);
  assert.match(files['memory.x'], /LENGTH = 264K/);
  assert.match(files['src/main.rs'], /rp2040_boot2/);
});

test('board-specific AVR and optimization settings reach the project', () => {
  const mega = scaffold({ name: 'demo', board: boards.find((b) => b.id === 'mega2560'), lang: 'c', opt: 'debug' });
  const m = JSON.parse(mega['siliconforge.json']);
  assert.match(mega['src/main.c'], /DDRB \|= _BV\(PB7\)/);
  assert.match(m.build[0], /-mmcu=atmega2560 .* -Og/);
  assert.match(m.upload[0], /-c wiring -b 115200 -D/);
  assert.strictEqual(m.baud, 115200);
  const mini = JSON.parse(scaffold({ name: 'demo', board: boards.find((b) => b.id === 'pro-mini-8'), lang: 'c' })['siliconforge.json']);
  assert.strictEqual(mini.baud, 57600); // 115200 is 8.5% off at 8 MHz
  const rust = scaffold({ name: 'demo', board: boards.find((b) => b.id === 'pico'), lang: 'rust', opt: 'speed' });
  assert.match(rust['Cargo.toml'], /opt-level = 3/);
  assert.throws(() => scaffold({ name: 'demo', board: boards[0], lang: 'c', opt: 'turbo' }));
});

test('board options reach the pipeline and unknown values are rejected', () => {
  const uno = boards.find((b) => b.id === 'uno');
  const isp = JSON.parse(scaffold({ name: 'demo', board: uno, lang: 'c', options: { programmer: 'usbasp' } })['siliconforge.json']);
  assert.strictEqual(isp.upload[0], 'avrdude -c usbasp -p atmega328p -U flash:w:firmware.hex:i');
  const s3 = scaffold({ name: 'demo', board: boards.find((b) => b.id === 'esp32-s3'), lang: 'c', options: { uploadBaud: '921600' } });
  assert.match(s3['sdkconfig.defaults'], /CONFIG_ESPTOOLPY_FLASHSIZE_8MB=y/); // the board's own flash size by default
  assert.match(JSON.parse(s3['siliconforge.json']).upload[0], /-b 921600 flash/);
  assert.throws(() => scaffold({ name: 'demo', board: uno, lang: 'c', options: { programmer: 'usbasp; rm -rf ~' } }));
});

test('changing board regenerates untouched files and keeps edited ones', () => {
  const find = (id) => boards.find((b) => b.id === id);
  const files = scaffold({ name: 'demo', board: find('uno'), lang: 'c' });
  const { opt, options, ...legacy } = JSON.parse(files['siliconforge.json']); // projects made before board options existed
  const edited = { ...files, 'src/main.c': '// mine\n', '.gitignore': files['.gitignore'].replaceAll('\n', '\r\n') };
  const moved = retarget({ manifest: legacy, from: find('uno'), to: find('mega2560'), read: (rel) => edited[rel] ?? null });
  assert.deepStrictEqual(moved.kept, ['src/main.c']); // the template's LED pin differs on the Mega
  assert.deepStrictEqual(Object.keys(moved.write), ['siliconforge.json']);
  const m = JSON.parse(moved.write['siliconforge.json']);
  assert.strictEqual(m.board, 'mega2560');
  assert.match(m.build[0], /atmega2560/);
  assert.deepStrictEqual(m.options, { programmer: 'bootloader' });

  const custom = retarget({ manifest: { ...legacy, upload: ['my-flasher'] }, from: find('uno'), to: find('mega2560'), read: (rel) => files[rel] ?? null });
  assert.deepStrictEqual(JSON.parse(custom.write['siliconforge.json']).upload, ['my-flasher']);
  assert.match(custom.write['src/main.c'], /PB7/);

  const esp = scaffold({ name: 'demo', board: find('esp32-devkitc'), lang: 'c' });
  const s3 = retarget({ manifest: JSON.parse(esp['siliconforge.json']), from: find('esp32-devkitc'), to: find('esp32-s3'), read: (rel) => esp[rel] ?? null });
  assert.match(s3.write['sdkconfig.defaults'], /esp32s3[\s\S]*FLASHSIZE_8MB/);
  assert.deepStrictEqual(s3.stale, ['build', 'sdkconfig']);
  assert.throws(() => retarget({ manifest: legacy, from: find('uno'), to: find('esp32-s3'), read: () => null }), /different toolchain/);
});

test('native-USB and megaAVR boards get a 1200 bps touch and their own serial registers', () => {
  const find = (id) => boards.find((b) => b.id === id);
  const leo = scaffold({ name: 'demo', board: find('leonardo'), lang: 'c' });
  assert.deepStrictEqual(JSON.parse(leo['siliconforge.json']).upload,
    [TOUCH_STEP, 'avrdude -c avr109 -b 57600 -D -p atmega32u4 -P {port} -U flash:w:firmware.hex:i']);
  assert.match(leo['src/main.c'], /UCSR1A = _BV\(U2X1\)/);
  assert.match(leo['src/main.c'], /PORTC \^= _BV\(PC7\)/);
  const isp = JSON.parse(scaffold({ name: 'demo', board: find('leonardo'), lang: 'c', options: { programmer: 'usbasp' } })['siliconforge.json']);
  assert.ok(!isp.upload.includes(TOUCH_STEP)); // an ISP programmer does not go through USB
  const every = scaffold({ name: 'demo', board: find('nano-every'), lang: 'c' });
  assert.strictEqual(JSON.parse(every['siliconforge.json']).upload[0], TOUCH_STEP);
  assert.match(every['src/main.c'], /USART3\.BAUD/);
  assert.match(every['src/main.c'], /PORTE\.OUTTGL = PIN2_bm/);
  assert.match(scaffold({ name: 'demo', board: find('uno'), lang: 'c' })['src/main.c'], /UCSR0A = _BV\(U2X0\)/);
});

test('1200 bps touch follows the board to its bootloader port', async () => {
  const fake = (...snapshots) => {
    const touched = [];
    let i = 0;
    return { touched, opts: { list: async () => snapshots[Math.min(i++, snapshots.length - 1)], poke: async (p) => touched.push(p), sleep: async () => {} } };
  };
  const leo = fake(['COM3', 'COM7'], ['COM3'], ['COM3'], ['COM3', 'COM8']);
  assert.strictEqual(await resetToBootloader('COM7', leo.opts), 'COM8');
  assert.deepStrictEqual(leo.touched, ['COM7']);
  assert.strictEqual(await resetToBootloader('/dev/ttyACM0', fake(['/dev/ttyACM0'], [], ['/dev/ttyACM0']).opts), '/dev/ttyACM0');
  assert.strictEqual(await resetToBootloader('COM5', fake(['COM5']).opts), 'COM5'); // USB bridge keeps its port
  const missing = fake(['COM9']); // nothing to touch: leave the port for the uploader to report on
  assert.strictEqual(await resetToBootloader('COM8', missing.opts), 'COM8');
  assert.deepStrictEqual(missing.touched, []);
});

test('unsupported language throws', () => {
  assert.throws(() => scaffold({ name: 'demo', board: boards.find((b) => b.id === 'uno'), lang: 'rust' }));
});

test('parses gcc, rustc and python errors', () => {
  const p = new ErrorParser('/proj');
  assert.deepStrictEqual(p.feed('C:\\proj\\src\\main.c:12:5: error: expected \';\' before \'}\' token'),
    { file: path.resolve('/proj', 'C:\\proj\\src\\main.c'), line: 12, col: 5, severity: 'error', message: "expected ';' before '}' token" });

  assert.strictEqual(p.feed('warning[E0599]: unused variable: `x`'), null);
  assert.deepStrictEqual(p.feed('  --> src/main.rs:9:13'),
    { file: path.resolve('/proj', 'src/main.rs'), line: 9, col: 13, severity: 'warning', message: 'unused variable: `x`' });

  assert.strictEqual(p.feed('  File "main.py", line 3'), null);
  assert.strictEqual(p.feed('    x = ('), null);
  assert.deepStrictEqual(p.feed("SyntaxError: '(' was never closed"),
    { file: path.resolve('/proj', 'main.py'), line: 3, col: 1, severity: 'error', message: "SyntaxError: '(' was never closed" });

  assert.strictEqual(p.feed('   Compiling demo v0.1.0'), null);
});
