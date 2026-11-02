// Library and board marketplaces: each one is a thin layer over the tool that owns that ecosystem.
// `ctx.exec(cmd, args, options)` resolves to a command's stdout, so tests can swap the tools for canned output.
const fs = require('node:fs');
const path = require('node:path');

const NAME = /^[\w][\w .+:-]*$/; // goes on a command line, even if not through a shell
const VERSION = /^[\w.+-]+$/;
const LIMIT = 100;

function checked(name, version) {
  if (!NAME.test(name ?? '')) throw new Error(`Invalid name "${name}"`);
  if (version && !VERSION.test(version)) throw new Error(`Invalid version "${version}"`);
  return version ? `${name}@${version}` : name;
}

// ---------- Boards ----------
// Same third-party cores people add to the Arduino IDE by hand. Passed by env so the user's arduino-cli config stays untouched.
const DEFAULT_BOARD_URLS = [
  'https://espressif.github.io/arduino-esp32/package_esp32_index.json',
  'https://arduino.esp8266.com/stable/package_esp8266com_index.json',
  'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json',
  'https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json',
];

function boardEnv(urls = '') {
  const extra = urls.split(/\s+/).filter(Boolean);
  for (const url of extra) if (!/^https:\/\/\S+$/.test(url)) throw new Error(`Board URLs must start with https:// ("${url}")`);
  return { ARDUINO_BOARD_MANAGER_ADDITIONAL_URLS: [...DEFAULT_BOARD_URLS, ...extra].join(' ') };
}

const coreRow = (p) => {
  const release = p.releases?.[p.latest_version] ?? p.releases?.[p.installed_version] ?? {};
  return {
    name: p.id, title: release.name ?? p.id, version: p.latest_version, installed: p.installed_version ?? '',
    author: p.maintainer, description: (release.boards ?? []).map((b) => b.name).slice(0, 12).join(', '), removable: true,
  };
};

async function searchBoards({ q = '', urls }, { exec }) {
  const env = boardEnv(urls);
  const json = async (...args) => JSON.parse(await exec('arduino-cli', [...args, '--format', 'json'], { env })).platforms ?? [];
  const [found, installed] = await Promise.all([json('core', 'search', ...(q ? [q] : [])), json('core', 'list')]);
  const rows = new Map(found.map((p) => [p.id, coreRow(p)]));
  // an installed core can have dropped out of the indexes, or simply not match the words searched for
  for (const p of installed) {
    const known = rows.get(p.id);
    if (known) known.installed = p.installed_version;
    else if (!q || `${p.id}`.includes(q.toLowerCase())) rows.set(p.id, coreRow(p));
  }
  const deprecated = (r) => /deprecated/i.test(r.title);
  return [...rows.values()].sort((a, b) => !a.installed - !b.installed || deprecated(a) - deprecated(b) || a.title.localeCompare(b.title));
}

const BOARD_COMMANDS = {
  install: ({ name, version }) => ['core', 'install', checked(name, version)],
  remove: ({ name }) => ['core', 'uninstall', checked(name)],
};
const boardCommand = ({ action, name, version, urls }) => ({ cmd: 'arduino-cli', args: BOARD_COMMANDS[action]({ name, version }), env: boardEnv(urls) });

// Boards of installed cores, in the shape of boards.json, so they can be picked for a new C++ project.
function installedBoards(listall, known) {
  const fqbns = new Set(known.map((b) => b.fqbn));
  return (listall.boards ?? []).filter((b) => b.fqbn && !fqbns.has(b.fqbn) && !known.some((k) => k.fqbn?.startsWith(`${b.fqbn}:`))).map((b) => ({
    id: b.fqbn, fqbn: b.fqbn, name: b.name, family: b.platform?.release?.name ?? b.fqbn.split(':').slice(0, 2).join(':'), cpu: '', pins: [], langs: { cpp: 'arduino' },
  }));
}

