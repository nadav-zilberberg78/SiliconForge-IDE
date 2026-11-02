# DOIT ESP32 DevKit V1: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from DOIT ESP32 DevKit V1:", count)
    count += 1
    time.sleep(1)
