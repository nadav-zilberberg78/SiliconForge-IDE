// Espressif ESP32-C3-DevKitM-1: fade an LED wired through a resistor to GPIO6
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/ledc.h"

static void set_duty(uint32_t duty) {
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, duty);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}

void app_main(void) {
    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = LEDC_TIMER_8_BIT,
        .timer_num = LEDC_TIMER_0, .freq_hz = 1000, .clk_cfg = LEDC_AUTO_CLK,
    };
    ledc_channel_config_t channel = {
        .gpio_num = 6, .speed_mode = LEDC_LOW_SPEED_MODE, .channel = LEDC_CHANNEL_0, .timer_sel = LEDC_TIMER_0,
    };
    ledc_timer_config(&timer);
    ledc_channel_config(&channel);
    for (;;) {
        for (int level = 0; level <= 255; level++) { set_duty(level); vTaskDelay(pdMS_TO_TICKS(4)); }
        for (int level = 255; level >= 0; level--) { set_duty(level); vTaskDelay(pdMS_TO_TICKS(4)); }
    }
}
