# WeAct Black Pill (STM32F411CE): print a counter to the Serial monitor.
import time

count = 0
while True:
    print("Hello from WeAct Black Pill (STM32F411CE):", count)
    count += 1
    time.sleep(1)
