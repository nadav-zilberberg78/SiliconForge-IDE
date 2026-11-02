# Espressif ESP32-S3-DevKitC-1: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Espressif ESP32-S3-DevKitC-1:", count)
    count += 1
    time.sleep(1)
