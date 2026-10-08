// AR sky overlay: phone camera plus device orientation, with stars, planets and satellites drawn
// where they are in the real sky. Needs HTTPS and a phone with a compass and gyroscope.
// Uses geoBodies, altAz, makeStarProjector, bvColor, getObserver, tleList, FEATURED_SATS,
// tleFor, lookAt, satellite, DEG, norm360, toJD from the other scripts.

const ar = {
  active: false,
  stream: null,
  R: null,              // smoothed rotation matrix (device frame to East-North-Up)
  iosHeading: null,
  yawOffset: 0,         // degrees added to every azimuth, set by Align
  fov: 65,              // degrees across the longer screen side
  bodies: [],
  sats: [],
  lastCalc: 0,
  raf: 0,
  gotEvent: false
};
try {
  const saved = JSON.parse(localStorage.getItem("arCalibration"));
  if (saved) { ar.yawOffset = Number(saved.yaw) || 0; ar.fov = Number(saved.fov) || 65; }
} catch (e) { /* ignore */ }

// W3C DeviceOrientation: R = Rz(alpha) * Rx(beta) * Ry(gamma), mapping device axes to East, North, Up.
function rotationMatrix(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG]
  ];
}

const enu = (alt, az) => [Math.cos(alt * DEG) * Math.sin(az * DEG), Math.cos(alt * DEG) * Math.cos(az * DEG), Math.sin(alt * DEG)];

// Project a sky direction to screen pixels. Returns null when it is behind the camera.
function arProject(R, alt, az, w, h, screenAngle, fov) {
  const v = enu(alt, az + ar.yawOffset);
  // Device coordinates: transpose of R times the world vector.
  const dx = R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2];
  const dy = R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2];
  const dz = R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2];
  if (dz >= -0.05) return null;
  const th = screenAngle * DEG;
  const sx = dx * Math.cos(th) - dy * Math.sin(th);
  const sy = dx * Math.sin(th) + dy * Math.cos(th);
  const f = (Math.max(w, h) / 2) / Math.tan((fov / 2) * DEG);
  return [w / 2 + (f * sx) / -dz, h / 2 - (f * sy) / -dz];
}

// Direction at the center of the screen (the back camera looks along device -z).
function arCenterAltAz(R) {
  const e = -R[0][2], n = -R[1][2], u = -R[2][2];
  return { alt: Math.asin(Math.max(-1, Math.min(1, u))) / DEG, az: norm360(Math.atan2(e, n) / DEG) };
}

function onOrientation(e) {
  if (e.alpha === null || e.beta === null) return;
  ar.gotEvent = true;
  let alpha = e.alpha;
  if (typeof e.webkitCompassHeading === "number") alpha = 360 - e.webkitCompassHeading;
  const m = rotationMatrix(alpha, e.beta, e.gamma);
  if (!ar.R) { ar.R = m; return; }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ar.R[i][j] = ar.R[i][j] * 0.75 + m[i][j] * 0.25;
}

function arRecalc() {
  const now = Date.now();
  const { lat, lon } = getObserver();
  const jd = toJD(now);
  ar.bodies = geoBodies(now).map((b) => ({ ...b, ...altAz(b, jd, lat, lon) }));
  ar.starProj = makeStarProjector(jd, lat, lon);
  ar.sats = [];
  if (typeof satellite !== "undefined" && tleList.length) {
    const observer = { latitude: lat * DEG, longitude: lon * DEG, height: 0.2 };
    for (const f of FEATURED_SATS) {
      const t = tleFor(f.id);
      const l = t && lookAt(satellite.twoline2satrec(t.l1, t.l2), now, observer);
      if (l && l.alt > -5) ar.sats.push({ name: f.name, alt: l.alt, az: l.az });
    }
  }
  ar.lastCalc = now;
}

