// Arduino Pro Mini 3.3 V / 8 MHz: light the LED while a button is held
// Wire a push button between pin 2 and GND. The internal pull-up keeps the pin HIGH until it is pressed.
const int BUTTON = 2;
const int LED = LED_BUILTIN;
bool wasPressed = false;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(57600);
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
