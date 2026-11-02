# Raspberry Pi Pico W (RP2040): print a potentiometer's reading; open the Plotter to graph it.
from machine import ADC, Pin
import time

sensor = ADC(Pin(26))

while True:
    print(sensor.read_u16())
    time.sleep_ms(50)
