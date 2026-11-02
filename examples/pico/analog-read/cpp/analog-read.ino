// Raspberry Pi Pico (RP2040): read a potentiometer wiper on A0. Open the Plotter at 115200 baud to graph it.
const int SENSOR = A0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println(analogRead(SENSOR));
  delay(50);
}
