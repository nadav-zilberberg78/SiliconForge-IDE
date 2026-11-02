# Seeed XIAO ESP32-C3: blink an LED (this board has no plain LED: wire one with a resistor to pin 7)
from machine import Pin
import time

led = Pin(7, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
