// Mean orbital elements (J2000 ecliptic) with secular rates per Julian century.
// Source: E. M. Standish, JPL "Keplerian Elements for Approximate Positions".
// Element order: a (AU), e, I (deg), L (mean longitude, deg), lonPeri (deg), lonNode (deg).
const PLANETS = [
  { name: "Mercury", color: "#b5b5b5", size: 2.5,
    el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { name: "Venus", color: "#e8c27a", size: 3.5,
    el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    rate: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
  { name: "Earth", color: "#4f8cff", size: 3.7,
    el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  { name: "Mars", color: "#d9653b", size: 3.0,
    el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { name: "Jupiter", color: "#d9b38c", size: 7,
    el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { name: "Saturn", color: "#e6d19a", size: 6.2,
    el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  { name: "Uranus", color: "#86d7e0", size: 4.8,
    el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  { name: "Neptune", color: "#3a5fd9", size: 4.6,
    el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] }
];

// Static reference data for the info card. Moon counts as of 2025.
const BODY_INFO = {
  Sun: { type: "Star (G-type main sequence)", diameter: "1,391,000 km", period: "About 230 million years around the galaxy", moons: "None",
    desc: "Holds about 99.8% of the solar system's mass." },
  Moon: { type: "Earth's natural satellite", diameter: "3,474 km", period: "27.3 days (29.5 days phase to phase)", moons: "None",
    desc: "Always shows the same face to Earth. Its gravity drives the ocean tides." },
  Mercury: { type: "Rocky planet", diameter: "4,879 km", period: "88 days", moons: "0",
    desc: "The smallest planet and closest to the Sun. Never strays more than about 28 degrees from the Sun in our sky." },
  Venus: { type: "Rocky planet", diameter: "12,104 km", period: "225 days", moons: "0",
    desc: "The brightest planet in our sky, wrapped in thick carbon dioxide clouds. Often called the morning or evening star." },
  Earth: { type: "Rocky planet", diameter: "12,742 km", period: "365.25 days", moons: "1",
    desc: "The only known world with liquid surface water and life." },
  Mars: { type: "Rocky planet", diameter: "6,779 km", period: "687 days", moons: "2",
    desc: "A cold desert world. Reaches opposition about every 26 months, when it looks brightest." },
  Jupiter: { type: "Gas giant", diameter: "139,820 km", period: "11.9 years", moons: "95+",
    desc: "The largest planet. Binoculars show its four largest moons as points of light beside it." },
  Saturn: { type: "Gas giant", diameter: "116,460 km", period: "29.5 years", moons: "274",
    desc: "Famous for its bright rings, visible in a small telescope." },
  Uranus: { type: "Ice giant", diameter: "50,724 km", period: "84 years", moons: "29",
    desc: "Tilted about 98 degrees, so it rolls around the Sun on its side. Barely visible to the naked eye under dark skies." },
  Neptune: { type: "Ice giant", diameter: "49,244 km", period: "165 years", moons: "16",
    desc: "The windiest planet. Needs a telescope to see." }
};

// Replace with a free personal key from https://api.nasa.gov to lift the demo rate limit.
const APOD_KEY = "DEMO_KEY";
const APOD_FIRST = "1995-06-16";

const DEG = Math.PI / 180;
const DAY = 86400000;
const SYNODIC_MONTH = 29.530588;
const AU_LIGHT_SECONDS = 499.005;
const norm360 = (x) => ((x % 360) + 360) % 360;
const pad = (n) => String(n).padStart(2, "0");
const localDateStr = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Julian Date from a UTC timestamp in milliseconds.
const toJD = (ms) => ms / 86400000 + 2440587.5;

// Heliocentric ecliptic position of a planet at a given Julian Date.
function helioPosition(p, jd) {
  const T = (jd - 2451545.0) / 36525;
  const [a0, e0, i0, L0, lp0, ln0] = p.el;
  const [da, de, di, dL, dlp, dln] = p.rate;

  const a = a0 + da * T;
  const e = e0 + de * T;
  const I = (i0 + di * T) * DEG;
  const L = L0 + dL * T;
  const lp = lp0 + dlp * T;
  const ln = ln0 + dln * T;

  const w = (lp - ln) * DEG;
  let M = norm360(L - lp);
  if (M > 180) M -= 360;
  M *= DEG;

  // Solve Kepler's equation with Newton iteration.
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 15; k++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const O = ln * DEG;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;

  return { x, y, z, a, lon: norm360(Math.atan2(y, x) / DEG), r: Math.hypot(x, y) };
}

// Bodies for a timestamp in the chosen frame.
// Heliocentric: eight planets from the Sun. Geocentric: seven planets from Earth, plus the Sun.
function frameAt(ms, view) {
  const jd = toJD(ms);
  const all = PLANETS.map((p) => ({ ...p, ...helioPosition(p, jd) }));
  const earth = all.find((b) => b.name === "Earth");

  if (view === "helio") {
    return { bodies: all, sun: null, earth: null };
  }

  const bodies = all
    .filter((b) => b.name !== "Earth")
    .map((b) => {
      const dx = b.x - earth.x;
      const dy = b.y - earth.y;
      return { ...b, x: dx, y: dy, lon: norm360(Math.atan2(dy, dx) / DEG), r: Math.hypot(dx, dy) };
    });
  return {
    bodies,
    sun: { name: "Sun", color: "#ffcc33", size: 6, lon: norm360(earth.lon + 180), r: earth.r },
    earth
  };
}

// Moon phase from Meeus' low-precision elongation series (accurate to about a degree).
function moonPhase(ms) {
  const T = (toJD(ms) - 2451545.0) / 36525;
  const D = norm360(297.8501921 + 445267.1114034 * T) * DEG;
  const M = norm360(357.5291092 + 35999.0502909 * T) * DEG;
  const Mp = norm360(134.9633964 + 477198.8675055 * T) * DEG;
  const i = 180 - D / DEG
    - 6.289 * Math.sin(Mp)
    + 2.100 * Math.sin(M)
    - 1.274 * Math.sin(2 * D - Mp)
    - 0.658 * Math.sin(2 * D)
    - 0.214 * Math.sin(2 * Mp)
    - 0.110 * Math.sin(D);
  const elong = norm360(180 - i);
  const illum = (1 + Math.cos(i * DEG)) / 2;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
    "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  return {
    illum,
    waxing: elong < 180,
    age: (elong / 360) * SYNODIC_MONTH,
    name: names[Math.round(elong / 45) % 8]
  };
}

// Smallest arc (degrees) containing all longitudes.
function arcSpan(lons) {
  const sorted = [...lons].sort((A, B) => A - B);
  let maxGap = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
    maxGap = Math.max(maxGap, next - sorted[i]);
  }
  return 360 - maxGap;
}

function levelFor(span, tight, loose) {
  if (span <= tight) return "tight";
  if (span <= loose) return "loose";
  return "none";
}

// Pairs of bodies whose longitudes differ by 15 degrees or less.
function conjunctions(list) {
  const pairs = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      let d = Math.abs(list[i].lon - list[j].lon) % 360;
      if (d > 180) d = 360 - d;
      if (d <= 15) pairs.push([list[i].name, list[j].name, d]);
    }
  }
  return pairs;
}

// Past positions of each body over the trail window, oldest first.
function trailPoints(ms, view, days) {
  const steps = Math.min(150, Math.max(30, days));
  const out = {};
  for (let k = steps; k >= 0; k--) {
    const f = frameAt(ms - (days * DAY * k) / steps, view);
    for (const b of f.bodies) (out[b.name] ||= []).push(b);
    if (f.sun) (out.Sun ||= []).push(f.sun);
  }
  return out;
}

// DOM references
const $ = (id) => document.getElementById(id);
const dateInput = $("dateInput");
const timeInput = $("timeInput");
const viewSelect = $("viewSelect");
const trailSelect = $("trailSelect");
const tightInput = $("tightInput");
const looseInput = $("looseInput");
const nightBtn = $("nightBtn");
const copyBtn = $("copyBtn");
const copyStatus = $("copyStatus");
const positionsBody = $("positions");
const verdict = $("verdict");
const spanText = $("spanText");
const conjText = $("conjText");
const frameNote = $("frameNote");
const canvas = $("orrery");
const ctx = canvas.getContext("2d");
const moonCanvas = $("moonCanvas");
const playBtn = $("playBtn");
const speedSelect = $("speedSelect");
const searchStart = $("searchStart");
const searchDays = $("searchDays");
const searchTol = $("searchTol");
const searchBtn = $("searchBtn");
const resultsList = $("results");
const searchSummary = $("searchSummary");
const apodBtn = $("apodBtn");
const apodBox = $("apod");
const infoCard = $("infoCard");
const vizNote = $("vizNote");
const tabButtons = document.querySelectorAll("[data-tab]");

// State: UTC timestamp in ms for the selected moment.
let currentMs = 0;
let playing = false;
let playTimer = null;
let activeTab = "map";
let selectedBody = null;
let orreryHits = [];

const TAB_NOTES = {
  map: "The solar system seen from above. Outer orbits are squeezed so everything fits. Tap a planet for details.",
  sky: "Your sky as if lying on your back: straight up is the center, the horizon is the edge. The gold dashed line is the path the planets follow; green squares are satellites. Tap anything for details.",
  "3d": "Drag to spin, pinch or scroll to zoom. Sizes and distances are not to scale."
};

// Inputs show local time. Convert between local inputs and UTC timestamps.
function showInputs(ms) {
  const d = new Date(ms);
  dateInput.value = localDateStr(ms);
  timeInput.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  showTimeStatus(ms);
}

// Plain-language line under the time bar: what moment is shown and how far it is from now.
function relativeTo(ms) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  if (abs < 30 * 60000) return "";
  const units = [[365.25 * DAY, "year"], [30.44 * DAY, "month"], [7 * DAY, "week"], [DAY, "day"], [3600000, "hour"]];
  for (const [size, name] of units) {
    if (abs >= size * 0.95) {
      const n = Math.round(abs / size);
      const text = `${n} ${name}${n === 1 ? "" : "s"}`;
      return diff > 0 ? `${text} from now` : `${text} ago`;
    }
  }
  return "";
}

function showTimeStatus(ms) {
  const el = $("timeStatus");
  if (!el) return;
  const when = new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const rel = relativeTo(ms);
  el.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = when;
  el.appendChild(strong);
  if (playing) {
    el.append(" (playing)");
  } else if (rel) {
    el.append(` (${rel}) `);
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to now";
    back.addEventListener("click", () => setMs(Date.now()));
    el.appendChild(back);
  } else {
    el.append(" (now)");
  }
}

// Draws a label next to a point, trying a few spots so labels do not overlap each other.
function placeLabel(c, text, x, y, r, placed, size) {
  const w = c.measureText(text).width;
  const h = 13;
  const spots = [
    [x + r + 4, y], [x - r - 4 - w, y],
    [x + r + 2, y + h], [x + r + 2, y - h],
    [x - r - 2 - w, y + h], [x - r - 2 - w, y - h]
  ];
  const fits = ([lx, ly]) => lx >= 0 && lx + w <= size && ly - h / 2 >= 0 && ly + h / 2 <= size;
  const clear = ([lx, ly]) => placed.every((p) => lx + w < p.x || lx > p.x + p.w || ly + h / 2 < p.y - p.h / 2 || ly - h / 2 > p.y + p.h / 2);
  const spot = spots.find((sp) => fits(sp) && clear(sp)) || spots.find(fits) || spots[0];
  const baseline = c.textBaseline, align = c.textAlign;
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillText(text, spot[0], spot[1]);
  c.textBaseline = baseline;
  c.textAlign = align;
  placed.push({ x: spot[0], y: spot[1], w, h });
}

function msFromInputs() {
  const [y, m, d] = dateInput.value.split("-").map(Number);
  const [h, mi] = (timeInput.value || "12:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
}

function setMs(ms) {
  currentMs = ms;
  showInputs(ms);
  render();
}

function setTab(tab) {
  activeTab = TAB_NOTES[tab] ? tab : "map";
  canvas.hidden = activeTab !== "map";
  $("skyCanvas").hidden = activeTab !== "sky";
  $("view3d").hidden = activeTab !== "3d";
  $("skyOptions").hidden = activeTab !== "sky";
  $("mapOptions").hidden = activeTab !== "map";
  tabButtons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === activeTab)));
  vizNote.textContent = TAB_NOTES[activeTab];
  if (activeTab === "3d") init3D();
  render();
}

