// ST STM32F4-Discovery — STM32F407VGT6 @ 168 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
