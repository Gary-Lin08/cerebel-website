let GEMX_ORIGIN =
  window.__CEREBEL_GEMX_ORIGIN__ ||
  "https://0i5-79nucyondu7h6sp1a-cdhea2bz-custom.service.onethingrobot.com";

const home = document.getElementById("home");
const working = document.getElementById("working");
const result = document.getElementById("result");
const fileInput = document.getElementById("fileInput");
const homeStatus = document.getElementById("homeStatus");
const workStatus = document.getElementById("workStatus");
const progressBar = document.getElementById("progressBar");
const meshStage = document.getElementById("meshStage");
const rgbVideo = document.getElementById("rgbVideo");
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

let jobId = null;
let meshViewer = null;
let chatHistory = [];

function show(el) {
  [home, working, result].forEach((n) => {
    if (n) n.hidden = n !== el;
  });
}

function setStatus(el, text, kind) {
  if (!el) return;
  el.hidden = !text;
  el.textContent = text || "";
  el.classList.toggle("is-err", kind === "err");
  el.classList.toggle("is-ok", kind === "ok");
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = "bubble " + role;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function ensureThree() {
  const THREE = await import("/playground/vendor/three/three.module.js");
  const { OrbitControls } = await import("/playground/vendor/three/OrbitControls.js");
  return { THREE, OrbitControls };
}

function disposeMesh() {
  if (!meshViewer) return;
  try { cancelAnimationFrame(meshViewer.raf); } catch (_) {}
  try { meshViewer._removeResize && meshViewer._removeResize(); } catch (_) {}
  try { meshViewer.controls && meshViewer.controls.dispose(); } catch (_) {}
  try { meshViewer.geometry && meshViewer.geometry.dispose(); } catch (_) {}
  try { meshViewer.material && meshViewer.material.dispose(); } catch (_) {}
  try { meshViewer.renderer && meshViewer.renderer.dispose(); } catch (_) {}
  if (meshViewer.renderer?.domElement?.parentNode) {
    meshViewer.renderer.domElement.parentNode.removeChild(meshViewer.renderer.domElement);
  }
  meshViewer = null;
}

async function playSomaMesh(url) {
  const { THREE, OrbitControls } = await ensureThree();
  disposeMesh();
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
  if (!res.ok) throw new Error("Mesh unavailable (" + res.status + ")");
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "SOMA" && magic !== "SOMA1") throw new Error("bad SOMA mesh magic");
  const version = view.getUint32(4, true);
  const faceCount = view.getUint32(8, true);
  const vertexCount = view.getUint32(12, true);
  const frameCount = view.getUint32(16, true);
  const fps = view.getFloat32(20, true) || 30;
  const facesOffset = 28;
  const faces = new Uint32Array(buf, facesOffset, faceCount * 3);
  const vertsOffset = facesOffset + faceCount * 3 * 4;
  const floatCount = frameCount * vertexCount * 3;
  let verts;
  if (version === 2) {
    verts = new Float32Array(floatCount);
    for (let i = 0; i < floatCount; i++) {
      const u16 = view.getUint16(vertsOffset + i * 2, true);
      const sign = (u16 & 0x8000) >> 15;
      const exp = (u16 & 0x7c00) >> 10;
      const frac = u16 & 0x03ff;
      let f;
      if (exp === 0) f = (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
      else if (exp === 0x1f) f = frac ? NaN : (sign ? -1 : 1) * Infinity;
      else f = (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
      verts[i] = f;
    }
  } else {
    verts = new Float32Array(buf.slice(vertsOffset, vertsOffset + floatCount * 4));
  }

  // Plant body: strip per-frame root XZ + shared floor Y.
  {
    const frameFloorYs = new Float32Array(frameCount);
    for (let t = 0; t < frameCount; t++) {
      const base = t * vertexCount * 3;
      let sx = 0, sz = 0, yMin = Infinity;
      for (let v = 0; v < vertexCount; v++) {
        const o = base + v * 3;
        sx += verts[o];
        sz += verts[o + 2];
        if (verts[o + 1] < yMin) yMin = verts[o + 1];
      }
      const cx = sx / vertexCount;
      const cz = sz / vertexCount;
      for (let v = 0; v < vertexCount; v++) {
        const o = base + v * 3;
        verts[o] -= cx;
        verts[o + 2] -= cz;
      }
      frameFloorYs[t] = yMin;
    }
    const sorted = Array.from(frameFloorYs).sort((a, b) => a - b);
    const yFloor = sorted[Math.max(0, Math.floor(sorted.length * 0.05))] || 0;
    for (let i = 1; i < floatCount; i += 3) verts[i] -= yFloor;
  }

  const host = meshStage;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth || 640, host.clientHeight || 320, false);
  renderer.setClearColor(0x0b0d0b, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);
  camera.position.set(0, 1.0, 3.0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.8;
  controls.maxDistance = 8;
  controls.update();
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2.5, 4, 2);
  scene.add(key);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertexCount * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(Array.from(faces));
  const material = new THREE.MeshStandardMaterial({
    color: 0x5aa8d4,
    roughness: 0.45,
    metalness: 0.08,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  scene.add(new THREE.Mesh(geometry, material));

  let playTime = 0;
  let last = performance.now();
  const scratch = new Float32Array(vertexCount * 3);
  const applyFrame = (f) => {
    const maxF = Math.max(frameCount - 1, 0);
    const i0 = Math.min(maxF, Math.max(0, Math.floor(f)));
    const i1 = Math.min(maxF, i0 + 1);
    const t = f - i0;
    const stride = vertexCount * 3;
    const aBase = i0 * stride;
    const bBase = i1 * stride;
    if (t <= 0.001 || i0 === i1) scratch.set(verts.subarray(aBase, aBase + stride));
    else if (t >= 0.999) scratch.set(verts.subarray(bBase, bBase + stride));
    else {
      for (let i = 0; i < stride; i++) {
        const a = verts[aBase + i];
        scratch[i] = a + (verts[bBase + i] - a) * t;
      }
    }
    const attr = geometry.getAttribute("position");
    attr.array.set(scratch);
    attr.needsUpdate = true;
  };
  applyFrame(0);

  const onResize = () => {
    const w = host.clientWidth || 640;
    const h = host.clientHeight || 320;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener("resize", onResize);
  onResize();
  requestAnimationFrame(() => { onResize(); requestAnimationFrame(onResize); });

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const maxF = Math.max(frameCount - 1, 0);
    playTime += dt * Math.max(fps, 1);
    if (playTime > maxF) playTime -= maxF + 1;
    applyFrame(playTime);
    controls.update();
    renderer.render(scene, camera);
    meshViewer.raf = requestAnimationFrame(tick);
  };
  meshViewer = {
    raf: requestAnimationFrame(tick),
    renderer,
    controls,
    geometry,
    material,
    _removeResize: () => window.removeEventListener("resize", onResize),
  };
}

async function pollJob(id) {
  for (;;) {
    const res = await fetch(GEMX_ORIGIN + "/v1/jobs/" + encodeURIComponent(id) + "?t=" + Date.now());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Job poll failed");
    const pct = Number(data.percent) || 0;
    progressBar.style.width = Math.max(4, Math.min(100, pct)) + "%";
    workStatus.textContent = data.message || data.status || "Working…";
    if (data.status === "ready") return data;
    if (data.status === "error") throw new Error(data.error || data.message || "GEM-X failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function onFile(file) {
  if (!file) return;
  setStatus(homeStatus, "Uploading " + file.name + "…");
  show(working);
  progressBar.style.width = "4%";
  workStatus.textContent = "Uploading to GEM-X…";

  const body = new FormData();
  body.append("file", file, file.name);
  body.append("fps", "30");

  const res = await fetch(GEMX_ORIGIN + "/v1/reconstruct", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed (" + res.status + ")");
  jobId = data.job_id;
  const ready = await pollJob(jobId);

  show(result);
  const meshUrl = GEMX_ORIGIN + (ready.mesh_url || `/v1/jobs/${jobId}/mesh.bin`);
  const videoUrl = GEMX_ORIGIN + (ready.video_url || `/v1/jobs/${jobId}/video`);
  rgbVideo.src = videoUrl;
  rgbVideo.muted = true;
  rgbVideo.playsInline = true;
  rgbVideo.load();
  rgbVideo.play().catch(() => {});
  await playSomaMesh(meshUrl);
  chatHistory = [];
  chatLog.innerHTML = "";
  addBubble("assistant", "Mesh is ready. Ask what to fix — I’ll use the RGB frames from your clip.");
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  onFile(file).catch((err) => {
    console.error(err);
    show(home);
    setStatus(homeStatus, err.message || String(err), "err");
  });
});

async function askCoach(question) {
  const q = String(question || "").trim();
  if (!q || !jobId) return;
  addBubble("user", q);
  chatHistory.push({ role: "user", content: q });
  chatInput.value = "";
  const thinking = document.createElement("div");
  thinking.className = "bubble assistant";
  thinking.textContent = "Looking at your swing…";
  chatLog.appendChild(thinking);

  const res = await fetch("/api/playground/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      message: q,
      history: chatHistory.slice(-8),
      gemx_origin: GEMX_ORIGIN,
    }),
  });
  const data = await res.json().catch(() => ({}));
  thinking.remove();
  if (!res.ok) {
    addBubble("assistant", data.error || "Coach unavailable (" + res.status + ")");
    return;
  }
  const answer = data.reply || data.message || "(no reply)";
  addBubble("assistant", answer);
  chatHistory.push({ role: "assistant", content: answer });
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  askCoach(chatInput.value).catch((err) => {
    addBubble("assistant", err.message || String(err));
  });
});

document.getElementById("chips").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-q]");
  if (!btn) return;
  askCoach(btn.dataset.q).catch((err) => addBubble("assistant", err.message || String(err)));
});

// Boot health (Vercel + GEM-X)
fetch("/api/playground/health")
  .then((r) => r.json())
  .then((d) => {
    if (d && d.gemx_origin) {
      GEMX_ORIGIN = d.gemx_origin;
      window.__CEREBEL_GEMX_ORIGIN__ = d.gemx_origin;
    }
  })
  .catch(() => {});