function arFrame() {
  if (!ar.active) return;
  ar.raf = requestAnimationFrame(arFrame);
  const cv = document.getElementById("arCanvas");
  const w = cv.clientWidth, h = cv.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const status = document.getElementById("arStatus");

  if (!ar.R) {
    status.textContent = ar.gotEvent ? "Waiting for the compass..." : "No motion sensor data. This view needs a phone with a compass.";
    return;
  }
  if (Date.now() - ar.lastCalc > 2000) arRecalc();

  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const P = (alt, az) => arProject(ar.R, alt, az, w, h, angle, ar.fov);
  const center = arCenterAltAz(ar.R);
  status.textContent = `Pointing ${center.alt.toFixed(0)} deg up, ${compass(norm360(center.az - ar.yawOffset))}`;

  // Horizon and cardinal points
  c.strokeStyle = "rgba(110, 255, 160, 0.6)";
  c.lineWidth = 1.5;
  c.beginPath();
  let pen = false;
  for (let az = 0; az <= 360; az += 3) {
    const p = P(0, az);
    if (!p) { pen = false; continue; }
    if (pen) c.lineTo(...p); else { c.moveTo(...p); pen = true; }
  }
  c.stroke();
  c.font = "bold 16px system-ui, sans-serif";
  c.fillStyle = "rgba(110, 255, 160, 0.9)";
  c.textAlign = "center";
  for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const p = P(0, az);
    if (p) c.fillText(label, p[0], p[1] - 8);
  }

  // Constellations and stars
  const data = window.SKY_DATA;
  if (data && ar.starProj) {
    c.strokeStyle = "rgba(140, 180, 255, 0.5)";
    c.lineWidth = 1;
    for (const [, segments] of data.lines) {
      for (const seg of segments) {
        c.beginPath();
        let down = false;
        for (const [ra, dec] of seg) {
          const s = ar.starProj(ra, dec);
          const p = P(s.alt, s.az);
          if (!p) { down = false; continue; }
          if (down) c.lineTo(...p); else { c.moveTo(...p); down = true; }
        }
        c.stroke();
      }
    }
    for (const [ra, dec, mag, bv] of data.stars) {
      if (mag > 4.5) continue;
      const s = ar.starProj(ra, dec);
      const p = P(s.alt, s.az);
      if (!p) continue;
      c.fillStyle = bvColor(bv);
      c.beginPath();
      c.arc(p[0], p[1], Math.max(1, 3.6 - 0.6 * mag), 0, Math.PI * 2);
      c.fill();
    }
    c.font = "11px system-ui, sans-serif";
    c.fillStyle = "rgba(170, 200, 255, 0.85)";
    for (const [, name, ra, dec] of data.labels) {
      const s = ar.starProj(ra, dec);
      const p = P(s.alt, s.az);
      if (p) c.fillText(name.toUpperCase(), p[0], p[1]);
    }
  }

  // Sun, Moon, planets, satellites
  c.textAlign = "left";
  c.font = "13px system-ui, sans-serif";
  for (const b of ar.bodies) {
    const p = P(b.alt, b.az);
    if (!p) continue;
    c.fillStyle = b.color;
    c.beginPath();
    c.arc(p[0], p[1], b.size + 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = b.alt < 0 ? "rgba(255, 255, 255, 0.5)" : "#ffffff";
    c.fillText(b.alt < 0 ? `${b.name} (below horizon)` : b.name, p[0] + b.size + 6, p[1] + 4);
  }
  for (const s of ar.sats) {
    const p = P(s.alt, s.az);
    if (!p) continue;
    c.fillStyle = "#8cffbe";
    c.fillRect(p[0] - 4, p[1] - 4, 8, 8);
    c.fillText(s.name, p[0] + 8, p[1] + 4);
  }

  // Crosshair for alignment
  c.strokeStyle = "rgba(255, 255, 255, 0.7)";
  c.beginPath();
  c.moveTo(w / 2 - 12, h / 2); c.lineTo(w / 2 + 12, h / 2);
  c.moveTo(w / 2, h / 2 - 12); c.lineTo(w / 2, h / 2 + 12);
  c.stroke();
}

async function openAR() {
  const view = document.getElementById("arView");
  const msg = document.getElementById("arStatus");
  if (!window.isSecureContext) {
    alertInline("AR needs the app to be opened over HTTPS (the hosted site), not as a local file.");
    return;
  }
  // iOS 13+ asks for motion permission, and only from a tap.
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== "granted") { alertInline("Motion access was denied. Allow it in Settings to use AR."); return; }
    } catch (e) { alertInline("Could not request motion access."); return; }
  }

  ar.active = true;
  ar.R = null;
  ar.gotEvent = false;
  view.hidden = false;
  document.body.classList.add("ar-open");
  msg.textContent = "Starting...";
  const evt = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(evt, onOrientation);
  ar.eventName = evt;

  const video = document.getElementById("arVideo");
  try {
    ar.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    video.srcObject = ar.stream;
    await video.play();
  } catch (e) {
    video.srcObject = null; // Without the camera, the overlay still works on a dark background.
  }

  document.getElementById("arFov").value = ar.fov;
  arRecalc();
  arFrame();
}

function closeAR() {
  ar.active = false;
  cancelAnimationFrame(ar.raf);
  if (ar.eventName) window.removeEventListener(ar.eventName, onOrientation);
  if (ar.stream) ar.stream.getTracks().forEach((t) => t.stop());
  ar.stream = null;
  document.getElementById("arView").hidden = true;
  document.body.classList.remove("ar-open");
}

function saveCalibration() {
  try { localStorage.setItem("arCalibration", JSON.stringify({ yaw: ar.yawOffset, fov: ar.fov })); } catch (e) { /* ignore */ }
}

// Align: the user centers a known body in the crosshair, and the compass error is removed.
function alignOn(name) {
  if (!ar.R) return;
  const b = ar.bodies.find((x) => x.name === name);
  if (!b) return;
  const center = arCenterAltAz(ar.R);
  // Screen center shows azimuth (center.az - yawOffset) in true terms; make it equal the body's azimuth.
  ar.yawOffset = norm180(center.az - b.az);
  saveCalibration();
  document.getElementById("arStatus").textContent = `Aligned on ${name}. Compass correction ${ar.yawOffset.toFixed(0)} deg.`;
}

function alertInline(text) {
  const p = document.getElementById("arNote");
  if (p) p.textContent = text;
}

// ---- DOM ----
document.getElementById("arOpenBtn").addEventListener("click", openAR);
document.getElementById("arCloseBtn").addEventListener("click", closeAR);
document.getElementById("arAlignBtn").addEventListener("click", () => alignOn(document.getElementById("arAlignSelect").value));
document.getElementById("arResetBtn").addEventListener("click", () => {
  ar.yawOffset = 0;
  saveCalibration();
  document.getElementById("arStatus").textContent = "Compass correction cleared.";
});
document.getElementById("arFov").addEventListener("input", (e) => {
  ar.fov = Number(e.target.value);
  saveCalibration();
});
