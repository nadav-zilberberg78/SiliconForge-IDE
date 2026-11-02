// Arduino Nano Every: stream two named waves. Open the Plotter at 115200 baud; "name:value" labels its channels.
float t = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("sine:");
  Serial.print(sin(t));
  Serial.print(",cosine:");
  Serial.println(cos(t));
  t += 0.1;
  delay(50);
}
