// Earth-based sky: geocentric coordinates, altitude/azimuth, rise and set times, sky chart.
// Uses PLANETS, helioPosition, toJD, DEG and norm360 from simulation.js.

const OBLIQ = 23.4392911;
// Altitude of the body's center at rise/set, including refraction (and semidiameter for Sun and Moon).
const HORIZON = { Sun: -0.833, Moon: 0.125 };
const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (az) => DIRS[Math.round(az / 22.5) % 16];

// Low-precision geocentric Moon (Meeus, truncated). About 0.3 degree accuracy.
function moonGeo(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = (297.8501921 + 445267.1114034 * T) * DEG;
  const M = (357.5291092 + 35999.0502909 * T) * DEG;
  const Mp = (134.9633964 + 477198.8675055 * T) * DEG;
  const F = (93.2720950 + 483202.0175233 * T) * DEG;
  const lon = Lp
    + 6.289 * Math.sin(Mp)
    + 1.274 * Math.sin(2 * D - Mp)
    + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp)
    - 0.186 * Math.sin(M)
    - 0.114 * Math.sin(2 * F);
  const lat = 5.128 * Math.sin(F)
    + 0.280 * Math.sin(Mp + F)
    + 0.277 * Math.sin(Mp - F)
    + 0.173 * Math.sin(2 * D - F);
  const km = 385001 - 20905 * Math.cos(Mp) - 3699 * Math.cos(2 * D - Mp) - 2956 * Math.cos(2 * D);
  return { lon: norm360(lon), lat, dist: km / 149597870.7 };
}

function eclToEq(lonDeg, latDeg, T) {
  const e = (OBLIQ - 0.0130042 * T) * DEG;
  const l = lonDeg * DEG, b = latDeg * DEG;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: norm360(ra / DEG), dec: dec / DEG };
}

// Geocentric ecliptic and equatorial coordinates of the Sun, Moon and planets.
function geoBodies(ms) {
  const jd = toJD(ms);
  const T = (jd - 2451545.0) / 36525;
  const helio = PLANETS.map((p) => ({ p, ...helioPosition(p, jd) }));
  const earth = helio.find((h) => h.p.name === "Earth");
  const out = [];
  const add = (name, color, size, x, y, z) => {
    const dist = Math.hypot(x, y, z);
    const lon = norm360(Math.atan2(y, x) / DEG);
    const lat = Math.asin(z / dist) / DEG;
    out.push({ name, color, size, lon, lat, dist, ...eclToEq(lon, lat, T) });
  };
  add("Sun", "#ffcc33", 7, -earth.x, -earth.y, -earth.z);
  const m = moonGeo(jd);
  out.push({ name: "Moon", color: "#e8ecff", size: 6, lon: m.lon, lat: m.lat, dist: m.dist, ...eclToEq(m.lon, m.lat, T) });
  for (const h of helio) {
    if (h.p.name !== "Earth") add(h.p.name, h.p.color, h.p.size, h.x - earth.x, h.y - earth.y, h.z - earth.z);
  }
  return out;
}

// Greenwich mean sidereal time in degrees.
function gmst(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T);
}

// Altitude and azimuth (from north, eastward) for an observer at lat/lon (east positive).
function altAz(body, jd, lat, lon) {
  const H = (gmst(jd) + lon - body.ra) * DEG;
  const phi = lat * DEG, d = body.dec * DEG;
  const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.cos(H) * Math.sin(phi));
  let altDeg = alt / DEG;
  // The Moon is close enough that parallax lowers it by up to about 1 degree.
  if (body.name === "Moon") altDeg -= Math.asin((6378.14 / 149597870.7) / body.dist * Math.cos(alt)) / DEG;
  return { alt: altDeg, az: norm360(az / DEG) };
}

// Rise, set and highest point for each body on the local calendar day containing ms.
function riseSetDay(ms, lat, lon) {
  const d = new Date(ms);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const STEP = 10 * 60000;
  const series = {};
  for (let i = 0; i <= 144; i++) {
    const t = start + i * STEP;
    const jd = toJD(t);
    for (const b of geoBodies(t)) (series[b.name] ||= []).push({ t, alt: altAz(b, jd, lat, lon).alt });
  }
  const out = {};
  for (const [name, pts] of Object.entries(series)) {
    const h0 = HORIZON[name] ?? -0.5667;
    let rise = null, set = null, top = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const fa = a.alt - h0, fb = b.alt - h0;
      if (fa < 0 && fb >= 0 && rise === null) rise = a.t + ((b.t - a.t) * -fa) / (fb - fa);
      if (fa >= 0 && fb < 0 && set === null) set = a.t + ((b.t - a.t) * fa) / (fa - fb);
      if (b.alt > top.alt) top = b;
    }
    out[name] = {
      rise, set,
      transit: top.t,
      transitAlt: top.alt,
      allUp: pts.every((p) => p.alt > h0),
      allDown: pts.every((p) => p.alt <= h0)
    };
  }
  return out;
}

