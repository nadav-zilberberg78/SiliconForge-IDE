// Espressif ESP32-C3-DevKitM-1: report a button wired between GPIO4 and GND
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>
#include "driver/gpio.h"

#define BUTTON 4

void app_main(void) {
    gpio_reset_pin(BUTTON);
    gpio_set_direction(BUTTON, GPIO_MODE_INPUT);
    gpio_pullup_en(BUTTON);
    int was = 1;
    for (;;) {
        int now = gpio_get_level(BUTTON);
        if (now != was) {
            puts(now ? "released" : "pressed");
            was = now;
        }
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
