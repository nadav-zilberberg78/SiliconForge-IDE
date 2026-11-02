#include <stdio.h>
#include "pico/stdlib.h"

int main(void) {
    stdio_init_all();
    for (int i = 0;; i++) {
        printf("Hello from SiliconForge on Arduino Nano RP2040 Connect: %d\n", i);
        sleep_ms(1000);
    }
}
