// Arduino Mega 2560: read A0 and print it at 115200 baud; open the Plotter to graph it
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

static unsigned adc_read(void) {
    ADCSRA |= _BV(ADSC);
    loop_until_bit_is_clear(ADCSRA, ADSC);
    return ADC;
}

int main(void) {
    char buf[8];
    uart_init();
    ADMUX = _BV(REFS0) | 0;
    ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);
    for (;;) {
        uart_puts(utoa(adc_read(), buf, 10));
        uart_puts("\r\n");
        _delay_ms(50);
    }
}