// ---- DOM ----
const skyCanvas = document.getElementById("skyCanvas");
const skyCtx = skyCanvas.getContext("2d");
const latInput = document.getElementById("latInput");
const lonInput = document.getElementById("lonInput");
const locBtn = document.getElementById("locBtn");
const locStatus = document.getElementById("locStatus");
const riseSetBody = document.getElementById("riseSet");
let skyHits = [];
let lastSky = null;

const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const DEFAULT_OBS = { lat: 39.76, lon: -84.19 };

function getObserver() {
  let lat = Number(latInput.value);
  let lon = Number(lonInput.value);
  if (!Number.isFinite(lat) || latInput.value === "") lat = DEFAULT_OBS.lat;
  if (!Number.isFinite(lon) || lonInput.value === "") lon = DEFAULT_OBS.lon;
  lat = Math.max(-89.9, Math.min(89.9, lat));
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon };
}

function saveObserver() {
  try { localStorage.setItem("observer", JSON.stringify(getObserver())); } catch (e) { /* ignore */ }
}

function loadObserver() {
  let obs = { ...DEFAULT_OBS };
  try {
    const saved = JSON.parse(localStorage.getItem("observer"));
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) obs = saved;
  } catch (e) { /* ignore */ }
  latInput.value = obs.lat.toFixed(3);
  lonInput.value = obs.lon.toFixed(3);
}

