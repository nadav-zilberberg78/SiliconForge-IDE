# Graph Report - SiliconForge IDE  (2026-11-02)

## Corpus Check
- 364 files · ~41,406 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 345 file(s) not represented in the graph (top: .ino 342, (none) 2, .css 1)

## Summary
- 958 nodes · 1632 edges · 91 communities (40 shown, 51 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- main.js
- core.test.js
- package.json
- renderer.js
- scaffold.js
- Writing an extension
- touch.js
- CLAUDE.md
- defmt_rtt_as
- Tasks.md
- market.test.js
- gen-examples.js
- ledc
- market.js
- leonardo/analog-read/c/src/main.c
- mega2560/analog-read/c/src/main.c
- micro/analog-read/c/src/main.c
- nano/analog-read/c/src/main.c
- nano-every/hello/c/src/main.c
- nano-old/analog-read/c/src/main.c
- pro-mini-16/analog-read/c/src/main.c
- pro-mini-8/analog-read/c/src/main.c
- uno/analog-read/c/src/main.c
- leonardo/blink/c/src/main.c
- mega2560/blink/c/src/main.c
- micro/blink/c/src/main.c
- nano/blink/c/src/main.c
- nano-old/blink/c/src/main.c
- pro-mini-16/blink/c/src/main.c
- pro-mini-8/blink/c/src/main.c
- uno/blink/c/src/main.c
- esp32-c3/servo/c/main/main.c
- esp32-c6/fade/c/main/main.c
- esp32-devkitc/fade/c/main/main.c
- esp32-devkitc/servo/c/main/main.c
- esp32-doit-v1/fade/c/main/main.c
- esp32-doit-v1/servo/c/main/main.c
- esp32-s2/fade/c/main/main.c
- esp32-s2/servo/c/main/main.c
- esp32-s3/fade/c/main/main.c
- lolin-s2-mini/servo/c/main/main.c
- nano-esp32/fade/c/main/main.c
- xiao-esp32c3/fade/c/main/main.c
- xiao-esp32c3/servo/c/main/main.c
- xiao-esp32s3/fade/c/main/main.c
- xiao-esp32s3/servo/c/main/main.c
- menu.js
- ui.test.js
- renderer/extensions.js
- renderBoardList
- marketAction
- serialConnect
- toggle
- openProject
- run
- css
- isSketch

## God Nodes (most connected - your core abstractions)
1. `run()` - 12 edges
2. `openProject()` - 11 edges
3. `changeBoard()` - 10 edges
4. `marketAction()` - 9 edges
5. `loadExtensions()` - 8 edges
6. `toggle()` - 8 edges
7. `scaffold()` - 7 edges
8. `MENUS()` - 6 edges
9. `applySettings()` - 6 edges
10. `openFile()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Writing an extension` --references--> `mask()`  [INFERRED]
  extensions/README.md → renderer/lint.js
- `refreshIndexes()` --calls--> `boardEnv()`  [EXTRACTED]
  main.js → src/market.js
- `examplesFor()` --calls--> `scaffold()`  [EXTRACTED]
  scripts/gen-examples.js → src/scaffold.js
- `refreshBoards()` --calls--> `installedBoards()`  [EXTRACTED]
  main.js → src/market.js

## Import Cycles
- None detected.

## Communities (91 total, 51 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.07
Nodes (26): { app, BrowserWindow, ipcMain, dialog, Menu, shell }, BUILTIN_EXTENSIONS, env, { ErrorParser }, exec(), extensions, fs, IGNORE (+18 more)

### Community 1 - "core.test.js"
Cohesion: 0.12
Nodes (9): ErrorParser, path, assert, boards, { ErrorParser }, path, { scaffold, retarget }, test (+1 more)

### Community 2 - "package.json"
Cohesion: 0.11
Nodes (16): dependencies, monaco-editor, description, devDependencies, electron, main, name, scripts (+8 more)

### Community 3 - "renderer.js"
Cohesion: 0.08
Nodes (25): ACTIONS, DEFAULT_KEYS, DEFAULTS, diags, exampleTree, fillList(), hiddenChannels, LANG_DETAILS (+17 more)

### Community 4 - "scaffold.js"
Cohesion: 0.13
Nodes (13): avr(), AVR_UPLOAD, BOARD_OPTIONS, boardOptions(), generate(), GENERATORS, { isDeepStrictEqual }, megaAvr() (+5 more)

### Community 6 - "Writing an extension"
Cohesion: 0.25
Nodes (6): Script API, The sandbox, Writing an extension, How it works, SiliconForge IDE, Toolchains (must be on PATH for now)

### Community 7 - "touch.js"
Cohesion: 0.22
Nodes (7): exec, { execFile }, fs, listPorts(), { promisify }, resetToBootloader(), touch()

### Community 11 - "defmt_rtt_as"
Cohesion: 0.08
Nodes (5): BOOT2_FIRMWARE, BOOT2_FIRMWARE, BOOT2_FIRMWARE, BOOT2_FIRMWARE, BOOT2_FIRMWARE

### Community 19 - "market.test.js"
Cohesion: 0.11
Nodes (19): lintRules(), mask(), fs, listExamples(), path, readExample(), ROOT, subdirs() (+11 more)

### Community 20 - "gen-examples.js"
Cohesion: 0.07
Nodes (30): arduinoPins(), AVR, AVR_PINS, boards, examplesFor(), family(), FAMILY_PINS, fs (+22 more)

### Community 21 - "ledc"
Cohesion: 0.12
Nodes (14): app_main(), set_duty(), app_main(), set_duty(), app_main(), set_duty(), app_main(), set_duty() (+6 more)

### Community 22 - "market.js"
Cohesion: 0.14
Nodes (10): BOARD_COMMANDS, boardCommand(), boardEnv(), coreRow(), DEFAULT_BOARD_URLS, fs, LIBRARIES, LIBRARY_NOTES (+2 more)

### Community 24 - "leonardo/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 25 - "mega2560/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 26 - "micro/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 27 - "nano/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 28 - "nano-every/hello/c/src/main.c"
Cohesion: 0.60
Nodes (3): main(), uart_init(), uart_puts()

### Community 29 - "nano-old/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 30 - "pro-mini-16/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 31 - "pro-mini-8/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 32 - "uno/analog-read/c/src/main.c"
Cohesion: 0.70
Nodes (4): adc_read(), main(), uart_init(), uart_puts()

### Community 33 - "leonardo/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 34 - "mega2560/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 35 - "micro/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 36 - "nano/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 37 - "nano-old/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 38 - "pro-mini-16/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 39 - "pro-mini-8/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 40 - "uno/blink/c/src/main.c"
Cohesion: 0.83
Nodes (3): main(), uart_init(), uart_puts()

### Community 79 - "menu.js"
Cohesion: 0.16
Nodes (17): ACTION_LABELS, actionItem(), choiceItem(), closeMenu(), EDITOR_KEYS, extensionActions(), menubar, MENUS() (+9 more)

### Community 80 - "ui.test.js"
Cohesion: 0.13
Nodes (11): accentPalette(), contrast(), luminance(), assert, builtinDir, ext, fs, os (+3 more)

### Community 81 - "renderer/extensions.js"
Cohesion: 0.23
Nodes (14): actionId(), deactivateAll(), EXTENSION_API, extensions, hosts, loadExtensions(), openExtensions(), paletteEntries (+6 more)

### Community 82 - "renderBoardList"
Cohesion: 0.24
Nodes (11): boards, changing(), loadBoards(), openWizard(), projectKind(), renderBoard(), renderBoardList(), selectedBoard() (+3 more)

### Community 83 - "marketAction"
Cohesion: 0.33
Nodes (9): cleanIpcError(), includeLibrary(), marketAction(), marketButton(), marketLang(), openMarket(), refreshMarket(), renderMarket() (+1 more)

### Community 84 - "serialConnect"
Cohesion: 0.32
Nodes (8): plotLine(), readLoop(), serialAppend(), serialConnect(), serialDisconnect(), serialReconnect(), setSerialState(), stamp()

### Community 85 - "toggle"
Cohesion: 0.38
Nodes (7): applyLook(), applySettings(), persist(), selectTab(), setPanelHeight(), showPanel(), toggle()

### Community 86 - "openProject"
Cohesion: 0.38
Nodes (7): applyMarkers(), checkProject(), openFile(), openFolder(), openProject(), renderRecent(), renderTree()

### Community 87 - "run"
Cohesion: 0.40
Nodes (6): changeBoard(), log(), run(), saveAll(), selectedOptions(), setTask()

### Community 88 - "css"
Cohesion: 0.50
Nodes (4): css(), drawPlot(), renderLegend(), syncControls()

### Community 89 - "isSketch"
Cohesion: 0.50
Nodes (4): isSketch(), quickLint(), registerAssist(), rulesFor()

## Knowledge Gaps
- **1 isolated node(s):** `monaco-editor`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 354 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `package.json` to `main.js`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `monaco-editor` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0677361853832442 - nodes in this community are weakly interconnected._
- **Why does `mask()` connect `market.test.js` to `Writing an extension`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `core.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._
- **Why does `Writing an extension` connect `Writing an extension` to `market.test.js`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._