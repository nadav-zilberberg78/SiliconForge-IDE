// Adafruit Feather RP2040: sweep a hobby servo on GP16 (give it its own 5 V supply and share GND)
#include "pico/stdlib.h"
#include "hardware/clocks.h"
#include "hardware/pwm.h"

#define SERVO 16

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
