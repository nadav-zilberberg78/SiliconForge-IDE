# Raspberry Pi Pico 2 (RP2350): blink an LED
from machine import Pin
import time

led = Pin("LED", Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
