// Blue Pill (STM32F103C8) — STM32F103C8T6 @ 72 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
