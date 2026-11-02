// Project templates. Each generator returns the files plus the build/upload steps that
// the Universal Upload button runs (stored in siliconforge.json so users can edit them).
// `stale` lists outputs built with the old settings, cleared when the project moves to another board.

const { isDeepStrictEqual } = require('node:util');
const { TOUCH_STEP } = require('./touch');

// Arduino framework through arduino-cli: this is the toolchain that can use the library and board marketplaces.
const arduino = ({ name, board, opt, baud = board.clockHz && board.clockHz < 16e6 ? 57600 : 115200 }) => {
  if (!/^[\w.:=,-]+$/.test(board.fqbn ?? '')) throw new Error(`Invalid FQBN "${board.fqbn}"`); // it is pasted into a shell command
  const compile = `arduino-cli compile --fqbn ${board.fqbn} --build-path build`;
  return {
    baud,
    entry: `${name}.ino`,
    build: [`${compile} ${opt.arduino} .`.replace('  ', ' ')],
    lint: [`${compile} --warnings all .`],
    upload: [`arduino-cli upload --fqbn ${board.fqbn} -p {port} --input-dir build .`],
    stale: ['build'],
    files: {
      [`${name}.ino`]: `// ${board.name}: blink the built-in LED and count over serial at ${baud} baud
#ifndef LED_BUILTIN
#define LED_BUILTIN 2 // this core does not name an LED; most such ESP32 boards use GPIO2
#endif

unsigned count = 0;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(${baud});
}

void loop() {
  digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  Serial.print("Hello from SiliconForge on ${board.name}: ");
  Serial.println(count++);
  delay(500);
}
`,
      '.gitignore': 'build/\n',
    },
  };
};

const cmakeArm = ({ name, board, opt, options }) => ({
  entry: 'src/main.c',
  build: ['cmake -S . -B build -G Ninja', 'cmake --build build'],
  upload: [`openocd -f interface/${options.probe}.cfg -f target/${board.openocdTarget}.cfg -c "program build/firmware.elf verify reset exit"`],
  stale: ['build'],
  files: {
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.20)
set(CMAKE_TOOLCHAIN_FILE \${CMAKE_CURRENT_SOURCE_DIR}/arm-none-eabi.cmake)
project(${name} C)

set(CPU_FLAGS ${board.cpuFlags})
add_executable(firmware.elf src/startup.c src/main.c)
target_compile_options(firmware.elf PRIVATE \${CPU_FLAGS} ${opt.c} -g -Wall -ffunction-sections -fdata-sections)
target_link_options(firmware.elf PRIVATE \${CPU_FLAGS} -T\${CMAKE_SOURCE_DIR}/linker.ld -nostartfiles
  --specs=nano.specs --specs=nosys.specs -Wl,--gc-sections -Wl,-Map=firmware.map)
add_custom_command(TARGET firmware.elf POST_BUILD COMMAND arm-none-eabi-size firmware.elf)
`,
    'arm-none-eabi.cmake': `set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER arm-none-eabi-gcc)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
`,
    'linker.ld': `/* ${board.cpu}: ${board.flashKB}K flash, ${board.ramKB}K RAM */
ENTRY(Reset_Handler)

MEMORY
{
  FLASH (rx)  : ORIGIN = ${board.flashOrigin}, LENGTH = ${board.flashKB}K
  RAM   (rwx) : ORIGIN = ${board.ramOrigin}, LENGTH = ${board.ramKB}K
}

_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
  .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
  .text : { *(.text*) *(.rodata*) . = ALIGN(4); } > FLASH
  _sidata = LOADADDR(.data);
  .data : { _sdata = .; *(.data*) . = ALIGN(4); _edata = .; } > RAM AT > FLASH
  .bss : { _sbss = .; *(.bss*) *(COMMON) . = ALIGN(4); _ebss = .; } > RAM
}
`,
    'src/startup.c': `#include <stdint.h>

extern uint32_t _sidata, _sdata, _edata, _sbss, _ebss, _estack;
int main(void);

void Reset_Handler(void) {
    for (uint32_t *src = &_sidata, *dst = &_sdata; dst < &_edata;) *dst++ = *src++;
    for (uint32_t *dst = &_sbss; dst < &_ebss;) *dst++ = 0;
    main();
    for (;;) {}
}

