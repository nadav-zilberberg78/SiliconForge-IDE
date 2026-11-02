// WeAct Black Pill (STM32F411CE): fade an LED wired through a resistor to PWM pin PA8.
const int LED = PA8;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  for (int level = 0; level <= 255; level++) { analogWrite(LED, level); delay(4); }
  for (int level = 255; level >= 0; level--) { analogWrite(LED, level); delay(4); }
}
