# Raspberry Pi Pico 2 (RP2350): print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Raspberry Pi Pico 2 (RP2350):", count)
    count += 1
    time.sleep(1)
