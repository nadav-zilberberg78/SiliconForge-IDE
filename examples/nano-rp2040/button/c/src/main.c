// Arduino Nano RP2040 Connect: report a button wired between GP15 and GND
#include <stdio.h>
#include "pico/stdlib.h"

#define BUTTON 15

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
