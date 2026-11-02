// ST Nucleo-L476RG — STM32L476RGT6 @ 80 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
