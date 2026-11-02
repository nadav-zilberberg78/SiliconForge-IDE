# Seeed XIAO ESP32-S3: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Seeed XIAO ESP32-S3:", count)
    count += 1
    time.sleep(1)
