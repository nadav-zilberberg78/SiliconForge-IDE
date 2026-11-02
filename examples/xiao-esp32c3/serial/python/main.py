# Seeed XIAO ESP32-C3: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Seeed XIAO ESP32-C3:", count)
    count += 1
    time.sleep(1)
