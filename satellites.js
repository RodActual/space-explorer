// Satellite pass predictions with SGP4 (satellite.js, loaded from jsDelivr).
// Orbital data (TLEs) come from CelesTrak through /api/tle when hosted, or directly as a fallback.
// Uses helioPosition, PLANETS, eclToEq, gmst, altAz, compass, DEG, DAY, norm360 from the other scripts.

const FEATURED_SATS = [
  { id: 25544, name: "ISS" },
  { id: 48274, name: "Tiangong" },
  { id: 20580, name: "Hubble" }
];
const TLE_CACHE_KEY = "tleCache";
const TLE_MAX_AGE = 12 * 3600000;
const EARTH_R = 6378.137;
const MIN_ALT = 10;

let tleList = [];
let tleFetchedAt = 0;
let satTrack = null;

const catalogNumber = (line1) => Number(line1.slice(2, 7));

function parseTLEText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length; i++) {
    if (lines[i + 1].startsWith("1 ") && lines[i + 2].startsWith("2 ")) {
      out.push({ name: lines[i].trim(), l1: lines[i + 1], l2: lines[i + 2] });
      i += 2;
    }
  }
  return out;
}

async function loadTLEs(force) {
  if (!force && tleList.length && Date.now() - tleFetchedAt < TLE_MAX_AGE) return tleList;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(TLE_CACHE_KEY));
      if (cached && Date.now() - cached.at < TLE_MAX_AGE && cached.list.length) {
        tleList = cached.list;
        tleFetchedAt = cached.at;
        return tleList;
      }
    } catch (e) { /* ignore */ }
  }

  let list = [];
  if (location.protocol.startsWith("http")) {
    try {
      const res = await fetch("/api/tle");
      if (res.ok) list = await res.json();
    } catch (e) { /* fall through to direct request */ }
  }
  if (!list.length) {
    // Direct request. Works only if CelesTrak allows this browser origin.
    const urls = [
      "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=TLE",
      ...FEATURED_SATS.map((s) => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${s.id}&FORMAT=TLE`)
    ];
    const texts = await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.text() : "")).catch(() => "")));
    const seen = new Map();
    for (const t of parseTLEText(texts.join("\n"))) seen.set(catalogNumber(t.l1), t);
    list = [...seen.values()];
  }
  if (!list.length) throw new Error("Could not download satellite orbit data. Check your connection and try again.");

  tleList = list;
  tleFetchedAt = Date.now();
  try { localStorage.setItem(TLE_CACHE_KEY, JSON.stringify({ at: tleFetchedAt, list })); } catch (e) { /* ignore */ }
  return tleList;
}

function tleFor(id) {
  return tleList.find((t) => catalogNumber(t.l1) === id);
}

function displayName(t) {
  const f = FEATURED_SATS.find((s) => s.id === catalogNumber(t.l1));
  return f ? f.name : t.name.replace(/\s+/g, " ");
}

// TLE epoch as a timestamp, from columns 19-32 of line 1 (YYDDD.DDDDDDDD).
function tleEpochMs(l1) {
  const yy = Number(l1.slice(18, 20));
  const day = Number(l1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return Date.UTC(year, 0, 1) + (day - 1) * DAY;
}

// Unit vector toward the Sun in Earth-centered equatorial coordinates.
function sunUnitEq(ms) {
  const jd = toJD(ms);
  const T = (jd - 2451545.0) / 36525;
  const e = helioPosition(PLANETS[2], jd);
  const lon = norm360(Math.atan2(-e.y, -e.x) / DEG);
  const { ra, dec } = eclToEq(lon, 0, T);
  return { ra, dec, v: [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)] };
}

// Cylindrical Earth-shadow test: is the satellite lit by the Sun?
function isSunlit(posKm, sunV) {
  const dot = posKm.x * sunV[0] + posKm.y * sunV[1] + posKm.z * sunV[2];
  if (dot > 0) return true;
  const px = posKm.x - dot * sunV[0], py = posKm.y - dot * sunV[1], pz = posKm.z - dot * sunV[2];
  return Math.hypot(px, py, pz) > EARTH_R;
}

function lookAt(satrec, ms, observer) {
  const date = new Date(ms);
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const g = satellite.gstime(date);
  const look = satellite.ecfToLookAngles(observer, satellite.eciToEcf(pv.position, g));
  return { alt: look.elevation / DEG, az: norm360(look.azimuth / DEG), pos: pv.position, rangeKm: look.rangeSat };
}

// Find passes above MIN_ALT. Coarse steps, then bisection for the start and end times.
function findPasses(tle, startMs, days, lat, lon, stepSec) {
  const satrec = satellite.twoline2satrec(tle.l1, tle.l2);
  const observer = { latitude: lat * DEG, longitude: lon * DEG, height: 0.2 };
  const step = stepSec * 1000;
  const end = startMs + days * DAY;
  const altAt = (t) => { const l = lookAt(satrec, t, observer); return l ? l.alt : -90; };
  const edge = (a, b, rising) => {
    for (let i = 0; i < 20; i++) {
      const m = (a + b) / 2;
      if ((altAt(m) >= MIN_ALT) === rising) b = m; else a = m;
    }
    return (a + b) / 2;
  };

  const passes = [];
  let prevT = startMs, prevAlt = altAt(startMs), inPass = prevAlt >= MIN_ALT, passStart = inPass ? startMs : null;
  for (let t = startMs + step; t <= end; t += step) {
    const alt = altAt(t);
    if (!inPass && alt >= MIN_ALT) { passStart = edge(prevT, t, true); inPass = true; }
    else if (inPass && alt < MIN_ALT) {
      passes.push(describePass(satrec, observer, passStart, edge(prevT, t, false), lat, lon));
      inPass = false;
    }
    prevT = t;
    prevAlt = alt;
  }
  return passes.filter(Boolean);
}

function describePass(satrec, observer, t0, t1, lat, lon) {
  const n = Math.max(12, Math.round((t1 - t0) / 10000));
  const samples = [];
  let top = null, visibleFrom = null, visibleTo = null;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const l = lookAt(satrec, t, observer);
    if (!l) continue;
    const sun = sunUnitEq(t);
    const sunAlt = altAz({ name: "Sun", ra: sun.ra, dec: sun.dec }, toJD(t), lat, lon).alt;
    const lit = isSunlit(l.pos, sun.v);
    const visible = lit && sunAlt < -6;
    if (visible) { visibleFrom ??= t; visibleTo = t; }
    samples.push({ t, alt: l.alt, az: l.az, visible });
    if (!top || l.alt > top.alt) top = { t, alt: l.alt, az: l.az };
  }
  if (!top) return null;
  return {
    start: t0, end: t1, top,
    startAz: samples[0].az, endAz: samples[samples.length - 1].az,
    visible: visibleFrom !== null, visibleFrom, visibleTo,
    samples
  };
}

// Sky chart overlay: the selected pass track and featured satellites currently overhead.
function drawSatellitesOnSky(c, proj, ms, lat, lon) {
  if (satTrack) {
    c.lineWidth = 2;
    for (let i = 1; i < satTrack.samples.length; i++) {
      const a = satTrack.samples[i - 1], b = satTrack.samples[i];
      c.strokeStyle = b.visible ? "rgba(140, 255, 190, 0.9)" : "rgba(154, 164, 204, 0.5)";
      c.beginPath();
      c.moveTo(...proj(a.alt, a.az));
      c.lineTo(...proj(b.alt, b.az));
      c.stroke();
    }
  }
  if (typeof satellite === "undefined" || !tleList.length) return;
  const observer = { latitude: lat * DEG, longitude: lon * DEG, height: 0.2 };
  c.font = "11px system-ui, sans-serif";
  for (const f of FEATURED_SATS) {
    const t = tleFor(f.id);
    if (!t) continue;
    const l = lookAt(satellite.twoline2satrec(t.l1, t.l2), ms, observer);
    if (!l || l.alt <= 0) continue;
    const [x, y] = proj(l.alt, l.az);
    c.fillStyle = "#8cffbe";
    c.fillRect(x - 3, y - 3, 6, 6);
    c.fillText(f.name, x + 6, y - 6);
  }
}

// ---- DOM ----
const satSelect = document.getElementById("satSelect");
const satDays = document.getElementById("satDays");
const satVisibleOnly = document.getElementById("satVisibleOnly");
const satBtn = document.getElementById("satBtn");
const satSummary = document.getElementById("satSummary");
const satList = document.getElementById("satList");

const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? "under 1 min" : `${m} min`; };

satBtn.addEventListener("click", async () => {
  if (typeof satellite === "undefined") {
    satSummary.textContent = "The satellite library did not load.";
    return;
  }
  satSummary.textContent = "Downloading orbit data...";
  satList.innerHTML = "";
  try {
    await loadTLEs();
  } catch (err) {
    satSummary.textContent = err.message;
    return;
  }

  const { lat, lon } = getObserver();
  const days = Math.min(10, Math.max(1, Number(satDays.value) || 3));
  const choice = satSelect.value;
  const targets = choice === "bright"
    ? tleList
    : [tleFor(Number(choice))].filter(Boolean);
  if (!targets.length) {
    satSummary.textContent = "No orbit data for that satellite right now.";
    return;
  }

  satSummary.textContent = `Calculating passes for ${targets.length} satellite${targets.length === 1 ? "" : "s"}...`;
  setTimeout(() => {
    const start = currentMs;
    const step = targets.length > 10 ? 60 : 30;
    const daysUsed = targets.length > 10 ? Math.min(days, 2) : days;
    let rows = [];
    for (const t of targets) {
      for (const p of findPasses(t, start, daysUsed, lat, lon, step)) rows.push({ sat: displayName(t), tle: t, ...p });
    }
    if (satVisibleOnly.checked || choice === "bright") rows = rows.filter((r) => r.visible);
    rows.sort((a, b) => a.start - b.start);
    rows = rows.slice(0, 100);

    for (const r of rows) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const strong = document.createElement("strong");
      strong.textContent = `${r.sat}: ${new Date(r.start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
      const span = document.createElement("span");
      span.textContent =
        ` ${fmtDur(r.end - r.start)}, ${compass(r.startAz)} to ${compass(r.endAz)}, highest ${r.top.alt.toFixed(0)} deg ${compass(r.top.az)}. ` +
        (r.visible ? `Visible ${new Date(r.visibleFrom).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} to ${new Date(r.visibleTo).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
          : "Not visible (daylight or in Earth's shadow).");
      btn.append(strong, span);
      btn.addEventListener("click", () => {
        satTrack = r;
        if (activeTab !== "sky") setTab("sky");
        setMs(r.top.t);
      });
      li.appendChild(btn);
      satList.appendChild(li);
    }

    const ages = targets.map((t) => (Date.now() - tleEpochMs(t.l1)) / DAY);
    const oldest = Math.max(...ages);
    const span = choice === "bright" && days > 2 ? " Bright-satellite search is limited to 2 days." : "";
    satSummary.textContent = (rows.length
      ? `${rows.length} pass${rows.length === 1 ? "" : "es"} found from your location.${span} Tap one to show its path on the sky chart.`
      : `No ${satVisibleOnly.checked || choice === "bright" ? "visible " : ""}passes in this window.${span}`) +
      (oldest > 30 ? ` Orbit data is ${oldest.toFixed(0)} days old and too stale for reliable times.`
        : oldest > 7 ? ` Orbit data is ${oldest.toFixed(0)} days old, so times may be off by minutes.` : "");
  }, 20);
});
