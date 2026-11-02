// WeAct Black Pill (STM32F411CE) — STM32F411CEU6 @ 100 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
