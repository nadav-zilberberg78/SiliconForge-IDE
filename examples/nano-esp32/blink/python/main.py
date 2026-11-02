# Arduino Nano ESP32: blink an LED
from machine import Pin
import time

led = Pin(48, Pin.OUT)

while True:
    led.value(not led.value())
    time.sleep_ms(500)
