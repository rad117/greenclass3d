/*
  Green Class AI — occupancy + climate rule logic
  Tinkercad-simulatable build (Arduino Uno). Mirrors the same rules as the
  3D viewer's occupancy sim (../main.js):

    occupied  = motion seen within the last OCCUPANCY_TIMEOUT window
    lightsOn  = occupied && room is dim            (PIR + LDR)
    acOn      = occupied && roomTemp > acThreshold  (PIR + DHT11)
    acThreshold is lower while occupied (cool sooner for comfort) and
    higher while vacant (an energy-saving setback) — same idea as a
    real thermostat schedule.

  Real hardware target is an ESP32-WROOM-32 (see the BOM in main.js's
  PARTS array); this sketch targets Arduino Uno instead because that's
  the board Tinkercad Circuits supports out of the box. Suggested
  ESP32 GPIO equivalents are noted next to each #define below — swap
  the pin numbers if you port this to the real board.

  Requires the "DHT sensor library" by Adafruit (Tinkercad has it
  preinstalled in the code editor's library list).
*/

#include <DHT.h>

// ---- pins (Arduino Uno / Tinkercad) ----------------------------------
#define PIR_PIN        2   // ESP32: GPIO27
#define DHT_PIN        4   // ESP32: GPIO26
#define LDR_PIN        A0  // ESP32: GPIO34 (ADC1_CH6)
#define GAS_PIN        A1  // ESP32: GPIO35 (ADC1_CH7) — MQ-135 in the real BOM, "Gas Sensor" in Tinkercad
#define RELAY_LIGHTS   7   // ESP32: GPIO25 — relay channel 1
#define RELAY_FAN      8   // ESP32: GPIO33 — relay channel 2 (drives fan + AC together)
// Relay channels 3 & 4 are unused, same as the 3D model (reserve GPIO32 / GPIO23 on ESP32)

DHT dht(DHT_PIN, DHT11);

// ---- rule constants (match main.js exactly) --------------------------
const unsigned long OCCUPANCY_TIMEOUT = 5UL * 60UL * 1000UL; // 5 minutes
const int   LDR_DIM_THRESHOLD      = 400;  // analog reading below this = "dim"; tune against your simulated light level
const float TEMP_THRESHOLD_OCCUPIED = 25.0; // acThreshold while occupied
const float TEMP_THRESHOLD_VACANT   = 28.0; // acThreshold while vacant (setback)

bool occupied = false;
unsigned long lastMotion = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_LIGHTS, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  digitalWrite(RELAY_LIGHTS, LOW);
  digitalWrite(RELAY_FAN, LOW);
  dht.begin();
}

void loop() {
  // --- occupancy: PIR + timeout, same as the "Person in room" sim ---
  if (digitalRead(PIR_PIN) == HIGH) {
    lastMotion = millis();
    occupied = true;
  } else if (occupied && millis() - lastMotion > OCCUPANCY_TIMEOUT) {
    occupied = false;
  }

  // --- sensor reads ---
  int   ldrReading = analogRead(LDR_PIN);
  bool  roomDim    = ldrReading < LDR_DIM_THRESHOLD;
  float roomTemp   = dht.readTemperature(); // °C, NaN if the read glitches
  int   gasIndex   = analogRead(GAS_PIN);   // telemetry only, no relay tied to it (matches main.js)

  // --- occupancy-dependent AC threshold ---
  float acThreshold  = occupied ? TEMP_THRESHOLD_OCCUPIED : TEMP_THRESHOLD_VACANT;
  bool  needsCooling  = occupied && !isnan(roomTemp) && roomTemp > acThreshold;

  bool lightsOn = occupied && roomDim;
  bool acOn     = needsCooling;

  digitalWrite(RELAY_LIGHTS, lightsOn ? HIGH : LOW);
  digitalWrite(RELAY_FAN, acOn ? HIGH : LOW);

  // --- telemetry line, stands in for the cloud-dashboard stream ---
  Serial.print("occupied=");   Serial.print(occupied);
  Serial.print(" ldr=");       Serial.print(ldrReading);
  Serial.print(" tempC=");     Serial.print(roomTemp);
  Serial.print(" acThreshold="); Serial.print(acThreshold);
  Serial.print(" gas=");       Serial.print(gasIndex);
  Serial.print(" lightsOn=");  Serial.print(lightsOn);
  Serial.print(" acOn=");      Serial.println(acOn);

  delay(1000);
}
