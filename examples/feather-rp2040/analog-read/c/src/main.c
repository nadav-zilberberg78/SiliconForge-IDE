// Adafruit Feather RP2040: print GP26 (ADC0) as 12-bit counts; open the Plotter to graph it
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/adc.h"

int main(void) {
    stdio_init_all();
    adc_init();
    adc_gpio_init(26);
    adc_select_input(0);
    for (;;) {
        printf("%u\n", adc_read());
        sleep_ms(50);
    }
}
