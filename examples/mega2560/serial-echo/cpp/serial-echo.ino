// Arduino Mega 2560: send a line from the Serial monitor (115200 baud) and the board answers.
void setup() {
  Serial.begin(115200);
  Serial.println("Type something and press Send.");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    Serial.print("You said: ");
    Serial.println(line);
  }
}
