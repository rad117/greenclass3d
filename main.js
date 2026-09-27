(function () {
  "use strict";

  /* ============================================================
     Green Class AI — 3D classroom model (Three.js, real WebGL)
     A wall-mounted ESP32 sensor unit inside a 3-wall classroom.
     Occupancy simulation mirrors the ESP32 sketch's rule logic
     (guide section 8): occupied -> lightsOn/fanOn via AND gates.
     ============================================================ */

  // ---------- renderer / scene / camera ----------

  const BG = 0x11181a;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 1300, 3400);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 6000);
  const DEFAULT_CAM_POS = new THREE.Vector3(950, 520, 950);
  const DEFAULT_TARGET = new THREE.Vector3(220, 150, -60);
  camera.position.copy(DEFAULT_CAM_POS);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.getElementById('canvas-wrap').appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.copy(DEFAULT_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 260;
  controls.maxDistance = 2200;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotateSpeed = 1.1;
  controls.update();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- lighting ----------

  scene.add(new THREE.HemisphereLight(0xdfe8e2, 0x1a1410, 0.65));

  const sun = new THREE.DirectionalLight(0xfff2df, 1.0);
  sun.position.set(-900, 620, 260); // outside the window wall
  sun.target.position.set(0, 120, 150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -900; sun.shadow.camera.right = 900;
  sun.shadow.camera.top = 700; sun.shadow.camera.bottom = -700;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 2200;
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  const fixtureLight = new THREE.PointLight(0xfff1b5, 0, 900, 2);
  scene.add(fixtureLight); // intensity driven by the occupancy sim

  // ---------- procedural textures ----------

  function makeWoodTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a97a4c'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 32) {
      ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    for (let i = 0; i < 500; i++) {
      ctx.strokeStyle = `rgba(60,35,15,${(Math.random() * 0.06).toFixed(3)})`;
      const y = Math.random() * 256;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + (Math.random() * 8 - 4)); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 11);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ---------- materials ----------

  const M = {
    wood: new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.86 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xd6d0bd, roughness: 0.92 }),
    whiteboard: new THREE.MeshStandardMaterial({ color: 0xf7f8f5, roughness: 0.25 }),
    boardFrame: new THREE.MeshStandardMaterial({ color: 0x8c8375, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0f2, transparent: true, opacity: 0.42, roughness: 0.12, emissive: 0xbfe0f2, emissiveIntensity: 0.45 }),
    windowFrame: new THREE.MeshStandardMaterial({ color: 0x7c6a52, roughness: 0.7 }),
    deskTop: new THREE.MeshStandardMaterial({ color: 0xc99a63, roughness: 0.6 }),
    deskLeg: new THREE.MeshStandardMaterial({ color: 0x6d5133, roughness: 0.7 }),
    chair: new THREE.MeshStandardMaterial({ color: 0x4d6d8c, roughness: 0.55 }),
    enclosure: new THREE.MeshStandardMaterial({ color: 0x9fe0a8, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    deviceBacking: new THREE.MeshStandardMaterial({ color: 0x141b16, roughness: 0.55 }),
    mountBracket: new THREE.MeshStandardMaterial({ color: 0x2a332f, roughness: 0.6 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x2e6b46, roughness: 0.55 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 }),
    relay: new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.5 }),
    ledOff: new THREE.MeshStandardMaterial({ color: 0x1c2321, roughness: 0.4, emissive: 0x000000 }),
    ldr: new THREE.MeshStandardMaterial({ color: 0x2f4f7a, roughness: 0.5 }),
    dht: new THREE.MeshStandardMaterial({ color: 0xeef2ee, roughness: 0.5 }),
    mq: new THREE.MeshStandardMaterial({ color: 0x8b929a, roughness: 0.4, metalness: 0.55 }),
    pir: new THREE.MeshStandardMaterial({ color: 0xeef1ec, roughness: 0.35 }),
    copperWire: new THREE.MeshStandardMaterial({ color: 0xc9835a, roughness: 0.5 }),
    sageWire: new THREE.MeshStandardMaterial({ color: 0x82ac74, roughness: 0.5 }),
    fanBlade: new THREE.MeshStandardMaterial({ color: 0xe7e2d3, roughness: 0.5 }),
    fanRod: new THREE.MeshStandardMaterial({ color: 0x8c8375, roughness: 0.6 }),
    fixture: new THREE.MeshStandardMaterial({ color: 0xe7e2d3, roughness: 0.4, emissive: 0xfff1b5, emissiveIntensity: 0 }),
    personTorso: new THREE.MeshStandardMaterial({ color: 0xc9835a, roughness: 0.6 }),
    personHead: new THREE.MeshStandardMaterial({ color: 0xd8b48c, roughness: 0.6 }),
  };

  // ---------- geometry helpers ----------

  function box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(r, h, mat, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 28), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function dome(r, mat, seg) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function wire(p1, p2, mat, thickness) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(thickness || 1.6, thickness || 1.6, len, 8), mat);
    m.position.copy(p1).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    m.castShadow = true;
    return m;
  }
  function wirePath(points, mat, thickness) {
    const g = new THREE.Group();
    for (let i = 0; i < points.length - 1; i++) g.add(wire(points[i], points[i + 1], mat, thickness));
    return g;
  }

  // ---------- room shell ----------

  const ROOM = { halfW: 700, backZ: -600, frontZ: 600, wallH: 280 };

  const floorMesh = box(ROOM.halfW * 2 + 200, 8, (ROOM.frontZ - ROOM.backZ) + 200, M.wood);
  floorMesh.position.set(0, -4, 0);
  scene.add(floorMesh);

  const backWall = box(ROOM.halfW * 2, ROOM.wallH, 8, M.wall);
  backWall.position.set(0, ROOM.wallH / 2, ROOM.backZ - 4);
  scene.add(backWall);

  const leftWall = box(8, ROOM.wallH, ROOM.frontZ - ROOM.backZ, M.wall);
  leftWall.position.set(-ROOM.halfW - 4, ROOM.wallH / 2, (ROOM.backZ + ROOM.frontZ) / 2);
  scene.add(leftWall);

  const rightWall = box(8, ROOM.wallH, ROOM.frontZ - ROOM.backZ, M.wall);
  rightWall.position.set(ROOM.halfW + 4, ROOM.wallH / 2, (ROOM.backZ + ROOM.frontZ) / 2);
  scene.add(rightWall);

  const board = box(360, 190, 6, M.whiteboard);
  board.position.set(0, 150, ROOM.backZ + 4);
  scene.add(board);
  const boardFrame = box(374, 204, 3, M.boardFrame);
  boardFrame.position.set(0, 150, ROOM.backZ + 2);
  scene.add(boardFrame);

  const win = box(6, 210, 260, M.glass);
  win.position.set(-ROOM.halfW + 2, 150, 40);
  scene.add(win);
  const winFrame = box(3, 224, 274, M.windowFrame);
  winFrame.position.set(-ROOM.halfW + 1, 150, 40);
  scene.add(winFrame);
  const mullV = box(4, 210, 4, M.windowFrame); mullV.position.set(-ROOM.halfW + 3, 150, 40); scene.add(mullV);
  const mullH = box(4, 4, 260, M.windowFrame); mullH.position.set(-ROOM.halfW + 3, 150, 40); scene.add(mullH);

  function desk(x, z, seatIndex) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const top = box(100, 6, 56, M.deskTop); top.position.set(0, 64, 0); g.add(top);
    const leg = box(8, 64, 40, M.deskLeg); leg.position.set(0, 32, 0); g.add(leg);
    const seat = box(36, 4, 36, M.chair); seat.position.set(0, 40, 42); g.add(seat);
    const back = box(36, 38, 4, M.chair); back.position.set(0, 59, 58); g.add(back);
    const legc = box(6, 40, 6, M.deskLeg); legc.position.set(0, 20, 42); g.add(legc);
    g.traverse(o => { if (o.isMesh) o.userData.seatIndex = seatIndex; }); // click-to-seat hit target
    scene.add(g);
    return g;
  }
  // A full classroom grid — 6 rows x 5 columns with a center aisle column, the way an
  // actual classroom is laid out — split into 5 named fan zones by quadrant (the aisle
  // column is its own "Center" zone). Same zone names/count as before, so every scenario
  // button and the per-zone fan logic keep working unchanged; there are just more desks
  // filling out each zone now.
  const ZONE_NAMES = ['Back-left', 'Back-right', 'Front-left', 'Front-right', 'Center'];
  const DESK_COLS = [-480, -240, 0, 240, 480];
  const DESK_ROWS = [-400, -240, -80, 80, 240, 400];
  const DESKS = [];
  DESK_ROWS.forEach(z => {
    DESK_COLS.forEach(x => {
      let zone;
      if (x === 0) zone = 4;                 // center aisle
      else if (z < 0) zone = x < 0 ? 0 : 1;   // back-left / back-right
      else zone = x < 0 ? 2 : 3;              // front-left / front-right ("bottom-right")
      DESKS.push({ x, z, zone });
    });
  });
  DESKS.forEach((d, i) => desk(d.x, d.z, i));

  // wall-mounted split AC — turns on together with the fan relay
  const acGroup = new THREE.Group();
  acGroup.position.set(-260, 232, ROOM.backZ + 4);
  scene.add(acGroup);
  const acBodyMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f0, roughness: 0.45 });
  acGroup.add(box(120, 32, 26, acBodyMat));
  const acVentMat = new THREE.MeshStandardMaterial({ color: 0xd7dbd6, roughness: 0.5, emissive: 0x000000 });
  const acVent = box(104, 7, 3, acVentMat); acVent.position.set(0, -11, 14); acGroup.add(acVent);
  const acLedMat = new THREE.MeshStandardMaterial({ color: 0x123018, roughness: 0.4, emissive: 0x000000 });
  const acLed = box(4, 3, 2, acLedMat); acLed.position.set(52, 10, 14); acGroup.add(acLed);

  // ceiling fans — one per named desk cluster/zone, real geometry spun by rotation.y each
  // frame. Zoning means a fan only needs to run over a cluster that actually has someone in it.
  function makeFan(x, z) {
    const pos = new THREE.Vector3(x, ROOM.wallH - 16, z);
    const rod = cyl(3, 50, M.fanRod, 10);
    rod.position.set(pos.x, ROOM.wallH - 25, pos.z);
    scene.add(rod);
    const group = new THREE.Group();
    group.position.copy(pos);
    group.add(box(130, 3, 14, M.fanBlade), box(14, 3, 130, M.fanBlade));
    scene.add(group);
    return { group, speed: 0, targetSpeed: 0 };
  }
  const ZONE_SEATS = ZONE_NAMES.map((_, zoneIdx) =>
    DESKS.map((_, i) => i).filter(i => DESKS[i].zone === zoneIdx)
  );
  const fans = ZONE_SEATS.map(seatIdxs => {
    const cx = seatIdxs.reduce((s, i) => s + DESKS[i].x, 0) / seatIdxs.length;
    const cz = seatIdxs.reduce((s, i) => s + DESKS[i].z, 0) / seatIdxs.length;
    return makeFan(cx, cz);
  });

  // ceiling light fixture — real PointLight + an emissive disc
  const fixtureMesh = cyl(30, 6, M.fixture, 28);
  fixtureMesh.position.set(-140, ROOM.wallH - 8, 150);
  scene.add(fixtureMesh);
  fixtureLight.position.set(-140, ROOM.wallH - 20, 150);

  // occupants — appear at the desks while "Person in room" is on
  const PERSON_COLORS = [
    [0xc9835a, 0xd8b48c],
    [0x5b7a9c, 0xcaa27e],
    [0x82ac74, 0xe0b98f],
    [0xb5563c, 0xc99a63],
    [0x3f6b8c, 0xe0b98f],
    [0x9c7a4d, 0xd8b48c],
    [0x6d8c5b, 0xcaa27e],
    [0xa15c7a, 0xe6c9a1],
    [0x4d5d8c, 0xc99a63],
    [0x5a7a4d, 0xc99a63],
    [0x8c4d6d, 0xe6c9a1],
    [0x4d7a7a, 0xd8b48c],
  ];
  function makePerson(x, z, torsoColor, headColor) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.visible = false;
    g.scale.setScalar(0.001);
    const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.6 });
    const torso = cyl(11, 44, torsoMat, 14); torso.position.set(0, 62, 0); g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), headMat);
    head.position.set(0, 92, 0); head.castShadow = true; g.add(head);
    scene.add(g);
    return g;
  }
  const people = DESKS.map((d, i) => {
    const c = PERSON_COLORS[i % PERSON_COLORS.length];
    return makePerson(d.x, d.z + 42, c[0], c[1]);
  });

  // ---------- device, wall-mounted on the right wall ----------

  const deviceGroup = new THREE.Group();
  deviceGroup.position.set(ROOM.halfW - 2, 150, -220);
  deviceGroup.rotation.y = -Math.PI / 2; // local +Z (front) now faces into the room
  deviceGroup.scale.setScalar(2.05); // sized up so it reads clearly at room-overview distance
  scene.add(deviceGroup);

  // dark backing panel on the wall behind the device so the translucent
  // case reads clearly against the wall instead of blending into it
  const deviceBacking = box(6, 250, 460, M.deviceBacking);
  deviceBacking.position.set(ROOM.halfW - 0.5, 150, -220);
  scene.add(deviceBacking);

  // dedicated accent spotlight so the device stands out from the rest of the room
  const deviceSpotTarget = new THREE.Object3D();
  deviceSpotTarget.position.copy(deviceGroup.position);
  scene.add(deviceSpotTarget);
  const deviceSpot = new THREE.SpotLight(0xbdf7c4, 2.4, 1000, Math.PI / 6, 0.4, 1.5);
  deviceSpot.position.set(ROOM.halfW - 260, 270, -140);
  deviceSpot.target = deviceSpotTarget;
  scene.add(deviceSpot);

  const enclosureMesh = box(180, 110, 110, M.enclosure);
  deviceGroup.add(enclosureMesh);
  const enclosureEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(enclosureMesh.geometry),
    new THREE.LineBasicMaterial({ color: 0xd4ffd9, transparent: true, opacity: 1 })
  );
  enclosureMesh.add(enclosureEdges);

  const esp32Group = new THREE.Group(); esp32Group.position.set(-40, -42, 10);
  esp32Group.add(box(78, 5, 30, M.pcb.clone()));
  const chip = box(16, 3, 16, M.chip.clone()); chip.position.set(-14, 4, -2); esp32Group.add(chip);
  deviceGroup.add(esp32Group);

  const relayGroup = new THREE.Group(); relayGroup.position.set(40, -47, -30);
  relayGroup.add(box(72, 17, 52, M.relay.clone()));
  const relayLEDs = []; // [0] = lights channel, [1] = fan channel
  for (let i = 0; i < 4; i++) {
    const led = box(9, 3, 9, M.ledOff.clone());
    led.position.set(-25 + i * 17, 9.5, -10);
    led.userData.isLed = true;
    relayGroup.add(led);
    relayLEDs.push(led);
  }
  deviceGroup.add(relayGroup);

  // short internal jumper between the two parts that stay in the hub enclosure
  const internalWireGroup = new THREE.Group();
  internalWireGroup.add(wire(new THREE.Vector3(-40, -40, 10), new THREE.Vector3(40, -47, -30), M.copperWire));
  deviceGroup.add(internalWireGroup);

  // ---------- remote sensors, distributed around the room like a real install ----------
  // each sensor lives where it would actually be mounted (corner for the PIR's field of
  // view, by the window for the LDR, away from vents/drafts for temp + gas), wired back
  // to the ESP32 hub with a ceiling-routed conduit run instead of sitting inside one box.

  // a thin backing plate sat just behind a wall sensor's front face (local -Z, toward the wall)
  function mountPlate(w, h, mat) {
    const m = box(w, h, 3, mat || M.mountBracket);
    m.position.z = -3;
    return m;
  }

  // PIR — high in the back-right corner, angled diagonally across the room for the
  // widest possible field of view over every desk (the standard real-world PIR spot).
  const pirGroup = new THREE.Group();
  pirGroup.position.set(660, 255, -560);
  pirGroup.rotation.set(-0.32, -0.62, 0.22);
  const pirMesh = dome(20, M.pir.clone(), 22);
  pirGroup.add(pirMesh);
  const pirMount = box(16, 5, 16, M.mountBracket); pirMount.position.set(0, 4, 0); pirGroup.add(pirMount);
  scene.add(pirGroup);

  // LDR — right by the window, so it reads actual daylight instead of the room's own
  // ceiling light (mounting it near the light fixture would create a feedback loop).
  const ldrGroup = new THREE.Group();
  ldrGroup.position.set(-ROOM.halfW + 2, 175, 190);
  ldrGroup.rotation.y = Math.PI / 2;
  ldrGroup.add(box(24, 32, 3, M.ldr.clone()));
  ldrGroup.add(mountPlate(28, 36));
  scene.add(ldrGroup);

  // DHT11 — interior wall, well away from the window (direct sun) and the AC unit
  // (cold draft), so the reading reflects the room average rather than a hot/cold spot.
  const dhtGroup = new THREE.Group();
  dhtGroup.position.set(ROOM.halfW - 2, 175, 250);
  dhtGroup.rotation.y = -Math.PI / 2;
  dhtGroup.add(box(28, 18, 4, M.dht.clone()));
  dhtGroup.add(mountPlate(32, 22));
  scene.add(dhtGroup);

  // MQ-135 — ceiling-hung near the room's center, clear of the door/window drafts that
  // would vent it artificially low and clear of the fan/AC's direct airflow.
  const mqGroup = new THREE.Group();
  mqGroup.position.set(250, 250, 250);
  mqGroup.add(cyl(16, 26, M.mq.clone(), 20));
  const mqMount = box(22, 5, 22, M.mountBracket); mqMount.position.set(0, 16, 0); mqGroup.add(mqMount);
  scene.add(mqGroup);

  // ceiling-routed conduit runs from each remote sensor back to the ESP32 hub — the exit
  // point is offset clear of the hub's opaque backing panel so the run stays visible
  // instead of vanishing behind it
  const CEILING_Y = 272;
  const hubExit = new THREE.Vector3(ROOM.halfW - 40, 150, deviceGroup.position.z);
  const hubTop = new THREE.Vector3(hubExit.x, CEILING_Y, hubExit.z);
  const remoteWireGroup = new THREE.Group();
  [
    { pos: pirGroup.position, mat: M.sageWire },
    { pos: ldrGroup.position, mat: M.sageWire },
    { pos: dhtGroup.position, mat: M.copperWire },
    { pos: mqGroup.position, mat: M.sageWire },
  ].forEach(({ pos, mat }) => {
    remoteWireGroup.add(wirePath([
      hubExit,
      hubTop,
      new THREE.Vector3(pos.x, CEILING_Y, pos.z),
      pos,
    ], mat, 2.2));
  });
  scene.add(remoteWireGroup);

  document.getElementById('loading').classList.add('hide');

  /* ---------- parts data (from BOM, guide section 3) + selection ---------- */

  const PARTS = [
    { id: 'esp32', num: 1, short: 'ESP32', role: 'Microcontroller', name: 'ESP32-WROOM-32 (DevKit V1)', group: esp32Group,
      spec: 'Dual-core 240MHz, WiFi + BLE, 3.3V logic, ~30 GPIO pins. Stays in the wall hub next to the relay it drives — every remote sensor wires back to it over the ceiling conduit run you can see across the room.', price: 400 },
    { id: 'pir', num: 2, short: 'PIR', role: 'Motion sensor', name: 'PIR — HC-SR501', group: pirGroup,
      spec: 'Range up to 7m, detection angle <120°, digital output, adjustable delay. Mounted high in the back corner and angled diagonally across the room — the standard placement for covering every desk with one sensor instead of leaving blind spots.', price: 75 },
    { id: 'ldr', num: 3, short: 'LDR', role: 'Light sensor', name: 'LDR module (LM393 / KY-018)', group: ldrGroup,
      spec: 'GL5528 photoresistor, analog + digital output. Mounted right by the window so it reads actual daylight — bolting it next to the ceiling light fixture instead would create a feedback loop where the lights turning on fools it into thinking the room is bright.', price: 40 },
    { id: 'dht11', num: 4, short: 'DHT11', role: 'Temp / humidity sensor', name: 'DHT11', group: dhtGroup,
      spec: '0–50°C ±2°C, 20–90% RH ±5%, digital single-wire. Mounted on the interior wall, away from the window\'s direct sun and the AC unit\'s cold draft, so its reading reflects the room\'s actual average instead of one hot or cold spot.', price: 90 },
    { id: 'mq135', num: 5, short: 'MQ-135', role: 'Air quality sensor', name: 'MQ-135', group: mqGroup,
      spec: 'Detects NH3 / NOx / CO2 / alcohol as a relative index, analog output. Needs a 20–30 min warm-up before readings settle. Hung centrally from the ceiling, clear of the door and window drafts that would vent it and read artificially clean air.', price: 130 },
    { id: 'relay', num: 6, short: 'Relay', role: 'Relay module', name: '4-channel relay (SRD-05VDC-SL-C)', group: relayGroup,
      spec: '5V trigger, 10A @ 250VAC per channel, opto-isolated. Switches the lights and fan/AC loads. Stays in the hub, close to the mains wiring it switches, rather than out with the low-voltage sensors.', price: 180 },
  ];
  const partById = Object.fromEntries(PARTS.map(p => [p.id, p]));

  PARTS.forEach(p => {
    p.group.traverse(o => {
      if (o.isMesh) {
        o.userData.part = p.id;
        if (!o.userData.isLed) {
          o.userData._origEmissiveHex = o.material.emissive.getHex();
          o.userData._origEmissiveIntensity = o.material.emissiveIntensity;
        }
      }
    });
  });

  const legendList = document.getElementById('legendList');
  PARTS.forEach(p => {
    const li = document.createElement('li');
    li.dataset.part = p.id;
    li.tabIndex = 0;
    li.innerHTML = `<span class="li-num">${String(p.num).padStart(2, '0')}</span><span class="li-dot"></span><span class="li-name">${p.name}</span>`;
    li.addEventListener('click', () => selectPart(p.id));
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPart(p.id); } });
    legendList.appendChild(li);
  });

  // floating in-scene labels — projected from each part's world position every frame
  const labelLayer = document.createElement('div');
  labelLayer.id = 'labelLayer';
  document.body.appendChild(labelLayer);
  const labelEls = {};
  PARTS.forEach(p => {
    const el = document.createElement('div');
    el.className = 'part-label';
    el.innerHTML = `<span class="pl-num">${String(p.num).padStart(2, '0')}</span><span class="pl-name">${p.short}</span>`;
    el.addEventListener('click', () => selectPart(p.id));
    labelLayer.appendChild(el);
    labelEls[p.id] = el;
  });
  const labelVec = new THREE.Vector3();
  function updateLabels() {
    camera.updateMatrixWorld();
    const placed = [];
    PARTS.forEach(p => {
      p.group.getWorldPosition(labelVec);
      labelVec.y += 34;
      const proj = labelVec.clone().project(camera);
      const el = labelEls[p.id];
      if (proj.z > 1 || proj.z < -1) { el.style.display = 'none'; return; }
      let x = (proj.x * 0.5 + 0.5) * window.innerWidth;
      let y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
      // nudge apart from labels already placed this frame so nearby parts don't overlap
      for (const q of placed) {
        const dx = x - q.x, dy = y - q.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 38) {
          const push = 38 - dist;
          const ang = Math.atan2(dy || -1, dx || 0.001);
          x += Math.cos(ang) * push * 0.65;
          y += Math.sin(ang) * push * 0.65 - 4;
        }
      }
      placed.push({ x, y });
      el.style.display = 'flex';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.classList.toggle('active', selectedPart === p.id);
    });
  }

  const specStrip = document.getElementById('specStrip');
  const specNum = document.getElementById('specNum');
  const specRole = document.getElementById('specRole');
  const specName = document.getElementById('specName');
  const specText = document.getElementById('specText');
  const specPrice = document.getElementById('specPrice');
  let selectedPart = null;

  function setHighlight(id, on) {
    const p = partById[id]; if (!p) return;
    p.group.traverse(o => {
      if (!o.isMesh || o.userData.isLed) return;
      if (on) { o.material.emissive.setHex(0xc9835a); o.material.emissiveIntensity = 0.55; }
      else { o.material.emissive.setHex(o.userData._origEmissiveHex || 0); o.material.emissiveIntensity = o.userData._origEmissiveIntensity || 0; }
    });
  }

  function selectPart(id) {
    if (selectedPart) setHighlight(selectedPart, false);
    selectedPart = id;
    setHighlight(id, true);
    legendList.querySelectorAll('li').forEach(li => li.classList.toggle('active', li.dataset.part === id));
    const p = partById[id];
    specNum.textContent = p.num;
    specRole.textContent = p.role;
    specName.textContent = p.name;
    specText.textContent = p.spec;
    specPrice.textContent = '₹' + p.price;
    specStrip.classList.add('show');
  }

  function deselect() {
    if (selectedPart) setHighlight(selectedPart, false);
    selectedPart = null;
    legendList.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
    specStrip.classList.remove('show');
  }

  document.getElementById('specClose').addEventListener('click', deselect);

  /* ---------- click-to-select raycasting (drag-tolerant) ---------- */

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  // compare down-position directly to up-position rather than accumulating every
  // intermediate pointermove delta — robust even if some move events get coalesced/dropped
  let pDown = false, downX = 0, downY = 0;

  renderer.domElement.addEventListener('pointerdown', e => {
    pDown = true; downX = e.clientX; downY = e.clientY;
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pDown) return;
    pDown = false;
    const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    if (moved > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    const partHit = hits.find(h => h.object.userData.part);
    if (partHit) { selectPart(partHit.object.userData.part); return; }
    const seatHit = hits.find(h => h.object.userData.seatIndex !== undefined);
    if (seatHit) { toggleSeat(seatHit.object.userData.seatIndex); return; }
    deselect();
  });

  /* ---------- view controls ---------- */

  const resetBtn = document.getElementById('resetBtn');
  const focusBtn = document.getElementById('focusBtn');
  const rotateBtn = document.getElementById('rotateBtn');

  let camTweenId = null;
  function tweenCamera(pos, target, duration) {
    if (camTweenId) cancelAnimationFrame(camTweenId);
    controls.autoRotate = false;
    rotateBtn.classList.remove('on');
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const t0 = performance.now();
    (function step() {
      const t = Math.min(1, (performance.now() - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos, pos, e);
      controls.target.lerpVectors(startTarget, target, e);
      controls.update();
      camTweenId = t < 1 ? requestAnimationFrame(step) : null;
    })();
  }

  resetBtn.addEventListener('click', () => {
    tweenCamera(DEFAULT_CAM_POS, DEFAULT_TARGET, 700);
    deselect();
    resetSimulation();
  });

  focusBtn.addEventListener('click', () => {
    const devicePos = new THREE.Vector3();
    deviceGroup.getWorldPosition(devicePos);
    tweenCamera(
      new THREE.Vector3(devicePos.x - 430, devicePos.y + 90, devicePos.z + 60),
      devicePos.clone().add(new THREE.Vector3(0, -15, 0)),
      900
    );
  });

  rotateBtn.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    rotateBtn.classList.toggle('on', controls.autoRotate);
  });
  controls.addEventListener('start', () => {
    if (controls.autoRotate) { controls.autoRotate = false; rotateBtn.classList.remove('on'); }
  });

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { rotateBtn.style.display = 'none'; controls.enableDamping = false; }

  /* ---------- occupancy simulation ----------
     Mirrors the ESP32 sketch's rule logic (guide section 8):
       occupied  = motion seen within the last OCCUPANCY_TIMEOUT window
       lightsOn  = occupied && natural light isn't enough (naturalLight < LIGHT_DIM_THRESHOLD)
       acOn      = occupied && roomTemp > acThreshold(occupied), unless manually overridden
     acThreshold is lower while occupied (cool sooner for comfort) and higher
     while vacant (an energy-saving setback), same idea as a real thermostat
     schedule. "Person in room" stands in for the PIR sensor: while it's on we
     fire a motion pulse every ~1.4s (like someone moving around); once it's
     off, occupied stays true until the timeout lapses, same as the real
     device. roomTemp and naturalLight both drift passively toward their own
     targets each frame (roomTemp toward an occupancy-scaled target, body heat
     + lights add heat; naturalLight toward a slowly-wobbling ambient daylight
     level, like passing clouds) and can also be nudged directly with the
     Heat/Cool and Brighten/Dim buttons to demo either threshold live. The LDR
     reads that naturalLight value directly — it's window-mounted, independent
     of the room's own ceiling fixture, so there's no feedback loop where
     turning the lights on fools it into reporting "bright". */

  const OCC_TIMEOUT_MS = 6000; // compressed stand-in for the real 5-minute OCCUPANCY_TIMEOUT
  const TEMP_MIN = 16, TEMP_MAX = 34;
  const TEMP_TARGET_OCCUPIED = 29; // body heat + lights nudge the room warmer
  const TEMP_TARGET_VACANT = 23;   // settles back toward ambient once empty
  const TEMP_EASE = 0.0035;        // passive per-frame drift rate toward the target above
  function acThresholdFor(occ) { return occ ? 25 : 28; }

  const LIGHT_MIN = 0, LIGHT_MAX = 100;
  const LIGHT_DIM_THRESHOLD = 45; // below this, natural light isn't enough on its own
  const LIGHT_BASE = 55, LIGHT_WOBBLE = 12; // ambient daylight drifts in [43, 67] like passing clouds
  const LIGHT_EASE = 0.01;

  let personIn = false, occupied = false;
  let roomTemp = 24;
  let naturalLight = LIGHT_BASE;
  let acOverride = null; // null = automatic (threshold-driven), true/false = manual override
  let lastMotion = 0, pulseInterval = null;
  let manualOverride = new Array(DESKS.length).fill(null); // per-seat: null = follow personIn, true/false = explicit click override
  let fixtureTargetIntensity = 0;
  let pirFlashUntil = 0;

  const personBtn = document.getElementById('personBtn');
  const brightenBtn = document.getElementById('brightenBtn');
  const dimBtn = document.getElementById('dimBtn');
  const heatBtn = document.getElementById('heatBtn');
  const coolBtn = document.getElementById('coolBtn');
  const acModeBtn = document.getElementById('acModeBtn');
  const pillOcc = document.getElementById('pillOcc');
  const pillSeats = document.getElementById('pillSeats');
  const pillLights = document.getElementById('pillLights');
  const pillLight = document.getElementById('pillLight');
  const pillFan = document.getElementById('pillFan');
  const pillAc = document.getElementById('pillAc');
  const pillTemp = document.getElementById('pillTemp');
  const simNote = document.getElementById('simNote');
  const acNote = document.getElementById('acNote');

  function setLed(mesh, active) {
    mesh.material.emissive.setHex(active ? 0x4caf50 : 0x000000);
    mesh.material.emissiveIntensity = active ? 1.4 : 0;
  }

  // a seat's effective state: an explicit click override wins, otherwise it follows the global toggle
  function seatOn(i) { return manualOverride[i] === null ? personIn : manualOverride[i]; }
  function seatedCount() {
    let n = 0;
    for (let i = 0; i < DESKS.length; i++) if (seatOn(i)) n++;
    return n;
  }
  // a filled seat counts as occupied even past the PIR's own motion-timeout — a still,
  // seated person can otherwise "time out" a basic PIR in real life (realistic, but it
  // would make the per-seat fan zones flicker off under someone who hasn't moved)
  function isRoomOccupied() { return occupied || seatedCount() > 0; }
  function refreshSeats() {
    for (let i = 0; i < DESKS.length; i++) {
      const on = seatOn(i);
      people[i].userData.targetScale = on ? 1 : 0.001;
      if (on) people[i].visible = true; // animate loop hides it again once it's fully shrunk
    }
  }
  function toggleSeat(i) {
    const wasOn = seatOn(i);
    manualOverride[i] = !wasOn;
    refreshSeats();
    if (manualOverride[i]) pulseMotion(); else flashPIR();
    updateDerived();
  }

  // scenario presets — seat an exact pattern and clear everything else, so the
  // zoned-fan response is instantly demonstrable instead of hand-clicking desks
  function applyScenario(seatIndices) {
    personIn = false;
    manualOverride.fill(false);
    seatIndices.forEach(i => { manualOverride[i] = true; });
    refreshSeats();
    if (seatIndices.length && roomTemp < acThresholdFor(true) + 3) {
      roomTemp = acThresholdFor(true) + 3; // guarantee a visible fan response for the demo
    }
    if (seatIndices.length) pulseMotion();
    updateDerived();
  }

  function updateDerived() {
    const seated = seatedCount();
    const roomOccupied = isRoomOccupied();
    const acThreshold = acThresholdFor(roomOccupied);
    const needsCooling = roomOccupied && roomTemp > acThreshold;
    const acOn = acOverride === null ? needsCooling : acOverride;
    const roomDim = naturalLight < LIGHT_DIM_THRESHOLD;
    const lightsOn = roomOccupied && roomDim;

    pillOcc.textContent = roomOccupied ? 'OCCUPIED' : 'VACANT';
    pillOcc.classList.toggle('on', roomOccupied);
    pillSeats.textContent = seated + '/' + DESKS.length + ' SEATED';
    pillSeats.classList.toggle('on', seated > 0);
    pillLights.textContent = 'LIGHTS ' + (lightsOn ? 'ON' : 'OFF');
    pillLights.classList.toggle('on', lightsOn);
    pillLight.textContent = 'DAYLIGHT ' + Math.round(naturalLight) + '% ' + (roomDim ? 'DIM' : 'BRIGHT');
    pillLight.classList.toggle('hot', roomDim);

    // zone fans: only spin over a row that actually has someone seated, and only while cooling is called for
    let fansOn = 0;
    fans.forEach((fan, zoneIdx) => {
      const zoneSeated = ZONE_SEATS[zoneIdx].some(seatOn);
      fan.targetSpeed = (zoneSeated && needsCooling) ? 0.09 : 0;
      if (fan.targetSpeed > 0) fansOn++;
    });
    pillFan.textContent = 'FAN ' + fansOn + '/' + fans.length;
    pillFan.classList.toggle('on', fansOn > 0);

    pillAc.textContent = 'AC ' + (acOn ? 'ON' : 'OFF');
    pillAc.classList.toggle('on', acOn);
    pillTemp.textContent = roomTemp.toFixed(1) + '°C';
    pillTemp.classList.toggle('hot', roomTemp > acThreshold);

    acNote.textContent = `AC threshold ${acThreshold}°C while ${roomOccupied ? 'occupied' : 'vacant'}`
      + (acOverride !== null ? ` — manual override: forced ${acOverride ? 'on' : 'off'}` : '');

    setLed(relayLEDs[0], lightsOn);
    setLed(relayLEDs[1], acOn);

    fixtureTargetIntensity = lightsOn ? 1.3 : 0;

    acLedMat.emissive.setHex(acOn ? 0x49e0ff : 0x000000);
    acLedMat.emissiveIntensity = acOn ? 1.3 : 0;
    acVentMat.emissive.setHex(acOn ? 0x8fd9ff : 0x000000);
    acVentMat.emissiveIntensity = acOn ? 0.5 : 0;
  }

  function flashPIR() { pirFlashUntil = performance.now() + 450; }

  function pulseMotion() {
    lastMotion = Date.now();
    if (!occupied) { occupied = true; updateDerived(); }
    flashPIR();
  }

  function setPersonIn(v) {
    personIn = v;
    manualOverride.fill(null); // the global toggle resets any per-seat overrides
    people.forEach(p => { p.visible = true; }); // animate loop hides any that end up targeting 0
    refreshSeats();
    personBtn.textContent = 'Person in room: ' + (v ? 'ON' : 'OFF');
    personBtn.classList.toggle('on', v);
    if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; }
    if (v) {
      pulseMotion();
      pulseInterval = setInterval(pulseMotion, 1400);
    }
  }

  personBtn.addEventListener('click', () => setPersonIn(!personIn));
  brightenBtn.addEventListener('click', () => { naturalLight = Math.min(LIGHT_MAX, naturalLight + 15); updateDerived(); });
  dimBtn.addEventListener('click', () => { naturalLight = Math.max(LIGHT_MIN, naturalLight - 15); updateDerived(); });
  heatBtn.addEventListener('click', () => { roomTemp = Math.min(TEMP_MAX, roomTemp + 2); updateDerived(); });
  coolBtn.addEventListener('click', () => { roomTemp = Math.max(TEMP_MIN, roomTemp - 2); updateDerived(); });
  acModeBtn.addEventListener('click', () => {
    acOverride = acOverride === null ? true : (acOverride === true ? false : null);
    acModeBtn.textContent = 'AC: ' + (acOverride === null ? 'Auto' : (acOverride ? 'Forced on' : 'Forced off'));
    acModeBtn.classList.toggle('on', acOverride !== null);
    updateDerived();
  });

  document.getElementById('scenEmptyBtn').addEventListener('click', () => applyScenario([]));
  document.getElementById('scenBottomRightBtn').addEventListener('click', () => applyScenario(ZONE_SEATS[3].slice(0, 2)));
  document.getElementById('scenMiddleBtn').addEventListener('click', () => applyScenario(ZONE_SEATS[4]));
  document.getElementById('scenScatteredBtn').addEventListener('click', () => applyScenario(ZONE_SEATS.map(z => z[0])));

  function resetSimulation() {
    if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; }
    personIn = false;
    manualOverride.fill(null);
    refreshSeats();
    personBtn.textContent = 'Person in room: OFF';
    personBtn.classList.remove('on');
    naturalLight = LIGHT_BASE;
    roomTemp = 24;
    acOverride = null;
    acModeBtn.textContent = 'AC: Auto';
    acModeBtn.classList.remove('on');
    occupied = false;
    simNote.textContent = '';
    updateDerived();
  }

  setInterval(() => {
    if (occupied) {
      const remaining = OCC_TIMEOUT_MS - (Date.now() - lastMotion);
      if (remaining <= 0) {
        occupied = false;
        simNote.textContent = '';
        updateDerived();
      } else if (!personIn) {
        simNote.textContent = `no motion — vacating in ${Math.ceil(remaining / 1000)}s`;
      } else {
        simNote.textContent = '';
      }
    }
  }, 400);

  updateDerived();

  /* ---------- big wall-mounted climate display ----------
     A digital screen on the back wall showing room temp, a simulated outside
     temp, and the "optimal" temperature the rule engine is currently
     targeting for the occupancy level (the same number driving the AC/fan
     decision above). Drawn on a canvas and mapped as an unlit texture so it
     reads clearly whether the room lights are on or off. */

  const OUTSIDE_TEMP_BASE = 33; // a hot-climate outdoor reference
  let screenElapsed = 0;
  function outsideTemp() { return OUTSIDE_TEMP_BASE + Math.sin(screenElapsed / 40) * 1.5; }

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512; screenCanvas.height = 300;
  const screenCtx = screenCanvas.getContext('2d');
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.encoding = THREE.sRGBEncoding;

  function drawScreen() {
    const ctx = screenCtx, w = screenCanvas.width, h = screenCanvas.height;
    ctx.fillStyle = '#0c1412'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a4a3a'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6fae7c'; ctx.font = '600 20px "Cascadia Code", monospace';
    ctx.fillText('GREEN CLASS AI — CLIMATE', w / 2, 38);

    const roomOccupied = isRoomOccupied();
    const acThreshold = acThresholdFor(roomOccupied);
    const cols = [
      { label: 'ROOM', value: roomTemp.toFixed(1) + '°C', color: '#d4ffd9' },
      { label: 'OUTSIDE', value: outsideTemp().toFixed(1) + '°C', color: '#a9c6ff' },
      { label: 'OPTIMAL', value: acThreshold + '°C', color: '#ffd9a0' },
    ];
    const colW = w / cols.length;
    cols.forEach((c, i) => {
      const cx = colW * i + colW / 2;
      ctx.fillStyle = '#7d9086'; ctx.font = '600 15px "Cascadia Code", monospace';
      ctx.fillText(c.label, cx, 100);
      ctx.fillStyle = c.color; ctx.font = '700 50px "Cascadia Code", monospace';
      ctx.fillText(c.value, cx, 160);
    });

    ctx.fillStyle = '#7d9086'; ctx.font = '13px "Cascadia Code", monospace';
    ctx.fillText(
      roomOccupied ? 'target set for an OCCUPIED room' : 'target set for a VACANT room (energy-saving setback)',
      w / 2, h - 26
    );
    ctx.fillText(seatedCount() + ' / ' + DESKS.length + ' seats filled right now', w / 2, h - 8);

    screenTexture.needsUpdate = true;
  }
  drawScreen();
  setInterval(() => { screenElapsed += 0.5; drawScreen(); }, 500);

  const screenBezel = box(226, 136, 6, M.deviceBacking);
  screenBezel.position.set(420, 150, ROOM.backZ + 3);
  scene.add(screenBezel);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(210, 120), new THREE.MeshBasicMaterial({ map: screenTexture }));
  screenMesh.position.set(420, 150, ROOM.backZ + 6.1);
  scene.add(screenMesh);

  /* ---------- animation loop ---------- */

  let lastFrameTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.25); // clamp so a throttled/backgrounded tab can't jump the sim
    lastFrameTime = now;

    // room temperature: drift toward a target that scales with how many seats are actually
    // filled (a couple of people warm the room less than a full house), at a framerate-independent
    // rate (TEMP_EASE is calibrated per-frame-at-60fps), then re-derive AC/fan state
    const occupancyFraction = seatedCount() / DESKS.length;
    const tempTarget = TEMP_TARGET_VACANT + occupancyFraction * (TEMP_TARGET_OCCUPIED - TEMP_TARGET_VACANT);
    roomTemp += (tempTarget - roomTemp) * (1 - Math.pow(1 - TEMP_EASE, dt * 60));

    // natural light: drift toward a slowly-wobbling ambient daylight level (passing clouds),
    // same framerate-independent easing approach as roomTemp above
    const lightTarget = LIGHT_BASE + Math.sin(now / 35000) * LIGHT_WOBBLE;
    naturalLight += (lightTarget - naturalLight) * (1 - Math.pow(1 - LIGHT_EASE, dt * 60));

    updateDerived();

    // fans: each zone eases toward its own target spin speed, then rotates
    fans.forEach(fan => {
      fan.speed += (fan.targetSpeed - fan.speed) * 0.05;
      if (Math.abs(fan.speed) > 0.0005) fan.group.rotation.y += fan.speed;
    });

    // ceiling fixture: ease light + emissive toward target
    fixtureLight.intensity += (fixtureTargetIntensity - fixtureLight.intensity) * 0.08;
    fixtureMesh.material.emissiveIntensity += (fixtureTargetIntensity - fixtureMesh.material.emissiveIntensity) * 0.08;

    // people: ease each seat's scale toward its own target, hide once fully shrunk
    people.forEach(p => {
      const target = p.userData.targetScale ?? 0.001;
      const s = p.scale.x + (target - p.scale.x) * 0.16;
      p.scale.setScalar(Math.max(s, 0.001));
      if (target < 0.5 && p.scale.x < 0.02) p.visible = false;
    });

    // PIR motion flash
    const flashT = pirFlashUntil - performance.now();
    pirMesh.material.emissiveIntensity = flashT > 0 ? (flashT / 450) * 1.2 : 0;
    if (flashT > 0) pirMesh.material.emissive.setHex(0xc9835a);

    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  }
  animate();

})();
