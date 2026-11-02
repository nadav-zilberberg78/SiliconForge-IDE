# Seeed XIAO RP2040: blink an LED
from machine import Pin
import time

led = Pin(25, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
