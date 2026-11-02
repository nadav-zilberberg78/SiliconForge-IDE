# Espressif ESP32-C3-DevKitM-1: report a button wired between pin 4 and GND.
from machine import Pin
import time

button = Pin(4, Pin.IN, Pin.PULL_UP)
was = button.value()

while True:
    now = button.value()
    if now != was:
        print("released" if now else "pressed")
        was = now
    time.sleep_ms(20)
