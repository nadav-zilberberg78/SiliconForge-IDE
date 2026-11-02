// BBC micro:bit v2 — nRF52833 @ 64 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
