// Seeed XIAO ESP32-S3: print a counter. Open the Serial monitor at 115200 baud.
unsigned long count = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("Hello from Seeed XIAO ESP32-S3: ");
  Serial.println(count++);
  delay(1000);
}