void Default_Handler(void) { for (;;) {} }

__attribute__((section(".isr_vector"), used))
void (*const vector_table[])(void) = {
    (void (*)(void))&_estack, Reset_Handler, Default_Handler /* NMI */, Default_Handler /* HardFault */,
};
`,
    'src/main.c': `// ${board.name} — ${board.cpu} @ ${board.clockHz / 1e6} MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
`,
    '.gitignore': 'build/\n',
  },
});

// An ISP programmer overwrites the bootloader, like Arduino's "Upload Using Programmer".
const AVR_UPLOAD = {
  bootloader: (b) => `avrdude ${b.avrdude} -p ${b.mcu} -P {port} -U flash:w:firmware.hex:i`,
  usbasp: (b) => `avrdude -c usbasp -p ${b.mcu} -U flash:w:firmware.hex:i`,
  arduinoisp: (b) => `avrdude -c stk500v1 -b 19200 -p ${b.mcu} -P {port} -U flash:w:firmware.hex:i`,
};

// Native-USB boards (ATmega32U4) have no USB serial in bare-metal code, so the bootloader can't be reached by software.
const NATIVE_USB_NOTE = `
// Serial goes out on the TX pin (D1), not USB: USB serial needs a USB stack. Without one the IDE can't reset the
// board into its bootloader, so press reset, set Port to the port that appears and click Upload within 8 seconds.`;

// Plain steps instead of a Makefile: Windows has no make by default. `u` is the USART wired to the serial pins.
const avr = ({ board, opt, options, baud = board.clockHz >= 16e6 ? 115200 : 57600, u = board.uart ?? 0 }) => ({
  baud,
  entry: 'src/main.c',
  build: [
    `avr-gcc -mmcu=${board.mcu} -DF_CPU=${board.clockHz}UL ${opt.c} -Wall -o firmware.elf src/main.c`,
    'avr-objcopy -O ihex -R .eeprom firmware.elf firmware.hex',
    'avr-size firmware.elf',
  ],
  lint: [`avr-gcc -mmcu=${board.mcu} -DF_CPU=${board.clockHz}UL ${opt.c} -fsyntax-only -Wall -Wextra src/main.c`],
  upload: [...(board.touch1200 && options.programmer === 'bootloader' ? [TOUCH_STEP] : []), AVR_UPLOAD[options.programmer](board)],
  files: {
    'src/main.c': `// ${board.name}: blink the LED (P${board.ledPort}${board.ledBit}) and count over serial at ${baud} baud${u ? NATIVE_USB_NOTE : ''}
#include <avr/io.h>
#include <stdlib.h>
#include <util/delay.h>

static void uart_init(void) {
    UCSR${u}A = _BV(U2X${u});
    UBRR${u} = F_CPU / 8 / ${baud} - 1;
    UCSR${u}B = _BV(TXEN${u});
    UCSR${u}C = _BV(UCSZ${u}1) | _BV(UCSZ${u}0);
}

static void uart_puts(const char *s) {
    while (*s) {
        loop_until_bit_is_set(UCSR${u}A, UDRE${u});
        UDR${u} = *s++;
    }
}

int main(void) {
    char buf[8];
    DDR${board.ledPort} |= _BV(P${board.ledPort}${board.ledBit});
    uart_init();
    for (unsigned i = 0;; i++) {
        PORT${board.ledPort} ^= _BV(P${board.ledPort}${board.ledBit});
        uart_puts("Hello from SiliconForge on ${board.name}: ");
        uart_puts(utoa(i, buf, 10));
        uart_puts("\\r\\n");
        _delay_ms(500);
    }
}
`,
    '.gitignore': '*.elf\n*.hex\n',
  },
});