function selectBody(name) {
  selectedBody = BODY_INFO[name] ? name : null;
  render();
}

// Night mode
function setNight(on) {
  document.documentElement.classList.toggle("night", on);
  nightBtn.setAttribute("aria-pressed", String(on));
  try { localStorage.setItem("nightMode", on ? "1" : "0"); } catch (e) { /* storage unavailable */ }
}

// Shareable links: state lives in the URL query string.
function writeUrl() {
  const obs = getObserver();
  const p = new URLSearchParams({
    t: new Date(currentMs).toISOString(),
    view: viewSelect.value,
    trail: trailSelect.value,
    tight: tightInput.value,
    loose: looseInput.value,
    tab: activeTab,
    lat: obs.lat.toFixed(3),
    lon: obs.lon.toFixed(3)
  });
  if (selectedBody) p.set("body", selectedBody);
  if (document.documentElement.classList.contains("night")) p.set("night", "1");
  try { history.replaceState(null, "", `${location.pathname}?${p}`); } catch (e) { /* ignore */ }
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  const t = Date.parse(p.get("t"));
  const pick = (el, val) => {
    if (val !== null && [...(el.options || [])].some((o) => o.value === val)) el.value = val;
  };
  pick(viewSelect, p.get("view"));
  pick(trailSelect, p.get("trail"));
  if (Number(p.get("tight")) > 0) tightInput.value = p.get("tight");
  if (Number(p.get("loose")) > 0) looseInput.value = p.get("loose");
  if (p.has("lat") && p.has("lon") && Number.isFinite(Number(p.get("lat"))) && Number.isFinite(Number(p.get("lon")))) {
    latInput.value = p.get("lat");
    lonInput.value = p.get("lon");
  }
  if (BODY_INFO[p.get("body")]) selectedBody = p.get("body");
  if (TAB_NOTES[p.get("tab")]) activeTab = p.get("tab");

  let night = false;
  try { night = localStorage.getItem("nightMode") === "1"; } catch (e) { /* ignore */ }
  if (p.has("night")) night = p.get("night") === "1";
  setNight(night);

  return Number.isFinite(t) ? t : Date.now();
}

