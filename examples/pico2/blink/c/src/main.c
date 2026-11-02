// Raspberry Pi Pico 2 (RP2350): blink GP25
#include "pico/stdlib.h"

#define LED 25

int main(void) {
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    for (;;) {
        gpio_xor_mask(1u << LED);
        sleep_ms(500);
    }
}
