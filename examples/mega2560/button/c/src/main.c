// Arduino Mega 2560: light the LED while a button between D2 and GND is held
#include <avr/io.h>

int main(void) {
    DDRB |= _BV(PB7);
    PORTE |= _BV(PE4); // internal pull-up
    for (;;) {
        if (bit_is_clear(PINE, PE4)) PORTB |= _BV(PB7);
        else PORTB &= ~_BV(PB7);
    }
}
