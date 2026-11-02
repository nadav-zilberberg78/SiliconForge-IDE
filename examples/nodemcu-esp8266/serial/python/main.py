# NodeMCU (ESP8266): print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from NodeMCU (ESP8266):", count)
    count += 1
    time.sleep(1)
