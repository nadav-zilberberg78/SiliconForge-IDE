# ST STM32F4-Discovery: blink an LED
from machine import Pin
import time

led = Pin("D12", Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
