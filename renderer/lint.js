// Instant checks that run while typing, no compiler needed. The compiler's own warnings arrive on save (see `lint` in main.js).
// Plain script in the page, CommonJS in the tests.
(function (exports) {
  // Blanks comments and string contents, keeping every column in place.
  function mask(text) {
    return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => m.replace(/[^\n]/g, ' '));
  }

  // line/col are 1-based. `fix` replaces col..endCol on the line, or with `insertAfter` adds whole lines below that line.
  function lintRules(text, { sketch = false, baud } = {}) {
    const lines = mask(text).split('\n');
    const code = lines.join('\n');
    const out = [];
    const add = (i, col, length, severity, message, fix) => out.push({ line: i + 1, col: col + 1, endCol: col + 1 + length, severity, message, fix });
    const firstLine = (re) => lines.findIndex((l) => re.test(l));

    lines.forEach((l, i) => {
      const assign = l.match(/\b(?:if|while)\s*\(\s*[A-Za-z_]\w*\s*(=)(?!=)/);
      if (assign) {
        const col = assign.index + assign[0].length - 1;
        add(i, col, 1, 'warning', 'This assigns instead of comparing. Did you mean "=="?', { title: 'Change to ==', text: '==' });
      }
      const empty = l.match(/\bif\s*\((?:[^()]|\([^()]*\))*\)\s*;\s*$/);
      if (empty) {
        const col = l.lastIndexOf(';');
        add(i, col, 1, 'warning', 'The ";" ends this if, so the code after it always runs.', { title: 'Remove the ;', text: '' });
      }
    });

    if (!sketch) return out;

    for (const name of ['setup', 'loop']) {
      if (!new RegExp(`\\bvoid\\s+${name}\\s*\\(`).test(code)) add(0, 0, 1, 'error', `A sketch needs a void ${name}() function.`);
    }

    const setup = firstLine(/\bvoid\s+setup\s*\([^)]*\)\s*\{/);
    const serial = firstLine(/\bSerial\.(?:print|println|write|read|available|parseInt)/);
    if (serial >= 0 && !/\bSerial\.begin\s*\(/.test(code)) {
      add(serial, lines[serial].indexOf('Serial'), 6, 'warning', 'Serial is used but Serial.begin() is never called.',
        setup >= 0 ? { title: `Add Serial.begin(${baud ?? 9600})`, insertAfter: setup, text: `  Serial.begin(${baud ?? 9600});` } : undefined);
    }

    const pinModes = new Set([...code.matchAll(/\bpinMode\s*\(\s*(\w+)/g)].map((m) => m[1]));
    for (const m of code.matchAll(/\bdigitalWrite\s*\(\s*(\d+|LED_BUILTIN|A\d+)\b/g)) {
      if (pinModes.has(m[1])) continue;
      pinModes.add(m[1]); // report each pin once
      const i = code.slice(0, m.index).split('\n').length - 1;
      add(i, lines[i].indexOf('digitalWrite'), 'digitalWrite'.length, 'warning', `Pin ${m[1]} is written but never set with pinMode(${m[1]}, OUTPUT).`,
        setup >= 0 ? { title: `Add pinMode(${m[1]}, OUTPUT)`, insertAfter: setup, text: `  pinMode(${m[1]}, OUTPUT);` } : undefined);
    }

    if (baud) {
      for (const [i, l] of lines.entries()) {
        const m = l.match(/\bSerial\.begin\s*\(\s*(\d+)/);
        if (m && +m[1] !== +baud) add(i, m.index, m[0].length, 'info', `The Serial monitor is set to ${baud} baud, so this ${m[1]} output will look garbled.`);
      }
    }
    return out;
  }

  exports.lintRules = lintRules;
})(typeof module === 'object' ? module.exports : (window.sfLint = {}));
