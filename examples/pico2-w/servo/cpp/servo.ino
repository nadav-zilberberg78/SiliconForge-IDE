// Raspberry Pi Pico 2 W (RP2350): sweep a hobby servo. Signal wire to pin 16; power the servo from its own 5 V supply and share GND.
// Needs the Servo library: open Libraries and search for "Servo".
#include <Servo.h>

Servo servo;

void setup() {
  servo.attach(16);
}

void loop() {
  for (int angle = 0; angle <= 180; angle++) { servo.write(angle); delay(15); }
  for (int angle = 180; angle >= 0; angle--) { servo.write(angle); delay(15); }
}
