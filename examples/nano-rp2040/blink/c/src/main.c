// Arduino Nano RP2040 Connect: blink GP6
#include "pico/stdlib.h"

#define LED 6

int main(void) {
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    for (;;) {
        gpio_xor_mask(1u << LED);
        sleep_ms(500);
    }
}
