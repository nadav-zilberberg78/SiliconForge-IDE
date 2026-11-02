// Writes examples/<board>/<example>/<language>/ from one template per toolchain plus the pin tables below.
// Run `npm run examples` after changing a template; a test fails if the folder drifts from this file.
const fs = require('node:fs');
const path = require('node:path');
const boards = require('../src/boards.json');
const { scaffold } = require('../src/scaffold');

// Pins free on every board of a family, so the wiring comment is the only thing that changes.
const FAMILY_PINS = {
  esp32: { button: 4, analog: 34, pwm: 18 },
  esp32s2: { button: 4, analog: 1, pwm: 16 },
  esp32s3: { button: 4, analog: 1, pwm: 16 },
  esp32c3: { button: 4, analog: 2, pwm: 6 },
  esp32c6: { button: 4, analog: 2, pwm: 6 },
  esp32h2: { button: 4, analog: 2, pwm: 10 },
  esp8266: { button: 4, analog: 'A0', pwm: 14 },
  rp: { button: 15, analog: 26, pwm: 16 },
  stm32: { button: 'A1', analog: 'A0', pwm: 'A8' },
  arduino: { button: 2, analog: 'A0', pwm: 9 },
};

// GPIO of an on-board plain LED. `external` marks boards whose LED is RGB/wireless-only: the example drives a wired LED.
const LEDS = {
  'esp32-devkitc': { led: 2 }, 'esp32-doit-v1': { led: 2 }, 'esp32-s2': { led: 15, external: true }, 'lolin-s2-mini': { led: 15 },
  'esp32-s3': { led: 21, external: true }, 'xiao-esp32s3': { led: 21 }, 'nano-esp32': { led: 48 }, 'esp32-c3': { led: 7, external: true },
  'xiao-esp32c3': { led: 7, external: true }, 'esp32-c6': { led: 7, external: true }, 'esp32-h2': { led: 1, external: true }, 'nodemcu-esp8266': { led: 2 },
  pico: { led: 25 }, pico2: { led: 25 }, 'pico-w': { led: 14, external: true }, 'pico2-w': { led: 14, external: true },
  'nano-rp2040': { led: 6 }, 'feather-rp2040': { led: 13 }, 'xiao-rp2040': { led: 25 },
  'blackpill-f411': { led: 'C13' }, 'nucleo-f401re': { led: 'A5' }, 'nucleo-f446re': { led: 'A5' }, 'nucleo-l476rg': { led: 'A5' },
  'disco-f407': { led: 'D12' }, 'nucleo-h743zi': { led: 'B0' },
};

const family = (b) => b.espChip ?? (b.id === 'nodemcu-esp8266' ? 'esp8266' : /RP2/.test(b.cpu) ? 'rp' : /STM32/.test(b.cpu) ? 'stm32' : 'arduino');

// ---------- C++ (Arduino) ----------
function arduinoPins(b) {
  const f = family(b);
  const arduinoNumbered = f === 'arduino' || b.id === 'nano-esp32' || b.id === 'nano-rp2040'; // these cores use the D/A names printed on the board
  const p = arduinoNumbered ? FAMILY_PINS.arduino : FAMILY_PINS[f];
  const name = (v) => (f === 'stm32' && v !== 'A0' ? `P${v}` : v); // stm32duino spells port pins PA1
  const led = f.startsWith('esp') && !arduinoNumbered ? LEDS[b.id] : {}; // ESP32 cores do not always name an LED
  return { led: led.led ?? 'LED_BUILTIN', external: led.external, button: name(p.button), analog: f === 'rp' ? 'A0' : name(p.analog), pwm: name(p.pwm) };
}

const wired = (p) => (p.external ? ` (this board has no plain LED: wire one with a resistor to pin ${p.led})` : '');

