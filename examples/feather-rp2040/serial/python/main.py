# Adafruit Feather RP2040: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Adafruit Feather RP2040:", count)
    count += 1
    time.sleep(1)
