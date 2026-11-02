# ST STM32F4-Discovery: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from ST STM32F4-Discovery:", count)
    count += 1
    time.sleep(1)
