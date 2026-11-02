// Arduino Nano Every: fade an LED wired through a resistor to PWM pin 9.
const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  for (int level = 0; level <= 255; level++) { analogWrite(LED, level); delay(4); }
  for (int level = 255; level >= 0; level--) { analogWrite(LED, level); delay(4); }
}
