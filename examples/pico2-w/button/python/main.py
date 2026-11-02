# Raspberry Pi Pico 2 W (RP2350): report a button wired between pin 15 and GND.
from machine import Pin
import time

button = Pin(15, Pin.IN, Pin.PULL_UP)
was = button.value()

while True:
    now = button.value()
    if now != was:
        print("released" if now else "pressed")
        was = now
    time.sleep_ms(20)
