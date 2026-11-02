# ST Nucleo-H743ZI: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from ST Nucleo-H743ZI:", count)
    count += 1
    time.sleep(1)
