# WeAct Black Pill (STM32F411CE): blink an LED
from machine import Pin
import time

led = Pin("C13", Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
