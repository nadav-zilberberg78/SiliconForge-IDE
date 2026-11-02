# DOIT ESP32 DevKit V1: sweep a hobby servo on pin 18 (give it its own 5 V supply and share GND).
from machine import PWM, Pin
import time

servo = PWM(Pin(18))
servo.freq(50)


def write_us(us):
    servo.duty_u16(us * 65535 // 20000)


while True:
    for us in list(range(1000, 2001, 10)) + list(range(2000, 999, -10)):
        write_us(us)
        time.sleep_ms(15)