const SKETCHES = {
  blink: (b, p) => `// ${b.name}: blink an LED once per second${wired(p)}
const int LED = ${p.led};

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
`,
  serial: (b, p, baud) => `// ${b.name}: print a counter. Open the Serial monitor at ${baud} baud.
unsigned long count = 0;

void setup() {
  Serial.begin(${baud});
}

void loop() {
  Serial.print("Hello from ${b.name}: ");
  Serial.println(count++);
  delay(1000);
}
`,
  'serial-echo': (b, p, baud) => `// ${b.name}: send a line from the Serial monitor (${baud} baud) and the board answers.
void setup() {
  Serial.begin(${baud});
  Serial.println("Type something and press Send.");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    Serial.print("You said: ");
    Serial.println(line);
  }
}
`,
  button: (b, p, baud) => `// ${b.name}: light the LED while a button is held${wired(p)}
// Wire a push button between pin ${p.button} and GND. The internal pull-up keeps the pin HIGH until it is pressed.
const int BUTTON = ${p.button};
const int LED = ${p.led};
bool wasPressed = false;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(${baud});
}

void loop() {
  bool pressed = digitalRead(BUTTON) == LOW;
  digitalWrite(LED, pressed ? HIGH : LOW);
  if (pressed != wasPressed) {
    Serial.println(pressed ? "pressed" : "released");
    wasPressed = pressed;
    delay(20); // ride out contact bounce
  }
}
`,
  fade: (b, p) => `// ${b.name}: fade an LED wired through a resistor to PWM pin ${p.pwm}.
const int LED = ${p.pwm};

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  for (int level = 0; level <= 255; level++) { analogWrite(LED, level); delay(4); }
  for (int level = 255; level >= 0; level--) { analogWrite(LED, level); delay(4); }
}
`,
  'analog-read': (b, p, baud) => `// ${b.name}: read a potentiometer wiper on ${p.analog}. Open the Plotter at ${baud} baud to graph it.
const int SENSOR = ${p.analog};

void setup() {
  Serial.begin(${baud});
}

void loop() {
  Serial.println(analogRead(SENSOR));
  delay(50);
}
`,
  plotter: (b, p, baud) => `// ${b.name}: stream two named waves. Open the Plotter at ${baud} baud; "name:value" labels its channels.
float t = 0;

void setup() {
  Serial.begin(${baud});
}

void loop() {
  Serial.print("sine:");
  Serial.print(sin(t));
  Serial.print(",cosine:");
  Serial.println(cos(t));
  t += 0.1;
  delay(50);
}
`,
  servo: (b, p) => {
    const lib = b.espChip ? 'ESP32Servo' : 'Servo';
    return `// ${b.name}: sweep a hobby servo. Signal wire to pin ${p.pwm}; power the servo from its own 5 V supply and share GND.
// Needs the ${lib} library: open Libraries and search for "${lib}".
#include <${lib}.h>

Servo servo;

void setup() {
  servo.attach(${p.pwm});
}

void loop() {
  for (int angle = 0; angle <= 180; angle++) { servo.write(angle); delay(15); }
  for (int angle = 180; angle >= 0; angle--) { servo.write(angle); delay(15); }
}
`;
  },
  'i2c-scanner': (b, p, baud) => `// ${b.name}: list the address of every I2C device on the default SDA/SCL pins.
#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(${baud});
}

void loop() {
  int found = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      Serial.println(address, HEX);
      found++;
    }
  }
  Serial.print(found);
  Serial.println(" device(s) found");
  delay(5000);
}
`,
};

// ---------- C, bare-metal AVR ----------
// OC1A carries both PWM examples; A0 is ADC7 on the 32U4.
const AVR_PINS = {
  atmega328p: { servo: ['B', 1, 'D9'], button: ['D', 2, 'D2'], adc: 0 },
  atmega2560: { servo: ['B', 5, 'D11'], button: ['E', 4, 'D2'], adc: 0 },
  atmega32u4: { servo: ['B', 5, 'D9'], button: ['D', 1, 'D2'], adc: 7 },
};

