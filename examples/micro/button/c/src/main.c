// Arduino Micro: light the LED while a button between D2 and GND is held
#include <avr/io.h>

int main(void) {
    DDRC |= _BV(PC7);
    PORTD |= _BV(PD1); // internal pull-up
    for (;;) {
        if (bit_is_clear(PIND, PD1)) PORTC |= _BV(PC7);
        else PORTC &= ~_BV(PC7);
    }
}
