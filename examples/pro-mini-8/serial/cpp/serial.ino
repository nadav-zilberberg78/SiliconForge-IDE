// Arduino Pro Mini 3.3 V / 8 MHz: print a counter. Open the Serial monitor at 57600 baud.
unsigned long count = 0;

void setup() {
  Serial.begin(57600);
}

void loop() {
  Serial.print("Hello from Arduino Pro Mini 3.3 V / 8 MHz: ");
  Serial.println(count++);
  delay(1000);
}