function drawSky(ms) {
  const { lat, lon } = getObserver();
  const size = Math.min(skyCanvas.clientWidth, 720);
  const dpr = window.devicePixelRatio || 1;
  skyCanvas.width = size * dpr;
  skyCanvas.height = size * dpr;
  const c = skyCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 28;
  const jd = toJD(ms);
  const T = (jd - 2451545.0) / 36525;
  const bodies = geoBodies(ms).map((b) => ({ ...b, ...altAz(b, jd, lat, lon) }));
  const sunAlt = bodies.find((b) => b.name === "Sun").alt;

  // Sky color follows the Sun: day, civil, nautical, astronomical twilight, night.
  const bg = sunAlt > 0 ? "#2a5298" : sunAlt > -6 ? "#1b2f66" : sunAlt > -12 ? "#0f1a45" : sunAlt > -18 ? "#08102e" : "#03050f";
  c.fillStyle = bg;
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(110, 168, 255, 0.6)";
  c.lineWidth = 1.5;
  c.stroke();

  // Looking up: zenith at center, north at top, east on the left.
  const proj = (alt, az) => {
    const r = (R * (90 - alt)) / 90;
    return [cx - r * Math.sin(az * DEG), cy - r * Math.cos(az * DEG)];
  };

  c.setLineDash([3, 5]);
  c.strokeStyle = "rgba(154, 164, 204, 0.35)";
  c.lineWidth = 1;
  for (const a of [30, 60]) {
    c.beginPath();
    c.arc(cx, cy, (R * (90 - a)) / 90, 0, Math.PI * 2);
    c.stroke();
  }

  // Ecliptic: the path the Sun, Moon and planets follow.
  c.strokeStyle = "rgba(255, 204, 51, 0.45)";
  c.beginPath();
  let penUp = true;
  for (let L = 0; L <= 360; L += 2) {
    const eq = eclToEq(L, 0, T);
    const h = altAz({ name: "", ...eq }, jd, lat, lon);
    if (h.alt < 0) { penUp = true; continue; }
    const [x, y] = proj(h.alt, h.az);
    if (penUp) { c.moveTo(x, y); penUp = false; } else c.lineTo(x, y);
  }
  c.stroke();
  c.setLineDash([]);

  drawStarField(c, proj, jd, lat, lon, sunAlt);

  c.font = "bold 13px system-ui, sans-serif";
  c.fillStyle = "#e8ecff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const [x, y] = proj(-7, az);
    c.fillText(label, x, y);
  }

  c.font = "12px system-ui, sans-serif";
  c.textAlign = "left";
  skyHits = [];
  const labels = [];
  for (const b of bodies) {
    if (b.alt <= 0) continue;
    const [x, y] = proj(b.alt, b.az);
    if (b.name === "Sun") {
      const g = c.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, "#fff7c2");
      g.addColorStop(1, "rgba(255, 180, 40, 0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, 16, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = b.color;
    c.beginPath();
    c.arc(x, y, b.size, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(232, 236, 255, 0.9)";
    placeLabel(c, b.name, x, y, b.size, labels, size);
    skyHits.push({ name: b.name, x, y });
  }

  if (typeof drawSatellitesOnSky === "function") drawSatellitesOnSky(c, proj, ms, lat, lon);
}

// ---- Stars and constellations ----
// Catalog positions are J2000; precession since then shifts them by under half a degree.
const skyOpts = { stars: true, lines: true, labels: true };

function bvColor(bv) {
  if (bv < 0) return "#aabfff";
  if (bv < 0.3) return "#cad7ff";
  if (bv < 0.6) return "#f8f7ff";
  if (bv < 1.0) return "#fff4e8";
  if (bv < 1.4) return "#ffd2a1";
  return "#ffb56c";
}

// Alt/az for a fixed RA/Dec. Shares the sidereal time across many stars for speed.
function makeStarProjector(jd, lat, lon) {
  const lst = gmst(jd) + lon;
  const sphi = Math.sin(lat * DEG), cphi = Math.cos(lat * DEG);
  return (ra, dec) => {
    const H = (lst - ra) * DEG, d = dec * DEG;
    const sd = Math.sin(d), cd = Math.cos(d), cH = Math.cos(H);
    const alt = Math.asin(sphi * sd + cphi * cd * cH);
    const az = Math.atan2(-cd * Math.sin(H), sd * cphi - cd * cH * sphi);
    return { alt: alt / DEG, az: norm360(az / DEG) };
  };
}

function drawStarField(c, proj, jd, lat, lon, sunAlt) {
  const data = window.SKY_DATA;
  if (!data) return;
  const toAltAz = makeStarProjector(jd, lat, lon);
  // Stars fade out as the sky brightens, but stay faintly visible in daylight for reference.
  const fade = sunAlt < -12 ? 1 : sunAlt > 0 ? 0.3 : 0.3 + (0.7 * (0 - sunAlt)) / 12;

  if (skyOpts.lines) {
    c.strokeStyle = `rgba(110, 168, 255, ${0.45 * fade})`;
    c.lineWidth = 1;
    for (const [, segments] of data.lines) {
      for (const seg of segments) {
        c.beginPath();
        let penUp = true;
        for (const [ra, dec] of seg) {
          const h = toAltAz(ra, dec);
          if (h.alt < 0) { penUp = true; continue; }
          const [x, y] = proj(h.alt, h.az);
          if (penUp) { c.moveTo(x, y); penUp = false; } else c.lineTo(x, y);
        }
        c.stroke();
      }
    }
  }

  if (skyOpts.stars) {
    for (const [ra, dec, mag, bv] of data.stars) {
      const h = toAltAz(ra, dec);
      if (h.alt < 0) continue;
      const [x, y] = proj(h.alt, h.az);
      c.globalAlpha = fade * Math.min(1, Math.max(0.35, (6 - mag) / 4));
      c.fillStyle = bvColor(bv);
      c.beginPath();
      c.arc(x, y, Math.max(0.6, 3.2 - 0.55 * mag), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  if (skyOpts.labels) {
    c.font = "10px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillStyle = `rgba(154, 180, 255, ${0.75 * fade})`;
    for (const [, name, ra, dec] of data.labels) {
      const h = toAltAz(ra, dec);
      if (h.alt < 5) continue;
      const [x, y] = proj(h.alt, h.az);
      c.fillText(name.toUpperCase(), x, y);
    }
    c.textAlign = "left";
    c.fillStyle = `rgba(232, 236, 255, ${0.8 * fade})`;
    for (const [name, ra, dec] of data.names) {
      const h = toAltAz(ra, dec);
      if (h.alt < 0) continue;
      const [x, y] = proj(h.alt, h.az);
      c.fillText(name, x + 4, y - 4);
    }
  }
}

// Star catalog and constellation lines from d3-celestial (c) 2015 Olaf Frohn, BSD-3-Clause,
// derived from the Hipparcos and Yale Bright Star catalogs. Loaded from jsDelivr on first use.
const SKY_CDN = "https://cdn.jsdelivr.net/npm/d3-celestial@0.7.35/data/";
const BRIGHT_NAMES = [["Achernar",24.428,-57.237],["Polaris",37.954,89.264],["Mirfak",51.081,49.861],["Aldebaran",68.98,16.509],["Rigel",78.635,-8.202],["Capella",79.172,45.998],["Bellatrix",81.283,6.35],["Elnath",81.573,28.608],["Alnilam",84.053,-1.202],["Alnitak",85.19,-1.943],["Betelgeuse",88.793,7.407],["Menkalinan",89.882,44.947],["Mirzam",95.675,-17.956],["Canopus",95.988,-52.696],["Alhena",99.428,16.399],["Sirius",101.287,-16.716],["Adhara",104.657,-28.972],["Wezen",107.098,-26.393],["Castor",113.649,31.888],["Procyon",114.826,5.225],["Pollux",116.329,28.026],["Regor",122.383,-47.337],["Avior",125.629,-59.509],["Alsephina",131.176,-54.709],["Miaplacidus",138.3,-69.717],["Alphard",141.897,-8.659],["Regulus",152.093,11.967],["Dubhe",165.932,61.751],["Acrux",186.65,-63.099],["Gacrux",187.792,-57.113],["Mimosa",191.93,-59.689],["Alioth",193.507,55.96],["Spica",201.298,-11.161],["Alkaid",206.885,49.313],["Hadar",210.956,-60.373],["Arcturus",213.915,19.182],["Rigil Kentaurus",219.902,-60.834],["Antares",247.352,-26.432],["Atria",252.166,-69.028],["Shaula",263.402,-37.104],["Sargas",264.33,-42.998],["Kaus Australis",276.043,-34.385],["Vega",279.235,38.784],["Altair",297.696,8.868],["Peacock",306.412,-56.735],["Deneb",310.358,45.28],["Alnair",332.058,-46.961],["Fomalhaut",344.413,-29.622]];

async function loadSkyData() {
  if (window.SKY_DATA) return;
  try {
    const get = (f) => fetch(SKY_CDN + f).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const [stars, lines, cons] = await Promise.all([get("stars.6.json"), get("constellations.lines.json"), get("constellations.json")]);
    const ra = (x) => norm360(x);
    window.SKY_DATA = {
      stars: stars.features.filter((f) => f.properties.mag <= 5.5)
        .map((f) => [ra(f.geometry.coordinates[0]), f.geometry.coordinates[1], f.properties.mag, parseFloat(f.properties.bv) || 0]),
      lines: lines.features.map((f) => [f.id, f.geometry.coordinates.map((seg) => seg.map(([a, b]) => [ra(a), b]))]),
      labels: cons.features.map((f) => [f.id, f.properties.name, ra(f.geometry.coordinates[0]), f.geometry.coordinates[1]]),
      names: BRIGHT_NAMES
    };
    if (currentMs) render();
  } catch (e) {
    const note = document.getElementById("vizNote");
    if (note && activeTab === "sky") note.textContent = "Could not load the star catalog. Check your internet connection.";
  }
}
loadSkyData();

for (const key of Object.keys(skyOpts)) {
  const box = document.getElementById(`opt-${key}`);
  if (!box) continue;
  box.checked = skyOpts[key];
  box.addEventListener("change", () => { skyOpts[key] = box.checked; render(); });
}

// Which location the sky uses, in words, so a default is never silent.
function showLocLine() {
  const { lat, lon } = getObserver();
  const isDefault = Math.abs(lat - DEFAULT_OBS.lat) < 0.001 && Math.abs(lon - DEFAULT_OBS.lon) < 0.001;
  const coords = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
  document.getElementById("locLine").textContent = isDefault ? `Using a default location (Dayton, OH)` : `For ${coords}`;
}

function renderSkyPanel(ms) {
  showLocLine();
  const { lat, lon } = getObserver();
  const rs = riseSetDay(ms, lat, lon);
  const jd = toJD(ms);
  const now = {};
  for (const b of geoBodies(ms)) now[b.name] = altAz(b, jd, lat, lon);
  lastSky = { rs, now };

  riseSetBody.innerHTML = "";
  for (const name of Object.keys(rs)) {
    const r = rs[name];
    const n = now[name];
    const tr = document.createElement("tr");
    tr.dataset.body = name;
    if (name === selectedBody) tr.classList.add("selected");
    const riseText = r.allUp ? "Up all day" : r.allDown ? "Not up" : r.rise ? fmtTime(r.rise) : "--";
    const setText = r.allUp || r.allDown ? "" : r.set ? fmtTime(r.set) : "--";
    const nowText = n.alt > 0 ? `${n.alt.toFixed(0)}° up, ${compass(n.az)}` : "Below";
    if (n.alt <= 0) tr.classList.add("down");
    for (const text of [name, riseText, setText, nowText]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    tr.addEventListener("click", () => selectBody(name));
    riseSetBody.appendChild(tr);
  }
}

latInput.addEventListener("change", () => { saveObserver(); render(); });
lonInput.addEventListener("change", () => { saveObserver(); render(); });

locBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locStatus.textContent = "Location is not available in this browser.";
    return;
  }
  locStatus.textContent = "Finding you... Allow location access if your phone asks.";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      latInput.value = pos.coords.latitude.toFixed(3);
      lonInput.value = pos.coords.longitude.toFixed(3);
      locStatus.textContent = "";
      saveObserver();
      render();
    },
    () => { locStatus.textContent = "Could not get your location. Enter it manually."; },
    { timeout: 10000 }
  );
});

skyCanvas.addEventListener("click", (e) => {
  const rect = skyCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null, bestD = 16;
  for (const h of skyHits) {
    const dd = Math.hypot(h.x - x, h.y - y);
    if (dd < bestD) { best = h; bestD = dd; }
  }
  if (best) selectBody(best.name);
});

loadObserver();
