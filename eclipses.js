// Solar and lunar eclipses from Meeus, "Astronomical Algorithms", chapter 54.
// Times of greatest eclipse are good to a few minutes. Lunar visibility is computed for
// the observer; solar eclipses link to NASA's visibility maps because local circumstances
// need far more precise Moon positions than this app carries.
// Uses toJD, DEG, DAY, norm360, geoBodies, altAz, getObserver, fmtTime from the other scripts.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Delta T (TT minus UT) in seconds, Espenak and Meeus polynomial fits.
function deltaT(year) {
  const u = (year - 1820) / 100;
  if (year >= 2005 && year < 2050) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (year >= 1986 && year < 2005) {
    const t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (year >= 1961 && year < 1986) { const t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (year >= 2050 && year < 2150) return -20 + 32 * u * u - 0.5628 * (2150 - year);
  return -20 + 32 * u * u;
}

function eclipseAt(k) {
  const lunar = k % 1 !== 0;
  const T = k / 1236.85;
  const sinD = (x) => Math.sin(x * DEG), cosD = (x) => Math.cos(x * DEG);
  const F = norm360(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
  if (Math.abs(sinD(F)) > 0.36) return null;

  const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const M = norm360(2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3);
  const Mp = norm360(201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4);
  const Om = norm360(124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const F1 = F - 0.02665 * sinD(Om);
  const A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;

  const corr = (lunar ? -0.4065 * sinD(Mp) + 0.1727 * E * sinD(M) : -0.4075 * sinD(Mp) + 0.1721 * E * sinD(M))
    + 0.0161 * sinD(2 * Mp) - 0.0097 * sinD(2 * F1) + 0.0073 * E * sinD(Mp - M) - 0.0050 * E * sinD(Mp + M)
    - 0.0023 * sinD(Mp - 2 * F1) + 0.0021 * E * sinD(2 * M) + 0.0012 * sinD(Mp + 2 * F1)
    + 0.0006 * E * sinD(2 * Mp + M) - 0.0004 * sinD(3 * Mp) - 0.0003 * E * sinD(M + 2 * F1)
    + 0.0003 * sinD(A1) - 0.0002 * E * sinD(M - 2 * F1) - 0.0002 * E * sinD(2 * Mp - M) - 0.0002 * sinD(Om);

  const P = 0.2070 * E * sinD(M) + 0.0024 * E * sinD(2 * M) - 0.0392 * sinD(Mp) + 0.0116 * sinD(2 * Mp)
    - 0.0073 * E * sinD(Mp + M) + 0.0067 * E * sinD(Mp - M) + 0.0118 * sinD(2 * F1);
  const Q = 5.2207 - 0.0048 * E * cosD(M) + 0.0020 * E * cosD(2 * M) - 0.3299 * cosD(Mp)
    - 0.0060 * E * cosD(Mp + M) + 0.0041 * E * cosD(Mp - M);
  const W = Math.abs(cosD(F1));
  const gamma = (P * cosD(F1) + Q * sinD(F1)) * (1 - 0.0048 * W);
  const u = 0.0059 + 0.0046 * E * cosD(M) - 0.0182 * cosD(Mp) + 0.0004 * cosD(2 * Mp) - 0.0005 * cosD(M + Mp);
  const g = Math.abs(gamma);

  const jdeMax = jde + corr;
  const year = 2000 + k / 12.3685;
  const ms = (jdeMax - deltaT(year) / 86400 - 2440587.5) * DAY;

  if (!lunar) {
    if (g > 1.5433 + u) return null;
    let type, magnitude = null;
    if (g < 0.9972) {
      if (u < 0) type = "Total";
      else if (u > 0.0047) type = "Annular";
      else type = u < 0.00464 * Math.sqrt(1 - gamma * gamma) ? "Hybrid" : "Annular";
    } else if (g < 0.9972 + Math.abs(u)) {
      type = u < 0 ? "Total" : "Annular";
    } else {
      type = "Partial";
      magnitude = (1.5433 + u - g) / (0.5461 + 2 * u);
    }
    return { kind: "solar", type, ms, gamma, magnitude };
  }

  const penMag = (1.5573 + u - g) / 0.545;
  const umbMag = (1.0128 - u - g) / 0.545;
  if (penMag <= 0) return null;
  const type = umbMag >= 1 ? "Total" : umbMag > 0 ? "Partial" : "Penumbral";
  const n = 0.5458 + 0.04 * cosD(Mp);
  const semi = (r) => (r > g ? (60 / n) * Math.sqrt(r * r - gamma * gamma) : 0);
  return {
    kind: "lunar", type, ms, gamma,
    magnitude: type === "Penumbral" ? penMag : umbMag,
    penumbralMin: semi(1.5573 + u),
    partialMin: semi(1.0128 - u),
    totalMin: semi(0.4678 - u)
  };
}

function findEclipses(startMs, years) {
  const startYear = new Date(startMs).getUTCFullYear() + new Date(startMs).getUTCMonth() / 12;
  const endMs = startMs + years * 365.25 * DAY;
  const out = [];
  for (let k = Math.floor((startYear - 2000) * 12.3685) - 1; ; k += 0.5) {
    const e = eclipseAt(k);
    const approx = Date.UTC(2000, 0, 6) + k * 29.530588861 * DAY;
    if (approx > endMs + 30 * DAY) break;
    if (e && e.ms >= startMs && e.ms <= endMs) out.push(e);
  }
  return out;
}

// How much of a lunar eclipse happens with the Moon above the observer's horizon.
function lunarVisibility(e, lat, lon) {
  const half = (e.penumbralMin || 60) * 60000;
  let up = 0, total = 0, upAtMax = false, maxAlt = -90;
  for (let t = e.ms - half; t <= e.ms + half; t += 5 * 60000) {
    const moon = geoBodies(t).find((b) => b.name === "Moon");
    const a = altAz(moon, toJD(t), lat, lon).alt;
    total++;
    if (a > 0) up++;
    if (Math.abs(t - e.ms) < 2.5 * 60000) { upAtMax = a > 0; maxAlt = a; }
  }
  if (up === total) return { text: "Visible from your location for the whole eclipse.", visible: true };
  if (up === 0) return { text: "Not visible from your location (Moon below the horizon).", visible: false };
  return {
    text: upAtMax
      ? `Partly visible: the Moon is ${maxAlt.toFixed(0)} deg up at greatest eclipse but rises or sets during it.`
      : "Partly visible: the Moon rises or sets during the eclipse, but is down at greatest eclipse.",
    visible: true
  };
}

// NASA map pages exist for 2001 to 2100, named like SE2024Apr08Tgoogle.html.
function nasaSolarLink(e) {
  const d = new Date(e.ms);
  const y = d.getUTCFullYear();
  if (y < 2001 || y > 2100) return null;
  const letter = { Total: "T", Annular: "A", Hybrid: "H", Partial: "P" }[e.type];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `https://eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/SE${y}${MONTHS[d.getUTCMonth()]}${dd}${letter}google.html`;
}

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

// ---- DOM ----
const eclStart = document.getElementById("eclStart");
const eclYears = document.getElementById("eclYears");
const eclKind = document.getElementById("eclKind");
const eclBtn = document.getElementById("eclBtn");
const eclSummary = document.getElementById("eclSummary");
const eclList = document.getElementById("eclList");

eclBtn.addEventListener("click", () => {
  const [y, m, d] = eclStart.value.split("-").map(Number);
  if (!y) return;
  const start = new Date(y, m - 1, d).getTime();
  const years = Math.min(50, Math.max(1, Number(eclYears.value) || 5));
  const { lat, lon } = getObserver();
  eclSummary.textContent = "Searching...";
  eclList.innerHTML = "";

  setTimeout(() => {
    let list = findEclipses(start, years);
    if (eclKind.value !== "all") list = list.filter((e) => e.kind === eclKind.value);
    for (const e of list) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const when = new Date(e.ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      const strong = document.createElement("strong");
      strong.textContent = `${e.type} ${e.kind} eclipse: ${when}`;
      const span = document.createElement("span");
      let detail = "";
      if (e.kind === "lunar") {
        detail = ` Magnitude ${e.magnitude.toFixed(2)}` +
          (e.totalMin ? `, totality ${fmtMin(2 * e.totalMin)}` : e.partialMin ? `, partial phase ${fmtMin(2 * e.partialMin)}` : "") +
          `. ${lunarVisibility(e, lat, lon).text}`;
      } else {
        detail = e.magnitude ? ` Magnitude ${e.magnitude.toFixed(2)}.` : "";
        detail += " Visible only along a limited path or region.";
      }
      span.textContent = detail;
      btn.append(strong, span);
      btn.addEventListener("click", () => {
        if (activeTab !== "sky") setTab("sky");
        setMs(e.ms);
        selectBody(e.kind === "lunar" ? "Moon" : "Sun");
      });
      li.appendChild(btn);

      const link = e.kind === "solar" ? nasaSolarLink(e) : null;
      if (link) {
        const a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener";
        a.className = "ext-link";
        a.textContent = "Where it's visible (NASA map)";
        li.appendChild(a);
      }
      eclList.appendChild(li);
    }
    eclSummary.textContent = list.length
      ? `${list.length} eclipse${list.length === 1 ? "" : "s"} found. Times are greatest eclipse in your time zone.`
      : "No eclipses in this range.";
  }, 20);
});
