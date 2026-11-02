# Seeed XIAO ESP32-S3: blink an LED
from machine import Pin
import time

led = Pin(21, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
