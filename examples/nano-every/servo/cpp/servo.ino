// Arduino Nano Every: sweep a hobby servo. Signal wire to pin 9; power the servo from its own 5 V supply and share GND.
// Needs the Servo library: open Libraries and search for "Servo".
#include <Servo.h>

Servo servo;

void setup() {
  servo.attach(9);
}

void loop() {
  for (int angle = 0; angle <= 180; angle++) { servo.write(angle); delay(15); }
  for (int angle = 180; angle >= 0; angle--) { servo.write(angle); delay(15); }
}
