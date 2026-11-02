// Espressif ESP32-S2-Saola-1: light the LED while a button is held (this board has no plain LED: wire one with a resistor to pin 15)
// Wire a push button between pin 4 and GND. The internal pull-up keeps the pin HIGH until it is pressed.
const int BUTTON = 4;
const int LED = 15;
bool wasPressed = false;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  bool pressed = digitalRead(BUTTON) == LOW;
  digitalWrite(LED, pressed ? HIGH : LOW);
  if (pressed != wasPressed) {
    Serial.println(pressed ? "pressed" : "released");
    wasPressed = pressed;
    delay(20); // ride out contact bounce
  }
}