function avrUart(u, baud) {
  return `static void uart_init(void) {
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
`;
}

const AVR = {
  button: (b, { button: [port, bit, label] }) => `// ${b.name}: light the LED while a button between ${label} and GND is held
#include <avr/io.h>

int main(void) {
    DDR${b.ledPort} |= _BV(P${b.ledPort}${b.ledBit});
    PORT${port} |= _BV(P${port}${bit}); // internal pull-up
    for (;;) {
        if (bit_is_clear(PIN${port}, P${port}${bit})) PORT${b.ledPort} |= _BV(P${b.ledPort}${b.ledBit});
        else PORT${b.ledPort} &= ~_BV(P${b.ledPort}${b.ledBit});
    }
}
`,
  fade: (b, { servo: [port, bit, label] }) => `// ${b.name}: fade an LED wired through a resistor to ${label}, using Timer1 PWM on OC1A
#include <avr/io.h>
#include <util/delay.h>

int main(void) {
    DDR${port} |= _BV(P${port}${bit});
    TCCR1A = _BV(COM1A1) | _BV(WGM10); // 8-bit fast PWM
    TCCR1B = _BV(WGM12) | _BV(CS11);
    for (;;) {
        for (int level = 0; level <= 255; level++) { OCR1A = level; _delay_ms(4); }
        for (int level = 255; level >= 0; level--) { OCR1A = level; _delay_ms(4); }
    }
}
`,
  'analog-read': (b, { adc }, baud) => `// ${b.name}: read A0 and print it at ${baud} baud; open the Plotter to graph it
#include <avr/io.h>
#include <stdlib.h>
#include <util/delay.h>

${avrUart(b.uart ?? 0, baud)}
static unsigned adc_read(void) {
    ADCSRA |= _BV(ADSC);
    loop_until_bit_is_clear(ADCSRA, ADSC);
    return ADC;
}

int main(void) {
    char buf[8];
    uart_init();
    ADMUX = _BV(REFS0) | ${adc};
    ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);
    for (;;) {
        uart_puts(utoa(adc_read(), buf, 10));
        uart_puts("\\r\\n");
        _delay_ms(50);
    }
}
`,
  servo: (b, { servo: [port, bit, label] }) => `// ${b.name}: sweep a hobby servo on ${label} with Timer1 (50 Hz on OC1A)
// Power the servo from its own 5 V supply and share GND.
#include <avr/io.h>
#include <util/delay.h>

#define TICKS_PER_US (F_CPU / 8000000UL)

int main(void) {
    DDR${port} |= _BV(P${port}${bit});
    ICR1 = 20000 * TICKS_PER_US;
    TCCR1A = _BV(COM1A1) | _BV(WGM11); // fast PWM, TOP = ICR1
    TCCR1B = _BV(WGM13) | _BV(WGM12) | _BV(CS11);
    for (;;) {
        for (unsigned us = 1000; us <= 2000; us += 10) { OCR1A = us * TICKS_PER_US; _delay_ms(15); }
        for (unsigned us = 2000; us >= 1000; us -= 10) { OCR1A = us * TICKS_PER_US; _delay_ms(15); }
    }
}
`,
};

// ---------- C, ESP-IDF ----------
const idfHead = (b, what, includes) => `// ${b.name}: ${what}
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
${includes.map((i) => `#include ${i}`).join('\n')}
`;
const idfPwm = (pin, hz, bits) => `    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = LEDC_TIMER_${bits}_BIT,
        .timer_num = LEDC_TIMER_0, .freq_hz = ${hz}, .clk_cfg = LEDC_AUTO_CLK,
    };
    ledc_channel_config_t channel = {
        .gpio_num = ${pin}, .speed_mode = LEDC_LOW_SPEED_MODE, .channel = LEDC_CHANNEL_0, .timer_sel = LEDC_TIMER_0,
    };
    ledc_timer_config(&timer);
    ledc_channel_config(&channel);
