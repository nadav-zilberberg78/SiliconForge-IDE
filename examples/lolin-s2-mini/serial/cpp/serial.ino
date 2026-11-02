// Wemos LOLIN S2 Mini: print a counter. Open the Serial monitor at 115200 baud.
unsigned long count = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("Hello from Wemos LOLIN S2 Mini: ");
  Serial.println(count++);
  delay(1000);
}
