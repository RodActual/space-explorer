// Vercel function: fetches satellite orbit data (TLEs) from CelesTrak and caches it at the edge.
// CelesTrak asks clients not to download the same data more than once every two hours.
const FEATURED = [25544, 48274, 20580];
const SOURCES = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=TLE",
  ...FEATURED.map((id) => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=TLE`)
];

function parse(text) {
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

module.exports = async (req, res) => {
  try {
    const texts = await Promise.all(SOURCES.map((u) =>
      fetch(u, { headers: { "User-Agent": "space-explorer (Vercel function)" } })
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "")
    ));
    const byId = new Map();
    for (const t of parse(texts.join("\n"))) byId.set(Number(t.l1.slice(2, 7)), t);
    if (!byId.size) {
      res.status(502).json({ error: "CelesTrak did not return any data." });
      return;
    }
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json([...byId.values()]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load orbit data." });
  }
};
