# DOIT ESP32 DevKit V1: blink an LED
from machine import Pin
import time

led = Pin(2, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
