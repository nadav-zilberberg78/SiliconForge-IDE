// Arduino Nano (old bootloader): light the LED while a button between D2 and GND is held
#include <avr/io.h>

int main(void) {
    DDRB |= _BV(PB5);
    PORTD |= _BV(PD2); // internal pull-up
    for (;;) {
        if (bit_is_clear(PIND, PD2)) PORTB |= _BV(PB5);
        else PORTB &= ~_BV(PB5);
    }
}
