# ST Nucleo-L476RG: print a potentiometer's reading; open the Plotter to graph it.
from machine import ADC, Pin
import time

sensor = ADC(Pin("A0"))

while True:
    print(sensor.read_u16())
    time.sleep_ms(50)
