# ST Nucleo-F446RE: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from ST Nucleo-F446RE:", count)
    count += 1
    time.sleep(1)
