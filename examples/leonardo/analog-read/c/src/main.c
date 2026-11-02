// Arduino Leonardo: read A0 and print it at 115200 baud; open the Plotter to graph it
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

static unsigned adc_read(void) {
    ADCSRA |= _BV(ADSC);
    loop_until_bit_is_clear(ADCSRA, ADSC);
    return ADC;
}

int main(void) {
    char buf[8];
    uart_init();
    ADMUX = _BV(REFS0) | 7;
    ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);
    for (;;) {
        uart_puts(utoa(adc_read(), buf, 10));
        uart_puts("\r\n");
        _delay_ms(50);
    }
}
