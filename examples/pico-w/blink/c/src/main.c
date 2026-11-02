// Raspberry Pi Pico W (RP2040): blink GP14 (wire an LED and resistor to it: the on-board LED sits behind the wireless chip)
#include "pico/stdlib.h"

#define LED 14

int main(void) {
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    for (;;) {
        gpio_xor_mask(1u << LED);
        sleep_ms(500);
    }
}
