# Wemos LOLIN S2 Mini: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from Wemos LOLIN S2 Mini:", count)
    count += 1
    time.sleep(1)
