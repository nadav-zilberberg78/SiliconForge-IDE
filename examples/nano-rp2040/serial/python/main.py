# Arduino Nano RP2040 Connect: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Arduino Nano RP2040 Connect:", count)
    count += 1
    time.sleep(1)
