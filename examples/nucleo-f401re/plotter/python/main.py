# ST Nucleo-F401RE: stream two named waves; "name:value" labels the Plotter's channels.
import math
import time

t = 0.0
while True:
    print("sine:%.3f,cosine:%.3f" % (math.sin(t), math.cos(t)))
    t += 0.1
    time.sleep_ms(50)
