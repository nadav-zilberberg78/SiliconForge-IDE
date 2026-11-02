// Arduino Micro: blink the LED (PC7) and count over serial at 115200 baud
// Serial goes out on the TX pin (D1), not USB: USB serial needs a USB stack. Without one the IDE can't reset the
// board into its bootloader, so press reset, set Port to the port that appears and click Upload within 8 seconds.
#include <avr/io.h>
#include <stdlib.h>
#include <util/delay.h>

static void uart_init(void) {
    UCSR1A = _BV(U2X1);
    UBRR1 = F_CPU / 8 / 115200 - 1;
    UCSR1B = _BV(TXEN1);
    UCSR1C = _BV(UCSZ11) | _BV(UCSZ10);
}

static void uart_puts(const char *s) {
    while (*s) {
        loop_until_bit_is_set(UCSR1A, UDRE1);
        UDR1 = *s++;
    }
}

int main(void) {
    char buf[8];
    DDRC |= _BV(PC7);
    uart_init();
    for (unsigned i = 0;; i++) {
        PORTC ^= _BV(PC7);
        uart_puts("Hello from SiliconForge on Arduino Micro: ");
        uart_puts(utoa(i, buf, 10));
        uart_puts("\r\n");
        _delay_ms(500);
    }
}
