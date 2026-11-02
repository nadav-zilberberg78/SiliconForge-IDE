// Arduino Pro Mini 5 V / 16 MHz: fade an LED wired through a resistor to D9, using Timer1 PWM on OC1A
#include <avr/io.h>
#include <util/delay.h>

int main(void) {
    DDRB |= _BV(PB1);
    TCCR1A = _BV(COM1A1) | _BV(WGM10); // 8-bit fast PWM
    TCCR1B = _BV(WGM12) | _BV(CS11);
    for (;;) {
        for (int level = 0; level <= 255; level++) { OCR1A = level; _delay_ms(4); }
        for (int level = 255; level >= 0; level--) { OCR1A = level; _delay_ms(4); }
    }
}
