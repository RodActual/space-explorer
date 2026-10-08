// Vercel function: NASA Astronomy Picture of the Day, keeping the API key on the server.
// Set NASA_API_KEY in the Vercel project settings; DEMO_KEY is used until then.
module.exports = async (req, res) => {
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Use ?date=YYYY-MM-DD" });
    return;
  }
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  try {
    const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&date=${date}`);
    const body = await r.text();
    if (r.ok) res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Content-Type", "application/json");
    res.status(r.status).send(body);
  } catch (err) {
    res.status(502).json({ error: "Could not reach NASA." });
  }
};
