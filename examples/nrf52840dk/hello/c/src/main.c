// Nordic nRF52840 DK — nRF52840 @ 64 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
