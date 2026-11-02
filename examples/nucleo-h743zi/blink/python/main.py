# ST Nucleo-H743ZI: blink an LED
from machine import Pin
import time

led = Pin("B0", Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
