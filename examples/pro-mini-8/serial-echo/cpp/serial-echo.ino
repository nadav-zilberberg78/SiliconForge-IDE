// Arduino Pro Mini 3.3 V / 8 MHz: send a line from the Serial monitor (57600 baud) and the board answers.
void setup() {
  Serial.begin(57600);
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
