# ST Nucleo-F401RE: print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from ST Nucleo-F401RE:", count)
    count += 1
    time.sleep(1)
