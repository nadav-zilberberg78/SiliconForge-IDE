#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

void app_main(void) {
    for (int i = 0;; i++) {
        printf("Hello from SiliconForge on DOIT ESP32 DevKit V1: %d\n", i);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
