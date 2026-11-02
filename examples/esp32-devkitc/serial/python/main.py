# Espressif ESP32-DevKitC: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Espressif ESP32-DevKitC:", count)
    count += 1
    time.sleep(1)
