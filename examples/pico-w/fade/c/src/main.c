// Raspberry Pi Pico W (RP2040): fade an LED wired through a resistor to GP16
#include "pico/stdlib.h"
#include "hardware/pwm.h"

#define LED 16

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
