// Espressif ESP32-S3-DevKitC-1: sweep a hobby servo. Signal wire to pin 16; power the servo from its own 5 V supply and share GND.
// Needs the ESP32Servo library: open Libraries and search for "ESP32Servo".
#include <ESP32Servo.h>

Servo servo;

void setup() {
  servo.attach(16);
}

void loop() {
  for (int angle = 0; angle <= 180; angle++) { servo.write(angle); delay(15); }
  for (int angle = 180; angle >= 0; angle--) { servo.write(angle); delay(15); }
}
