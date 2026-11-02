// ST Nucleo-F401RE — STM32F401RET6 @ 84 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
