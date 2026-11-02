# Espressif ESP32-DevKitC: print a potentiometer's reading; open the Plotter to graph it.
from machine import ADC, Pin
import time

sensor = ADC(Pin(34))

while True:
    print(sensor.read_u16())
    time.sleep_ms(50)
