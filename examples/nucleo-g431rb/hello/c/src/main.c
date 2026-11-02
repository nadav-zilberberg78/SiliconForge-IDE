// ST Nucleo-G431RB — STM32G431RBT6 @ 170 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