async function copyLink() {
  writeUrl();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    copyStatus.textContent = "Link copied";
  } catch (e) {
    window.prompt("Copy this link:", url);
    copyStatus.textContent = "";
  }
  setTimeout(() => { copyStatus.textContent = ""; }, 2500);
}

function renderTable(frame) {
  positionsBody.innerHTML = "";
  const rows = frame.sun ? [frame.sun, ...frame.bodies] : frame.bodies;
  for (const b of rows) {
    const tr = document.createElement("tr");
    tr.dataset.body = b.name;
    if (b.name === selectedBody) tr.classList.add("selected");
    tr.innerHTML =
      `<td>${b.name}</td>` +
      `<td class="num">${b.lon.toFixed(1)}&deg;</td>` +
      `<td class="num">${b.r.toFixed(3)}</td>`;
    tr.addEventListener("click", () => selectBody(b.name));
    positionsBody.appendChild(tr);
  }
}

function renderVerdict(frame) {
  const tight = Number(tightInput.value) || 45;
  const loose = Number(looseInput.value) || 90;
  const span = arcSpan(frame.bodies.map((b) => b.lon));
  const level = levelFor(span, tight, loose);

  const labels = {
    tight: '<span class="tag tight">Tight alignment</span>',
    loose: '<span class="tag loose">Loose alignment</span>',
    none: '<span class="tag none">No alignment</span>'
  };
  verdict.innerHTML = labels[level];
  const origin = frame.earth ? "as seen from Earth" : "as seen from the Sun";
  spanText.textContent = `The planets fit within a ${span.toFixed(0)}-degree arc ${origin}.`;

  const pairs = conjunctions(frame.bodies);
  conjText.textContent = pairs.length
    ? "Close pairs (within 15 degrees): " +
      pairs.map(([a, b, d]) => `${a}-${b} (${d.toFixed(1)} deg)`).join(", ") + "."
    : "No planet pairs are within 15 degrees of each other.";

  frameNote.textContent = frame.earth
    ? "Geocentric view: Earth is the observer, so it is left out of the alignment check."
    : "Heliocentric view: all eight planets are included.";
}

