// DOIT ESP32 DevKit V1: read a potentiometer wiper on 34. Open the Plotter at 115200 baud to graph it.
const int SENSOR = 34;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println(analogRead(SENSOR));
  delay(50);
}
