// Espressif ESP32-S2-Saola-1: blink an LED once per second (this board has no plain LED: wire one with a resistor to pin 15)
const int LED = 15;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