function renderMoon() {
  const m = moonPhase(currentMs);
  $("moonName").textContent = m.name;
  $("moonIllum").textContent = `${(m.illum * 100).toFixed(0)}% illuminated`;
  $("moonAge").textContent = `${m.age.toFixed(1)} days since new moon`;

  // Drawn as seen from the Northern Hemisphere: waxing lit side on the right.
  const c = moonCanvas.getContext("2d");
  const s = moonCanvas.width;
  const r = s / 2 - 4;
  const cx = s / 2, cy = s / 2;
  const lit = "#e8ecff";
  const dark = "#1a2040";
  c.clearRect(0, 0, s, s);

  c.fillStyle = dark;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();

  // Lit half: right side when waxing, left when waning.
  c.fillStyle = lit;
  c.beginPath();
  if (m.waxing) c.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
  else c.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
  c.closePath();
  c.fill();

  // Terminator ellipse trims the lit half (crescent) or extends it (gibbous).
  const rx = r * Math.abs(1 - 2 * m.illum);
  c.fillStyle = m.illum < 0.5 ? dark : lit;
  c.beginPath();
  c.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
  c.fill();
}

function renderInfo() {
  infoCard.innerHTML = "";
  if (!selectedBody) {
    const p = document.createElement("p");
    p.textContent = "Tap a planet, the Sun or the Moon to see details here.";
    infoCard.appendChild(p);
    return;
  }
  const info = BODY_INFO[selectedBody];
  const h = document.createElement("h3");
  h.textContent = selectedBody;
  const type = document.createElement("p");
  type.textContent = info.type;
  const desc = document.createElement("p");
  desc.textContent = info.desc;

  const rows = [
    ["Diameter", info.diameter],
    ["Orbital period", info.period],
    ["Known moons", info.moons]
  ];

  if (selectedBody !== "Earth") {
    const geo = geoSnap(currentMs);
    const b = geo[selectedBody];
    const lightMin = (b.dist * AU_LIGHT_SECONDS) / 60;
    const lightText = lightMin < 1 ? `${(lightMin * 60).toFixed(1)} light-seconds` : `${lightMin.toFixed(1)} light-minutes`;
    const distText = selectedBody === "Moon"
      ? `${Math.round(b.dist * 149597870.7).toLocaleString()} km (${lightText})`
      : `${b.dist.toFixed(3)} AU (${lightText})`;
    rows.push(["Distance from Earth", distText]);
    if (selectedBody !== "Sun") {
      const e = angSep(b, geo.Sun);
      const side = norm180(b.lon - geo.Sun.lon) > 0 ? "east (evening side)" : "west (morning side)";
      rows.push(["Angle from Sun", `${e.toFixed(1)} deg ${side}`]);
    }
    if (lastSky && lastSky.rs[selectedBody]) {
      const r = lastSky.rs[selectedBody];
      const n = lastSky.now[selectedBody];
      const riseSet = r.allUp ? "Up all day" : r.allDown ? "Does not rise today"
        : `Rises ${r.rise ? fmtTime(r.rise) : "--"}, sets ${r.set ? fmtTime(r.set) : "--"}`;
      rows.push(["Today", riseSet]);
      if (!r.allDown) rows.push(["Highest", `${r.transitAlt.toFixed(0)} deg at ${fmtTime(r.transit)}`]);
      rows.push(["Right now", n.alt > 0 ? `${n.alt.toFixed(0)} deg up, ${compass(n.az)}` : "Below the horizon"]);
    }
  }

  const dl = document.createElement("dl");
  dl.className = "info-grid";
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.append(dt, dd);
  }
  infoCard.append(h, type, desc, dl);
}

