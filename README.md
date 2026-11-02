<div align="center">

# SiliconForge IDE

**An Arduino-simple IDE for embedded development in C++, C, Rust and MicroPython.**

[![Latest release](https://img.shields.io/github/v/release/nadav-zilberberg78/SiliconForge-IDE?label=release)](https://github.com/nadav-zilberberg78/SiliconForge-IDE/releases/latest)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D4)](#installation)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[Installation](#installation) · [Features](#features) · [Toolchains](#toolchains) · [Development](#development) · [Extensions](extensions/README.md)

</div>

---

SiliconForge IDE lets you pick a board and a language, then write, build and upload firmware from one window. Every
project keeps its build and upload commands in a plain `siliconforge.json` file, so you can see and change exactly what
runs.

## Features

- **Project wizard:** choose a board and language, and get a ready-to-build project (`.ino` sketch, CMake and linker
  script, Cargo and `memory.x`, or `main.py`/`boot.py`).
- **Examples:** browse examples by board and language. Opening one makes a private copy as a new project.
- **Boards and libraries:** install Arduino cores and search the Arduino library index, crates.io and micropython-lib
  from inside the IDE.
- **Code checks:** common mistakes are flagged as you type, with quick fixes. Saving runs the real compiler with
  warnings on, and compiler errors become clickable console lines and editor squiggles.
- **Serial Monitor and Plotter:** read serial output and graph numeric data, with `name:value` pairs labelling the
  channels as in the Arduino IDE.
- **Customizable:** themes, accent color, spacing, toolbar buttons and shortcuts.
- **Extensions:** add themes, snippets and commands, which run in a sandbox.

## Installation

Choose the option that suits you. Either way, you also need the [toolchain](#toolchains) for the boards you use.

### Option 1: Windows installer (recommended)

Requires 64-bit Windows. You don't need Node.js or anything else to run the IDE itself.

1. Go to the [latest release](https://github.com/nadav-zilberberg78/SiliconForge-IDE/releases/latest).
2. Under **Assets**, download `SiliconForge-IDE-Setup-<version>.exe`.
3. Run the file and follow the setup wizard to choose an install location.
4. Open **SiliconForge IDE** from the Start Menu or the desktop shortcut.

> [!NOTE]
> The installer is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". To continue,
> select **More info**, then **Run anyway**.

To uninstall, go to **Settings > Apps > Installed apps** and remove SiliconForge IDE.

### Option 2: Build from source

Requires [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/) 22.12 or newer.

```sh
git clone https://github.com/nadav-zilberberg78/SiliconForge-IDE.git
cd SiliconForge-IDE
npm install
npm start
```

To build your own Windows installer, run `npm run dist`. The result is saved as
`dist/SiliconForge-IDE-Setup-<version>.exe`.

## Toolchains

The IDE does not include compilers, because they can take up several gigabytes. Install the tools for the boards and
languages you use, and make sure they are on your `PATH`.

| Project type | Tools |
|---|---|
| C++ (Arduino), Libraries, Boards | `arduino-cli` |
| C, STM32/nRF | `cmake`, `ninja`, `arm-none-eabi-gcc`, `openocd` |
| C, Arduino Uno | `avr-gcc`, `avrdude` (found automatically if the Arduino IDE or `arduino-cli core install arduino:avr` installed them) |
| C, ESP32 | ESP-IDF (`idf.py`, `IDF_PATH`) |
| C, Pico | Pico SDK (`PICO_SDK_PATH`), `cmake`, `ninja`, `picotool` |
| Rust | `rustup` (target installed automatically from `rust-toolchain.toml`), `probe-rs` |
| MicroPython | `python`, `mpremote` |

## Usage

- **New Project** picks a board from `src/boards.json`, plus every board of the cores installed through the Boards
  Manager, and a language. `src/scaffold.js` then writes the project and its `siliconforge.json` manifest.
- **Examples** live in `examples/<board>/<example>/<language>/`. Bare-metal Cortex-M C, Rust and megaAVR have only a
  `hello` example, since their registers differ per chip; use the C++ language on those boards for servo, serial and
  the rest.
- **Libraries** (Ctrl+Shift+I) uses the Arduino index for C++ projects, crates.io for Rust (`cargo add`) and
  micropython-lib for MicroPython (`mpremote mip install`, added to Upload). Bare-metal C has no index.
- **Boards** (Ctrl+Shift+B) installs Arduino cores. ESP32, ESP8266, Pico and STM32 indexes are built in; add others
  under *Additional board URLs*.
- **Code checks:** `renderer/lint.js` flags mistakes while typing, with quick fixes on the lightbulb. On save, the
  manifest's `lint` steps run the compiler. C++ sketches and MicroPython get completion and hover from
  `renderer/api.js`. A missing-header error offers *Find a library*.
- **Port** set to `auto` uses the only plugged-in board. Click the field to choose among detected ports.
- **Board options** (AVR programmer, debug probe, ESP32 flash size and upload speed) are picked in the wizard. Click
  the board badge in the toolbar to move the open project to another board on the same toolchain or change its options.
  Generated files you have not edited are regenerated; edited ones are kept and listed in the console.
- **Verify / Upload** run the manifest's `build` / `build + upload` shell steps. Edit them per project; `{port}` is
  replaced with the toolbar Port value. The special step `touch-1200` (Leonardo, Micro, Nano Every) opens the port at
  1200 baud to reset the board into its bootloader, then points `{port}` at whatever port the bootloader appears on.
- **Menu bar** holds every command, and **Customize** holds the appearance settings. The command palette is
  Ctrl+Shift+P or F1.
- **Serial Monitor** uses Web Serial. The **Plotter** graphs lines of comma- or space-separated numbers.

To write your own extension, see [extensions/README.md](extensions/README.md).

## Development

```sh
npm start          # launch the IDE
npm test           # scaffold, marketplace, lint and error-parser tests
npm run examples   # rewrite examples/ after changing scripts/gen-examples.js
npm run dist       # build the Windows installer into dist/
```

### Publishing a release

```sh
npm version patch        # or minor / major; updates package.json and creates the tag
git push --follow-tags
```

Pushing a `v*` tag runs [the release workflow](.github/workflows/release.yml), which runs the tests, builds the
installer and publishes it as a GitHub Release.

## License

SiliconForge IDE is released under the [MIT License](LICENSE). You can use, modify and distribute it freely, including
for commercial purposes.
