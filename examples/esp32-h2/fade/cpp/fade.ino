// Espressif ESP32-H2-DevKitM-1: fade an LED wired through a resistor to PWM pin 10.
const int LED = 10;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  for (int level = 0; level <= 255; level++) { analogWrite(LED, level); delay(4); }
  for (int level = 255; level >= 0; level--) { analogWrite(LED, level); delay(4); }
}
