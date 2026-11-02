// Adafruit Feather RP2040: blink GP13
#include "pico/stdlib.h"

#define LED 13

int main(void) {
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    for (;;) {
        gpio_xor_mask(1u << LED);
        sleep_ms(500);
    }
}