// ---------- Libraries ----------
const cargoDependencies = (toml) => [...(toml.match(/^\[dependencies\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/m)?.[1] ?? '').matchAll(/^([\w-]+)\s*=\s*(?:"([^"]*)"|\{\s*version\s*=\s*"([^"]*)")?/gm)]
  .map(([, name, plain, table]) => ({ name, installed: plain ?? table ?? '?', removable: true }));

const readManifest = (root) => JSON.parse(fs.readFileSync(path.join(root, 'siliconforge.json'), 'utf8'));
const writeManifest = (root, m) => fs.writeFileSync(path.join(root, 'siliconforge.json'), JSON.stringify(m, null, 2) + '\n');
const MIP_STEP = /^mpremote connect \{port\} mip install ([\w.@-]+)$/;

const LIBRARIES = {
  cpp: {
    needsProject: false,
    async search(q, { exec }) {
      if (!q) return [];
      const { libraries = [] } = JSON.parse(await exec('arduino-cli', ['lib', 'search', q, '--omit-releases-details', '--format', 'json']));
      // the CLI sorts by name, so without this an exact match can fall past the limit
      const words = q.toLowerCase();
      const rank = ({ name }) => { const n = name.toLowerCase(); return n === words ? 0 : n.startsWith(words) ? 1 : n.includes(words) ? 2 : 3; };
      return libraries.sort((a, b) => rank(a) - rank(b)).slice(0, LIMIT)
        .map(({ name, latest: l = {} }) => ({ name, version: l.version, author: l.author, description: l.sentence }));
    },
    async installed(_, { exec }) {
      const { installed_libraries: list = [] } = JSON.parse(await exec('arduino-cli', ['lib', 'list', '--format', 'json']));
      return list.map(({ library: l, release }) => ({
        name: l.name, installed: l.version, version: release?.version, description: l.sentence, author: l.author, includes: l.provides_includes ?? [], removable: l.location === 'user',
      }));
    },
    install: ({ name, version }) => ({ cmd: 'arduino-cli', args: ['lib', 'install', checked(name, version)] }),
    remove: ({ name }) => ({ cmd: 'arduino-cli', args: ['lib', 'uninstall', checked(name)] }),
  },
  rust: {
    needsProject: true,
    async search(q, { exec }) {
      if (!q) return [];
      return (await exec('cargo', ['search', q, '--limit', String(LIMIT)])).split('\n').flatMap((line) => {
        const m = line.match(/^([\w-]+) = "([^"]+)"\s*(?:#\s*(.*))?$/);
        return m ? [{ name: m[1], version: m[2], description: m[3] ?? '' }] : [];
      });
    },
    installed: async (root) => cargoDependencies(fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8').replaceAll('\r\n', '\n')),
    install: ({ name, version, root }) => ({ cmd: 'cargo', args: ['add', version ? `${checked(name)}@${version}` : checked(name)], cwd: root }),
    remove: ({ name, root }) => ({ cmd: 'cargo', args: ['remove', checked(name)], cwd: root }),
  },
  // Packages live on the board, so installing is a step of the project's Upload.
  python: {
    needsProject: true,
    async search(q, { fetch }) {
      if (!q) return [];
      const res = await fetch('https://micropython.org/pi/v2/index.json');
      if (!res.ok) throw new Error(`micropython.org answered ${res.status}`);
      const words = q.toLowerCase();
      return (await res.json()).packages.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(words)).slice(0, LIMIT)
        .map((p) => ({ name: p.name, version: p.version, author: p.author, description: p.description }));
    },
    installed: async (root) => readManifest(root).upload.flatMap((s) => {
      const m = s.match(MIP_STEP);
      return m ? [{ name: m[1], installed: 'on upload', removable: true }] : [];
    }),
    install({ name, root }) {
      const m = readManifest(root);
      m.upload = [`mpremote connect {port} mip install ${checked(name)}`, ...m.upload.filter((s) => s.match(MIP_STEP)?.[1] !== name)];
      writeManifest(root, m);
      return null;
    },
    remove({ name, root }) {
      const m = readManifest(root);
      m.upload = m.upload.filter((s) => s.match(MIP_STEP)?.[1] !== name);
      writeManifest(root, m);
      return null;
    },
  },
};

const LIBRARY_NOTES = {
  cpp: 'Arduino libraries are shared by all your C++ projects, like in the Arduino IDE. Type to search the library index.',
  rust: 'Crates are added to this project\'s Cargo.toml. Only no_std crates work on a microcontroller.',
  python: 'Packages come from micropython-lib and are copied to the board on the next Upload.',
  c: 'Bare-metal C has no package index. Create a C++ (Arduino) project to use Arduino libraries.',
};

async function searchLibraries({ lang, q = '', root }, ctx) {
  const provider = LIBRARIES[lang];
  if (!provider) return { note: LIBRARY_NOTES[lang] ?? LIBRARY_NOTES.c, rows: [] };
  if (provider.needsProject && !root) return { note: 'Open a project first.', rows: [] };
  const [found, installed] = await Promise.all([provider.search(q, ctx), provider.installed(root, ctx)]);
  const have = new Map(installed.map((l) => [l.name, l]));
  const words = q.toLowerCase();
  const rows = [
    ...installed.filter((l) => !words || `${l.name} ${l.description}`.toLowerCase().includes(words))
      .map((l) => ({ ...l, version: found.find((f) => f.name === l.name)?.version ?? l.version })),
    ...found.filter((f) => !have.has(f.name)),
  ];
  return { note: LIBRARY_NOTES[lang], rows };
}

function libraryCommand({ action, lang, ...args }) {
  const provider = LIBRARIES[lang];
  if (!provider) throw new Error(`No library index for ${lang}`);
  return provider[action === 'remove' ? 'remove' : 'install'](args);
}

module.exports = { searchBoards, boardCommand, boardEnv, installedBoards, searchLibraries, libraryCommand, cargoDependencies };
