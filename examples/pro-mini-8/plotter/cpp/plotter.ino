// Arduino Pro Mini 3.3 V / 8 MHz: stream two named waves. Open the Plotter at 57600 baud; "name:value" labels its channels.
float t = 0;

void setup() {
  Serial.begin(57600);
}

void loop() {
  Serial.print("sine:");
  Serial.print(sin(t));
  Serial.print(",cosine:");
  Serial.println(cos(t));
  t += 0.1;
  delay(50);
}
