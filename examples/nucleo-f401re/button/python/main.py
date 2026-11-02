# ST Nucleo-F401RE: report a button wired between pin "A1" and GND.
from machine import Pin
import time

button = Pin("A1", Pin.IN, Pin.PULL_UP)
was = button.value()

while True:
    now = button.value()
    if now != was:
        print("released" if now else "pressed")
        was = now
    time.sleep_ms(20)
