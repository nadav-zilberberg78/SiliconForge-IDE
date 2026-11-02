// Espressif ESP32-C6-DevKitC-1: read a potentiometer wiper on 2. Open the Plotter at 115200 baud to graph it.
const int SENSOR = 2;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println(analogRead(SENSOR));
  delay(50);
}
