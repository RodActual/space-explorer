// 3D heliocentric view. Three.js loads from a CDN the first time the 3D tab opens.
// Uses PLANETS, helioPosition, toJD and currentMs from simulation.js.

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
let T3 = null;
const v3 = {
  ready: false, loading: false,
  scene: null, camera: null, renderer: null,
  meshes: {}, labels: {},
  theta: 0.6, phi: 1.05, dist: 48
};
const view3dWrap = document.getElementById("view3d");

// Square-root distance compression, keeping direction. Ecliptic z maps to Three's y (up).
function to3(x, y, z) {
  const r = Math.hypot(x, y, z);
  const k = r ? (4 * Math.sqrt(r)) / r : 0;
  return new T3.Vector3(x * k, z * k, -y * k);
}

function addLabel3D(name) {
  const el = document.createElement("div");
  el.className = "label3d";
  el.textContent = name;
  view3dWrap.appendChild(el);
  v3.labels[name] = el;
}

async function init3D() {
  if (v3.ready || v3.loading) return;
  v3.loading = true;
  const status = document.createElement("p");
  status.className = "status3d";
  status.textContent = "Loading 3D engine...";
  view3dWrap.appendChild(status);

  try {
    T3 = await import(THREE_URL);
  } catch (e) {
    status.textContent = "Could not load the 3D engine. Check your internet connection.";
    v3.loading = false;
    return;
  }
  status.remove();

  const renderer = new T3.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  view3dWrap.appendChild(renderer.domElement);

  const scene = new T3.Scene();
  const camera = new T3.PerspectiveCamera(45, 1, 0.1, 2000);
  scene.add(new T3.AmbientLight(0xffffff, 0.35));
  scene.add(new T3.PointLight(0xffffff, 2.5, 0, 0));

  const sun = new T3.Mesh(new T3.SphereGeometry(1, 32, 16), new T3.MeshBasicMaterial({ color: 0xffcc33 }));
  scene.add(sun);
  v3.meshes.Sun = sun;
  addLabel3D("Sun");

  const jd0 = toJD(currentMs);
  for (const p of PLANETS) {
    const mesh = new T3.Mesh(
      new T3.SphereGeometry(0.12 * p.size, 24, 12),
      new T3.MeshStandardMaterial({ color: p.color, roughness: 0.8 })
    );
    if (p.name === "Saturn") {
      const ring = new T3.Mesh(
        new T3.RingGeometry(0.12 * p.size * 1.4, 0.12 * p.size * 2.3, 48),
        new T3.MeshBasicMaterial({ color: 0xe6d19a, side: T3.DoubleSide, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = -Math.PI / 2 + 0.47;
      mesh.add(ring);
    }
    scene.add(mesh);
    v3.meshes[p.name] = mesh;
    addLabel3D(p.name);

    // Orbit path: one full period sampled from the same orbital elements.
    const periodDays = 365.25 * Math.pow(p.el[0], 1.5);
    const pts = [];
    for (let k = 0; k <= 240; k++) {
      const pos = helioPosition(p, jd0 + (periodDays * k) / 240);
      pts.push(to3(pos.x, pos.y, pos.z));
    }
    scene.add(new T3.Line(
      new T3.BufferGeometry().setFromPoints(pts),
      new T3.LineBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0.35 })
    ));
  }

  // Drag to orbit, scroll to zoom.
  const el = renderer.domElement;
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    v3.theta -= (e.clientX - drag.x) * 0.01;
    v3.phi = Math.max(0.1, Math.min(Math.PI - 0.1, v3.phi - (e.clientY - drag.y) * 0.01));
    drag = { x: e.clientX, y: e.clientY };
    draw3D();
  });
  const endDrag = () => { drag = null; };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    v3.dist = Math.max(6, Math.min(120, v3.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    draw3D();
  }, { passive: false });

  Object.assign(v3, { scene, camera, renderer, ready: true, loading: false });
  update3D(currentMs);
}

function update3D(ms) {
  if (!v3.ready) return;
  const jd = toJD(ms);
  for (const p of PLANETS) {
    const pos = helioPosition(p, jd);
    v3.meshes[p.name].position.copy(to3(pos.x, pos.y, pos.z));
  }
  draw3D();
}

function draw3D() {
  if (!v3.ready) return;
  const w = view3dWrap.clientWidth;
  if (!w) return;
  v3.renderer.setSize(w, w);
  const { camera, theta, phi, dist } = v3;
  camera.aspect = 1;
  camera.position.set(dist * Math.sin(phi) * Math.cos(theta), dist * Math.cos(phi), dist * Math.sin(phi) * Math.sin(theta));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  v3.renderer.render(v3.scene, camera);

  for (const [name, el] of Object.entries(v3.labels)) {
    const v = v3.meshes[name].position.clone().project(camera);
    if (v.z > 1) { el.style.display = "none"; continue; }
    el.style.display = "";
    el.style.left = `${((v.x + 1) / 2) * w}px`;
    el.style.top = `${((1 - v.y) / 2) * w}px`;
  }
}
