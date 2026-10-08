const bodies = [
  {
    name: "Sun",
    color: "#ffcc33",
    diameter: "1,391,000 km",
    distance: "0 km (center of the system)",
    moons: "None",
    desc: "A G-type main-sequence star holding about 99.8% of the solar system's mass."
  },
  {
    name: "Mercury",
    color: "#b5b5b5",
    diameter: "4,879 km",
    distance: "About 58 million km",
    moons: "0",
    desc: "The smallest planet and the closest to the Sun. Its surface swings from extreme heat to deep cold."
  },
  {
    name: "Venus",
    color: "#e8c27a",
    diameter: "12,104 km",
    distance: "About 108 million km",
    moons: "0",
    desc: "Wrapped in thick clouds of carbon dioxide. Its runaway greenhouse effect makes it the hottest planet."
  },
  {
    name: "Earth",
    color: "#4f8cff",
    diameter: "12,742 km",
    distance: "About 150 million km",
    moons: "1",
    desc: "The only known world with liquid water on its surface and life."
  },
  {
    name: "Mars",
    color: "#d9653b",
    diameter: "6,779 km",
    distance: "About 228 million km",
    moons: "2",
    desc: "A cold desert world with the tallest volcano and deepest canyon in the solar system."
  },
  {
    name: "Jupiter",
    color: "#d9b38c",
    diameter: "139,820 km",
    distance: "About 778 million km",
    moons: "More than 90",
    desc: "The largest planet. Its Great Red Spot is a storm wider than Earth."
  },
  {
    name: "Saturn",
    color: "#e6d19a",
    diameter: "116,460 km",
    distance: "About 1.43 billion km",
    moons: "More than 140",
    desc: "Famous for its bright ring system, made mostly of ice particles. It is less dense than water."
  },
  {
    name: "Uranus",
    color: "#86d7e0",
    diameter: "50,724 km",
    distance: "About 2.87 billion km",
    moons: "More than 25",
    desc: "An ice giant that rotates on its side, tilted about 98 degrees."
  },
  {
    name: "Neptune",
    color: "#3a5fd9",
    diameter: "49,244 km",
    distance: "About 4.5 billion km",
    moons: "16 or more",
    desc: "The windiest planet, with gusts over 2,000 km/h. It was first located by mathematical prediction."
  }
];

const nav = document.getElementById("bodies");
const els = {
  name: document.getElementById("name"),
  desc: document.getElementById("desc"),
  diameter: document.getElementById("diameter"),
  distance: document.getElementById("distance"),
  moons: document.getElementById("moons")
};

function show(body, button) {
  els.name.textContent = body.name;
  els.desc.textContent = body.desc;
  els.diameter.textContent = body.diameter;
  els.distance.textContent = body.distance;
  els.moons.textContent = body.moons;

  nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
  button.setAttribute("aria-pressed", "true");
}

bodies.forEach((body, i) => {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", "false");

  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = `radial-gradient(circle at 35% 35%, #ffffff55, ${body.color})`;

  const label = document.createElement("span");
  label.textContent = body.name;

  button.append(dot, label);
  button.addEventListener("click", () => show(body, button));
  nav.appendChild(button);

  if (i === 0) show(body, button);
});

// Starfield: stars drift toward the viewer.
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");
let stars = [];
const STAR_COUNT = 400;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function makeStar() {
  return {
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random()
  };
}

function initStars() {
  stars = Array.from({ length: STAR_COUNT }, makeStar);
}

function draw() {
  ctx.fillStyle = "rgba(3, 4, 12, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const scale = Math.max(canvas.width, canvas.height);

  for (const s of stars) {
    s.z -= 0.003;
    if (s.z <= 0) Object.assign(s, makeStar(), { z: 1 });

    const px = cx + (s.x / s.z) * scale * 0.25;
    const py = cy + (s.y / s.z) * scale * 0.25;
    const size = Math.max(0.3, (1 - s.z) * 2.2);
    const alpha = 1 - s.z;

    ctx.fillStyle = `rgba(232, 236, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

window.addEventListener("resize", () => {
  resize();
  ctx.fillStyle = "#03040c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});

resize();
initStars();
ctx.fillStyle = "#03040c";
ctx.fillRect(0, 0, canvas.width, canvas.height);
draw();
