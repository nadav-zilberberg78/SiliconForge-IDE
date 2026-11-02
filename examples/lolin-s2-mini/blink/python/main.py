# Wemos LOLIN S2 Mini: blink an LED
from machine import Pin
import time

led = Pin(15, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
