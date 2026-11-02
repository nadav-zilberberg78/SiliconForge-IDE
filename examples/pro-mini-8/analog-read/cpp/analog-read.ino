// Arduino Pro Mini 3.3 V / 8 MHz: read a potentiometer wiper on A0. Open the Plotter at 57600 baud to graph it.
const int SENSOR = A0;

void setup() {
  Serial.begin(57600);
}

void loop() {
  Serial.println(analogRead(SENSOR));
  delay(50);
}
