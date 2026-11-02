// Espressif ESP32-S3-DevKitC-1: print GPIO1 as raw ADC counts; open the Plotter to graph it
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>
#include "esp_adc/adc_oneshot.h"

void app_main(void) {
    adc_unit_t unit;
    adc_channel_t channel;
    adc_oneshot_io_to_channel(1, &unit, &channel);
    adc_oneshot_unit_handle_t adc;
    adc_oneshot_unit_init_cfg_t init = { .unit_id = unit };
    adc_oneshot_chan_cfg_t config = { .atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT };
    adc_oneshot_new_unit(&init, &adc);
    adc_oneshot_config_channel(adc, channel, &config);
    for (;;) {
        int raw;
        adc_oneshot_read(adc, channel, &raw);
        printf("%d\n", raw);
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