function drawOrrery(frame, view) {
  const size = Math.min(canvas.clientWidth, 720);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = size / 2, cy = size / 2;
  const maxR = size / 2 - 14;
  const maxDist = view === "helio" ? 30.07 : 31;
  // Square-root scale so near bodies stay visible. Not to physical scale.
  const toPx = (au) => maxR * Math.sqrt(au / maxDist);
  const project = (b) => [
    cx + toPx(b.r) * Math.cos(b.lon * DEG),
    cy - toPx(b.r) * Math.sin(b.lon * DEG)
  ];

  ctx.clearRect(0, 0, size, size);
  ctx.font = "12px system-ui, sans-serif";
  orreryHits = [];

  if (view === "helio") {
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(110, 168, 255, 0.25)";
    for (const b of frame.bodies) {
      ctx.beginPath();
      ctx.arc(cx, cy, toPx(b.a), 0, Math.PI * 2);
      ctx.stroke();
    }
    drawGlow(cx, cy, 16, "#fff7c2", "rgba(255, 180, 40, 0)");
    orreryHits.push({ name: "Sun", x: cx, y: cy });
  } else {
    // Reference rings at 1, 2 and 3 AU from Earth.
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(110, 168, 255, 0.2)";
    ctx.fillStyle = "rgba(154, 164, 204, 0.8)";
    for (const au of [1, 2, 3]) {
      ctx.beginPath();
      ctx.arc(cx, cy, toPx(au), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${au} AU`, cx + toPx(au) * 0.707 + 4, cy - toPx(au) * 0.707);
    }
    drawGlow(cx, cy, 8, "#4f8cff", "rgba(79, 140, 255, 0)");
    ctx.fillStyle = "#4f8cff";
    ctx.fillText("Earth", cx + 10, cy + 4);
    orreryHits.push({ name: "Earth", x: cx, y: cy });
  }

  const labels = [];

  // Trails
  const days = Number(trailSelect.value);
  if (days > 0) {
    const trails = trailPoints(currentMs, view, days);
    ctx.lineWidth = 1.5;
    for (const [name, pts] of Object.entries(trails)) {
      const color = name === "Sun" ? "#ffcc33" : PLANETS.find((p) => p.name === name).color;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      pts.forEach((b, i) => {
        const [x, y] = project(b);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (frame.sun) {
    const [sx, sy] = project(frame.sun);
    drawGlow(sx, sy, 14, "#fff7c2", "rgba(255, 180, 40, 0)");
    ctx.fillStyle = "rgba(232, 236, 255, 0.85)";
    placeLabel(ctx, "Sun", sx, sy, 6, labels, size);
    orreryHits.push({ name: "Sun", x: sx, y: sy });
  }

  for (const b of frame.bodies) {
    const [px, py] = project(b);
    if (b.name === selectedBody) {
      ctx.strokeStyle = "#6ea8ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, b.size + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(px, py, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(232, 236, 255, 0.85)";
    placeLabel(ctx, b.name, px, py, b.size, labels, size);
    orreryHits.push({ name: b.name, x: px, y: py });
  }
}

function drawGlow(x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  const view = viewSelect.value;
  const frame = frameAt(currentMs, view);
  renderTable(frame);
  renderVerdict(frame);
  renderMoon();
  if (activeTab === "map") drawOrrery(frame, view);
  else if (activeTab === "sky") drawSky(currentMs);
  else update3D(currentMs);
  renderSkyPanel(currentMs);
  renderInfo();
  writeUrl();
}

// Scan forward day by day and list the first day of each run where the
// planets fit within the tolerance.
function findAlignments() {
  const [y, m, d] = searchStart.value.split("-").map(Number);
  if (!y) return;
  const startMs = new Date(y, m - 1, d, 12).getTime();
  const days = Math.min(3650, Math.max(1, Number(searchDays.value) || 365));
  const tol = Math.min(359, Math.max(1, Number(searchTol.value) || 90));
  const view = viewSelect.value;

  const hits = [];
  let prevHit = false;
  for (let i = 0; i < days; i++) {
    const ms = startMs + i * DAY;
    const frame = frameAt(ms, view);
    const span = arcSpan(frame.bodies.map((b) => b.lon));
    const hit = span <= tol;
    if (hit && !prevHit) hits.push({ ms, span });
    prevHit = hit;
    if (hits.length >= 50) break;
  }

  resultsList.innerHTML = "";
  for (const h of hits) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const dt = new Date(h.ms);
    btn.type = "button";
    btn.textContent =
      `${dt.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}` +
      ` - span ${h.span.toFixed(0)} deg`;
    btn.addEventListener("click", () => setMs(h.ms));
    li.appendChild(btn);
    resultsList.appendChild(li);
  }

  const frameWord = view === "helio" ? "from the Sun" : "from Earth";
  searchSummary.textContent = hits.length
    ? `${hits.length}${hits.length === 50 ? " or more" : ""} run${hits.length === 1 ? "" : "s"} found within ${tol} degrees ${frameWord}. Tap a date to view it.`
    : `No dates within ${tol} degrees ${frameWord} in this range.`;
}

// NASA Astronomy Picture of the Day for the selected date.
async function loadApod() {
  let date = localDateStr(currentMs);
  const today = localDateStr(Date.now());
  let note = "";
  if (date < APOD_FIRST) { date = APOD_FIRST; note = "APOD starts on 1995-06-16, showing the first entry."; }
  if (date > today) { date = today; note = "No pictures exist for future dates, showing today's."; }

  apodBox.textContent = "Loading...";
  try {
    // Hosted: the server function holds the API key. Local file: call NASA directly with the demo key.
    const url = location.protocol.startsWith("http")
      ? `/api/apod?date=${date}`
      : `https://api.nasa.gov/planetary/apod?api_key=${APOD_KEY}&date=${date}`;
    let res = await fetch(url);
    if (res.status === 404 && url.startsWith("/api/")) {
      res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${APOD_KEY}&date=${date}`);
    }
    if (!res.ok) {
      throw new Error(res.status === 429
        ? "NASA's rate limit was reached. Add a NASA_API_KEY to the hosting settings to raise it."
        : `Request failed (${res.status}).`);
    }
    const data = await res.json();
    apodBox.innerHTML = "";

    if (note) {
      const n = document.createElement("p");
      n.textContent = note;
      apodBox.appendChild(n);
    }

    const h = document.createElement("h3");
    h.textContent = data.title || "Untitled";
    apodBox.appendChild(h);

    const meta = document.createElement("p");
    meta.textContent = data.date + (data.copyright ? ` | Credit: ${data.copyright.trim()}` : "");
    apodBox.appendChild(meta);

    if (data.media_type === "image") {
      const a = document.createElement("a");
      a.href = data.hdurl || data.url;
      a.target = "_blank";
      a.rel = "noopener";
      const img = document.createElement("img");
      img.src = data.url;
      img.alt = data.title || "Astronomy picture of the day";
      a.appendChild(img);
      apodBox.appendChild(a);
    } else if (data.url) {
      const a = document.createElement("a");
      a.href = data.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Open today's video";
      apodBox.appendChild(a);
    }

    const ex = document.createElement("p");
    ex.textContent = data.explanation || "";
    apodBox.appendChild(ex);
  } catch (err) {
    apodBox.textContent = err.message || "Could not load the picture.";
  }
}

// Controls
$("todayBtn").addEventListener("click", () => setMs(Date.now()));

document.querySelectorAll("[data-step]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const days = Number(btn.dataset.step);
    setMs(currentMs + days * DAY);
  });
});

dateInput.addEventListener("change", () => {
  if (dateInput.value) setMs(msFromInputs());
});
timeInput.addEventListener("change", () => {
  if (timeInput.value) setMs(msFromInputs());
});
[viewSelect, trailSelect, tightInput, looseInput].forEach((el) => el.addEventListener("change", render));
tabButtons.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null, bestD = 24; // Finger-sized hit area.
  for (const h of orreryHits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bestD) { best = h; bestD = d; }
  }
  if (best) selectBody(best.name);
});

nightBtn.addEventListener("click", () => {
  setNight(!document.documentElement.classList.contains("night"));
  writeUrl();
});
copyBtn.addEventListener("click", copyLink);
apodBtn.addEventListener("click", loadApod);

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? "Pause" : "Play";
  playBtn.setAttribute("aria-pressed", String(playing));
  showTimeStatus(currentMs);
  if (playing) {
    playTimer = setInterval(() => {
      setMs(currentMs + Number(speedSelect.value) * DAY);
    }, 120);
  } else {
    clearInterval(playTimer);
  }
});

searchBtn.addEventListener("click", findAlignments);

// Side panel tabs and the search picker. The choice is remembered per browser.
function remember(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* storage unavailable */ }
}
function recall(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

const panelButtons = document.querySelectorAll("[data-panel]");
function setPanel(name) {
  if (!document.querySelector(`[data-pane="${name}"]`)) name = "tonight";
  panelButtons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.panel === name)));
  document.querySelectorAll("[data-pane]").forEach((el) => { el.hidden = el.dataset.pane !== name; });
  remember("panel", name);
}
panelButtons.forEach((b) => b.addEventListener("click", () => setPanel(b.dataset.panel)));

const finderSelect = $("finderSelect");
function setFinder(name) {
  if (![...finderSelect.options].some((o) => o.value === name)) name = "events";
  finderSelect.value = name;
  document.querySelectorAll("[data-finder]").forEach((el) => { el.hidden = el.dataset.finder !== name; });
  remember("finder", name);
}
finderSelect.addEventListener("change", () => setFinder(finderSelect.value));

// On phones the map sits above the result lists, so bring it into view after a jump.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".result-list button")) return;
  if (window.matchMedia("(max-width: 799px)").matches) {
    document.querySelector(".viz").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
setPanel(recall("panel"));
setFinder(recall("finder"));
window.addEventListener("resize", render);

// Initial state runs after sky.js, events.js and view3d.js have loaded.
window.addEventListener("DOMContentLoaded", () => {
  const today = localDateStr(Date.now());
  searchStart.value = today;
  $("eventStart").value = today;
  $("eclStart").value = today;
  const ms = readUrl();
  currentMs = ms;
  showInputs(ms);
  setTab(activeTab);
});
