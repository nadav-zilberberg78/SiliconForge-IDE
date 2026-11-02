// ST Nucleo-H743ZI — STM32H743ZIT6 @ 480 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
