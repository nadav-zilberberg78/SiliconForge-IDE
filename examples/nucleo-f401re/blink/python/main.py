# ST Nucleo-F401RE: blink an LED
from machine import Pin
import time

led = Pin("A5", Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
