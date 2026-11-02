# Espressif ESP32-C3-DevKitM-1: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Espressif ESP32-C3-DevKitM-1:", count)
    count += 1
    time.sleep(1)
