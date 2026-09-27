# Green Class AI — Spatial Occupancy Demo

A Three.js prototype showing how classroom automation can respond to **how many people are present and exactly where they are sitting**.

## Demo
- 5 classroom rows × 6 seats = 30 addressable seats.
- Two ceiling fans are physically distributed across each row.
- Two lighting fixtures are distributed across each row.
- Five wall-mounted AC zones map one-to-one to the five rows.
- Click seats in the occupancy map to place students.
- Enter a people count and use **Place people** to populate seats.
- Paste an occupancy payload such as:
  `{"people":6,"seats":["R1S2","R2S3","R2S4","R3S2","R4S5","R5S3"]}`
- **Apply data** converts that payload into the live 3D classroom state.

## Control logic
- **Lights:** occupied row + insufficient daylight → that row's lights on.
- **Fans:** occupied row → the two fans above that row on.
- **AC:** occupied row + room temperature above the occupied threshold → that row's AC on.
- Empty rows remain idle.

This is a simulation/demo. The JSON input represents the kind of occupancy data that could later come from an ESP32, camera/people-counting model, or other classroom sensor system.
