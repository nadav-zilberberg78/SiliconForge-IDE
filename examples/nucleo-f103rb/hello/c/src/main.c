// ST Nucleo-F103RB — STM32F103RBT6 @ 72 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
