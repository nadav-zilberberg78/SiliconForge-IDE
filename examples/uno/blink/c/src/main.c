// Arduino Uno: blink the LED (PB5) and count over serial at 115200 baud
#include <avr/io.h>
#include <stdlib.h>
#include <util/delay.h>

static void uart_init(void) {
    UCSR0A = _BV(U2X0);
    UBRR0 = F_CPU / 8 / 115200 - 1;
    UCSR0B = _BV(TXEN0);
    UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);
}

static void uart_puts(const char *s) {
    while (*s) {
        loop_until_bit_is_set(UCSR0A, UDRE0);
        UDR0 = *s++;
    }
}

int main(void) {
    char buf[8];
    DDRB |= _BV(PB5);
    uart_init();
    for (unsigned i = 0;; i++) {
        PORTB ^= _BV(PB5);
        uart_puts("Hello from SiliconForge on Arduino Uno: ");
        uart_puts(utoa(i, buf, 10));
        uart_puts("\r\n");
        _delay_ms(500);
    }
}
