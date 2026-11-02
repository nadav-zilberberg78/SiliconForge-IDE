// ST Nucleo-F446RE — STM32F446RET6 @ 180 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
