// Event finder: planet conjunctions, oppositions, conjunctions with the Sun,
// and greatest elongations of Mercury and Venus, all as seen from Earth.
// Uses geoBodies from sky.js and DAY, norm360 from simulation.js.

const norm180 = (x) => { const v = norm360(x); return v > 180 ? v - 360 : v; };
const EVENT_PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
const OUTER_PLANETS = ["Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
const HOUR = 3600000;

// Angular separation in degrees between two bodies with ecliptic lon/lat.
function angSep(a, b) {
  const b1 = a.lat * DEG, b2 = b.lat * DEG, dl = (a.lon - b.lon) * DEG;
  const c = Math.sin(b1) * Math.sin(b2) + Math.cos(b1) * Math.cos(b2) * Math.cos(dl);
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}

function geoSnap(ms) {
  const m = {};
  for (const b of geoBodies(ms)) m[b.name] = b;
  return m;
}

// Hourly scan for the minimum of fn within 36 hours of t0.
function refineMin(fn, t0) {
  let best = { t: t0, v: fn(t0) };
  for (let h = -36; h <= 36; h++) {
    const t = t0 + h * HOUR;
    const v = fn(t);
    if (v < best.v) best = { t, v };
  }
  return best;
}

// Bisection for a sign change of fn between a and b.
function refineRoot(fn, a, b) {
  let fa = fn(a);
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2;
    const fm = fn(m);
    if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

function findEvents(startMs, days, maxSep) {
  const events = [];
  const snaps = [];
  for (let i = 0; i <= days + 1; i++) snaps.push(geoSnap(startMs + i * DAY));
  const tAt = (i) => startMs + i * DAY;
  const elong = (s, P) => norm180(s[P].lon - s.Sun.lon);

  for (let i = 0; i < snaps.length - 1; i++) {
    const s1 = snaps[i], s2 = snaps[i + 1];

    for (const P of EVENT_PLANETS) {
      const e1 = elong(s1, P), e2 = elong(s2, P);

      // Conjunction with the Sun: longitude difference crosses zero.
      if (Math.abs(e1) < 90 && Math.abs(e2) < 90 && (e1 < 0) !== (e2 < 0)) {
        const t = refineRoot((tt) => elong(geoSnap(tt), P), tAt(i), tAt(i + 1));
        const s = geoSnap(t);
        let title = `${P} in conjunction with the Sun`;
        if (P === "Mercury" || P === "Venus") {
          title = s[P].dist < s.Sun.dist ? `${P} at inferior conjunction` : `${P} at superior conjunction`;
        }
        events.push({ ms: t, type: "Solar conjunction", title, detail: "Lost in the Sun's glare and not observable." });
      }

      // Opposition: an outer planet sits opposite the Sun.
      if (OUTER_PLANETS.includes(P)) {
        const o1 = norm180(e1 + 180), o2 = norm180(e2 + 180);
        if (Math.abs(o1) < 90 && Math.abs(o2) < 90 && (o1 < 0) !== (o2 < 0)) {
          const t = refineRoot((tt) => norm180(elong(geoSnap(tt), P) + 180), tAt(i), tAt(i + 1));
          const s = geoSnap(t);
          events.push({
            ms: t, type: "Opposition", title: `${P} at opposition`,
            detail: `Up all night and near its brightest, ${s[P].dist.toFixed(2)} AU from Earth.`
          });
        }
      }
    }

    if (i === 0) continue;
    const s0 = snaps[i - 1];

    // Planet pairs at closest approach.
    for (let a = 0; a < EVENT_PLANETS.length; a++) {
      for (let b = a + 1; b < EVENT_PLANETS.length; b++) {
        const A = EVENT_PLANETS[a], B = EVENT_PLANETS[b];
        const d0 = angSep(s0[A], s0[B]), d1 = angSep(s1[A], s1[B]), d2 = angSep(s2[A], s2[B]);
        if (d1 <= d0 && d1 < d2 && d1 < maxSep + 1) {
          const best = refineMin((tt) => { const s = geoSnap(tt); return angSep(s[A], s[B]); }, tAt(i));
          if (best.v <= maxSep) {
            const s = geoSnap(best.t);
            const sunGap = Math.min(angSep(s[A], s.Sun), angSep(s[B], s.Sun));
            events.push({
              ms: best.t, type: "Conjunction", title: `${A} and ${B} conjunction`,
              detail: `${best.v.toFixed(2)} deg apart, ` +
                (sunGap < 15 ? "too close to the Sun to observe." : `${sunGap.toFixed(0)} deg from the Sun.`)
            });
          }
        }
      }
    }

    // Greatest elongation: Mercury or Venus at its widest angle from the Sun.
    for (const P of ["Mercury", "Venus"]) {
      const a0 = angSep(s0[P], s0.Sun), a1 = angSep(s1[P], s1.Sun), a2 = angSep(s2[P], s2.Sun);
      if (a1 >= a0 && a1 > a2) {
        const best = refineMin((tt) => { const s = geoSnap(tt); return -angSep(s[P], s.Sun); }, tAt(i));
        const east = elong(geoSnap(best.t), P) > 0;
        events.push({
          ms: best.t, type: "Greatest elongation",
          title: `${P} at greatest ${east ? "eastern" : "western"} elongation`,
          detail: `${(-best.v).toFixed(1)} deg from the Sun, best seen in the ${east ? "evening" : "morning"} sky.`
        });
      }
    }
  }

  return events.sort((x, y) => x.ms - y.ms);
}

// ---- DOM ----
const eventStart = document.getElementById("eventStart");
const eventDays = document.getElementById("eventDays");
const eventSep = document.getElementById("eventSep");
const eventBtn = document.getElementById("eventBtn");
const eventList = document.getElementById("eventList");
const eventSummary = document.getElementById("eventSummary");

eventBtn.addEventListener("click", () => {
  const [y, m, d] = eventStart.value.split("-").map(Number);
  if (!y) return;
  const start = new Date(y, m - 1, d).getTime();
  const days = Math.min(3650, Math.max(1, Number(eventDays.value) || 365));
  const sep = Math.min(10, Math.max(0.1, Number(eventSep.value) || 3));
  eventSummary.textContent = "Searching...";
  eventList.innerHTML = "";

  // Let the status paint before the scan blocks the page.
  setTimeout(() => {
    const events = findEvents(start, days, sep).filter((ev) => ev.ms >= start);
    for (const ev of events) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const when = new Date(ev.ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      const strong = document.createElement("strong");
      strong.textContent = ev.title;
      const meta = document.createElement("span");
      meta.textContent = ` ${when}. ${ev.detail}`;
      btn.append(strong, meta);
      btn.addEventListener("click", () => {
        viewSelect.value = "geo";
        setMs(ev.ms);
      });
      li.appendChild(btn);
      eventList.appendChild(li);
    }
    eventSummary.textContent = events.length
      ? `${events.length} event${events.length === 1 ? "" : "s"} found. Tap one to jump to it.`
      : "No events in this range.";
  }, 20);
});