`;
const IDF_DUTY = 'static void set_duty(uint32_t duty) {\n    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, duty);\n    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);\n}\n';

const IDF = {
  blink: (b, p) => `${idfHead(b, `blink GPIO${p.led}${p.external ? ' (wire an LED and resistor to it: this board has no plain LED)' : ''}`, ['"driver/gpio.h"'])}
#define LED ${p.led}

void app_main(void) {
    gpio_reset_pin(LED);
    gpio_set_direction(LED, GPIO_MODE_OUTPUT);
    for (int on = 1;; on = !on) {
        gpio_set_level(LED, on);
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
`,
  button: (b, p) => `${idfHead(b, `report a button wired between GPIO${p.button} and GND`, ['<stdio.h>', '"driver/gpio.h"'])}
#define BUTTON ${p.button}

void app_main(void) {
    gpio_reset_pin(BUTTON);
    gpio_set_direction(BUTTON, GPIO_MODE_INPUT);
    gpio_pullup_en(BUTTON);
    int was = 1;
    for (;;) {
        int now = gpio_get_level(BUTTON);
        if (now != was) {
            puts(now ? "released" : "pressed");
            was = now;
        }
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
`,
  fade: (b, p) => `${idfHead(b, `fade an LED wired through a resistor to GPIO${p.pwm}`, ['"driver/ledc.h"'])}
${IDF_DUTY}
void app_main(void) {
${idfPwm(p.pwm, 1000, 8)}    for (;;) {
        for (int level = 0; level <= 255; level++) { set_duty(level); vTaskDelay(pdMS_TO_TICKS(4)); }
        for (int level = 255; level >= 0; level--) { set_duty(level); vTaskDelay(pdMS_TO_TICKS(4)); }
    }
}
`,
  servo: (b, p) => `${idfHead(b, `sweep a hobby servo on GPIO${p.pwm} (give it its own 5 V supply and share GND)`, ['"driver/ledc.h"'])}
#define US_TO_DUTY(us) ((us) * 8192 / 20000) // 13-bit duty over the 20 ms servo period

${IDF_DUTY}
void app_main(void) {
${idfPwm(p.pwm, 50, 13)}    for (;;) {
        for (int us = 1000; us <= 2000; us += 10) { set_duty(US_TO_DUTY(us)); vTaskDelay(pdMS_TO_TICKS(20)); }
        for (int us = 2000; us >= 1000; us -= 10) { set_duty(US_TO_DUTY(us)); vTaskDelay(pdMS_TO_TICKS(20)); }
    }
}
`,
  'analog-read': (b, p) => `${idfHead(b, `print GPIO${p.analog} as raw ADC counts; open the Plotter to graph it`, ['<stdio.h>', '"esp_adc/adc_oneshot.h"'])}
void app_main(void) {
    adc_unit_t unit;
    adc_channel_t channel;
    adc_oneshot_io_to_channel(${p.analog}, &unit, &channel);
    adc_oneshot_unit_handle_t adc;
    adc_oneshot_unit_init_cfg_t init = { .unit_id = unit };
    adc_oneshot_chan_cfg_t config = { .atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT };
    adc_oneshot_new_unit(&init, &adc);
    adc_oneshot_config_channel(adc, channel, &config);
    for (;;) {
        int raw;
        adc_oneshot_read(adc, channel, &raw);
        printf("%d\\n", raw);
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
`,
};

// ---------- C, Pico SDK ----------
const PICO = {
  blink: (b, p) => `// ${b.name}: blink GP${p.led}${p.external ? ' (wire an LED and resistor to it: the on-board LED sits behind the wireless chip)' : ''}
#include "pico/stdlib.h"

#define LED ${p.led}

int main(void) {
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    for (;;) {
        gpio_xor_mask(1u << LED);
        sleep_ms(500);
    }
}
`,
  button: (b, p) => `// ${b.name}: report a button wired between GP${p.button} and GND
#include <stdio.h>
#include "pico/stdlib.h"

#define BUTTON ${p.button}

int main(void) {
    stdio_init_all();
    gpio_init(BUTTON);
    gpio_pull_up(BUTTON);
    bool was = true;
    for (;;) {
        bool now = gpio_get(BUTTON);
        if (now != was) {
            puts(now ? "released" : "pressed");
            was = now;
        }
        sleep_ms(20);
    }
}
`,
  fade: (b, p) => `// ${b.name}: fade an LED wired through a resistor to GP${p.pwm}
#include "pico/stdlib.h"
#include "hardware/pwm.h"

#define LED ${p.pwm}

int main(void) {
    gpio_set_function(LED, GPIO_FUNC_PWM);
    uint slice = pwm_gpio_to_slice_num(LED);
    pwm_set_wrap(slice, 255);
    pwm_set_enabled(slice, true);
    for (;;) {
        for (int level = 0; level <= 255; level++) { pwm_set_gpio_level(LED, level); sleep_ms(4); }
        for (int level = 255; level >= 0; level--) { pwm_set_gpio_level(LED, level); sleep_ms(4); }
    }
}
`,
  servo: (b, p) => `// ${b.name}: sweep a hobby servo on GP${p.pwm} (give it its own 5 V supply and share GND)
#include "pico/stdlib.h"
#include "hardware/clocks.h"
#include "hardware/pwm.h"

#define SERVO ${p.pwm}

int main(void) {
    gpio_set_function(SERVO, GPIO_FUNC_PWM);
    uint slice = pwm_gpio_to_slice_num(SERVO);
    pwm_set_clkdiv(slice, clock_get_hz(clk_sys) / 1000000.0f); // 1 tick per microsecond
    pwm_set_wrap(slice, 19999); // 20 ms period
    pwm_set_enabled(slice, true);
    for (;;) {
        for (uint us = 1000; us <= 2000; us += 10) { pwm_set_gpio_level(SERVO, us); sleep_ms(15); }
        for (uint us = 2000; us >= 1000; us -= 10) { pwm_set_gpio_level(SERVO, us); sleep_ms(15); }
    }
}
`,
  'analog-read': (b, p) => `// ${b.name}: print GP${p.analog} (ADC0) as 12-bit counts; open the Plotter to graph it
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/adc.h"

int main(void) {
    stdio_init_all();
    adc_init();
    adc_gpio_init(${p.analog});
    adc_select_input(0);
    for (;;) {
        printf("%u\\n", adc_read());
        sleep_ms(50);
    }
}
`,
};

// ---------- MicroPython ----------
const pyPin = (v) => (typeof v === 'string' ? JSON.stringify(v) : v);
const pyAdc = (b, p) => (family(b) === 'esp8266' ? 'ADC(0)' : `ADC(Pin(${pyPin(p.analog)}))`);
function pythonPins(b) {
  const led = LEDS[b.id] ?? {};
  // these MicroPython ports name the LED, including the one behind the Pico W's wireless chip
  return { ...FAMILY_PINS[family(b)], external: led.external && !/^pico/.test(b.id), led: /^pico/.test(b.id) ? 'LED' : led.led };
}

const PYTHON = {
  blink: (b, p) => `# ${b.name}: blink an LED${wired({ ...p, led: pyPin(p.led) })}
from machine import Pin
import time

led = Pin(${pyPin(p.led)}, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
`,
  serial: (b) => `# ${b.name}: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from ${b.name}:", count)
    count += 1
    time.sleep(1)
`,
  button: (b, p) => `# ${b.name}: report a button wired between pin ${pyPin(p.button)} and GND.
from machine import Pin
import time

button = Pin(${pyPin(p.button)}, Pin.IN, Pin.PULL_UP)
was = button.value()

while True:
    now = button.value()
    if now != was:
        print("released" if now else "pressed")
        was = now
    time.sleep_ms(20)
`,
  'analog-read': (b, p) => `# ${b.name}: print a potentiometer's reading; open the Plotter to graph it.
from machine import ADC, Pin
import time

sensor = ${pyAdc(b, p)}

while True:
    print(sensor.read_u16())
    time.sleep_ms(50)
`,
  plotter: (b) => `# ${b.name}: stream two named waves; "name:value" labels the Plotter's channels.
import math
import time

t = 0.0
while True:
    print("sine:%.3f,cosine:%.3f" % (math.sin(t), math.cos(t)))
    t += 0.1
    time.sleep_ms(50)
`,
  fade: (b, p) => `# ${b.name}: fade an LED wired through a resistor to pin ${pyPin(p.pwm)}.
from machine import PWM, Pin
import time

led = PWM(Pin(${pyPin(p.pwm)}))
led.freq(1000)

while True:
    for level in list(range(0, 65536, 512)) + list(range(65535, -1, -512)):
        led.duty_u16(level)
        time.sleep_ms(4)
`,
  servo: (b, p) => `# ${b.name}: sweep a hobby servo on pin ${pyPin(p.pwm)} (give it its own 5 V supply and share GND).
from machine import PWM, Pin
import time

servo = PWM(Pin(${pyPin(p.pwm)}))
servo.freq(50)


def write_us(us):
    servo.duty_u16(us * 65535 // 20000)


while True:
    for us in list(range(1000, 2001, 10)) + list(range(2000, 999, -10)):
        write_us(us)
        time.sleep_ms(15)
`,
};

function examplesFor(b, lang) {
  const kind = b.langs[lang];
  const base = scaffold({ name: 'example', board: b, lang });
  const m = JSON.parse(base['siliconforge.json']);
  // the scaffold's own starter is the example for toolchains with no templates above
  const starter = (name) => [name, [[m.entry, base[m.entry]]]];
  if (kind === 'arduino') return Object.keys(SKETCHES).map((name) => [name, [[`${name}.ino`, SKETCHES[name](b, arduinoPins(b), m.baud)]]]);
  if (kind === 'avr') {
    const pins = AVR_PINS[b.mcu];
    return [starter('blink'), ...Object.keys(AVR).map((name) => [name, [[m.entry, AVR[name](b, pins, m.baud)]]])];
  }
  if (kind === 'esp-idf') {
    const pins = { ...FAMILY_PINS[family(b)], ...LEDS[b.id] };
    return [starter('serial'), ...Object.keys(IDF).map((name) => [name, [[m.entry, IDF[name](b, pins)]]])];
  }
  if (kind === 'pico-sdk') {
    const pins = { ...FAMILY_PINS.rp, ...LEDS[b.id] };
    return [starter('serial'), ...Object.keys(PICO).map((name) => [name, [[m.entry, PICO[name](b, pins)]]])];
  }
  if (kind === 'micropython') {
    const pins = pythonPins(b);
    // the stm32 port has no machine.PWM
    const names = Object.keys(PYTHON).filter((name) => family(b) !== 'stm32' || !['fade', 'servo'].includes(name));
    return names.map((name) => [name, [[m.entry, PYTHON[name](b, pins)]]]);
  }
  return [starter('hello')]; // bare-metal Cortex-M C/Rust and megaAVR have no HAL here: registers differ per chip
}

// examples-relative path -> text
function generateTree() {
  const tree = {};
  for (const b of boards) {
    for (const lang of Object.keys(b.langs)) {
      for (const [example, files] of examplesFor(b, lang)) {
        for (const [rel, text] of files) tree[path.posix.join(b.id, example, lang, rel)] = text;
      }
    }
  }
  return tree;
}

if (require.main === module) {
  const root = path.join(__dirname, '..', 'examples');
  const tree = generateTree();
  for (const [rel, text] of Object.entries(tree)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
  console.log(`Wrote ${Object.keys(tree).length} example files`);
}

module.exports = { generateTree };