// megaAVR 0-series (ATmega4809): same toolchain, new peripheral registers, flashed over UPDI by the board's USB bridge.
const megaAvr = (args) => {
  const base = avr({ ...args, options: { programmer: 'bootloader' } });
  const { board } = args;
  const led = `PORT${board.ledPort}`;
  return {
    ...base,
    files: {
      ...base.files,
      'src/main.c': `// ${board.name}: blink the LED (P${board.ledPort}${board.ledBit}) and count over serial at ${base.baud} baud
#include <avr/io.h>
#include <avr/xmega.h>
#include <stdlib.h>
#include <util/delay.h>

// USB serial is USART3 on its alternate pins, PB4 (TX) / PB5 (RX).
static void uart_init(void) {
    PORTMUX.USARTROUTEA = PORTMUX_USART3_ALT1_gc;
    PORTB.DIRSET = PIN4_bm;
    // correct for the internal oscillator's factory-measured error, as the Arduino core does
    int32_t baud = (8 * F_CPU / ${base.baud} + 1) / 2;
    baud += baud * (int8_t)SIGROW.OSC16ERR5V / 1024;
    USART3.BAUD = (uint16_t)baud;
    USART3.CTRLB = USART_TXEN_bm;
}

static void uart_puts(const char *s) {
    while (*s) {
        loop_until_bit_is_set(USART3.STATUS, USART_DREIF_bp);
        USART3.TXDATAL = *s++;
    }
}

int main(void) {
    char buf[8];
    _PROTECTED_WRITE(CLKCTRL.MCLKCTRLB, 0); // run at the full 16 MHz instead of the reset default of 16 / 6
    ${led}.DIRSET = PIN${board.ledBit}_bm;
    uart_init();
    for (unsigned i = 0;; i++) {
        ${led}.OUTTGL = PIN${board.ledBit}_bm;
        uart_puts("Hello from SiliconForge on ${board.name}: ");
        uart_puts(utoa(i, buf, 10));
        uart_puts("\\r\\n");
        _delay_ms(500);
    }
}
`,
    },
  };
};

