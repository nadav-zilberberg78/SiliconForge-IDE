// Arduino Nano Every: blink the LED (PE2) and count over serial at 115200 baud
#include <avr/io.h>
#include <avr/xmega.h>
#include <stdlib.h>
#include <util/delay.h>

// USB serial is USART3 on its alternate pins, PB4 (TX) / PB5 (RX).
static void uart_init(void) {
    PORTMUX.USARTROUTEA = PORTMUX_USART3_ALT1_gc;
    PORTB.DIRSET = PIN4_bm;
    // correct for the internal oscillator's factory-measured error, as the Arduino core does
    int32_t baud = (8 * F_CPU / 115200 + 1) / 2;
    baud += baud * (int8_t)SIGROW.OSC16ERR5V / 1024;
    USART3.BAUD = (uint16_t)baud;
    USART3.CTRLB = USART_TXEN_bm;
}

static void uart_puts(const char *s) {
    while (*s) {
        loop_until_bit_is_set(USART3.STATUS, USART_DREIF_bp);
        USART3.TXDATAL = *s++;
    }
}

int main(void) {
    char buf[8];
    _PROTECTED_WRITE(CLKCTRL.MCLKCTRLB, 0); // run at the full 16 MHz instead of the reset default of 16 / 6
    PORTE.DIRSET = PIN2_bm;
    uart_init();
    for (unsigned i = 0;; i++) {
        PORTE.OUTTGL = PIN2_bm;
        uart_puts("Hello from SiliconForge on Arduino Nano Every: ");
        uart_puts(utoa(i, buf, 10));
        uart_puts("\r\n");
        _delay_ms(500);
    }
}
