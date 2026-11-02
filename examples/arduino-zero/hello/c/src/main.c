// Arduino Zero (EDBG port) — ATSAMD21G18A @ 48 MHz
#include <stdint.h>

static volatile uint32_t ticks;

int main(void) {
    for (;;) {
        ticks++;
    }
}
