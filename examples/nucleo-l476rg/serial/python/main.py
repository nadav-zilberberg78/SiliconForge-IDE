# ST Nucleo-L476RG: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from ST Nucleo-L476RG:", count)
    count += 1
    time.sleep(1)