const espIdf =({ name, board, opt, options }) => ({
  entry: 'main/main.c',
  build: ['idf.py build'],
  upload: [`idf.py -b ${options.uploadBaud} flash`],
  // sdkconfig.defaults is only read when sdkconfig is missing, so a new target or flash size needs it regenerated
  stale: ['build', 'sdkconfig'],
  files: {
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(${name})
`,
    'sdkconfig.defaults': `CONFIG_IDF_TARGET="${board.espChip}"
CONFIG_ESPTOOLPY_FLASHSIZE_${options.flashSize}=y
${opt.idf}
`,
    'main/CMakeLists.txt': 'idf_component_register(SRCS "main.c" INCLUDE_DIRS ".")\n',
    'main/main.c': `#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

void app_main(void) {
    for (int i = 0;; i++) {
        printf("Hello from SiliconForge on ${board.name}: %d\\n", i);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
`,
    '.gitignore': 'build/\nsdkconfig\nsdkconfig.old\n',
  },
});

const picoSdk = ({ name, board, opt }) => ({
  entry: 'src/main.c',
  build: [`cmake -S . -B build -G Ninja -DPICO_BOARD=${board.picoBoard} -DCMAKE_BUILD_TYPE=${opt.cmake}`, 'cmake --build build'],
  upload: ['picotool load -f -x build/firmware.uf2'],
  stale: ['build'], // the CMake cache pins the old PICO_BOARD
  files: {
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.13)
include($ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake)
project(${name} C CXX ASM)
pico_sdk_init()

add_executable(firmware src/main.c)
target_link_libraries(firmware pico_stdlib hardware_pwm hardware_adc)
pico_enable_stdio_usb(firmware 1)
pico_add_extra_outputs(firmware)
`,
    'src/main.c': `#include <stdio.h>
#include "pico/stdlib.h"

int main(void) {
    stdio_init_all();
    for (int i = 0;; i++) {
        printf("Hello from SiliconForge on ${board.name}: %d\\n", i);
        sleep_ms(1000);
    }
}
`,
    '.gitignore': 'build/\n',
  },
});

const cortexMRust = ({ name, board, opt }) => {
  const target = board.rustTarget;
  const memory = board.boot2
    ? `MEMORY
{
  BOOT2 : ORIGIN = ${board.flashOrigin}, LENGTH = 0x100
  FLASH : ORIGIN = ${board.flashOrigin} + 0x100, LENGTH = ${board.flashKB}K - 0x100
  RAM   : ORIGIN = ${board.ramOrigin}, LENGTH = ${board.ramKB}K
}

EXTERN(BOOT2_FIRMWARE)

SECTIONS {
  .boot2 ORIGIN(BOOT2) : { KEEP(*(.boot2)); } > BOOT2
} INSERT BEFORE .text;
`
    : `MEMORY
{
  FLASH : ORIGIN = ${board.flashOrigin}, LENGTH = ${board.flashKB}K
  RAM   : ORIGIN = ${board.ramOrigin}, LENGTH = ${board.ramKB}K
}
`;
  return {
    entry: 'src/main.rs',
    build: ['cargo build --release'],
    lint: ['cargo check'],
    // probe-rs flashes, then streams decoded defmt logs into the console until Stop.
    upload: ['cargo run --release'],
    files: {
      'Cargo.toml': `[package]
name = "${name}"
version = "0.1.0"
edition = "2021"

[dependencies]
cortex-m = { version = "0.7", features = ["critical-section-single-core"] }
cortex-m-rt = "0.7"
defmt = "1"
defmt-rtt = "1"
panic-probe = { version = "1", features = ["print-defmt"] }
${board.boot2 ? 'rp2040-boot2 = "0.3"\n' : ''}
[profile.release]
debug = 2
opt-level = ${opt.rust}
`,
      'rust-toolchain.toml': `[toolchain]
channel = "stable"
targets = ["${target}"]
`,
      '.cargo/config.toml': `[build]
target = "${target}"

[target.${target}]
runner = "probe-rs run --chip ${board.probeRsChip}"
rustflags = ["-C", "link-arg=--nmagic", "-C", "link-arg=-Tlink.x", "-C", "link-arg=-Tdefmt.x"]

[env]
DEFMT_LOG = "info"
`,
      'memory.x': memory,
      'build.rs': `// Put memory.x on the linker search path.
fn main() {
    let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
    std::fs::copy("memory.x", out.join("memory.x")).unwrap();
    println!("cargo:rustc-link-search={}", out.display());
    println!("cargo:rerun-if-changed=memory.x");
}
`,
      'src/main.rs': `#![no_std]
#![no_main]

use cortex_m_rt::entry;
use defmt_rtt as _;
use panic_probe as _;
${board.boot2 ? `
#[link_section = ".boot2"]
#[used]
pub static BOOT2_FIRMWARE: [u8; 256] = rp2040_boot2::BOOT_LOADER_GENERIC_03H;
` : ''}
#[entry]
fn main() -> ! {
    let mut n: u32 = 0;
    loop {
        defmt::info!("Hello from SiliconForge on ${board.name}: {}", n);
        n = n.wrapping_add(1);
        cortex_m::asm::delay(${board.clockHz});
    }
}
`,
      '.gitignore': 'target/\n',
    },
  };
};

const micropython = ({ board }) => ({
  entry: 'main.py',
  build: ['python -m py_compile boot.py main.py'],
  lint: ['python -m py_compile boot.py main.py'],
  upload: ['mpremote connect {port} cp boot.py main.py : + reset'],
  files: {
    'boot.py': '# Runs on every boot, before main.py.\n',
    'main.py': `# ${board.name} — streams two waveforms; open the Plotter to see them.
import math
import time

t = 0.0
while True:
    print("%.3f,%.3f" % (math.sin(t), math.cos(t)))
    t += 0.1
    time.sleep_ms(50)
`,
    '.gitignore': '__pycache__/\n',
  },
});

const GENERATORS = { arduino, 'cmake-arm': cmakeArm, avr, megaavr: megaAvr, 'esp-idf': espIdf, 'pico-sdk': picoSdk, 'cortex-m': cortexMRust, micropython };

// The same optimization choice expressed in each toolchain's vocabulary.
const OPTIMIZATION = {
  size: { c: '-Os', rust: '"s"', cmake: 'MinSizeRel', idf: 'CONFIG_COMPILER_OPTIMIZATION_SIZE=y', arduino: '' },
  speed: { c: '-O2', rust: '3', cmake: 'Release', idf: 'CONFIG_COMPILER_OPTIMIZATION_PERF=y', arduino: '' },
  debug: { c: '-Og', rust: '1', cmake: 'Debug', idf: 'CONFIG_COMPILER_OPTIMIZATION_DEBUG=y', arduino: '--optimize-for-debug' },
};

// Arduino-IDE style "Tools menu" choices per toolchain; `default` picks a board-specific value, else the first one wins.
// Values end up in shell commands, so only listed ones are accepted.
const BOARD_OPTIONS = {
  avr: [
    { id: 'programmer', label: 'Programmer', values: [['bootloader', 'Bootloader (USB cable)'], ['usbasp', 'USBasp'], ['arduinoisp', 'Arduino as ISP']] },
  ],
  'cmake-arm': [
    { id: 'probe', label: 'Debug probe', values: [['stlink', 'ST-Link'], ['jlink', 'J-Link'], ['cmsis-dap', 'CMSIS-DAP']], default: (b) => b.probe },
  ],
  'esp-idf': [
    { id: 'flashSize', label: 'Flash size', values: [['2MB', '2 MB'], ['4MB', '4 MB'], ['8MB', '8 MB'], ['16MB', '16 MB']], default: (b) => `${b.flashKB / 1024}MB` },
    { id: 'uploadBaud', label: 'Upload speed', values: [['460800', '460800 baud'], ['921600', '921600 baud'], ['115200', '115200 baud']] },
  ],
};

function boardOptions(board, lang) {
  return (BOARD_OPTIONS[board.langs[lang]] ?? []).map(({ default: pick, ...o }) => ({ ...o, default: pick?.(board) ?? o.values[0][0] }));
}

function resolveOptions(board, lang, given = {}) {
  return Object.fromEntries(boardOptions(board, lang).map((o) => {
    const value = given[o.id] ?? o.default;
    if (!o.values.some(([v]) => v === value)) throw new Error(`Unknown ${o.label.toLowerCase()} "${value}"`);
    return [o.id, value];
  }));
}

function generate({ name, board, lang, opt = 'size', options }) {
  const gen = GENERATORS[board.langs[lang]];
  if (!gen) throw new Error(`${board.name} does not support ${lang}`);
  if (!OPTIMIZATION[opt]) throw new Error(`Unknown optimization "${opt}"`);
  options = resolveOptions(board, lang, options);
  const { files, entry, build, lint, upload, baud = 115200, stale = [] } = gen({ name, board, options, opt: OPTIMIZATION[opt] });
  const manifest = { name, board: board.id, language: lang, entry, baud, build, lint, upload, opt, options };
  return { files: { ...files, 'siliconforge.json': JSON.stringify(manifest, null, 2) + '\n' }, manifest, stale };
}

const scaffold = (args) => generate(args).files;

// Moves an existing project to another board on the same toolchain. Files and manifest steps still matching what the
// old settings generated are regenerated; ones the user edited are kept and listed so they can be updated by hand.
// `read(rel)` returns a project file's text, or null if it does not exist.
function retarget({ manifest, from, to, opt = manifest.opt, options, read }) {
  const lang = manifest.language;
  if (from.langs[lang] !== to.langs[lang]) throw new Error(`${to.name} uses a different toolchain; create a new project for it`);
  const before = generate({ name: manifest.name, board: from, lang, opt: manifest.opt, options: manifest.options });
  const after = generate({ name: manifest.name, board: to, lang, opt, options });
  const write = {};
  const kept = [];
  for (const [rel, content] of Object.entries(after.files)) {
    if (rel === 'siliconforge.json') continue;
    const current = read(rel)?.replaceAll('\r\n', '\n') ?? null;
    if (current === content) continue;
    if (current === null || current === before.files[rel]) write[rel] = content;
    else if (before.files[rel] !== content) kept.push(rel);
  }
  const next = { ...manifest, board: to.id, opt: after.manifest.opt, options: after.manifest.options, lint: after.manifest.lint };
  for (const key of ['entry', 'baud', 'build', 'upload']) {
    if (isDeepStrictEqual(manifest[key], before.manifest[key])) next[key] = after.manifest[key];
    else if (!isDeepStrictEqual(manifest[key], after.manifest[key]) && !isDeepStrictEqual(before.manifest[key], after.manifest[key])) kept.push(`siliconforge.json "${key}"`);
  }
  write['siliconforge.json'] = JSON.stringify(next, null, 2) + '\n';
  return { write, kept, stale: Object.keys(write).length > 1 ? after.stale : [] };
}

module.exports = { scaffold, retarget, boardOptions };
