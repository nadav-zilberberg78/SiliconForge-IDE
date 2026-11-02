// Arduino Uno: sweep a hobby servo on D9 with Timer1 (50 Hz on OC1A)
// Power the servo from its own 5 V supply and share GND.
#include <avr/io.h>
#include <util/delay.h>

#define TICKS_PER_US (F_CPU / 8000000UL)

int main(void) {
    DDRB |= _BV(PB1);
    ICR1 = 20000 * TICKS_PER_US;
    TCCR1A = _BV(COM1A1) | _BV(WGM11); // fast PWM, TOP = ICR1
    TCCR1B = _BV(WGM13) | _BV(WGM12) | _BV(CS11);
    for (;;) {
        for (unsigned us = 1000; us <= 2000; us += 10) { OCR1A = us * TICKS_PER_US; _delay_ms(15); }
        for (unsigned us = 2000; us >= 1000; us -= 10) { OCR1A = us * TICKS_PER_US; _delay_ms(15); }
    }
}
