// Espressif ESP32-DevKitC: blink GPIO2
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"

#define LED 2

void app_main(void) {
    gpio_reset_pin(LED);
    gpio_set_direction(LED, GPIO_MODE_OUTPUT);
    for (int on = 1;; on = !on) {
        gpio_set_level(LED, on);
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
