// The example library on disk: examples/<board>/<example>/<language>/<project files>. See scripts/gen-examples.js.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'examples');
const SEGMENT = /^[a-z0-9][a-z0-9-]*$/; // these come over IPC and become path parts

const subdirs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

// { boardId: { example: [languages] } }
function listExamples(root = ROOT) {
  return Object.fromEntries(subdirs(root).map((board) => [board,
    Object.fromEntries(subdirs(path.join(root, board)).map((example) => [example, subdirs(path.join(root, board, example))]))]));
}

// Project-relative path -> text. A sketch must be named after its folder, so it takes the project's name.
function readExample({ board, example, lang }, name = example, root = ROOT) {
  for (const part of [board, example, lang]) if (!SEGMENT.test(part)) throw new Error(`Invalid example path "${part}"`);
  const dir = path.join(root, board, example, lang);
  const walk = (rel) => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const p = path.posix.join(rel, e.name);
    return e.isDirectory() ? walk(p) : [[p.endsWith('.ino') ? `${name}.ino` : p, fs.readFileSync(path.join(dir, p), 'utf8')]];
  });
  return Object.fromEntries(walk(''));
}

module.exports = { listExamples, readExample };
