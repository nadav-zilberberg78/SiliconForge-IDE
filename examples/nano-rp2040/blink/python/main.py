# Arduino Nano RP2040 Connect: blink an LED
from machine import Pin
import time

led = Pin(6, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
