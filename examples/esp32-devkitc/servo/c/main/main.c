// Espressif ESP32-DevKitC: sweep a hobby servo on GPIO18 (give it its own 5 V supply and share GND)
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/ledc.h"

#define US_TO_DUTY(us) ((us) * 8192 / 20000) // 13-bit duty over the 20 ms servo period

static void set_duty(uint32_t duty) {
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, duty);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}

void app_main(void) {
    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = LEDC_TIMER_13_BIT,
        .timer_num = LEDC_TIMER_0, .freq_hz = 50, .clk_cfg = LEDC_AUTO_CLK,
    };
    ledc_channel_config_t channel = {
        .gpio_num = 18, .speed_mode = LEDC_LOW_SPEED_MODE, .channel = LEDC_CHANNEL_0, .timer_sel = LEDC_TIMER_0,
    };
    ledc_timer_config(&timer);
    ledc_channel_config(&channel);
    for (;;) {
        for (int us = 1000; us <= 2000; us += 10) { set_duty(US_TO_DUTY(us)); vTaskDelay(pdMS_TO_TICKS(20)); }
        for (int us = 2000; us >= 1000; us -= 10) { set_duty(US_TO_DUTY(us)); vTaskDelay(pdMS_TO_TICKS(20)); }
    }
}
