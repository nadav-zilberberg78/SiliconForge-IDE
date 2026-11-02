# Arduino Nano ESP32: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Arduino Nano ESP32:", count)
    count += 1
    time.sleep(1)
