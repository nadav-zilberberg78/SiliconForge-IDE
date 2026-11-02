# Espressif ESP32-C3-DevKitM-1: fade an LED wired through a resistor to pin 6.
from machine import PWM, Pin
import time

led = PWM(Pin(6))
led.freq(1000)

while True:
    for level in list(range(0, 65536, 512)) + list(range(65535, -1, -512)):
        led.duty_u16(level)
        time.sleep_ms(4)
