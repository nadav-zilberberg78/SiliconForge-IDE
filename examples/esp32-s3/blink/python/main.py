# Espressif ESP32-S3-DevKitC-1: blink an LED (this board has no plain LED: wire one with a resistor to pin 21)
from machine import Pin
import time

led = Pin(21, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
