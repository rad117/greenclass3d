# Building this circuit in Tinkercad

This isn't a project file I can publish to your Tinkercad account directly — I
don't have any way to sign in or write to tinkercad.com. What's here is
everything needed to recreate the circuit yourself in a few minutes: a
component list with the closest Tinkercad equivalents, an exact wiring table,
and the firmware in [`green_class_ai.ino`](./green_class_ai.ino), which
implements the same occupancy + temperature-threshold rule logic as the
3D viewer (`../main.js`).

## 1. Start a new circuit

Tinkercad Circuits → **Create** → **Circuit**. Set the board to
**Arduino Uno R3** — Tinkercad supports it natively, and it's the safest
universal target for this guide. (The real device is an ESP32-WROOM-32 per
the BOM below; GPIO equivalents for porting to the real board are noted as
comments in the `.ino` file next to each pin `#define`.)

## 2. Components — BOM vs. Tinkercad equivalents

| # | Real BOM part (from `main.js`'s `PARTS`) | Tinkercad component to drag in | Notes |
|---|---|---|---|
| 1 | ESP32-WROOM-32 (DevKit V1) | **Arduino Uno R3** | Substitute for simulation — Uno is guaranteed available in every Tinkercad account |
| 2 | PIR — HC-SR501 | **PIR Motion Sensor** | 3-pin: GND / OUT / VCC |
| 3 | LDR module (LM393 / KY-018) | **Photoresistor** + **10kΩ resistor** | Tinkercad's photoresistor is a bare LDR, not the LM393 breakout — wire it as a voltage divider (step 3) to get an analog reading |
| 4 | DHT11 | **Temperature Sensor [TMP36]** — *or* search "DHT11" in the component picker (Tinkercad has added DHT11/DHT22 directly in most accounts) | If you get a TMP36 instead, use `analogRead` + the TMP36 formula rather than the `DHT` library — ask if you want that variant of the sketch |
| 5 | MQ-135 | **Gas Sensor** | Analog output, same wiring pattern as the LDR |
| 6 | 4-channel relay (SRD-05VDC-SL-C) | **Relay Module** ×1 (or 2, if Tinkercad's only has 1 channel in your account) | Channel 1 → lights, channel 2 → fan/AC. Channels 3–4 are unused, same as the 3D model |

Also drag in:
- A small DC **fan** or an **LED** wired through the relay's NO/COM contacts, to visualize the fan/AC channel switching
- A second **LED** through the lights relay channel, to visualize the lights switching

## 3. Wiring table

| From | To | Notes |
|---|---|---|
| PIR VCC | Uno 5V | |
| PIR GND | Uno GND | |
| PIR OUT | Uno **D2** | |
| DHT11 VCC | Uno 5V | |
| DHT11 GND | Uno GND | |
| DHT11 DATA | Uno **D4** | |
| 5V | Photoresistor leg 1 | |
| Photoresistor leg 2 | Uno **A0** *and* 10kΩ resistor leg 1 | junction node = the analog reading |
| 10kΩ resistor leg 2 | GND | completes the divider |
| Gas Sensor VCC | Uno 5V | |
| Gas Sensor GND | Uno GND | |
| Gas Sensor AOUT | Uno **A1** | |
| Relay VCC | Uno 5V | |
| Relay GND | Uno GND | |
| Relay IN1 (lights channel) | Uno **D7** | |
| Relay IN2 (fan/AC channel) | Uno **D8** | |
| Lights-channel relay COM/NO | LED + resistor → GND | visual "lights on" indicator |
| Fan-channel relay COM/NO | LED + resistor (or fan) → GND | visual "AC/fan on" indicator |

## 4. Paste in the code

Open the **Code** panel in Tinkercad, switch it to **Text** mode (not Blocks),
and paste the full contents of [`green_class_ai.ino`](./green_class_ai.ino).
If Tinkercad's Uno library list doesn't already include the Adafruit `DHT`
library, add it from the library picker before starting the simulation.

## 5. Run it

Click **Start Simulation**. In Tinkercad's simulation view you can:
- Click the PIR sensor to toggle motion — this is the same as the "Person in
  room" button in the 3D viewer, and drives `occupied` the same way.
- Drag the photoresistor's light-level slider to cross `LDR_DIM_THRESHOLD` and
  watch the lights relay respond.
- Drag the temperature sensor's slider up past 25°C while occupied (or past
  28°C while vacant) and watch the fan/AC relay kick in — this is the
  occupancy-dependent threshold from the original request, reproduced on
  real (simulated) hardware.
- Open the **Serial Monitor** to see the same telemetry line the ESP32 would
  stream to a cloud dashboard.

## Why the thresholds are what they are

`TEMP_THRESHOLD_OCCUPIED = 25` and `TEMP_THRESHOLD_VACANT = 28` in the sketch
are the exact same numbers as `acThresholdFor()` in `main.js` — a room with
people in it should start cooling sooner (comfort), and an empty room can
run a few degrees warmer before the AC bothers to turn on (energy-saving
setback). Change both places together if you want to retune them.
