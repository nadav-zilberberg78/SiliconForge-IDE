// ST Nucleo-L476RG: list the address of every I2C device on the default SDA/SCL pins.
#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(115200);
}

void loop() {
  int found = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      Serial.println(address, HEX);
      found++;
    }
  }
  Serial.print(found);
  Serial.println(" device(s) found");
  delay(5000);
}
