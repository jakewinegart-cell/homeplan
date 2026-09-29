/**
 * HomePlan 3D — Three.js conceptual massing from plan + §5 3D store
 * Sketch walls/rooms win over parametric footprint when both exist.
 *
 * Realism P0 (Better tier): Guidance-bound cladding/roofing/foundation materials,
 * late-morning lighting, eave/window/foundation geometry cues. Stud toggle stays
 * educational overlay — finished look when Studs OFF.
 * Interior P0: warm ceiling/room fills, painted finish + baseboard/ceiling/floor
 * when Studs OFF, fixture face polish (cabinets/sink/outlets).
 * Floor framing ON: omit opaque finish deck so I-beams read from above (and below).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WALL_THICK = 0.45; // ~5.4 in visual shell
const POST_OVERLAP = 0.025; // slight bite into post so no hairline gap
/** Nominal 2×4 face width along wall (~1.5–1.8"). */
const STUD_W = 0.15;
/** Plate / stud depth matches wall thickness so flush corners stay clean. */
const STUD_D = WALL_THICK;
const PLATE_H = 0.125;
const STUD_OC = 16 / 12; // 16" on center
const DEFAULT_WIN_W = 3;
const DEFAULT_WIN_H = 4;
const DEFAULT_WIN_SILL = 2.5;
const WIN_RECESS = 2.5 / 12; // 2–3 in glass setback
const SILL_PROJ = 1.25 / 12; // projecting exterior sill
const ROOF_THICK = 5 / 12; // ~4–6 in sheathing+shingle visual
const FOUND_REVEAL_SLAB = 0.75; // 9 in reveal
const PIER_H_DEFAULT = 2.5; // ~2–3 ft elevated reveal
const PIER_R = 0.5; // 12 in sonotube radius (dia 12 in → r=0.5 ft)
const BASEBOARD_H = 4 / 12; // ~4 in interior trim
const BASEBOARD_T = 0.09; // ~1.1 in thick — readable trim
const PAINT_LINER_T = 0.035; // thin interior paint face
const CEILING_T = 0.08;
const MAX_INTERIOR_LIGHTS = 3;
/** Conceptual floor joists / I-beams — EXAMPLE spacing only (not engineering). */
const FLOOR_JOIST_OC = 20 / 12; // ~20 in o.c. (EXAMPLE within 16–24 in)
const FLOOR_IBEAM_H = 10 / 12; // ~10 in deep visual member
const FLOOR_IBEAM_FLANGE_W = 5 / 12;
const FLOOR_IBEAM_FLANGE_T = 0.06;
const FLOOR_IBEAM_WEB_T = 0.04;

/** §2.1 cladding presets — albedo/roughness/metalness from Guidance answers only */
const CLAD_PRESETS = {
  wood:     { id: 'tex_clad_wood_clapboard', hex: '#C4A574', roughness: 0.75, metalness: 0.0, courseM: 0.15, pattern: 'clapboard' },
  fiber:    { id: 'tex_clad_fiber_cement',   hex: '#D8D2C8', roughness: 0.70, metalness: 0.0, courseM: 0.18, pattern: 'clapboard' },
  vinyl:    { id: 'tex_clad_vinyl',          hex: '#E8E4DC', roughness: 0.55, metalness: 0.02, courseM: 0.20, pattern: 'clapboard' },
  eng_wood: { id: 'tex_clad_eng_wood',       hex: '#B8956A', roughness: 0.72, metalness: 0.0, courseM: 0.16, pattern: 'clapboard' },
  brick:    { id: 'tex_clad_brick',          hex: '#8B4A3A', roughness: 0.85, metalness: 0.0, courseM: 0.07, pattern: 'brick' },
  stucco:   { id: 'tex_clad_stucco',         hex: '#E5DFD3', roughness: 0.90, metalness: 0.0, courseM: 1.5,  pattern: 'noise' },
  stone:    { id: 'tex_clad_stone',          hex: '#9A9590', roughness: 0.88, metalness: 0.0, courseM: 0.45, pattern: 'stone' },
  mixed:    { id: 'tex_clad_neutral',        hex: '#C8C4BC', roughness: 0.75, metalness: 0.0, courseM: 2.0,  pattern: 'noise' },
  other:    { id: 'tex_clad_neutral',        hex: '#C8C4BC', roughness: 0.75, metalness: 0.0, courseM: 2.0,  pattern: 'noise' },
};

/** §2.2 roofing presets */
const ROOF_PRESETS = {
  asphalt:  { id: 'tex_roof_asphalt',    hex: '#4A4A4A', roughness: 0.80, metalness: 0.0, pattern: 'shingle' },
  metal:    { id: 'tex_roof_metal_rib',  hex: '#6E7A84', roughness: 0.35, metalness: 0.65, pattern: 'rib' },
  tile:     { id: 'tex_roof_tile',       hex: '#A65D3F', roughness: 0.70, metalness: 0.0, pattern: 'tile' },
  slate:    { id: 'tex_roof_slate',      hex: '#3D4450', roughness: 0.75, metalness: 0.0, pattern: 'slate' },
  match:    { id: 'tex_roof_asphalt',    hex: '#4A4A4A', roughness: 0.80, metalness: 0.0, pattern: 'shingle' },
  unsure:   { id: 'tex_roof_asphalt',    hex: '#4A4A4A', roughness: 0.80, metalness: 0.0, pattern: 'shingle' },
  membrane: { id: 'tex_roof_membrane',   hex: '#2F3236', roughness: 0.65, metalness: 0.0, pattern: 'membrane' },
};

/** §2.3 foundation presets */
const FOUND_PRESETS = {
  slab:     { hex: '#A8A29A', roughness: 0.90, metalness: 0.0 },
  crawl:    { hex: '#9E9890', roughness: 0.92, metalness: 0.0 },
  basement: { hex: '#8F8A82', roughness: 0.92, metalness: 0.0 },
  piers:    { hex: '#A8A29A', roughness: 0.90, metalness: 0.0 },
};

function fmtFt(n) {
  if (!isFinite(n)) return '—';
  const v = Math.round(n * 10) / 10;
  return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + ' ft';
}

function normalizeWin(win, store) {
  const openingType = win.openingType || (win.autoShared ? 'door' : null);
  const isDoor = openingType === 'door' || openingType === 'large';
  const defW = isDoor
    ? (32 / 12)
    : ((store && store.opening_preset_win_w_in) ? store.opening_preset_win_w_in / 12 : DEFAULT_WIN_W);
  const defH = isDoor
    ? (80 / 12)
    : ((store && store.opening_preset_win_h_in) ? store.opening_preset_win_h_in / 12 : DEFAULT_WIN_H);
  const out = {
    id: win.id,
    wallId: win.wallId,
    t: win.t != null ? Number(win.t) : 0.5,
    widthFt: win.widthFt > 0 ? Number(win.widthFt) : defW,
    heightFt: win.heightFt > 0 ? Number(win.heightFt) : defH,
    sillFt: win.sillFt != null && win.sillFt >= 0
      ? Number(win.sillFt)
      : (isDoor ? 0 : DEFAULT_WIN_SILL),
  };
  if (openingType) out.openingType = openingType;
  if (win.doorType) out.doorType = win.doorType;
  if (win.autoShared) out.autoShared = true;
  if (win.sharedKey) out.sharedKey = win.sharedKey;
  return out;
}

function createView3D(container) {
  const emptyEl = container.querySelector('#view3d-empty');
  const canvasHost = container.querySelector('#view3d-canvas-host');
  const defaultsChip = container.querySelector('#view3d-defaults-chip');
  const inspectorEl = container.querySelector('#view3d-win-inspector');
  const dimsToggle = container.querySelector('#view3d-dims-toggle');
  const studsToggle = container.querySelector('#view3d-studs-toggle');
  const floorFramingToggle = container.querySelector('#view3d-floorframing-toggle');
  const shadowsToggle = container.querySelector('#view3d-shadows-toggle');

  let renderer, scene, camera, controls, animId, rootGroup, labelGroup;
  let raycaster, pointer, plane;
  let showDims = true;
  let showStuds = true; // educational overlay — finished look when OFF
  let showFloorFraming = true; // I-beams / joists under floor (educational) — default ON so beams read first
  let floorFramingManual = false; // user touched toggle — stop auto foundation default
  let shadowsWanted = true; // user preference; auto-killed on narrow/low
  let sunLight = null;
  let hemiLight = null;
  let fillLight = null;
  let interiorFill = null; // primary warm fill (kept for compat)
  let interiorLights = []; // extra room-center point lights (no shadows)
  let ambientWarm = null; // gentle indoor lift (no shadows)
  let hooks = {};
  let lastPlan = null;
  let lastStore = null;
  let planOrigin = { ox: 0, oz: 0 };
  let selectedWinId = null; // edit-mode selection (null = orbit-only)
  let dragState = null; // { mode:'move'|'resizeW'|'resizeH', winId, wall, startT, ... }
  let lastTapDown = null; // { winId, t, x, y, pointerId, wasDrag } for double-tap
  let pendingEmptyExit = null; // { x, y, pointerId } — click empty exits edit
  let suppressOrbit = false; // true after double-tap / long-press until pointerup
  let longPress = null; // { pointerId, x, y, timer, hit }
  let longPressShown = false; // tag shown this gesture — block orbit/edit
  let partTagEl = null;
  let partTagHideTimer = null;
  const DBL_TAP_MS = 330;
  const TAP_MOVE_PX = 14;
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_MOVE_PX = 10;
  const PART_TAG_TIMEOUT_MS = 2800;
  let windowMeshes = new Map(); // id -> { group, glass, frame, handles }
  let roFramingGroups = new Map(); // winId -> THREE.Group (parented to wall/root framing, NOT window)
  let framingRoot = null; // wall stud system group under rootGroup
  let interactiveObjects = []; // pickable meshes
  let preserveCamera = false;

  function ensure() {
    if (renderer) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8e2ec); // cool late-morning sky feel
    scene.fog = new THREE.Fog(0xd8e2ec, 120, 280);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
    camera.position.set(32, 24, 32);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    canvasHost.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 4;
    controls.maxDistance = 140;
    controls.target.set(0, 4, 0);

    // §3 late-morning: cool sky / warm ground ambient + warm sun (1 shadow caster)
    // + stronger warm interior fills (placed per-room in buildFromPlan; no shadows)
    hemiLight = new THREE.HemisphereLight(0xc8d6e8, 0x7a7268, 0.48);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff1d6, 0.92);
    // Azimuth ~135° from front, elevation ~50°
    sunLight.position.set(38, 48, 28);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.00025;
    sunLight.shadow.normalBias = 0.03;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    scene.add(sunLight);
    fillLight = new THREE.DirectionalLight(0xb8c8d8, 0.1); // weak opposite rim
    fillLight.position.set(-30, 18, -22);
    scene.add(fillLight);
    interiorFill = new THREE.PointLight(0xfff4e8, 2.4, 48, 1.5);
    interiorFill.position.set(0, 6.5, 0);
    interiorFill.castShadow = false;
    scene.add(interiorFill);
    interiorLights = [];
    for (let i = 0; i < MAX_INTERIOR_LIGHTS - 1; i++) {
      const pl = new THREE.PointLight(0xfff0dc, 0.0, 32, 1.5);
      pl.castShadow = false;
      pl.visible = false;
      scene.add(pl);
      interiorLights.push(pl);
    }
    ambientWarm = new THREE.AmbientLight(0xfff0e4, 0.18);
    scene.add(ambientWarm);
    renderer.toneMappingExposure = 1.0; // avoid blown whites with stronger interior fills

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    plane = new THREE.Plane();

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    // Document-level so OrbitControls capture/retarget still updates tap/drag state
    document.addEventListener('pointermove', onPointerMoveDoc);
    document.addEventListener('pointerup', onPointerUpDoc);
    document.addEventListener('pointercancel', onPointerUpDoc);
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('contextmenu', onContextMenu);

    // Floating part-name chip (long-press / right-click / Alt-click)
    if (!partTagEl && canvasHost) {
      partTagEl = document.createElement('div');
      partTagEl.className = 'v3d-part-tag';
      partTagEl.hidden = true;
      partTagEl.setAttribute('role', 'status');
      partTagEl.setAttribute('aria-live', 'polite');
      canvasHost.appendChild(partTagEl);
    }

    document.addEventListener('keydown', onKeyDown);

    const editDone = container.querySelector('#view3d-edit-done');
    if (editDone) editDone.addEventListener('click', () => selectWindow(null));

    if (dimsToggle) {
      dimsToggle.checked = true;
      dimsToggle.addEventListener('change', () => {
        showDims = !!dimsToggle.checked;
        if (labelGroup) labelGroup.visible = showDims;
      });
    }

    if (studsToggle) {
      studsToggle.checked = showStuds;
      studsToggle.addEventListener('change', () => {
        showStuds = !!studsToggle.checked;
        if (lastPlan) {
          preserveCamera = true;
          buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
        }
      });
    }

    if (floorFramingToggle) {
      floorFramingToggle.checked = showFloorFraming;
      floorFramingToggle.addEventListener('change', () => {
        floorFramingManual = true;
        showFloorFraming = !!floorFramingToggle.checked;
        if (lastPlan) {
          preserveCamera = true;
          buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
        }
      });
    }

    if (shadowsToggle) {
      shadowsToggle.checked = shadowsWanted;
      shadowsToggle.addEventListener('change', () => {
        shadowsWanted = !!shadowsToggle.checked;
        applyShadowMode();
      });
    }

    wireInspector();

    window.addEventListener('resize', onResize);
    applyShadowMode();
    (function loop() {
      animId = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    })();
  }

  function shadowsAutoOff() {
    const w = (canvasHost && canvasHost.clientWidth) || window.innerWidth || 1200;
    const lowDpr = (window.devicePixelRatio || 1) < 1.1 && w < 900;
    return w < 700 || lowDpr;
  }

  function applyShadowMode() {
    if (!renderer) return;
    const on = !!shadowsWanted && !shadowsAutoOff();
    renderer.shadowMap.enabled = on;
    if (sunLight) sunLight.castShadow = on;
    // Force material/shadow refresh
    renderer.shadowMap.needsUpdate = true;
    // Narrow screens: re-cap / dim interior fills (no new lights)
    if (lastPlan && interiorFill) {
      // Intensities reapplied on next build; soft-dim extras immediately
      const budget = interiorLightBudget();
      for (let i = budget.max - 1; i < interiorLights.length; i++) {
        if (interiorLights[i]) {
          interiorLights[i].visible = false;
          interiorLights[i].intensity = 0;
        }
      }
      if (budget.max <= 1 && interiorLights[0]) {
        interiorLights[0].visible = false;
        interiorLights[0].intensity = 0;
      }
      if (interiorFill && budget.intensityScale < 1) {
        interiorFill.intensity = Math.min(interiorFill.intensity, 0.55 * budget.intensityScale + (showStuds ? 0 : 0.15));
      }
    }
  }

  function onResize() {
    if (!renderer) return;
    const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
    if (w < 2 || h < 2) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    applyShadowMode();
  }

  function clearRoot() {
    windowMeshes.clear();
    roFramingGroups.clear();
    framingRoot = null;
    interactiveObjects = [];
    if (rootGroup) {
      scene.remove(rootGroup);
      rootGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        }
      });
      rootGroup = null;
    }
    labelGroup = null;
    [...scene.children].forEach((c) => {
      if (!c.isLight && c !== rootGroup) {
        if (c.isMesh || c.type === 'GridHelper' || c.type === 'Group') {
          scene.remove(c);
        }
      }
    });
  }

  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color, roughness: 0.85, metalness: 0.04,
    }, opts || {}));
  }

  /** Procedural canvas albedo for named material presets (no external image assets). */
  function makePatternTexture(pattern, baseHex, coursePx) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const base = baseHex || '#C8C4BC';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const course = Math.max(4, Math.round(coursePx || 24));

    if (pattern === 'clapboard') {
      for (let y = 0; y < size; y += course) {
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(0, y + course - 2, size, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, y, size, 1);
      }
    } else if (pattern === 'brick') {
      ctx.fillStyle = '#D8D2C8'; // mortar field
      ctx.fillRect(0, 0, size, size);
      const bh = Math.max(10, Math.round(course));
      const bw = Math.round(bh * 2.6);
      for (let row = 0, y = 0; y < size; y += bh, row++) {
        const off = (row % 2) ? bw / 2 : 0;
        for (let x = -bw; x < size + bw; x += bw) {
          const shade = 1 - ((x + y * 3) % 5) * 0.04;
          ctx.fillStyle = base;
          ctx.globalAlpha = shade;
          ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(40,30,25,0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
        }
      }
    } else if (pattern === 'stone') {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 28; i++) {
        const x = (i * 73) % size, y = (i * 47) % size;
        const w = 28 + (i % 5) * 10, h = 18 + (i % 4) * 8;
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      }
    } else if (pattern === 'noise') {
      const img = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() * 28) - 14;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
      }
      ctx.putImageData(img, 0, 0);
    } else if (pattern === 'shingle') {
      const th = 18, tw = 42;
      for (let row = 0, y = 0; y < size; y += th, row++) {
        const off = (row % 2) ? tw / 2 : 0;
        for (let x = -tw; x < size + tw; x += tw) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x + off, y + th - 2, tw - 1, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(x + off + 2, y + 2, tw - 6, th - 6);
        }
      }
    } else if (pattern === 'rib') {
      for (let x = 0; x < size; x += 18) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, 0, 3, size);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 3, 0, 2, size);
      }
    } else if (pattern === 'tile') {
      for (let y = 0; y < size; y += 28) {
        for (let x = 0; x < size; x += 28) {
          ctx.beginPath();
          ctx.ellipse(x + 14, y + 18, 12, 14, 0, Math.PI, 0);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.stroke();
        }
      }
    } else if (pattern === 'slate') {
      const th = 20, tw = 36;
      for (let row = 0, y = 0; y < size; y += th, row++) {
        const off = (row % 2) ? tw / 2 : 0;
        for (let x = -tw; x < size + tw; x += tw) {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.strokeRect(x + off + 1, y + 1, tw - 2, th - 2);
        }
      }
    } else if (pattern === 'membrane') {
      // large soft mottling only
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + (i % 3) * 0.01) + ')';
        ctx.beginPath();
        ctx.arc((i * 61) % size, (i * 37) % size, 40 + i * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  function cladMaterial(key) {
    const p = CLAD_PRESETS[key] || CLAD_PRESETS.mixed;
    const coursePx = p.pattern === 'noise' ? 64 : Math.max(8, Math.round(256 * (p.courseM / 1.2)));
    const map = makePatternTexture(p.pattern, p.hex, coursePx);
    // UV: course height in meters ≈ courseM; texture is 1 course tall-ish → repeat by world size later via mesh if needed
    // World UVs applyWallUVs → keep map.repeat near 1 so courses ~courseM
    const ru = p.pattern === 'noise' ? 0.25 : (p.pattern === 'brick' ? 0.9 : 0.7);
    map.repeat.set(ru, ru);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.hex),
      map,
      roughness: p.roughness,
      metalness: p.metalness,
    });
  }

  function roofMaterial(key, opts) {
    const lowSlope = opts && opts.lowSlope;
    const p = lowSlope ? ROOF_PRESETS.membrane : (ROOF_PRESETS[key] || ROOF_PRESETS.asphalt);
    const map = makePatternTexture(p.pattern, p.hex, p.pattern === 'membrane' ? 80 : 24);
    map.repeat.set(p.pattern === 'membrane' ? 1.2 : (p.pattern === 'rib' ? 8 : 5), p.pattern === 'membrane' ? 1.2 : 4);
    // Cap metalness without env map so metal roofs stay readable on phone
    const metal = p.metalness > 0.3 ? Math.min(p.metalness, 0.4) : p.metalness;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.hex),
      map,
      roughness: Math.max(p.roughness, metal > 0.2 ? 0.4 : p.roughness),
      metalness: metal,
      side: THREE.DoubleSide,
    });
  }

  /** World-ish UVs so procedural cladding reads on ExtrudeGeometry / boxes. */
  function applyWallUVs(mesh, vScale) {
    if (!mesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    let uv = geo.attributes.uv;
    if (!uv || uv.count !== pos.count) {
      uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
      geo.setAttribute('uv', uv);
    }
    const vs = vScale || 0.55;
    const tmp = new THREE.Vector3();
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      mesh.localToWorld(tmp);
      // U along plan, V up — course stacking
      uv.setXY(i, tmp.x * 0.4 + tmp.z * 0.4, tmp.y * vs);
    }
    uv.needsUpdate = true;
  }

  /** Planar XZ UVs for floors / ceilings (wood / tile maps). */
  function applyPlanarXZUVs(mesh, scale) {
    if (!mesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    let uv = geo.attributes.uv;
    if (!uv || uv.count !== pos.count) {
      uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
      geo.setAttribute('uv', uv);
    }
    const s = scale || 0.35;
    const tmp = new THREE.Vector3();
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      mesh.localToWorld(tmp);
      uv.setXY(i, tmp.x * s, tmp.z * s);
    }
    uv.needsUpdate = true;
  }

  function foundMaterial(key) {
    const p = FOUND_PRESETS[key] || FOUND_PRESETS.slab;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.hex),
      roughness: p.roughness,
      metalness: p.metalness,
    });
  }

  function glassMaterial() {
    // §2.4 dielectric glazing
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#A8C8E8'),
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  function frameMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F2F0EA'),
      roughness: 0.55,
      metalness: 0.05,
    });
  }

  /** Warm painted drywall for finished interiors (Studs OFF). */
  function paintMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F3EEE4'),
      roughness: 0.92,
      metalness: 0.0,
    });
  }

  function ceilingMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F2EDE3'),
      roughness: 0.94,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }

  function baseboardMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F0EAE0'),
      roughness: 0.72,
      metalness: 0.02,
    });
  }

  /** Soft contact shadow strip at wall/floor junction (AO feel, no real AO pass). */
  function junctionMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#C9B8A0'),
      roughness: 0.95,
      metalness: 0.0,
    });
  }

  /** Procedural wood-plank floor albedo (no external assets). */
  function makeFloorTexture(kind) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (kind === 'tile') {
      ctx.fillStyle = '#D8D2C8';
      ctx.fillRect(0, 0, size, size);
      const tw = 64, th = 64;
      for (let y = 0; y < size; y += th) {
        for (let x = 0; x < size; x += tw) {
          const shade = 0.92 + ((x + y) % 7) * 0.01;
          ctx.fillStyle = 'rgb(' + Math.round(210 * shade) + ',' + Math.round(200 * shade) + ',' + Math.round(188 * shade) + ')';
          ctx.fillRect(x + 2, y + 2, tw - 4, th - 4);
          ctx.strokeStyle = 'rgba(120,110,100,0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
        }
      }
    } else {
      // wood planks along U
      ctx.fillStyle = '#C4A574';
      ctx.fillRect(0, 0, size, size);
      const ph = 36;
      for (let row = 0, y = 0; y < size; y += ph, row++) {
        const base = row % 3 === 0 ? '#C8A878' : (row % 3 === 1 ? '#B8956A' : '#D0B080');
        ctx.fillStyle = base;
        ctx.fillRect(0, y, size, ph - 1);
        // grain
        for (let g = 0; g < 5; g++) {
          ctx.strokeStyle = 'rgba(80,50,20,' + (0.04 + (g % 3) * 0.02) + ')';
          ctx.beginPath();
          const gy = y + 6 + g * 6;
          ctx.moveTo(0, gy);
          for (let x = 0; x < size; x += 16) {
            ctx.lineTo(x + 8, gy + ((x + row) % 5) - 2);
            ctx.lineTo(x + 16, gy);
          }
          ctx.stroke();
        }
        // plank seam
        ctx.fillStyle = 'rgba(60,40,20,0.22)';
        ctx.fillRect(0, y + ph - 2, size, 2);
        // staggered end joints
        const joint = ((row * 97) % (size - 40)) + 20;
        ctx.fillStyle = 'rgba(60,40,20,0.18)';
        ctx.fillRect(joint, y, 2, ph - 2);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.repeat.set(kind === 'tile' ? 4 : 3.5, kind === 'tile' ? 4 : 3.5);
    tex.needsUpdate = true;
    return tex;
  }

  function floorMaterial(kind) {
    const map = makeFloorTexture(kind || 'wood');
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(kind === 'tile' ? '#D0CAC0' : '#C4A574'),
      map,
      roughness: kind === 'tile' ? 0.7 : 0.78,
      metalness: 0.0,
    });
  }

  /**
   * Place warm interior point lights at room/footprint centers near ceiling.
   * Caps count; auto-dims extras on narrow screens. No shadows.
   * centers: [{x,y,z, radius?}, ...]  y = absolute world height of light
   */
  function placeInteriorLights(centers, opts) {
    const finished = !(opts && opts.studs);
    const budget = interiorLightBudget();
    const list = (centers || []).slice(0, budget.max);
    // Stronger warm fills so rooms aren't caves; sun stays key outdoors
    const baseI = finished ? 2.6 : 0.7;
    const scale = budget.intensityScale;

    if (interiorFill) {
      if (list.length) {
        const c = list[0];
        interiorFill.visible = true;
        interiorFill.position.set(c.x, c.y, c.z);
        interiorFill.intensity = baseI * scale;
        interiorFill.distance = Math.max(22, (c.radius || 10) * 2.8);
        interiorFill.decay = 1.6;
        interiorFill.color.setHex(0xfff2e0);
      } else {
        interiorFill.position.set(0, 6.5, 0);
        interiorFill.intensity = (finished ? 0.7 : 0.28) * scale;
        interiorFill.distance = 36;
      }
    }

    // Second light slightly lower / offset for soft wrap (not just one hot spot)
    for (let i = 0; i < interiorLights.length; i++) {
      const pl = interiorLights[i];
      const c = list[i + 1] || (i === 0 && list[0] ? {
        x: list[0].x + (list[0].radius || 6) * 0.25,
        y: list[0].y - 1.2,
        z: list[0].z - (list[0].radius || 6) * 0.15,
        radius: (list[0].radius || 8) * 0.9,
      } : null);
      // Only fabricate the wrap fill when we have budget room and a single center
      if (c && (list[i + 1] || (i === 0 && list.length === 1 && budget.max >= 2))) {
        pl.visible = true;
        pl.position.set(c.x, c.y, c.z);
        pl.intensity = (baseI * 0.55) * scale;
        pl.distance = Math.max(16, (c.radius || 8) * 2.2);
        pl.decay = 1.7;
        pl.color.setHex(0xffe8cc);
      } else if (list[i + 1]) {
        pl.visible = true;
        pl.position.set(list[i + 1].x, list[i + 1].y, list[i + 1].z);
        pl.intensity = (baseI * 0.75) * scale;
        pl.distance = Math.max(16, (list[i + 1].radius || 8) * 2.2);
        pl.color.setHex(0xfff0dc);
      } else {
        pl.visible = false;
        pl.intensity = 0;
      }
    }

    // Soften sun a touch when finished interior so fills read without blown exteriors
    if (sunLight) sunLight.intensity = finished ? 0.75 : 0.92;
    if (hemiLight) hemiLight.intensity = finished ? 0.58 : 0.48;
    if (ambientWarm) ambientWarm.intensity = finished ? 0.28 * scale : 0.1;
  }

  function interiorLightBudget() {
    const w = (canvasHost && canvasHost.clientWidth) || window.innerWidth || 1200;
    if (w < 700) return { max: 1, intensityScale: 0.72 };
    if (w < 900) return { max: 2, intensityScale: 0.88 };
    return { max: MAX_INTERIOR_LIGHTS, intensityScale: 1 };
  }

  /**
   * Finished-interior cues for a rectangular room (plan XZ → 3D):
   * ceiling plane, baseboard, paint liner, soft wall/floor junction.
   * Call when Studs OFF. Floors are handled separately with floorMaterial.
   */
  function addRoomInteriorFinish(rx, rz, rw, rd, wallH, group, mats) {
    const w = Math.abs(rw);
    const d = Math.abs(rd);
    if (w < 1 || d < 1 || wallH < 2) return;
    const cx = rx + rw / 2;
    const cz = rz + rd / 2;
    const half = WALL_THICK / 2;
    const paint = mats.paint;
    const ceiling = mats.ceiling;
    const base = mats.baseboard;
    const junction = mats.junction;

    // Ceiling — light warm plane just under wall top
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.5, w - WALL_THICK), CEILING_T, Math.max(0.5, d - WALL_THICK)),
      ceiling
    );
    ceil.position.set(cx, wallH - CEILING_T / 2, cz);
    ceil.receiveShadow = true;
    ceil.userData = { type: 'ceiling', label: 'Ceiling' };
    group.add(ceil);
    applyPlanarXZUVs(ceil, 0.25);

    // Interior paint liners on four sides (cover cladding on room face)
    const inset = half + PAINT_LINER_T / 2;
    const paintH = Math.max(0.5, wallH - BASEBOARD_H - 0.04);
    const paintY = BASEBOARD_H + paintH / 2;
    const faces = [
      // north (low z), south (high z), west (low x), east (high x)
      { x: cx, z: rz + inset, bw: Math.max(0.2, w - WALL_THICK), bd: PAINT_LINER_T },
      { x: cx, z: rz + rd - inset, bw: Math.max(0.2, w - WALL_THICK), bd: PAINT_LINER_T },
      { x: rx + inset, z: cz, bw: PAINT_LINER_T, bd: Math.max(0.2, d - WALL_THICK) },
      { x: rx + rw - inset, z: cz, bw: PAINT_LINER_T, bd: Math.max(0.2, d - WALL_THICK) },
    ];
    faces.forEach((f) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(f.bw, paintH, f.bd), paint);
      m.position.set(f.x, paintY, f.z);
      m.receiveShadow = true;
      m.userData = { type: 'paintLiner', label: 'Interior wall' };
      group.add(m);
    });

    // Baseboard trim ~3.5 in
    const bbInset = half + BASEBOARD_T / 2;
    const bbs = [
      { x: cx, z: rz + bbInset, bw: Math.max(0.2, w - WALL_THICK), bd: BASEBOARD_T },
      { x: cx, z: rz + rd - bbInset, bw: Math.max(0.2, w - WALL_THICK), bd: BASEBOARD_T },
      { x: rx + bbInset, z: cz, bw: BASEBOARD_T, bd: Math.max(0.2, d - WALL_THICK) },
      { x: rx + rw - bbInset, z: cz, bw: BASEBOARD_T, bd: Math.max(0.2, d - WALL_THICK) },
    ];
    bbs.forEach((f) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(f.bw, BASEBOARD_H, f.bd), base);
      m.position.set(f.x, BASEBOARD_H / 2, f.z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { type: 'baseboard', label: 'Baseboard' };
      group.add(m);
    });

    // Soft darker junction strip (AO feel) just inside baseboard at floor
    const jh = 0.04;
    const jInset = half + BASEBOARD_T + 0.03;
    const jring = [
      { x: cx, z: rz + jInset, bw: Math.max(0.2, w - WALL_THICK - 0.1), bd: 0.05 },
      { x: cx, z: rz + rd - jInset, bw: Math.max(0.2, w - WALL_THICK - 0.1), bd: 0.05 },
      { x: rx + jInset, z: cz, bw: 0.05, bd: Math.max(0.2, d - WALL_THICK - 0.1) },
      { x: rx + rw - jInset, z: cz, bw: 0.05, bd: Math.max(0.2, d - WALL_THICK - 0.1) },
    ];
    jring.forEach((f) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(f.bw, jh, f.bd), junction);
      m.position.set(f.x, jh / 2 + 0.01, f.z);
      m.userData = { type: 'floorJunction', label: 'Floor junction' };
      group.add(m);
    });
  }

  /** Baseboard along a free wall segment (Studs OFF). */
  function addWallBaseboard(x1, z1, x2, z2, group, baseMat) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.4 || !baseMat) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len - WALL_THICK * 0.5, BASEBOARD_H, BASEBOARD_T),
      baseMat
    );
    mesh.position.set((x1 + x2) / 2, BASEBOARD_H / 2, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    // nudge slightly toward +normal (arbitrary); fine for free walls
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'baseboard', label: 'Baseboard' };
    group.add(mesh);
  }

  function steelMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6A7278'),
      roughness: 0.45,
      metalness: 0.55,
    });
  }

  function defaultFloorFramingFor(foundationType) {
    // Always default ON (including slab): Jake wants beams visible first;
    // toggle still restores opaque finish flooring when unchecked.
    void foundationType;
    return true;
  }

  /**
   * Conceptual steel I-beam / joist grid under a rectangular floor (EXAMPLE spacing).
   * Members sit just below floor plane (floorY ≈ 0 in local group space).
   * Not engineering — educational massing only.
   */
  function addFloorFraming(cx, cz, lenX, lenZ, group, steelMat, opts) {
    const w = Math.abs(lenX);
    const d = Math.abs(lenZ);
    if (w < 2 || d < 2 || !group) return null;
    const wrap = new THREE.Group();
    wrap.userData = { type: 'floorFraming', example: true };
    group.add(wrap);

    const oc = (opts && opts.ocFt) || FLOOR_JOIST_OC;
    const beamH = (opts && opts.beamH) || FLOOR_IBEAM_H;
    const fw = FLOOR_IBEAM_FLANGE_W;
    const ft = FLOOR_IBEAM_FLANGE_T;
    const wt = FLOOR_IBEAM_WEB_T;
    // Top of I-beam just under floor slab (~0.02–0.05 below y=0 local)
    const topY = (opts && opts.topY != null) ? opts.topY : -0.04;
    const midY = topY - beamH / 2;
    const mat = steelMat || steelMaterial();

    // Primary joists span the shorter direction (common conceptual cue)
    const spanShortX = w <= d;
    const spanLen = spanShortX ? w : d;
    const runLen = spanShortX ? d : w;
    const n = Math.max(2, Math.round(runLen / oc) + 1);

    function addIBeam(x, z, length, rotY) {
      const g = new THREE.Group();
      g.position.set(x, midY, z);
      g.rotation.y = rotY || 0;
      g.userData = { type: 'floorIBeam', label: 'Floor I-beam', example: true };
      // web
      const web = new THREE.Mesh(new THREE.BoxGeometry(length, beamH - ft * 2, wt), mat);
      web.castShadow = true;
      web.receiveShadow = true;
      web.userData = { type: 'floorIBeam', label: 'Floor I-beam', example: true };
      g.add(web);
      // flanges
      const top = new THREE.Mesh(new THREE.BoxGeometry(length, ft, fw), mat);
      top.position.y = beamH / 2 - ft / 2;
      top.castShadow = true;
      top.userData = { type: 'floorIBeam', label: 'Floor I-beam', example: true };
      g.add(top);
      const bot = new THREE.Mesh(new THREE.BoxGeometry(length, ft, fw), mat);
      bot.position.y = -(beamH / 2 - ft / 2);
      bot.castShadow = true;
      bot.userData = { type: 'floorIBeam', label: 'Floor I-beam', example: true };
      g.add(bot);
      wrap.add(g);
    }

    const inset = Math.min(0.35, Math.min(w, d) * 0.04);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      if (spanShortX) {
        // joists parallel to X, spaced along Z
        const z = cz - d / 2 + inset + t * (d - inset * 2);
        addIBeam(cx, z, Math.max(1, w - inset * 2), 0);
      } else {
        // joists parallel to Z, spaced along X
        const x = cx - w / 2 + inset + t * (w - inset * 2);
        addIBeam(x, cz, Math.max(1, d - inset * 2), Math.PI / 2);
      }
    }

    // One or two perimeter/girder beams along the long edges (heavier visual)
    const girderH = beamH * 1.15;
    const girderY = topY - girderH / 2;
    function addGirder(x, z, length, rotY) {
      const g = new THREE.Group();
      g.position.set(x, girderY, z);
      g.rotation.y = rotY || 0;
      g.userData = { type: 'floorIBeam', label: 'Floor girder', example: true };
      const web = new THREE.Mesh(new THREE.BoxGeometry(length, girderH - ft * 2, wt * 1.4), mat);
      web.castShadow = true;
      web.userData = { type: 'floorIBeam', label: 'Floor girder', example: true };
      g.add(web);
      const top = new THREE.Mesh(new THREE.BoxGeometry(length, ft * 1.15, fw * 1.15), mat);
      top.position.y = girderH / 2 - ft * 0.55;
      top.userData = { type: 'floorIBeam', label: 'Floor girder', example: true };
      g.add(top);
      const bot = new THREE.Mesh(new THREE.BoxGeometry(length, ft * 1.15, fw * 1.15), mat);
      bot.position.y = -(girderH / 2 - ft * 0.55);
      bot.userData = { type: 'floorIBeam', label: 'Floor girder', example: true };
      g.add(bot);
      wrap.add(g);
    }
    if (spanShortX) {
      // girders along X at near/far Z
      addGirder(cx, cz - d / 2 + inset * 0.5, Math.max(1, w - inset), 0);
      addGirder(cx, cz + d / 2 - inset * 0.5, Math.max(1, w - inset), 0);
    } else {
      addGirder(cx - w / 2 + inset * 0.5, cz, Math.max(1, d - inset), Math.PI / 2);
      addGirder(cx + w / 2 - inset * 0.5, cz, Math.max(1, d - inset), Math.PI / 2);
    }

    return wrap;
  }

  /** Hollow stem / basement wall ring so under-floor framing stays visible (educational). */
  function addStemWallRing(cx, cz, lenX, lenZ, height, yBottom, material, group, wallT) {
    const t = wallT != null ? wallT : 0.55;
    const w = Math.abs(lenX);
    const d = Math.abs(lenZ);
    if (w < 2 || d < 2 || height < 0.4) return;
    const y = yBottom + height / 2;
    const ud = { type: 'foundation', label: 'Foundation wall' };
    boxAt(w, height, t, cx, y, cz - d / 2 + t / 2, material, group, ud);
    boxAt(w, height, t, cx, y, cz + d / 2 - t / 2, material, group, ud);
    boxAt(t, height, Math.max(0.2, d - t * 2), cx - w / 2 + t / 2, y, cz, material, group, ud);
    boxAt(t, height, Math.max(0.2, d - t * 2), cx + w / 2 - t / 2, y, cz, material, group, ud);
  }

  /**
   * Sonotube / pier foundation — ONLY under wall edges (corners + along exterior /
   * bearing wall lines at ~6 ft o.c.). Never mid-span under open floor.
   * opts.walls: plan walls in plan-ft (with opts.ox/oz origin) → wall-aware placement.
   * Without walls: perimeter of the ax,az / addL×addW rectangle only.
   */
  function addPierFoundation(ax, az, addL, addW, pierH, foundMat, beamMat, group, opts) {
    const wrap = new THREE.Group();
    wrap.userData = { type: 'pierFoundation', pierH };
    group.add(wrap);
    group = wrap;
    const h = pierH > 0 ? pierH : PIER_H_DEFAULT;
    const spacing = 6; // ft o.c. along edges
    const opts0 = opts || {};
    const pierMap = new Map();
    function addPierPt(px, pz) {
      const k = keyPt(px, pz);
      if (!pierMap.has(k)) pierMap.set(k, [px, pz]);
    }
    function placeAlongSegment(x1, z1, x2, z2) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.05) return;
      const n = Math.max(2, Math.round(len / spacing) + 1);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        addPierPt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
      }
    }

    const walls = opts0.walls || null;
    const wallOx = opts0.ox != null ? opts0.ox : 0;
    const wallOz = opts0.oz != null ? opts0.oz : 0;
    if (walls && walls.length) {
      walls.forEach((w) => {
        placeAlongSegment(w.x1 - wallOx, w.y1 - wallOz, w.x2 - wallOx, w.y2 - wallOz);
      });
    } else {
      // Parametric / no sketch walls: perimeter of rectangle only (no interior grid).
      const inset = Math.min(1.0, Math.min(addL, addW) * 0.12);
      const x0 = ax - addL / 2 + inset;
      const x1 = ax + addL / 2 - inset;
      const z0 = az - addW / 2 + inset;
      const z1 = az + addW / 2 - inset;
      placeAlongSegment(x0, z0, x1, z0);
      placeAlongSegment(x0, z1, x1, z1);
      placeAlongSegment(x0, z0, x0, z1);
      placeAlongSegment(x1, z0, x1, z1);
    }
    const pierPositions = Array.from(pierMap.values());

    pierPositions.forEach(([px, pz]) => {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(PIER_R, PIER_R * 1.05, h, 16),
        foundMat
      );
      cyl.position.set(px, h / 2, pz);
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      cyl.userData = { type: 'pier', label: 'Pier / sonotube' };
      group.add(cyl);
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(PIER_R * 1.6, PIER_R * 1.7, 0.25, 12),
        foundMat
      );
      pad.position.set(px, 0.12, pz);
      pad.receiveShadow = true;
      pad.userData = { type: 'pier', label: 'Pier footing' };
      group.add(pad);
    });

    // Grade beam along edge / wall lines (ring for footprint; segments when walls given)
    if (beamMat) {
      const beamH = 0.35;
      const beamY = h - beamH / 2;
      const beamT = 0.3;
      if (walls && walls.length) {
        walls.forEach((w) => {
          const x1 = w.x1 - wallOx, z1 = w.y1 - wallOz;
          const x2 = w.x2 - wallOx, z2 = w.y2 - wallOz;
          const len = Math.hypot(x2 - x1, z2 - z1);
          if (len < 0.1) return;
          const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.15, beamH, beamT), beamMat);
          m.position.set((x1 + x2) / 2, beamY, (z1 + z2) / 2);
          m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
          m.castShadow = true;
          m.userData = { type: 'gradeBeam', label: 'Grade beam' };
          group.add(m);
        });
      } else {
        const ring = [
          [ax, az - addW / 2, addL + 0.3, beamT],
          [ax, az + addW / 2, addL + 0.3, beamT],
          [ax - addL / 2, az, beamT, addW + 0.3],
          [ax + addL / 2, az, beamT, addW + 0.3],
        ];
        ring.forEach(([x, z, bw, bd]) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(bw, beamH, bd), beamMat);
          m.position.set(x, beamY, z);
          m.castShadow = true;
          m.userData = { type: 'gradeBeam', label: 'Grade beam' };
          group.add(m);
        });
      }
    }
    return { pierH: h, count: pierPositions.length };
  }

  function boxAt(w, h, d, x, y, z, material, group, ud) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (ud) mesh.userData = Object.assign({}, ud);
    group.add(mesh);
    if (material && material.map) applyWallUVs(mesh, 0.55);
    return mesh;
  }

  /** Canvas sprite label facing camera */
  function makeLabel(text, x, y, z, group, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 64);
    ctx.font = '600 22px system-ui, sans-serif';
    const tw = Math.min(480, Math.max(120, ctx.measureText(text).width + 36));
    const x0 = (512 - tw) / 2;
    ctx.fillStyle = 'rgba(40, 44, 48, 0.78)';
    roundRect(ctx, x0, 12, tw, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#f5f2ec';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const sprMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(sprMat);
    const s = scale || 2.2;
    spr.scale.set(s * 1.6, s * 0.25, 1);
    spr.position.set(x, y, z);
    spr.renderOrder = 10;
    group.add(spr);
    return spr;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function keyPt(x, z) {
    return (Math.round(x * 200) / 200) + ',' + (Math.round(z * 200) / 200);
  }

  /**
   * Continuous wall ring for a closed rectangular room (true flush corners).
   * Shape in XZ → extruded in Y via rotation.
   */
  function extrudeRoomRing(rx, rz, rw, rd, height, material, group) {
    const half = WALL_THICK / 2;
    if (rw < WALL_THICK * 2.2 || rd < WALL_THICK * 2.2 || height < 0.5) return null;
    // Shape in XY; after Rx(-90) local_y maps to -world_z, so feed shapeY = -planZ
    const shape = new THREE.Shape();
    const y0 = -(rz - half), y1 = -(rz + rd + half);
    const x0 = rx - half, x1 = rx + rw + half;
    shape.moveTo(x0, y0);
    shape.lineTo(x1, y0);
    shape.lineTo(x1, y1);
    shape.lineTo(x0, y1);
    shape.lineTo(x0, y0);
    const hole = new THREE.Path();
    const hx0 = rx + half, hx1 = rx + rw - half;
    const hy0 = -(rz + half), hy1 = -(rz + rd - half);
    // Hole winding opposite to outer
    hole.moveTo(hx0, hy0);
    hole.lineTo(hx0, hy1);
    hole.lineTo(hx1, hy1);
    hole.lineTo(hx1, hy0);
    hole.lineTo(hx0, hy0);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'cladding', label: 'Cladding' };
    group.add(mesh);
    applyWallUVs(mesh, 0.6);
    return mesh;
  }

  /**
   * Wall segment butting to corner posts (inset ends), no window cutouts.
   */
  function wallSegSolid(x1, z1, x2, z2, height, material, group, y0) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return null;
    const half = WALL_THICK / 2;
    const ux = dx / len, uz = dz / len;
    const inset = Math.min(half - POST_OVERLAP, len / 2 - 0.01);
    if (inset < 0) return null;
    const ax = x1 + ux * inset, az = z1 + uz * inset;
    const bx = x2 - ux * inset, bz = z2 - uz * inset;
    const eff = Math.hypot(bx - ax, bz - az);
    if (eff < 0.02) return null;
    const base = y0 || 0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(eff, height, WALL_THICK), material);
    mesh.position.set((ax + bx) / 2, base + height / 2, (az + bz) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'cladding', label: 'Cladding' };
    group.add(mesh);
    return mesh;
  }

  /** Place a wall run from t0..t1 along centerline (fraction of full wall), full height slab between yBot..yTop */
  function wallSlabAlong(x1, z1, x2, z2, t0, t1, yBot, yTop, material, group) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05 || t1 <= t0 + 1e-4) return null;
    const h = yTop - yBot;
    if (h < 0.02) return null;
    const ax = x1 + dx * t0, az = z1 + dz * t0;
    const bx = x1 + dx * t1, bz = z1 + dz * t1;
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg < 0.02) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(seg, h, WALL_THICK), material);
    mesh.position.set((ax + bx) / 2, (yBot + yTop) / 2, (az + bz) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'cladding', label: 'Cladding' };
    group.add(mesh);
    return mesh;
  }

  /**
   * Build a free wall with corner-post insets and window cutouts (sill + header + jambs).
   */
  function buildOpenWall(x1, z1, x2, z2, height, openings, material, group) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;
    const half = WALL_THICK / 2;
    const insetDist = Math.min(half - POST_OVERLAP, len * 0.45);
    const tInset = insetDist / len;
    const tStart = tInset;
    const tEnd = 1 - tInset;

    const wins = (openings || []).slice().sort((a, b) => a.t - b.t);
    // Build horizontal spans of full-height wall, skipping window widths
    const cuts = [];
    wins.forEach((win) => {
      const halfW = (win.widthFt / len) / 2;
      let a = win.t - halfW;
      let b = win.t + halfW;
      a = Math.max(tStart, a);
      b = Math.min(tEnd, b);
      if (b > a) cuts.push({ a, b, win });
    });

    let cursor = tStart;
    const solidSpans = [];
    cuts.forEach((c) => {
      if (c.a > cursor + 1e-4) solidSpans.push([cursor, c.a]);
      cursor = Math.max(cursor, c.b);
    });
    if (tEnd > cursor + 1e-4) solidSpans.push([cursor, tEnd]);

    solidSpans.forEach(([a, b]) => {
      wallSlabAlong(x1, z1, x2, z2, a, b, 0, height, material, group);
    });

    cuts.forEach((c) => {
      const win = c.win;
      const sill = Math.max(0, Math.min(win.sillFt, height - 0.5));
      const wh = Math.min(win.heightFt, height - sill - 0.15);
      // sill below opening
      if (sill > 0.05) wallSlabAlong(x1, z1, x2, z2, c.a, c.b, 0, sill, material, group);
      // header above opening
      const headBot = sill + wh;
      if (height - headBot > 0.05) wallSlabAlong(x1, z1, x2, z2, c.a, c.b, headBot, height, material, group);
    });
  }

  /** Oriented lumber box along wall centerline from t0..t1, thickness STUD_D. */
  function lumberAlong(x1, z1, x2, z2, t0, t1, yBot, yTop, material, group, depth, ud) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05 || t1 <= t0 + 1e-4) return null;
    const h = yTop - yBot;
    if (h < 0.02) return null;
    const ax = x1 + dx * t0, az = z1 + dz * t0;
    const bx = x1 + dx * t1, bz = z1 + dz * t1;
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg < 0.02) return null;
    const d = depth != null ? depth : STUD_D;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(seg, h, d), material);
    mesh.position.set((ax + bx) / 2, (yBot + yTop) / 2, (az + bz) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (ud) mesh.userData = Object.assign({}, ud);
    group.add(mesh);
    return mesh;
  }

  /** Vertical stud centered at fraction t along wall (between plates). */
  function studAt(x1, z1, x2, z2, t, yBot, yTop, material, group, ud) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return null;
    const h = yTop - yBot;
    if (h < 0.05) return null;
    const cx = x1 + dx * t, cz = z1 + dz * t;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(STUD_W, h, STUD_D), material);
    mesh.position.set(cx, (yBot + yTop) / 2, cz);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (ud) mesh.userData = Object.assign({}, ud);
    else mesh.userData = { type: 'stud' };
    group.add(mesh);
    return mesh;
  }

  /**
   * Open stud framing for one wall run (bottom/top plates, studs @ 16" o.c.,
   * simplified rough opening with king studs + header + sill).
   * Ends inset for shared corner posts (flush corner technique).
   */
  function buildStudWall(x1, z1, x2, z2, height, openings, material, group) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05 || height < 0.5) return;
    const half = WALL_THICK / 2;
    const insetDist = Math.min(half - POST_OVERLAP, len * 0.45);
    const tInset = insetDist / len;
    const tStart = tInset;
    const tEnd = 1 - tInset;
    if (tEnd <= tStart + 1e-4) return;

    const plateBot = 0;
    const plateTop = height;
    const studBot = PLATE_H;
    const studTop = height - PLATE_H;

    // Bottom + top plates (full run between posts)
    lumberAlong(x1, z1, x2, z2, tStart, tEnd, plateBot, plateBot + PLATE_H, material, group, null,
      { type: 'bottomPlate', label: 'Bottom plate' });
    lumberAlong(x1, z1, x2, z2, tStart, tEnd, plateTop - PLATE_H, plateTop, material, group, null,
      { type: 'topPlate', label: 'Top plate' });

    const wins = (openings || []).slice().sort((a, b) => a.t - b.t);
    const cuts = [];
    wins.forEach((win) => {
      const halfW = (win.widthFt / len) / 2;
      let a = win.t - halfW;
      let b = win.t + halfW;
      a = Math.max(tStart, a);
      b = Math.min(tEnd, b);
      if (b > a) cuts.push({ a, b, win });
    });

    // Merge overlapping opening spans
    const blocked = (t) => {
      const halfStud = (STUD_W / 2) / len;
      for (const c of cuts) {
        if (t + halfStud >= c.a && t - halfStud <= c.b) return true;
      }
      return false;
    };

    // End studs (against posts) + regular OC studs, skipping openings
    const studUd = { type: 'stud', wallHeightFt: height };
    const placeStud = (t) => {
      if (t < tStart - 1e-6 || t > tEnd + 1e-6) return;
      if (blocked(t)) return;
      studAt(x1, z1, x2, z2, t, studBot, studTop, material, group, studUd);
    };
    placeStud(tStart + (STUD_W / 2) / len);
    placeStud(tEnd - (STUD_W / 2) / len);

    // 16" o.c. from first end (prototype — good enough for conceptual framing)
    const runLen = (tEnd - tStart) * len;
    const nGaps = Math.max(1, Math.round(runLen / STUD_OC));
    const actualOc = runLen / nGaps;
    for (let i = 1; i < nGaps; i++) {
      const dist = insetDist + i * actualOc;
      placeStud(dist / len);
    }

    // Rough openings are built separately via buildRoughOpeningFraming so they
    // stay parented to the wall/root framing group (never under the draggable window).
  }

  /**
   * King/jack/header/sill/cripples for one window opening.
   * Parent must be the wall/root framing group — never the window mesh group.
   */
  function buildRoughOpeningFraming(x1, z1, x2, z2, height, win, material, parentGroup) {
    if (!win || !parentGroup) return null;
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05 || height < 0.5) return null;
    const half = WALL_THICK / 2;
    const insetDist = Math.min(half - POST_OVERLAP, len * 0.45);
    const tInset = insetDist / len;
    const tStart = tInset;
    const tEnd = 1 - tInset;
    if (tEnd <= tStart + 1e-4) return null;

    const studBot = PLATE_H;
    const studTop = height - PLATE_H;
    const halfW = (win.widthFt / len) / 2;
    let a = Math.max(tStart, win.t - halfW);
    let b = Math.min(tEnd, win.t + halfW);
    if (b <= a) return null;

    const g = new THREE.Group();
    g.userData = { type: 'roFraming', winId: win.id };
    const sill = Math.max(0, Math.min(win.sillFt, height - 0.5));
    const wh = Math.min(win.heightFt, height - sill - 0.15);
    const headBot = sill + wh;
    const headH = Math.min(0.45, Math.max(0.2, height - headBot - PLATE_H));
    const kingClear = (STUD_W * 0.55) / len;

    const studUd = { type: 'stud', wallHeightFt: height };
    const tKingL = Math.max(tStart, a - kingClear);
    const tKingR = Math.min(tEnd, b + kingClear);
    studAt(x1, z1, x2, z2, tKingL, studBot, studTop, material, g, Object.assign({}, studUd, { role: 'king' }));
    studAt(x1, z1, x2, z2, tKingR, studBot, studTop, material, g, Object.assign({}, studUd, { role: 'king' }));

    if (sill > studBot + 0.05) {
      studAt(x1, z1, x2, z2, a + kingClear * 0.3, studBot, sill, material, g,
        Object.assign({}, studUd, { role: 'jack', label: 'Jack stud' }));
      studAt(x1, z1, x2, z2, b - kingClear * 0.3, studBot, sill, material, g,
        Object.assign({}, studUd, { role: 'jack', label: 'Jack stud' }));
    }
    if (sill > 0.08) {
      lumberAlong(x1, z1, x2, z2, a, b, sill - PLATE_H, sill, material, g, null,
        { type: 'sill', label: 'Rough sill' });
    }
    if (sill - PLATE_H > studBot + 0.15) {
      const span = (b - a) * len;
      const nC = Math.max(1, Math.round(span / STUD_OC));
      for (let i = 1; i < nC; i++) {
        const t = a + (i / nC) * (b - a);
        studAt(x1, z1, x2, z2, t, studBot, sill - PLATE_H, material, g,
          { type: 'cripple', label: 'Cripple stud' });
      }
    }
    const hTop = Math.min(studTop, headBot + headH);
    if (hTop > headBot + 0.05) {
      lumberAlong(x1, z1, x2, z2, a, b, headBot, hTop, material, g, null,
        { type: 'header', label: 'Header' });
    }
    if (studTop > hTop + 0.12) {
      const span = (b - a) * len;
      const nC = Math.max(1, Math.round(span / STUD_OC));
      for (let i = 1; i < nC; i++) {
        const t = a + (i / nC) * (b - a);
        studAt(x1, z1, x2, z2, t, hTop, studTop, material, g,
          { type: 'cripple', label: 'Cripple stud' });
      }
    }

    parentGroup.add(g);
    if (win.id) roFramingGroups.set(win.id, g);
    return g;
  }

  function cornerPostAt(x, z, height, material, group) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_THICK, height, WALL_THICK),
      material
    );
    post.position.set(x, height / 2, z);
    post.castShadow = true;
    post.receiveShadow = true;
    post.userData = { type: 'cornerPost', label: 'Corner post', wallHeightFt: height };
    group.add(post);
    return post;
  }

  function openingOnWall(x1, z1, x2, z2, wallH, ow, oh, sill, glassMat, frameMat, group) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.5) return;
    const t = 0.5;
    const mx = x1 + (x2 - x1) * t;
    const mz = z1 + (z2 - z1) * t;
    const ang = Math.atan2(z2 - z1, x2 - x1);
    const wFt = ow / 12, hFt = Math.min(oh / 12, wallH - sill - 0.2);
    addFramedOpening(mx, mz, ang, wFt, hFt, sill, glassMat, frameMat, group, null);
  }

  function addFramedOpening(mx, mz, ang, wFt, hFt, sill, glassMat, frameMat, group, winId, opts) {
    opts = opts || {};
    const isDoor = opts.openingType === 'door' || opts.openingType === 'large' || opts.autoShared;
    const g = new THREE.Group();
    g.position.set(mx, 0, mz);
    g.rotation.y = -ang;

    // Frame spans wall thickness; glass recessed 2–3 in from outer face (P0)
    const depth = WALL_THICK + 0.06;
    const trim = 0.14;
    const cy = sill + hFt / 2;
    const outerZ = WALL_THICK / 2;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(wFt + trim * 2, hFt + trim * 2, depth),
      frameMat
    );
    frame.position.set(0, cy, 0);
    frame.castShadow = true;
    g.add(frame);

    const gw = Math.max(0.2, wFt - 0.12);
    const gh = Math.max(0.2, hFt - 0.12);
    const glassDepth = isDoor ? 0.07 : 0.05;
    const glassZ = Math.max(0.02, outerZ - WIN_RECESS); // set back from cladding face
    // Doors: opaque panel recessed like glass; windows: dielectric glazing
    const panelMat = isDoor
      ? mat(0x6b4a32, { roughness: 0.72, metalness: 0.05 })
      : glassMat;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, glassDepth), panelMat);
    glass.position.set(0, cy, glassZ);
    g.add(glass);
    const glass2 = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, glassDepth), panelMat);
    glass2.position.set(0, cy, -glassZ);
    g.add(glass2);

    // Projecting exterior sill (~1–1.5 in) under windows
    if (!isDoor && sill > 0.05) {
      const sillMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wFt + trim * 2 + 0.1, 0.07, WALL_THICK + SILL_PROJ * 2),
        frameMat
      );
      sillMesh.position.set(0, sill - 0.02, 0);
      sillMesh.castShadow = true;
      sillMesh.userData = { type: 'windowSill', label: 'Window sill', winId };
      g.add(sillMesh);
    }

    // Mullion (windows) or door stile/handle hint (doors) — no muntin grids (P2 skip)
    let mull;
    if (isDoor) {
      mull = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, Math.max(0.2, hFt * 0.25), depth * 0.55),
        mat(0xc4a882, { roughness: 0.5, metalness: 0.35 })
      );
      mull.position.set(wFt * 0.32, cy, glassZ + 0.02);
      g.add(mull);
    } else {
      mull = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, Math.max(0.15, hFt - 0.12), depth * 0.5),
        frameMat
      );
      mull.position.set(0, cy, 0);
      g.add(mull);
    }

    if (winId) {
      // Clone materials so selection highlight is per-window
      frame.material = frameMat.clone();
      glass.material = panelMat.clone ? panelMat.clone() : panelMat;
      glass2.material = glass.material;
      mull.material = isDoor ? mull.material.clone() : frame.material;
      const openType = opts.openingType || (isDoor ? 'door' : 'window');
      g.userData = { type: 'window', winId, openingType: openType };
      glass.userData = { type: 'window', winId, openingType: openType };
      glass2.userData = { type: 'window', winId, openingType: openType };
      frame.userData = { type: 'window', winId, openingType: openType };
      if (mull) mull.userData = { type: 'window', winId, openingType: openType };
      interactiveObjects.push(glass, glass2, frame);

      // Resize handles (local space): left, right, top
      const handleMat = mat(0x2f6f6a, { emissive: 0x1a3d3a, emissiveIntensity: 0.25 });
      const hk = 0.28;
      const leftH = new THREE.Mesh(new THREE.BoxGeometry(hk, hk, hk), handleMat);
      leftH.position.set(-wFt / 2 - 0.08, cy, depth * 0.55);
      leftH.userData = { type: 'winHandle', winId, handle: 'left' };
      leftH.visible = false;
      const rightH = new THREE.Mesh(new THREE.BoxGeometry(hk, hk, hk), handleMat);
      rightH.position.set(wFt / 2 + 0.08, cy, depth * 0.55);
      rightH.userData = { type: 'winHandle', winId, handle: 'right' };
      rightH.visible = false;
      const topH = new THREE.Mesh(new THREE.BoxGeometry(hk, hk, hk), handleMat);
      topH.position.set(0, sill + hFt + 0.1, depth * 0.55);
      topH.userData = { type: 'winHandle', winId, handle: 'top' };
      topH.visible = false;
      g.add(leftH, rightH, topH);
      interactiveObjects.push(leftH, rightH, topH);

      // Opening group only — studs / RO framing live under framingRoot, never here
      windowMeshes.set(winId, {
        group: g, glass, glass2, frame, mull, leftH, rightH, topH, wFt, hFt, sill,
        openingType: opts.openingType || (isDoor ? 'door' : 'window'),
      });
    }

    group.add(g);
    return g;
  }

  function addRoofGable(group, w, d, wallH, pitch, overhang, roofMat, tieIn) {
    const oh = overhang / 12;
    const W = w + oh * 2, D = d + oh * 2;
    // Rise from BUILDING half-span (not eave-to-eave) so wall-line clearance is correct.
    // Underside at wall line = top plate (wallH); top surface = wallH + ROOF_THICK.
    // Overhang tip continues the same pitch downward outside the walls.
    const alongZ = D >= W;
    const buildingHalf = alongZ ? (w / 2) : (d / 2);
    let rise = Math.max(0.15, buildingHalf * pitch);
    if (tieIn === 'flat' || tieIn === 'low-slope') rise = Math.max(0.5, Math.max(w, d) * 0.04);
    if (tieIn === 'dormer') rise = Math.max(rise, 3);
    const thick = ROOF_THICK;
    const bearingY = wallH; // underside at wall line clears top plate / studs
    const plateY = bearingY + thick; // TOP surface at wall line
    const ridgeY = plateY + rise;
    // Tip drops oh*pitch along the same slope (skip drop for flat/low-slope)
    const tipDrop = (tieIn === 'flat' || tieIn === 'low-slope') ? 0 : oh * pitch;
    const eaveY = plateY - tipDrop;
    function plane(corners) {
      const verts = new Float32Array(corners.flat());
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, roofMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: 'roof', label: 'Roof' };
      group.add(mesh);
      return mesh;
    }
    function addThickPlanes(topCorners) {
      plane(topCorners);
      // Underside offset for eave/roof thickness cue
      const bot = topCorners.map((c) => [c[0], c[1] - thick, c[2]]);
      plane(bot);
    }
    if (alongZ) {
      addThickPlanes([[-W / 2, eaveY, -D / 2], [0, ridgeY, -D / 2], [0, ridgeY, D / 2], [-W / 2, eaveY, D / 2]]);
      addThickPlanes([[W / 2, eaveY, -D / 2], [0, ridgeY, -D / 2], [0, ridgeY, D / 2], [W / 2, eaveY, D / 2]]);
      // Eave edge bands (thickness readable at overhang)
      [[-W / 2, D], [W / 2, D]].forEach(([x, _d]) => {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(thick * 0.9, thick, D),
          roofMat
        );
        edge.position.set(x, eaveY - thick / 2, 0);
        edge.castShadow = true;
        edge.userData = { type: 'roof', label: 'Roof eave' };
        group.add(edge);
      });
    } else {
      addThickPlanes([[-W / 2, eaveY, -D / 2], [-W / 2, ridgeY, 0], [W / 2, ridgeY, 0], [W / 2, eaveY, -D / 2]]);
      addThickPlanes([[-W / 2, eaveY, D / 2], [-W / 2, ridgeY, 0], [W / 2, ridgeY, 0], [W / 2, eaveY, D / 2]]);
      [[-D / 2], [D / 2]].forEach(([z]) => {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(W, thick, thick * 0.9),
          roofMat
        );
        edge.position.set(0, eaveY - thick / 2, z);
        edge.castShadow = true;
        edge.userData = { type: 'roof', label: 'Roof eave' };
        group.add(edge);
      });
    }
  }

  /** Hip roof: 2 main slopes + 2 triangular hips (4 planes). Pitch drives rise from half the short BUILDING span. */
  function addRoofHip(group, w, d, wallH, pitch, overhang, roofMat, tieIn) {
    const oh = overhang / 12;
    const W = w + oh * 2, D = d + oh * 2;
    // Underside at wall line = top plate; top = wallH + ROOF_THICK; tip drops outside.
    const buildingHalfMin = Math.min(w, d) / 2;
    let rise = Math.max(0.15, buildingHalfMin * pitch);
    if (tieIn === 'flat' || tieIn === 'low-slope') rise = Math.max(0.5, buildingHalfMin * 0.08);
    if (tieIn === 'dormer') rise = Math.max(rise, 3);
    const thick = ROOF_THICK;
    const bearingY = wallH;
    const plateY = bearingY + thick; // TOP at wall line
    const tipDrop = (tieIn === 'flat' || tieIn === 'low-slope') ? 0 : oh * pitch;
    const eaveY = plateY - tipDrop;
    const ridgeY = plateY + rise;
    function addFace(corners, indices) {
      const verts = new Float32Array(corners.flat());
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, roofMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: 'roof', label: 'Roof' };
      group.add(mesh);
      // underside for thickness
      const bot = corners.map((c) => [c[0], c[1] - thick, c[2]]);
      const verts2 = new Float32Array(bot.flat());
      const geo2 = new THREE.BufferGeometry();
      geo2.setAttribute('position', new THREE.BufferAttribute(verts2, 3));
      geo2.setIndex(indices);
      geo2.computeVertexNormals();
      const mesh2 = new THREE.Mesh(geo2, roofMat);
      mesh2.castShadow = true;
      mesh2.userData = { type: 'roof', label: 'Roof' };
      group.add(mesh2);
    }
    if (D >= W) {
      const rh = Math.max(0, D / 2 - W / 2);
      const r0 = [0, ridgeY, -rh], r1 = [0, ridgeY, rh];
      addFace([[-W / 2, eaveY, -D / 2], r0, r1, [-W / 2, eaveY, D / 2]], [0, 1, 2, 0, 2, 3]);
      addFace([[W / 2, eaveY, -D / 2], r0, r1, [W / 2, eaveY, D / 2]], [0, 2, 1, 0, 3, 2]);
      addFace([[-W / 2, eaveY, -D / 2], [W / 2, eaveY, -D / 2], r0], [0, 1, 2]);
      addFace([[-W / 2, eaveY, D / 2], [W / 2, eaveY, D / 2], r1], [0, 2, 1]);
    } else {
      const rh = Math.max(0, W / 2 - D / 2);
      const r0 = [-rh, ridgeY, 0], r1 = [rh, ridgeY, 0];
      addFace([[-W / 2, eaveY, -D / 2], r0, r1, [W / 2, eaveY, -D / 2]], [0, 1, 2, 0, 2, 3]);
      addFace([[-W / 2, eaveY, D / 2], r0, r1, [W / 2, eaveY, D / 2]], [0, 2, 1, 0, 3, 2]);
      addFace([[-W / 2, eaveY, -D / 2], [-W / 2, eaveY, D / 2], r0], [0, 1, 2]);
      addFace([[W / 2, eaveY, -D / 2], [W / 2, eaveY, D / 2], r1], [0, 2, 1]);
    }
  }

  function addRoof(group, w, d, wallH, pitch, overhang, roofMat, tieIn, style) {
    if (style === 'hip') addRoofHip(group, w, d, wallH, pitch, overhang, roofMat, tieIn);
    else addRoofGable(group, w, d, wallH, pitch, overhang, roofMat, tieIn);
  }

  function planHasSketch(plan) {
    return !!(plan && ((plan.walls && plan.walls.length) || (plan.rooms && plan.rooms.length)));
  }

  function planBounds(plan) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    const c = (x, y) => { any = true; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    (plan.walls || []).forEach((w) => { c(w.x1, w.y1); c(w.x2, w.y2); });
    (plan.rooms || []).forEach((r) => { c(r.x, r.y); c(r.x + r.w, r.y + r.h); });
    if (plan.existingHouse) {
      const eh = plan.existingHouse;
      c(eh.x, eh.y); c(eh.x + eh.lengthFt, eh.y + eh.widthFt);
    }
    (plan.rooflines || []).forEach((rl) => (rl.points || []).forEach((p) => c(p.x, p.y)));
    (plan.fixtures || []).forEach((f) => {
      if (f.planKind === 'wall' || f.wallId) {
        const w = (plan.walls || []).find((x) => x.id === f.wallId);
        if (w) {
          const t0 = f.t != null ? f.t : 0.5;
          c(w.x1 + (w.x2 - w.x1) * t0, w.y1 + (w.y2 - w.y1) * t0);
        }
      } else if (f.x != null && f.y != null) {
        c(f.x, f.y);
      }
    });
    if (!any) return null;
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      w: maxX - minX, d: maxY - minY };
  }

  /** Addition / remodel footprint only — rooms + walls. Excludes existing house,
   * fixtures, and freehand rooflines so the 3D roof does not span the whole site. */
  function additionBounds(plan) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    const c = (x, y) => { any = true; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    (plan.walls || []).forEach((w) => { c(w.x1, w.y1); c(w.x2, w.y2); });
    (plan.rooms || []).forEach((r) => { c(r.x, r.y); c(r.x + r.w, r.y + r.h); });
    if (!any) return null;
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      w: maxX - minX, d: maxY - minY };
  }

  /** Modest eave only: default 12 in, clamp absurd custom values (cap 36 in). */
  function clampEaveOverhangIn(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 12;
    if (n > 36) return 36;
    return n;
  }

  /** Drop-in fixtures from plan — EXAMPLE massing only (no SKUs). Dims in inches from fixtures stub. */
  function addFixturesFromPlan(plan, ox, oz, group) {
    const list = (plan && plan.fixtures) || [];
    if (!list.length) return;
    const counterMat = mat(0xd4c4b0, { roughness: 0.48, metalness: 0.06 });
    const cabMat = mat(0x7e8890, { roughness: 0.72, metalness: 0.04 });
    const cabFaceMat = mat(0x8a949c, { roughness: 0.68, metalness: 0.04 });
    const seamMat = mat(0x5c646c, { roughness: 0.8, metalness: 0.02 });
    const upperMat = mat(0x9aa4ac, { roughness: 0.7, metalness: 0.04 });
    const sinkMat = mat(0xc8d2d8, { roughness: 0.32, metalness: 0.28 });
    const basinMat = mat(0x6e7a82, { roughness: 0.38, metalness: 0.35 });
    const plateMat = mat(0xf7f3ea, { roughness: 0.62, metalness: 0.05 });
    const plateEdgeMat = mat(0xc8c2b6, { roughness: 0.7, metalness: 0.04 });
    const slotMat = mat(0x2c2c2a, { roughness: 0.55, metalness: 0.1 });
    const switchMat = mat(0xefeae0, { roughness: 0.6, metalness: 0.04 });

    list.forEach((fx0) => {
      const fx = fx0 || {};
      const id = fx.fixtureId || '';
      if (fx.planKind === 'wall' || id === 'outlet_duplex' || id === 'switch_single') {
        const w = (plan.walls || []).find((x) => x.id === fx.wallId);
        if (!w) return;
        const x1 = w.x1 - ox, z1 = w.y1 - oz, x2 = w.x2 - ox, z2 = w.y2 - oz;
        const mx = x1 + (x2 - x1) * (fx.t != null ? fx.t : 0.5);
        const mz = z1 + (z2 - z1) * (fx.t != null ? fx.t : 0.5);
        const ang = Math.atan2(z2 - z1, x2 - x1);
        let nx = -Math.sin(ang), nz = Math.cos(ang);
        if (w.roomId) {
          const room = (plan.rooms || []).find((r) => r.id === w.roomId);
          if (room) {
            const cx = room.x + room.w / 2 - ox;
            const cz = room.y + room.h / 2 - oz;
            if ((cx - mx) * nx + (cz - mz) * nz < 0) { nx = -nx; nz = -nz; }
          }
        }
        const affIn = fx.affIn != null ? Number(fx.affIn) : (id === 'switch_single' ? 48 : 12);
        const aff = affIn / 12;
        const pw = ((fx.plateWIn != null ? fx.plateWIn : 2.75) / 12);
        const ph = ((fx.plateHIn != null ? fx.plateHIn : 4.5) / 12);
        const thick = 0.045;
        const face = 0.25;
        const g = new THREE.Group();
        g.position.set(mx + nx * face, aff, mz + nz * face);
        g.rotation.y = -ang;
        g.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        // Plate body (bright) + slight edge frame for contrast
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(pw, ph, thick),
          id === 'switch_single' ? switchMat : plateMat
        );
        plate.castShadow = true;
        plate.receiveShadow = true;
        g.add(plate);
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(pw + 0.02, ph + 0.02, thick * 0.5),
          plateEdgeMat
        );
        edge.position.z = -thick * 0.15;
        g.add(edge);
        if (id === 'outlet_duplex' || (!id && fx.planKind === 'wall')) {
          // Two dark duplex slots for readable contrast
          const sw = pw * 0.28, sh = ph * 0.28, sd = 0.02;
          [[-ph * 0.18], [ph * 0.18]].forEach((yy) => {
            const slot = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), slotMat);
            slot.position.set(0, yy[0], thick / 2 + 0.005);
            g.add(slot);
          });
        } else if (id === 'switch_single') {
          const tog = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.22, ph * 0.35, 0.025), slotMat);
          tog.position.set(0, 0, thick / 2 + 0.01);
          g.add(tog);
        }
        group.add(g);
        return;
      }

      const widthFt = (fx.widthIn != null ? fx.widthIn : 24) / 12;
      const depthFt = (fx.depthIn != null ? fx.depthIn : 24) / 12;
      const cx = (fx.x != null ? fx.x : 0) - ox;
      const cz = (fx.y != null ? fx.y : 0) - oz;
      const rot = fx.rot || 0;

      if (id === 'counter_base') {
        const thick = ((fx.thicknessIn != null ? fx.thicknessIn : 1.5) / 12);
        const topAff = ((fx.heightIn != null ? fx.heightIn : 36) / 12);
        const over = ((fx.overhangIn != null ? fx.overhangIn : 1) / 12);
        const d = depthFt + over;
        const ang = rot;
        const nx = -Math.sin(ang), nz = Math.cos(ang);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(widthFt, thick, d), counterMat);
        mesh.position.set(cx + nx * (over / 2), topAff - thick / 2, cz + nz * (over / 2));
        mesh.rotation.y = -rot;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        group.add(mesh);
        // Thin front edge lip for counter readability
        const lip = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.98, thick * 0.35, 0.02),
          mat(0xb8a890, { roughness: 0.5, metalness: 0.05 })
        );
        lip.position.set(cx + nx * (d / 2 - 0.01), topAff - thick * 0.7, cz + nz * (d / 2 - 0.01));
        lip.rotation.y = -rot;
        lip.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        group.add(lip);
        return;
      }

      if (id === 'cab_base') {
        const h = ((fx.heightIn != null ? fx.heightIn : 34.5) / 12);
        const g = new THREE.Group();
        g.position.set(cx, 0, cz);
        g.rotation.y = -rot;
        g.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        const body = new THREE.Mesh(new THREE.BoxGeometry(widthFt, h, depthFt), cabMat);
        body.position.y = h / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);
        // Door face slightly proud + center seam
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.96, h * 0.9, 0.03),
          cabFaceMat
        );
        face.position.set(0, h / 2, depthFt / 2 + 0.01);
        g.add(face);
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, h * 0.82, 0.035),
          seamMat
        );
        seam.position.set(0, h / 2, depthFt / 2 + 0.025);
        g.add(seam);
        // Toe kick recess cue
        const kick = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.98, 0.3, depthFt * 0.85),
          mat(0x3a3e42, { roughness: 0.9 })
        );
        kick.position.set(0, 0.15, -0.02);
        g.add(kick);
        group.add(g);
        return;
      }

      if (id === 'cab_upper') {
        const h = ((fx.heightIn != null ? fx.heightIn : 30) / 12);
        const bottom = ((fx.bottomAffIn != null ? fx.bottomAffIn : 54) / 12);
        const g = new THREE.Group();
        g.position.set(cx, bottom, cz);
        g.rotation.y = -rot;
        g.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        const body = new THREE.Mesh(new THREE.BoxGeometry(widthFt, h, depthFt), upperMat);
        body.position.y = h / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.95, h * 0.9, 0.025),
          cabFaceMat
        );
        face.position.set(0, h / 2, depthFt / 2 + 0.01);
        g.add(face);
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, h * 0.8, 0.03),
          seamMat
        );
        seam.position.set(0, h / 2, depthFt / 2 + 0.022);
        g.add(seam);
        group.add(g);
        return;
      }

      if (id === 'sink_kitchen' || id === 'sink_bar' || id === 'sink_bath') {
        const topAff = 36 / 12;
        const basinD = Math.min(depthFt * 0.72, widthFt * 0.8);
        const basinW = Math.min(widthFt * 0.72, depthFt * 1.0);
        const bowlH = id === 'sink_bar' ? 0.45 : 0.58;
        const g = new THREE.Group();
        g.position.set(cx, 0, cz);
        g.rotation.y = -rot;
        g.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        // Rim frame (4 sides) + dark cutout overlay so opening reads over solid counter
        const rimH = 0.06;
        const rimY = topAff - rimH / 2 + 0.02; // sit slightly above counter top
        const rw = (widthFt - basinW) / 2;
        const rd = (depthFt - basinD) / 2;
        const rimParts = [
          { w: widthFt, d: Math.max(0.04, rd), x: 0, z: -(depthFt / 2 - rd / 2) },
          { w: widthFt, d: Math.max(0.04, rd), x: 0, z: (depthFt / 2 - rd / 2) },
          { w: Math.max(0.04, rw), d: basinD, x: -(widthFt / 2 - rw / 2), z: 0 },
          { w: Math.max(0.04, rw), d: basinD, x: (widthFt / 2 - rw / 2), z: 0 },
        ];
        rimParts.forEach((p) => {
          const rim = new THREE.Mesh(new THREE.BoxGeometry(p.w, rimH, p.d), sinkMat);
          rim.position.set(p.x, rimY, p.z);
          rim.castShadow = true;
          g.add(rim);
        });
        // Recessed dark opening (covers counter albedo in basin aperture)
        const aperture = new THREE.Mesh(
          new THREE.BoxGeometry(basinW, 0.05, basinD),
          mat(0x2a3238, { roughness: 0.55, metalness: 0.35 })
        );
        aperture.position.set(0, topAff - 0.01, 0);
        g.add(aperture);
        // Basin walls (deeper bowl)
        const wallT = 0.04;
        const bwY = topAff - rimH - bowlH / 2;
        [
          { w: basinW, d: wallT, x: 0, z: -basinD / 2 + wallT / 2 },
          { w: basinW, d: wallT, x: 0, z: basinD / 2 - wallT / 2 },
          { w: wallT, d: basinD, x: -basinW / 2 + wallT / 2, z: 0 },
          { w: wallT, d: basinD, x: basinW / 2 - wallT / 2, z: 0 },
        ].forEach((p) => {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, bowlH, p.d), basinMat);
          wall.position.set(p.x, bwY, p.z);
          g.add(wall);
        });
        // Bowl floor
        const floor = new THREE.Mesh(
          new THREE.BoxGeometry(basinW - wallT * 2, 0.04, basinD - wallT * 2),
          mat(0x3e484e, { roughness: 0.42, metalness: 0.45 })
        );
        floor.position.set(0, topAff - rimH - bowlH + 0.02, 0);
        g.add(floor);
        group.add(g);
        return;
      }
    });
  }

  function buildFromPlan(plan, store, opts) {
    ensure();
    const keepCam = !!(opts && opts.preserveCamera) || preserveCamera;
    const camPos = keepCam ? camera.position.clone() : null;
    const camTarget = keepCam ? controls.target.clone() : null;
    const prevSel = selectedWinId;

    hidePartTag();
    clearLongPress();
    longPressShown = false;
    clearRoot();
    rootGroup = new THREE.Group();
    scene.add(rootGroup);
    framingRoot = new THREE.Group();
    framingRoot.userData = { type: 'framingRoot' };
    rootGroup.add(framingRoot);
    labelGroup = new THREE.Group();
    labelGroup.visible = showDims;
    rootGroup.add(labelGroup);

    lastPlan = plan;
    lastStore = store;
    store = store || (window.HomePlanGuide && window.HomePlanGuide.build3DStore({})) || {};
    const wallH = store.wall_height_ft || 8;
    const pitch = (plan && plan.roofPitch != null) ? plan.roofPitch
      : (store.roof_pitch || 4 / 12);
    const roofStyle = (plan && plan.roofStyle) || store.roof_style || 'gable';
    const eaveIn = clampEaveOverhangIn(store.eave_overhang_in != null ? store.eave_overhang_in : 12);
    const cladKey = store.cladding_texture || 'fiber';
    const roofKey = store.roofing_texture || 'asphalt';
    const lowSlope = pitch <= (2 / 12) || store.roof_tie_in === 'flat' || store.roof_tie_in === 'low-slope';

    // §2 materials from Guidance answers only (named presets + procedural maps)
    const wallMat = cladMaterial(cladKey);
    const lumberMat = mat(0xc9a66b, { roughness: 0.9, metalness: 0.02 });
    const roofMat = roofMaterial(roofKey, { lowSlope });
    const floorMat = floorMaterial('wood');
    const glassMat = glassMaterial();
    const frameMat = frameMaterial();
    const houseMat = cladMaterial('stucco'); // existing mass — neutral until house B7 drives it
    const foundKey = store.foundation_type || 'slab';
    const foundMat = foundMaterial(foundKey === 'piers' ? 'piers' : foundKey);
    const beamMat = mat(0x7a746c, { roughness: 0.88 });
    const attachMat = mat(0x2f6f6a, { emissive: 0x1a3d3a, emissiveIntensity: 0.12 });
    const frameWallMat = showStuds ? lumberMat : wallMat;
    const steelMat = steelMaterial();
    // Educational floor framing: default ON for all foundations unless user overrode
    if (!floorFramingManual) {
      showFloorFraming = defaultFloorFramingFor(foundKey);
    }
    if (floorFramingToggle) floorFramingToggle.checked = !!showFloorFraming;
    const paintMat = paintMaterial();
    const ceilingMat = ceilingMaterial();
    const baseboardMat = baseboardMaterial();
    const junctionMat = junctionMaterial();
    const interiorMats = { paint: paintMat, ceiling: ceilingMat, baseboard: baseboardMat, junction: junctionMat };
    const lightCenters = []; // filled while building rooms / footprint

    if (defaultsChip) {
      const using = (store.usingDefaults || []).length > 0;
      defaultsChip.hidden = !using;
    }

    const sketch = planHasSketch(plan);
    const remodel = !!store.remodel_only;
    const trulyEmpty = !sketch && remodel;
    if (emptyEl) {
      emptyEl.hidden = !trulyEmpty;
      if (trulyEmpty) {
        emptyEl.querySelector('p').textContent =
          'Draw rooms or walls on the Plan tab for a remodel preview — or switch project type to addition in Guidance.';
      }
    }
    if (canvasHost) canvasHost.style.opacity = trulyEmpty ? '0.3' : '1';

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      mat(0x6f7a5e, { roughness: 0.98 }) // muted grass/gravel
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    ground.userData = { type: 'ground' };
    rootGroup.add(ground);
    const grid = new THREE.GridHelper(80, 40, 0xb8c0b8, 0xd0d6ce);
    grid.position.y = 0;
    rootGroup.add(grid);

    if (trulyEmpty) {
      onResize();
      updateInspector(null);
      return;
    }

    let focusY = wallH * 0.4;
    let span = 24;

    if (sketch) {
      const b = planBounds(plan);
      const ox = b.cx, oz = b.cy;
      planOrigin = { ox, oz };
      span = Math.max(b.w, b.d, 14) + 8;

      (plan.rooms || []).forEach((r) => {
        const fw = Math.abs(r.w), fd = Math.abs(r.h);
        // Opaque finish flooring hides I-beams from above — omit when Floor framing is on
        if (!showFloorFraming) {
          const fmesh = boxAt(fw, 0.14, fd,
            r.x + r.w / 2 - ox, 0.07, r.y + r.h / 2 - oz, floorMat, rootGroup);
          if (fmesh) {
            fmesh.userData = { type: 'floor', label: 'Floor' };
            applyPlanarXZUVs(fmesh, 0.4);
          }
        }
        // Room-center warm fill near ceiling (absolute y; pier lift moves group later)
        const rh = wallH;
        lightCenters.push({
          x: r.x + r.w / 2 - ox,
          y: rh * 0.88,
          z: r.y + r.h / 2 - oz,
          radius: Math.max(fw, fd) * 0.55,
        });
        if (showDims) {
          makeLabel(
            (r.name ? r.name + ' · ' : '') + fmtFt(fw) + ' × ' + fmtFt(fd),
            r.x + r.w / 2 - ox, 0.9, r.y + r.h / 2 - oz, labelGroup, 3.2
          );
        }
      });

      if (plan.existingHouse) {
        const eh = plan.existingHouse;
        const ehH = 9;
        boxAt(eh.lengthFt, ehH, eh.widthFt,
          eh.x + eh.lengthFt / 2 - ox, ehH / 2, eh.y + eh.widthFt / 2 - oz,
          houseMat, rootGroup);
        addRoofGable(
          (() => { const g = new THREE.Group(); g.position.set(eh.x + eh.lengthFt / 2 - ox, 0, eh.y + eh.widthFt / 2 - oz); rootGroup.add(g); return g; })(),
          eh.lengthFt, eh.widthFt, ehH, 5 / 12, 12, mat(0x5c5048, { side: THREE.DoubleSide }), 'separate'
        );
        if (showDims) {
          makeLabel('Existing · ' + fmtFt(eh.lengthFt) + ' × ' + fmtFt(eh.widthFt),
            eh.x + eh.lengthFt / 2 - ox, ehH + 1.2, eh.y + eh.widthFt / 2 - oz, labelGroup, 3.5);
        }
      }

      // Normalize windows against store defaults
      const winsNorm = (plan.windows || []).map((w) => normalizeWin(w, store));
      const winsByWall = new Map();
      winsNorm.forEach((win) => {
        if (!winsByWall.has(win.wallId)) winsByWall.set(win.wallId, []);
        winsByWall.get(win.wallId).push(win);
      });

      // Detect rooms that can use continuous extrude (uniform height, closed rect)
      // Stud mode skips solid extrude — open framing on every wall instead.
      const extrudedWallIds = new Set();
      // Plate height for roof = max of walls that actually carry the addition roof
      // (per-wall heightFt). Do NOT seed with store.wall_height_ft — that leaves the
      // roof floating when Guidance height > drawn wall heights.
      let maxWallH = 0;

      if (!showStuds) {
        (plan.rooms || []).forEach((room) => {
          const linked = (plan.walls || []).filter((w) => w.roomId === room.id);
          if (linked.length < 4) return;
          const heights = linked.map((w) => (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH);
          const h0 = heights[0];
          const uniform = heights.every((h) => Math.abs(h - h0) < 0.05);
          // Prefer continuous extrude for flush corners; windows overlay as framed openings
          if (uniform && Math.abs(room.w) > WALL_THICK * 2.5 && Math.abs(room.h) > WALL_THICK * 2.5) {
            extrudeRoomRing(room.x - ox, room.y - oz, room.w, room.h, h0, wallMat, rootGroup);
            linked.forEach((w) => extrudedWallIds.add(w.id));
            if (h0 > maxWallH) maxWallH = h0;
            if (showDims) {
              makeLabel('H ' + fmtFt(h0), room.x + room.w - ox + 0.6, h0 / 2, room.y - oz - 0.6, labelGroup, 2.4);
            }
          }
        });
      } else {
        (plan.rooms || []).forEach((room) => {
          const linked = (plan.walls || []).filter((w) => w.roomId === room.id);
          if (!linked.length) return;
          const heights = linked.map((w) => (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH);
          const h0 = Math.max(...heights);
          if (h0 > maxWallH) maxWallH = h0;
          if (showDims) {
            makeLabel('H ' + fmtFt(h0), room.x + room.w - ox + 0.6, h0 / 2, room.y - oz - 0.6, labelGroup, 2.4);
          }
        });
      }

      // Junction / corner posts for non-extruded walls (shared endpoints)
      const junctions = new Map();
      (plan.walls || []).forEach((w) => {
        if (extrudedWallIds.has(w.id)) return;
        const h = (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH;
        if (h > maxWallH) maxWallH = h;
        [[w.x1 - ox, w.y1 - oz], [w.x2 - ox, w.y2 - oz]].forEach(([x, z]) => {
          const k = keyPt(x, z);
          let j = junctions.get(k);
          if (!j) { j = { x, z, maxH: h }; junctions.set(k, j); }
          else j.maxH = Math.max(j.maxH, h);
        });
      });
      junctions.forEach((j) => {
        cornerPostAt(j.x, j.z, j.maxH, frameWallMat, framingRoot);
      });

      // Free / room walls not covered by extrude (or all walls in stud mode)
      (plan.walls || []).forEach((w) => {
        if (extrudedWallIds.has(w.id)) return;
        const h = (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH;
        const x1 = w.x1 - ox, z1 = w.y1 - oz, x2 = w.x2 - ox, z2 = w.y2 - oz;
        const openings = winsByWall.get(w.id) || [];
        if (showStuds) {
          buildStudWall(x1, z1, x2, z2, h, openings, frameWallMat, framingRoot);
          openings.forEach((win) => {
            buildRoughOpeningFraming(x1, z1, x2, z2, h, win, frameWallMat, framingRoot);
          });
        } else {
          buildOpenWall(x1, z1, x2, z2, h, openings, wallMat, rootGroup);
        }

        if (showDims) {
          const len = Math.hypot(x2 - x1, z2 - z1);
          const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
          makeLabel(fmtFt(len), mx, h + 0.55, mz, labelGroup, 2.0);
          makeLabel(fmtFt(h) + ' H', mx, h * 0.55, mz, labelGroup, 1.7);
        }
      });

      // Finished interior: paint liners, baseboards, ceilings (Studs OFF only)
      if (!showStuds) {
        (plan.rooms || []).forEach((room) => {
          const linked = (plan.walls || []).filter((w) => w.roomId === room.id);
          const heights = linked.map((w) => (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH);
          const h0 = heights.length ? Math.max(...heights) : wallH;
          addRoomInteriorFinish(room.x - ox, room.y - oz, room.w, room.h, h0, rootGroup, interiorMats);
        });
        // Baseboard on free walls not belonging to a room
        (plan.walls || []).forEach((w) => {
          if (w.roomId) return;
          const h = (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH;
          if (h < 2) return;
          addWallBaseboard(w.x1 - ox, w.y1 - oz, w.x2 - ox, w.y2 - oz, rootGroup, baseboardMat);
        });
      }

      // Height labels for extruded rooms' walls (length)
      (plan.rooms || []).forEach((room) => {
        const linked = (plan.walls || []).filter((w) => w.roomId === room.id && extrudedWallIds.has(w.id));
        linked.forEach((w) => {
          if (!showDims) return;
          const x1 = w.x1 - ox, z1 = w.y1 - oz, x2 = w.x2 - ox, z2 = w.y2 - oz;
          const len = Math.hypot(x2 - x1, z2 - z1);
          const h = (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH;
          makeLabel(fmtFt(len), (x1 + x2) / 2, h + 0.55, (z1 + z2) / 2, labelGroup, 2.0);
        });
      });

      // Interactive framed windows
      winsNorm.forEach((win) => {
        const w = (plan.walls || []).find((x) => x.id === win.wallId);
        if (!w) return;
        const x1 = w.x1 - ox, z1 = w.y1 - oz, x2 = w.x2 - ox, z2 = w.y2 - oz;
        const wallLen = Math.hypot(x2 - x1, z2 - z1);
        const wallHeight = (w.heightFt != null && w.heightFt > 0) ? w.heightFt : wallH;
        const mx = x1 + (x2 - x1) * win.t;
        const mz = z1 + (z2 - z1) * win.t;
        const ang = Math.atan2(z2 - z1, x2 - x1);
        const sill = Math.max(0, Math.min(win.sillFt, wallHeight - 0.5));
        const wh = Math.min(win.heightFt, wallHeight - sill - 0.15);
        const ww = Math.min(win.widthFt, wallLen * 0.9);
        addFramedOpening(mx, mz, ang, ww, wh, sill, glassMat, frameMat, rootGroup, win.id, {
          openingType: win.openingType, autoShared: win.autoShared,
        });
        if (showDims) {
          makeLabel(fmtFt(ww) + ' × ' + fmtFt(wh), mx, sill + wh + 0.7, mz, labelGroup, 1.9);
        }
      });

      // Fixtures (counters / cabinets / sinks / outlets) — before pier lift
      addFixturesFromPlan(plan, ox, oz, rootGroup);

      if (store.has_large_opening && (plan.walls || []).length) {
        let longest = plan.walls[0], best = 0;
        plan.walls.forEach((w) => {
          const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
          if (L > best) { best = L; longest = w; }
        });
        openingOnWall(
          longest.x1 - ox, longest.y1 - oz, longest.x2 - ox, longest.y2 - oz,
          wallH, (store.large_opening_w_ft || 8) * 12, (store.large_opening_h_ft || 6.67) * 12,
          0, glassMat, frameMat, rootGroup
        );
      }

      if (!(maxWallH > 0)) maxWallH = wallH;
      focusY = maxWallH * 0.4;

      if (store.show_roof !== false) {
        // Roof footprint = addition rooms/walls only (existing house keeps its own roof).
        // Extra size beyond walls comes solely from eave_overhang_in (modest, clamped).
        // Vertical: eave/plate at maxWallH (addition top plate); pier lift raises group later.
        const ab = additionBounds(plan) || b;
        // Bounds follow wall centerlines; expand by WALL_THICK so outer stud faces
        // stay at/inside the wall-line bearing (not in the dropping overhang zone).
        const roofW = Math.max(ab.w, 1) + WALL_THICK;
        const roofD = Math.max(ab.d, 1) + WALL_THICK;
        const gRoof = new THREE.Group();
        gRoof.position.set(ab.cx - ox, 0, ab.cy - oz);
        gRoof.userData = { type: 'additionRoof' };
        addRoof(gRoof, roofW, roofD, maxWallH, pitch, eaveIn, roofMat, store.roof_tie_in, roofStyle);
        rootGroup.add(gRoof);
      }

      const ridgeMat = mat(0xb05a3c);
      (plan.rooflines || []).forEach((rl) => {
        const pts = rl.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], bpt = pts[i + 1];
          const len = Math.hypot(bpt.x - a.x, bpt.y - a.y);
          if (len < 0.1) continue;
          const rise = Math.max(2.5, (Math.max(b.w, b.d) / 2) * pitch);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.3), ridgeMat);
          mesh.position.set((a.x + bpt.x) / 2 - ox, maxWallH + rise, (a.y + bpt.y) / 2 - oz);
          mesh.rotation.y = -Math.atan2(bpt.y - a.y, bpt.x - a.x);
          rootGroup.add(mesh);
        }
      });

      if (store.skylights) {
        boxAt(2, 0.15, 2, 0, maxWallH + 1.5, 0, glassMat, rootGroup);
      }

      // Conceptual floor framing / I-beams under floor plane (EXAMPLE spacing)
      if (showFloorFraming) {
        const bb = planBounds(plan);
        if (bb) {
          addFloorFraming(0, 0, Math.max(bb.w, 6), Math.max(bb.d, 6), rootGroup, steelMat, {
            topY: -0.02,
          });
        }
      }

      // Foundation under sketch footprint (reveal / stem / piers)
      if (store.show_foundation !== false) {
        const ft = store.foundation_type || 'slab';
        const bb = planBounds(plan);
        if (bb && ft === 'piers') {
          const pierH = store.pier_height_ft > 0 ? store.pier_height_ft : PIER_H_DEFAULT;
          addPierFoundation(0, 0, Math.max(bb.w, 6), Math.max(bb.d, 6), pierH, foundMat, beamMat, rootGroup, {
            walls: plan.walls || [],
            ox: ox,
            oz: oz,
          });
          // Elevate building content onto pier tops (leave ground/grid/piers)
          [...rootGroup.children].forEach((ch) => {
            if (!ch) return;
            if (ch.type === 'GridHelper' || ch.type === 'Mesh' && ch.geometry && ch.geometry.type === 'PlaneGeometry') return;
            if (ch.userData && ch.userData.type === 'pierFoundation') return;
            // ground plane is first Mesh PlaneGeometry — also skip by material color check via userData
            if (ch.userData && ch.userData.type === 'ground') return;
            ch.position.y += pierH;
          });
        } else if (bb && ft === 'slab') {
          // Framing on: thin pad below I-beams so members read from above.
          // Framing off: normal ~9 in reveal under finish floor.
          if (showFloorFraming) {
            const padH = 0.2;
            const beamBot = -0.02 - FLOOR_IBEAM_H;
            boxAt(Math.max(bb.w, 4) + 0.5, padH, Math.max(bb.d, 4) + 0.5,
              0, beamBot - padH / 2 - 0.02, 0, foundMat, rootGroup,
              { type: 'foundation', label: 'Foundation' });
          } else {
            boxAt(Math.max(bb.w, 4) + 0.5, FOUND_REVEAL_SLAB, Math.max(bb.d, 4) + 0.5,
              0, -FOUND_REVEAL_SLAB / 2, 0, foundMat, rootGroup,
              { type: 'foundation', label: 'Foundation' });
          }
        } else if (bb && ft === 'crawl') {
          // Hollow stem ring — crawl volume open so I-beams / joists read
          addStemWallRing(0, 0, Math.max(bb.w, 4) + 0.5, Math.max(bb.d, 4) + 0.5, 2.5, -2.5, foundMat, rootGroup);
        } else if (bb && ft === 'basement') {
          addStemWallRing(0, 0, Math.max(bb.w, 4) + 0.5, Math.max(bb.d, 4) + 0.5, 8, -8, foundMat, rootGroup);
        }
      }
    } else {
      // Parametric addition massing
      const L = store.footprint_l_ft || 12;
      const W = store.footprint_w_ft || 16;
      const side = store.attach_side || 'back';
      span = Math.max(L, W, 20) + 30;

      const eh = plan.existingHouse;
      const houseL = eh ? eh.lengthFt : 40, houseW = eh ? eh.widthFt : 30, houseH = 9;
      boxAt(houseL, houseH, houseW, 0, houseH / 2, 0, houseMat, rootGroup);
      addRoofGable(rootGroup, houseL, houseW, houseH, 5 / 12, 12, mat(0x5c5048, { side: THREE.DoubleSide }), 'separate');

      let ax = 0, az = 0;
      let addL = L, addW = W;
      if (side === 'back') { ax = 0; az = houseW / 2 + addW / 2; }
      else if (side === 'front') { ax = 0; az = -(houseW / 2 + addW / 2); }
      else if (side === 'left') { ax = -(houseL / 2 + addW / 2); az = 0; addL = W; addW = L; }
      else if (side === 'right') { ax = houseL / 2 + addW / 2; az = 0; addL = W; addW = L; }
      else { ax = houseL / 2 + addW / 4; az = houseW / 2 + addW / 4; }

      const ft = store.foundation_type || 'slab';
      let floorY = store.floor_align === 'no' ? 0.5 : 0;
      if (ft === 'piers') {
        floorY = (store.pier_height_ft > 0 ? store.pier_height_ft : PIER_H_DEFAULT)
          + (store.floor_align === 'no' ? 0.25 : 0);
      }

      if (store.show_foundation !== false) {
        if (ft === 'piers') {
          const pierH = store.pier_height_ft > 0 ? store.pier_height_ft : PIER_H_DEFAULT;
          addPierFoundation(ax, az, addL, addW, pierH, foundMat, beamMat, rootGroup);
        } else if (ft === 'slab') {
          // Framing on: thin pad under I-beams (beams readable from above).
          // Framing off: 4–12 in reveal below cladding line + finish floor.
          if (showFloorFraming) {
            const padH = 0.2;
            const beamBot = floorY - 0.02 - FLOOR_IBEAM_H;
            boxAt(addL + 0.5, padH, addW + 0.5, ax, beamBot - padH / 2 - 0.02, az, foundMat, rootGroup,
              { type: 'foundation', label: 'Foundation' });
          } else {
            boxAt(addL + 0.5, FOUND_REVEAL_SLAB, addW + 0.5, ax, floorY - FOUND_REVEAL_SLAB / 2, az, foundMat, rootGroup,
              { type: 'foundation', label: 'Foundation' });
          }
        } else if (ft === 'crawl') {
          addStemWallRing(ax, az, addL + 0.5, addW + 0.5, 2.5, floorY - 2.5, foundMat, rootGroup);
        } else if (ft === 'basement') {
          addStemWallRing(ax, az, addL + 0.5, addW + 0.5, 8, floorY - 8, foundMat, rootGroup);
        }
      }

      // Opaque finish flooring hides I-beams from above — omit when Floor framing is on.
      // Slab keeps thin concrete foundation reveal below; fixtures stay at same Y (beam plane).
      if (!showFloorFraming) {
        const fmesh = boxAt(addL, 0.15, addW, ax, floorY + 0.08, az, floorMat, rootGroup);
        if (fmesh) {
          fmesh.userData = { type: 'floor', label: 'Floor' };
          applyPlanarXZUVs(fmesh, 0.4);
        }
      }
      if (showFloorFraming) {
        // World-space under elevated floor (respects pier floorY)
        const fg = new THREE.Group();
        fg.position.set(ax, floorY, az);
        rootGroup.add(fg);
        addFloorFraming(0, 0, addL, addW, fg, steelMat, { topY: -0.02 });
      }
      lightCenters.push({
        x: ax, y: floorY + wallH * 0.88, z: az,
        radius: Math.max(addL, addW) * 0.55,
      });

      const x0 = ax - addL / 2, x1 = ax + addL / 2;
      const z0 = az - addW / 2, z1 = az + addW / 2;
      const addGroup = new THREE.Group();
      addGroup.position.y = floorY;
      rootGroup.add(addGroup);
      let attachIdx = 0;
      if (side === 'back') attachIdx = 0;
      if (side === 'front') attachIdx = 2;
      if (side === 'left') attachIdx = 1;
      if (side === 'right') attachIdx = 3;
      const segs = [
        [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0],
      ];
      const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      if (showStuds) {
        // Open stud framing ring + corner posts (flush plates/posts)
        corners.forEach(([cx, cz]) => cornerPostAt(cx, cz, wallH, frameWallMat, addGroup));
        segs.forEach((s) => {
          buildStudWall(s[0], s[1], s[2], s[3], wallH, [], frameWallMat, addGroup);
        });
      } else {
        // Continuous extrude ring for parametric addition (flush corners)
        extrudeRoomRing(x0, z0, addL, addW, wallH, wallMat, addGroup);
      }
      const as = segs[attachIdx];
      // Attach highlight — thin finished strip even in stud mode so connection reads
      if (!showStuds) {
        wallSegSolid(as[0], as[1], as[2], as[3], wallH, attachMat, addGroup, 0);
        // Paint / ceiling / baseboard in addition local space (floorY applied via addGroup)
        addRoomInteriorFinish(x0, z0, addL, addW, wallH, addGroup, interiorMats);
      } else {
        // Subtle attach tint as thinner overlay on the attach plate line
        lumberAlong(as[0], as[1], as[2], as[3], 0.05, 0.95, wallH * 0.35, wallH * 0.55, attachMat, addGroup, WALL_THICK + 0.06);
      }

      if (showDims) {
        makeLabel(fmtFt(addL) + ' × ' + fmtFt(addW), ax, floorY + 1.0, az, labelGroup, 3.0);
        makeLabel(fmtFt(wallH) + ' H', ax + addL / 2 + 0.8, floorY + wallH / 2, az, labelGroup, 2.2);
      }

      if (store.connect_type === 'open_wall' || store.has_large_opening) {
        const ow = store.has_large_opening ? (store.large_opening_w_ft || 8) * 12 : Math.min(addL, 8) * 12;
        openingOnWall(as[0], as[1], as[2], as[3], wallH, ow, (store.large_opening_h_ft || 6.67) * 12, 0, glassMat, frameMat, addGroup);
      } else {
        openingOnWall(as[0], as[1], as[2], as[3], wallH,
          store.opening_preset_door_w_in || 36, store.opening_preset_door_h_in || 80, 0, glassMat, frameMat, addGroup);
      }

      const exterior = segs.filter((_, i) => i !== attachIdx);
      const doors = store.door_types || [];
      let doorCount = 0;
      if (doors.includes('one_entry')) doorCount = 1;
      if (doors.includes('two_plus') || doors.includes('sliding') || doors.includes('french')) doorCount = Math.max(doorCount, doors.includes('two_plus') ? 2 : 1);
      if (!doors.length || doors.includes('unsure')) doorCount = 1;
      if (doors.includes('none')) doorCount = 0;

      for (let i = 0; i < doorCount && i < exterior.length; i++) {
        const s = exterior[i];
        let dw = store.opening_preset_door_w_in || 36;
        let dh = store.opening_preset_door_h_in || 80;
        if (doors.includes('sliding') || doors.includes('french')) { dw = 72; dh = 84; }
        openingOnWall(s[0], s[1], s[2], s[3], wallH, dw, dh, 0, glassMat, frameMat, addGroup);
      }

      let winLeft = store.window_count || 0;
      exterior.forEach((s) => {
        if (winLeft <= 0) return;
        openingOnWall(s[0], s[1], s[2], s[3], wallH,
          store.opening_preset_win_w_in || 36, store.opening_preset_win_h_in || 48, 2.5, glassMat, frameMat, addGroup);
        winLeft--;
      });
      while (winLeft > 0 && exterior.length) {
        const s = exterior[winLeft % exterior.length];
        openingOnWall(s[0], s[1], s[2], s[3], wallH,
          store.opening_preset_win_w_in || 36, store.opening_preset_win_h_in || 48, 2.5, glassMat, frameMat, addGroup);
        winLeft--;
      }

      if (store.show_roof !== false) {
        const g = new THREE.Group();
        g.position.set(ax, floorY, az);
        addRoof(g, addL, addW, wallH, pitch, eaveIn, roofMat, store.roof_tie_in, roofStyle);
        rootGroup.add(g);
      }

      if (store.skylights) {
        boxAt(2, 0.15, 2, ax, floorY + wallH + 2, az, glassMat, rootGroup);
      }

      if (!keepCam) controls.target.set(ax / 2, floorY + wallH * 0.4, az / 2);
      focusY = floorY + wallH * 0.4;
    }

    // Warm interior fills at room / footprint centers near ceiling (capped; mobile-dimmed)
    if (!lightCenters.length) {
      lightCenters.push({ x: 0, y: Math.max(3, wallH * 0.88), z: 0, radius: 12 });
    }
    // If piers elevated sketch content, bump light Y to match pier lift
    if (sketch && store && store.foundation_type === 'piers') {
      const pierH = store.pier_height_ft > 0 ? store.pier_height_ft : PIER_H_DEFAULT;
      lightCenters.forEach((c) => { c.y += pierH; });
    }
    placeInteriorLights(lightCenters, { studs: showStuds });
    applyShadowMode();

    if (!keepCam) {
      if (sketch) controls.target.set(0, focusY, 0);
      camera.position.set(span * 0.9, span * 0.65, span * 0.95);
    } else if (camPos && camTarget) {
      camera.position.copy(camPos);
      controls.target.copy(camTarget);
    }
    controls.update();
    onResize();

    if (prevSel && windowMeshes.has(prevSel)) {
      selectWindow(prevSel, { silent: true });
    } else {
      selectedWinId = null;
      updateInspector(null);
    }
    preserveCamera = false;
  }

  // ---- Part tag / long-press naming ----
  const SKIP_TAG_TYPES = new Set(['ground', 'framingRoot', 'roFraming', 'winHandle']);

  function formatHeightFt(ft) {
    if (ft == null || !isFinite(ft) || ft <= 0) return null;
    const n = Math.round(Number(ft) * 10) / 10;
    if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n)) + ' ft';
    return String(n) + ' ft';
  }

  function fixturePlainName(fixtureId) {
    const map = {
      outlet_duplex: 'Outlet',
      switch_single: 'Switch',
      counter_base: 'Counter',
      cab_base: 'Base cabinet',
      cab_upper: 'Upper cabinet',
      sink_kitchen: 'Kitchen sink',
      sink_bar: 'Bar sink',
      sink_bath: 'Bath sink',
    };
    return map[fixtureId] || 'Fixture';
  }

  function formatPartLabel(ud) {
    if (!ud || !ud.type) return null;
    if (SKIP_TAG_TYPES.has(ud.type)) return null;
    if (ud.label && typeof ud.label === 'string' && ud.label.trim()) {
      // Prefer explicit label except for studs (format height from plan)
      if (ud.type !== 'stud') return ud.label.trim();
    }
    const wallH = (ud.wallHeightFt != null && ud.wallHeightFt > 0)
      ? ud.wallHeightFt
      : ((lastStore && lastStore.wall_height_ft) || null);
    switch (ud.type) {
      case 'stud': {
        if (ud.role === 'jack' || (ud.label && /jack/i.test(ud.label))) return 'Jack stud';
        if (ud.role === 'king') {
          const h = formatHeightFt(wallH);
          return h ? (h + ' stud') : 'King stud';
        }
        const h = formatHeightFt(wallH);
        return h ? (h + ' stud') : 'Stud';
      }
      case 'cripple': return 'Cripple stud';
      case 'bottomPlate': return 'Bottom plate';
      case 'topPlate': return 'Top plate';
      case 'header': return 'Header';
      case 'sill': return 'Rough sill';
      case 'windowSill': return 'Window sill';
      case 'cornerPost': return 'Corner post';
      case 'cladding': return 'Cladding';
      case 'roof': return 'Roof';
      case 'floorIBeam': return ud.label || 'Floor I-beam';
      case 'floorFraming': return 'Floor framing';
      case 'pier': return ud.label || 'Pier / sonotube';
      case 'pierFoundation': return 'Pier / sonotube';
      case 'gradeBeam': return 'Grade beam';
      case 'foundation': return ud.label || 'Foundation';
      case 'floor': return 'Floor';
      case 'ceiling': return 'Ceiling';
      case 'baseboard': return 'Baseboard';
      case 'paintLiner': return 'Interior wall';
      case 'floorJunction': return 'Floor junction';
      case 'window': {
        const ot = ud.openingType;
        if (ot === 'door' || ot === 'large') return 'Door';
        return 'Window';
      }
      case 'fixture': return fixturePlainName(ud.fixtureId);
      default: return ud.label || null;
    }
  }

  function resolveTagUserData(obj) {
    let o = obj;
    while (o) {
      const ud = o.userData;
      if (ud && ud.type && !SKIP_TAG_TYPES.has(ud.type)) return ud;
      o = o.parent;
    }
    return null;
  }

  function pickTagged(e) {
    if (!renderer || !rootGroup) return null;
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(rootGroup.children, true);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (!h.object || h.object.isSprite) continue;
      const ud = resolveTagUserData(h.object);
      if (!ud) continue;
      return { hit: h, userData: ud, label: formatPartLabel(ud) };
    }
    return null;
  }

  function ensurePartTagEl() {
    if (partTagEl) return partTagEl;
    if (!canvasHost) return null;
    partTagEl = document.createElement('div');
    partTagEl.className = 'v3d-part-tag';
    partTagEl.hidden = true;
    partTagEl.setAttribute('role', 'status');
    partTagEl.setAttribute('aria-live', 'polite');
    canvasHost.appendChild(partTagEl);
    return partTagEl;
  }

  function hidePartTag() {
    if (partTagHideTimer) {
      clearTimeout(partTagHideTimer);
      partTagHideTimer = null;
    }
    if (partTagEl) {
      partTagEl.hidden = true;
      partTagEl.textContent = '';
      partTagEl.classList.remove('is-visible');
    }
  }

  function showPartTag(label, clientX, clientY) {
    if (!label) return;
    const el = ensurePartTagEl();
    if (!el || !renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const hostRect = (canvasHost && canvasHost.getBoundingClientRect)
      ? canvasHost.getBoundingClientRect() : rect;
    el.textContent = label;
    el.hidden = false;
    el.classList.add('is-visible');
    // Position near finger / cursor inside canvas host (clamp if projected off-screen)
    let localX = clientX - hostRect.left;
    let localY = clientY - hostRect.top;
    if (!isFinite(localX) || !isFinite(localY)) {
      localX = hostRect.width * 0.5;
      localY = hostRect.height * 0.4;
    } else {
      localX = Math.max(8, Math.min(hostRect.width - 8, localX));
      localY = Math.max(8, Math.min(hostRect.height - 8, localY));
    }
    const pad = 12;
    const tw = el.offsetWidth || 120;
    const th = el.offsetHeight || 32;
    let left = localX + 14;
    let top = localY - th - 14;
    if (left + tw > hostRect.width - pad) left = localX - tw - 14;
    if (top < pad) top = localY + 18;
    left = Math.max(pad, Math.min(hostRect.width - tw - pad, left));
    top = Math.max(pad, Math.min(hostRect.height - th - pad, top));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    if (partTagHideTimer) clearTimeout(partTagHideTimer);
    partTagHideTimer = setTimeout(() => { hidePartTag(); }, PART_TAG_TIMEOUT_MS);
  }

  function clearLongPress() {
    if (longPress && longPress.timer) clearTimeout(longPress.timer);
    longPress = null;
  }

  function fireLongPressTag(x, y, picked) {
    const label = picked && picked.label;
    if (!label) return false;
    longPressShown = true;
    suppressOrbit = true;
    if (controls) controls.enabled = false;
    lastTapDown = null;
    pendingEmptyExit = null;
    showPartTag(label, x, y);
    return true;
  }

  function onContextMenu(e) {
    if (!renderer) return;
    e.preventDefault();
    const picked = pickTagged(e);
    if (picked && picked.label) {
      fireLongPressTag(e.clientX, e.clientY, picked);
      // Re-enable controls after short beat (no pointerup for contextmenu alone)
      setTimeout(() => {
        if (suppressOrbit && !dragState) {
          suppressOrbit = false;
          if (controls) controls.enabled = true;
        }
        longPressShown = false;
      }, 80);
    }
  }

  // ---- Window interaction ----
  function getWinData(id) {
    if (!lastPlan) return null;
    const raw = (lastPlan.windows || []).find((w) => w.id === id);
    if (!raw) return null;
    return normalizeWin(raw, lastStore);
  }

  function getWallForWin(win) {
    if (!lastPlan || !win) return null;
    return (lastPlan.walls || []).find((w) => w.id === win.wallId) || null;
  }

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(e) {
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactiveObjects, false);
    return hits.length ? hits[0] : null;
  }

  function hitWinId(hit) {
    if (!hit || !hit.object) return null;
    const ud = hit.object.userData || {};
    if ((ud.type === 'window' || ud.type === 'winHandle') && ud.winId) return ud.winId;
    return null;
  }

  function beginOpeningDrag(e, winId, mode, handle) {
    const win = getWinData(winId);
    const wall = getWallForWin(win);
    if (!win || !wall) return false;
    dragState = {
      mode, winId, handle: handle || null,
      startW: win.widthFt, startH: win.heightFt, startT: win.t,
      wall, pointerId: e.pointerId,
    };
    // No dimension popup / mid-drag dim HUD while moving or resizing openings
    hideInspector();
    controls.enabled = false;
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  function enterEditMode(winId, e) {
    lastTapDown = null;
    pendingEmptyExit = null;
    selectWindow(winId);
    // Prevent OrbitControls from treating this gesture as an orbit start
    suppressOrbit = true;
    if (controls) controls.enabled = false;
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
    }
  }

  function exitEditMode() {
    selectWindow(null);
  }

  function onDblClick(e) {
    if (!renderer) return;
    const hit = pick(e);
    const id = hitWinId(hit);
    if (id) enterEditMode(id, e);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && selectedWinId) {
      exitEditMode();
      e.preventDefault();
    }
  }

  function onPointerDown(e) {
    if (!renderer) return;
    // Desktop: Alt+click names the part (touch-first long-press equivalent)
    if (e.button === 0 && e.altKey) {
      const picked = pickTagged(e);
      if (picked && picked.label) {
        fireLongPressTag(e.clientX, e.clientY, picked);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    if (e.button !== 0) return;

    // Short tap elsewhere dismisses an open part tag
    if (partTagEl && !partTagEl.hidden) {
      hidePartTag();
    }

    clearLongPress();
    longPressShown = false;

    const hit = pick(e);
    const id = hitWinId(hit);
    const now = performance.now();
    const ud = hit && hit.object ? (hit.object.userData || {}) : {};

    // Double-tap / second click on same opening → enter edit (down-to-down, ~330ms)
    if (id && lastTapDown && lastTapDown.winId === id && !lastTapDown.wasDrag
        && (now - lastTapDown.t) <= DBL_TAP_MS
        && Math.hypot(e.clientX - lastTapDown.x, e.clientY - lastTapDown.y) <= TAP_MOVE_PX * 2.5) {
      clearLongPress();
      enterEditMode(id, e);
      return;
    }

    // IN edit mode: drag selected opening / handles; empty click may exit
    if (selectedWinId) {
      if (ud.type === 'winHandle' && ud.winId === selectedWinId) {
        const mode = ud.handle === 'top' ? 'resizeH' : 'resizeW';
        beginOpeningDrag(e, ud.winId, mode, ud.handle);
        lastTapDown = null;
        clearLongPress();
        return;
      }
      if (ud.type === 'window' && ud.winId === selectedWinId) {
        beginOpeningDrag(e, ud.winId, 'move', null);
        lastTapDown = null;
        clearLongPress();
        return;
      }
      // Different opening or empty: allow orbit; record tap / pending empty exit
      if (!id) {
        pendingEmptyExit = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      } else {
        pendingEmptyExit = null;
      }
      lastTapDown = id
        ? { winId: id, x: e.clientX, y: e.clientY, t: now, pointerId: e.pointerId, wasDrag: false }
        : null;
      // Still allow long-press naming while in edit (not on active drag)
      startLongPressWatch(e);
      return;
    }

    // NOT in edit mode: never start opening drag — orbit/pan always
    pendingEmptyExit = null;
    lastTapDown = id
      ? { winId: id, x: e.clientX, y: e.clientY, t: now, pointerId: e.pointerId, wasDrag: false }
      : null;
    startLongPressWatch(e);
  }

  function startLongPressWatch(e) {
    const picked = pickTagged(e);
    if (!picked || !picked.label) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    longPress = {
      pointerId,
      x: startX,
      y: startY,
      picked,
      timer: setTimeout(() => {
        if (!longPress || longPress.pointerId !== pointerId) return;
        const lp = longPress;
        longPress = null;
        fireLongPressTag(lp.x, lp.y, lp.picked);
        try { e.preventDefault(); } catch (_) {}
      }, LONG_PRESS_MS),
    };
  }

  function notePointerTravel(e) {
    if (longPress && longPress.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - longPress.x, e.clientY - longPress.y) > LONG_PRESS_MOVE_PX) {
        // Moved past threshold → cancel long-press; allow normal orbit
        clearLongPress();
      }
    }
    if (lastTapDown && lastTapDown.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - lastTapDown.x, e.clientY - lastTapDown.y) > TAP_MOVE_PX) {
        lastTapDown.wasDrag = true;
      }
    }
    if (pendingEmptyExit && pendingEmptyExit.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - pendingEmptyExit.x, e.clientY - pendingEmptyExit.y) > TAP_MOVE_PX) {
        pendingEmptyExit = null; // became an orbit drag
      }
    }
  }

  function onPointerMoveDoc(e) {
    notePointerTravel(e);
  }

  function onPointerMove(e) {
    notePointerTravel(e);
    if (!dragState) return;
    const win = getWinData(dragState.winId);
    const wall = dragState.wall;
    if (!win || !wall) return;
    const wallLen = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    const wallH = (wall.heightFt != null && wall.heightFt > 0) ? wall.heightFt : ((lastStore && lastStore.wall_height_ft) || 8);

    if (dragState.mode === 'move') {
      const t = projectToWallT(e, wall);
      applyLocalWin(dragState.winId, { t }, { live: true });
    } else if (dragState.mode === 'resizeW') {
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointer, camera);
      const y = win.sillFt + win.heightFt / 2;
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, y, 0));
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        const ox = planOrigin.ox, oz = planOrigin.oz;
        const x1 = wall.x1 - ox, z1 = wall.y1 - oz;
        const x2 = wall.x2 - ox, z2 = wall.y2 - oz;
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const cx = x1 + dx * win.t, cz = z1 + dz * win.t;
        const ux = dx / len, uz = dz / len;
        const along = (pt.x - cx) * ux + (pt.z - cz) * uz;
        let newW = Math.abs(along) * 2;
        newW = Math.max(1.5, Math.min(wallLen * 0.85, newW));
        const halfT = (newW / len) / 2;
        let t = win.t;
        t = Math.max(halfT + 0.01, Math.min(1 - halfT - 0.01, t));
        applyLocalWin(dragState.winId, { widthFt: Math.round(newW * 20) / 20, t }, { live: true });
      }
    } else if (dragState.mode === 'resizeH') {
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointer, camera);
      // Vertical plane along wall
      const ox = planOrigin.ox, oz = planOrigin.oz;
      const x1 = wall.x1 - ox, z1 = wall.y1 - oz;
      const x2 = wall.x2 - ox, z2 = wall.y2 - oz;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const nx = -dz / len, nz = dx / len;
      const cx = x1 + dx * win.t, cz = z1 + dz * win.t;
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(nx, 0, nz), new THREE.Vector3(cx, 0, cz));
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        let newH = pt.y - win.sillFt;
        newH = Math.max(1.5, Math.min(wallH - win.sillFt - 0.2, newH));
        applyLocalWin(dragState.winId, { heightFt: Math.round(newH * 20) / 20 }, { live: true });
      }
    }
    e.preventDefault();
  }

  function finishPointerUp(e) {
    // Long-press incomplete → just clear timer (short tap / release)
    if (longPress && (e.pointerId == null || longPress.pointerId === e.pointerId)) {
      clearLongPress();
    }

    if (suppressOrbit) {
      suppressOrbit = false;
      if (controls && !dragState) controls.enabled = true;
    }

    // Long-press completed: do not treat as edit-exit or double-tap seed
    if (longPressShown) {
      longPressShown = false;
      lastTapDown = null;
      pendingEmptyExit = null;
      return;
    }

    if (dragState) {
      if (dragState.pointerId != null && e.pointerId != null && dragState.pointerId !== e.pointerId) return;
      const id = dragState.winId;
      dragState = null;
      controls.enabled = true;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
      // Drag end: rebuild RO/dims quietly — no dimension popup/modal
      if (lastPlan) {
        preserveCamera = true;
        buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
        selectWindow(id, { silent: true, noInspector: true });
      }
      const win = getWinData(id);
      if (win && hooks.onWindowChange) hooks.onWindowChange({ ...win }, { final: true });
      lastTapDown = null;
      pendingEmptyExit = null;
      return;
    }

    // Empty click while editing → exit edit (drag-on-empty already cleared pendingEmptyExit)
    if (pendingEmptyExit && pendingEmptyExit.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - pendingEmptyExit.x, e.clientY - pendingEmptyExit.y) <= TAP_MOVE_PX) {
        exitEditMode();
      }
      pendingEmptyExit = null;
      return;
    }

    // Orbit/drag gesture: do not keep a stale tap candidate
    if (lastTapDown && lastTapDown.pointerId === e.pointerId && lastTapDown.wasDrag) {
      lastTapDown = null;
    }
  }

  function onPointerUp(e) {
    finishPointerUp(e);
  }

  function onPointerUpDoc(e) {
    // Only handle if the gesture relates to our canvas / active drag / pending exit / long-press
    if (!renderer) return;
    if (dragState || pendingEmptyExit || suppressOrbit || longPress || longPressShown) {
      finishPointerUp(e);
    }
  }

  function projectToWallT(e, wall) {
    const ox = planOrigin.ox, oz = planOrigin.oz;
    const x1 = wall.x1 - ox, z1 = wall.y1 - oz;
    const x2 = wall.x2 - ox, z2 = wall.y2 - oz;
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return 0.5;
    // Horizontal plane at mid window height for drag
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const win = getWinData(dragState.winId);
    const y = win ? (win.sillFt + win.heightFt / 2) : 4;
    plane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, y, 0)
    );
    const pt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, pt)) return dragState.startT;
    // Project onto wall segment
    const vx = pt.x - x1, vz = pt.z - z1;
    let t = (vx * dx + vz * dz) / (len * len);
    const halfW = (win ? win.widthFt : DEFAULT_WIN_W) / len / 2;
    const margin = halfW + 0.02;
    t = Math.max(margin, Math.min(1 - margin, t));
    return t;
  }

  /**
   * Live-drag: move/resize ONLY the opening mesh (glass/frame/handles).
   * Stud plates + regular studs stay put; RO framing stays on framingRoot until drag end.
   */
  function syncOpeningMeshLive(id) {
    const win = getWinData(id);
    const wall = getWallForWin(win);
    const rec = windowMeshes.get(id);
    if (!win || !wall || !rec || !rec.group) return false;
    const ox = planOrigin.ox, oz = planOrigin.oz;
    const x1 = wall.x1 - ox, z1 = wall.y1 - oz;
    const x2 = wall.x2 - ox, z2 = wall.y2 - oz;
    const wallLen = Math.hypot(x2 - x1, z2 - z1);
    if (wallLen < 0.1) return false;
    const wallHeight = (wall.heightFt != null && wall.heightFt > 0)
      ? wall.heightFt
      : ((lastStore && lastStore.wall_height_ft) || 8);
    const mx = x1 + (x2 - x1) * win.t;
    const mz = z1 + (z2 - z1) * win.t;
    const ang = Math.atan2(z2 - z1, x2 - x1);
    const sill = Math.max(0, Math.min(win.sillFt, wallHeight - 0.5));
    const hFt = Math.min(win.heightFt, wallHeight - sill - 0.15);
    const wFt = Math.min(win.widthFt, wallLen * 0.9);

    rec.group.position.set(mx, 0, mz);
    rec.group.rotation.y = -ang;

    const sizeChanged = Math.abs(rec.wFt - wFt) > 1e-4
      || Math.abs(rec.hFt - hFt) > 1e-4
      || Math.abs(rec.sill - sill) > 1e-4;
    if (!sizeChanged) return true;

    // Resize opening contents in place — do not touch framingRoot / studs
    const depth = WALL_THICK + 0.06;
    const trim = 0.14;
    const cy = sill + hFt / 2;
    const gw = Math.max(0.2, wFt - 0.12);
    const gh = Math.max(0.2, hFt - 0.12);
    const glassDepth = 0.05;
    const glassZ = Math.max(0.02, WALL_THICK / 2 - WIN_RECESS);
    const hk = 0.28;

    if (rec.frame) {
      rec.frame.geometry.dispose();
      rec.frame.geometry = new THREE.BoxGeometry(wFt + trim * 2, hFt + trim * 2, depth);
      rec.frame.position.set(0, cy, 0);
    }
    if (rec.glass) {
      rec.glass.geometry.dispose();
      rec.glass.geometry = new THREE.BoxGeometry(gw, gh, glassDepth);
      rec.glass.position.set(0, cy, glassZ);
    }
    if (rec.glass2) {
      rec.glass2.geometry.dispose();
      rec.glass2.geometry = new THREE.BoxGeometry(gw, gh, glassDepth);
      rec.glass2.position.set(0, cy, -glassZ);
    }
    if (rec.mull) {
      rec.mull.geometry.dispose();
      rec.mull.geometry = new THREE.BoxGeometry(0.06, Math.max(0.15, hFt - 0.12), depth * 0.5);
      rec.mull.position.set(0, cy, 0);
    }
    if (rec.leftH) rec.leftH.position.set(-wFt / 2 - 0.08, cy, depth * 0.55);
    if (rec.rightH) rec.rightH.position.set(wFt / 2 + 0.08, cy, depth * 0.55);
    if (rec.topH) rec.topH.position.set(0, sill + hFt + 0.1, depth * 0.55);

    rec.wFt = wFt;
    rec.hFt = hFt;
    rec.sill = sill;
    return true;
  }

  function applyLocalWin(id, props, opts) {
    if (!lastPlan) return;
    const raw = (lastPlan.windows || []).find((w) => w.id === id);
    if (!raw) return;
    if (props.t != null) raw.t = props.t;
    if (props.widthFt != null) raw.widthFt = props.widthFt;
    if (props.heightFt != null) raw.heightFt = props.heightFt;
    if (props.sillFt != null) raw.sillFt = props.sillFt;

    const live = !!(opts && opts.live);
    if (live) {
      // During drag: opening only. Hide RO for this window so it does not slide with cursor.
      // Suppress dimension popup / mid-drag dim HUD — RO/dims refresh quietly on pointerup.
      const ro = roFramingGroups.get(id);
      if (ro) ro.visible = false;
      syncOpeningMeshLive(id);
      hideInspector();
      const win = normalizeWin(raw, lastStore);
      if (hooks.onWindowChange) hooks.onWindowChange({ ...win }, { final: false });
      return;
    }

    // Commit / inspector: full rebuild so RO framing reparents around new opening on framingRoot
    preserveCamera = true;
    const sel = id;
    buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
    selectWindow(sel, { silent: true });
    const win = normalizeWin(raw, lastStore);
    updateInspector(win);
    if (hooks.onWindowChange) hooks.onWindowChange({ ...win }, { final: false });
  }

  function selectWindow(id, opts) {
    selectedWinId = id || null;
    // Handles only visible in edit mode for the selected opening
    windowMeshes.forEach((rec, wid) => {
      const on = !!id && wid === id;
      [rec.leftH, rec.rightH, rec.topH].forEach((h) => {
        if (!h) return;
        h.visible = on;
        h.material.emissiveIntensity = on ? 0.55 : 0.15;
        h.scale.setScalar(on ? 1.25 : 1);
      });
      if (rec.frame && rec.frame.material && rec.frame.material.emissive) {
        rec.frame.material.emissive.set(on ? 0x2f6f6a : 0x000000);
        rec.frame.material.emissiveIntensity = on ? 0.25 : 0;
      }
    });
    const win = id ? getWinData(id) : null;
    if (opts && opts.noInspector) {
      hideInspector();
      updateEditChrome(win);
    } else {
      updateInspector(win);
    }
    if (!(opts && opts.silent) && hooks.onWindowSelect) {
      try { hooks.onWindowSelect(win); } catch (e) { console.warn(e); }
    }
  }

  function wireInspector() {
    if (!inspectorEl) return;
    const bind = (id, prop) => {
      const el = inspectorEl.querySelector(id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (!selectedWinId) return;
        const v = parseFloat(el.value);
        if (!isFinite(v)) return;
        const patch = {};
        patch[prop] = v;
        // Clamp t when width changes
        if (prop === 'widthFt' || prop === 't') {
          const win = getWinData(selectedWinId);
          const wall = getWallForWin(win);
          if (win && wall) {
            const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
            const w = prop === 'widthFt' ? v : win.widthFt;
            const halfT = (w / len) / 2;
            let t = prop === 't' ? v : win.t;
            t = Math.max(halfT + 0.01, Math.min(1 - halfT - 0.01, t));
            patch.t = t;
          }
        }
        applyLocalWin(selectedWinId, patch);
        const win = getWinData(selectedWinId);
        if (win && hooks.onWindowChange) hooks.onWindowChange({ ...win }, { final: true });
      });
    };
    bind('#v3d-win-w', 'widthFt');
    bind('#v3d-win-h', 'heightFt');
    bind('#v3d-win-sill', 'sillFt');
    bind('#v3d-win-t', 't');
    const closeBtn = inspectorEl.querySelector('#v3d-win-close');
    if (closeBtn) closeBtn.addEventListener('click', () => selectWindow(null));
    const doneBtn = inspectorEl.querySelector('#v3d-win-done');
    if (doneBtn) doneBtn.addEventListener('click', () => selectWindow(null));
  }

  function openingEditLabel(win) {
    if (!win) return 'Editing window';
    const ot = win.openingType || (win.autoShared ? 'door' : null);
    if (ot === 'door' || ot === 'large') return 'Editing door';
    return 'Editing window';
  }

  function updateEditChrome(win) {
    const bar = container.querySelector('#view3d-edit-bar');
    const label = container.querySelector('#view3d-edit-label');
    if (!bar) return;
    if (!win) {
      bar.hidden = true;
      bar.setAttribute('hidden', '');
      return;
    }
    bar.hidden = false;
    bar.removeAttribute('hidden');
    if (label) label.textContent = openingEditLabel(win);
  }

  function hideInspector() {
    const panel = inspectorEl || container.querySelector('#view3d-win-inspector');
    if (!panel) return;
    panel.hidden = true;
    panel.setAttribute('hidden', '');
  }

  function updateInspector(win) {
    const panel = inspectorEl || container.querySelector('#view3d-win-inspector');
    if (!panel) return;
    if (!win) {
      hideInspector();
      updateEditChrome(null);
      return;
    }
    panel.hidden = false;
    panel.removeAttribute('hidden');
    const set = (sel, v) => {
      const el = panel.querySelector(sel);
      if (el) el.value = v;
    };
    set('#v3d-win-w', win.widthFt);
    set('#v3d-win-h', win.heightFt);
    set('#v3d-win-sill', win.sillFt);
    set('#v3d-win-t', Math.round(win.t * 1000) / 1000);
    const title = panel.querySelector('#v3d-win-title');
    if (title) title.textContent = openingEditLabel(win);
    updateEditChrome(win);
  }

  function show() {
    ensure();
    onResize();
  }

  function setHooks(h) {
    hooks = Object.assign(hooks, h || {});
  }

  function getSelectedWindowId() {
    return selectedWinId;
  }

  function debugSetCamera(pos, target) {
    ensure();
    if (target) controls.target.set(target[0], target[1], target[2]);
    if (pos) camera.position.set(pos[0], pos[1], pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(controls.target);
    controls.update();
    // Re-apply after controls spherical clamp
    if (pos) camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(controls.target);
    if (renderer) renderer.render(scene, camera);
  }

  function debugScreenshotDataURL() {
    ensure();
    controls.update();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  function debugStats() {
    const wins = [];
    windowMeshes.forEach((rec, id) => {
      const p = rec.group.position;
      const parentType = rec.group.parent && rec.group.parent.userData
        ? rec.group.parent.userData.type : (rec.group.parent === rootGroup ? 'root' : 'other');
      // Ensure no RO / stud children hang off the draggable opening
      let studChild = false;
      rec.group.traverse((o) => {
        if (o !== rec.group && o.userData && o.userData.type === 'roFraming') studChild = true;
      });
      wins.push({
        id, x: p.x, y: p.y, z: p.z, w: rec.wFt, h: rec.hFt, sill: rec.sill,
        parentType, studChild, childCount: rec.group.children.length,
      });
    });
    const ros = [];
    roFramingGroups.forEach((g, id) => {
      const parentIsFraming = !!(g.parent && (
        g.parent === framingRoot || (g.parent.userData && g.parent.userData.type === 'framingRoot')
      ));
      ros.push({
        id, visible: g.visible, parentIsFraming,
        childCount: g.children.length,
      });
    });
    let pierCount = 0;
    let pierH = 0;
    let maxContentY = 0;
    let fixtureCount = 0;
    let floorFramingCount = 0;
    let floorDeckCount = 0;
    const fixtureIds = [];
    if (rootGroup) {
      rootGroup.traverse((o) => {
        if (o.userData && o.userData.type === 'pierFoundation') {
          pierCount += 1;
          if (o.userData.pierH) pierH = o.userData.pierH;
        }
        if (o.userData && o.userData.type === 'floorFraming') {
          floorFramingCount += 1;
        }
        if (o.userData && o.userData.type === 'floor') {
          floorDeckCount += 1;
        }
        if (o.userData && o.userData.type === 'fixture') {
          fixtureCount += 1;
          if (o.userData.fixtureId) fixtureIds.push(o.userData.fixtureId);
        }
        if (o.isMesh && o.position) {
          maxContentY = Math.max(maxContentY, o.position.y);
        }
      });
    }
    return {
      fixtureCount,
      fixtureIds,
      floorFramingCount,
      floorDeckCount,
      showFloorFraming,
      winCount: windowMeshes.size,
      interactive: interactiveObjects.length,
      selectedWinId,
      showStuds,
      cam: camera ? [camera.position.x, camera.position.y, camera.position.z] : null,
      target: controls ? [controls.target.x, controls.target.y, controls.target.z] : null,
      wins,
      roFraming: ros,
      framingChildCount: framingRoot ? framingRoot.children.length : 0,
      canvas: renderer ? [renderer.domElement.width, renderer.domElement.height] : null,
      foundation_type: lastStore ? lastStore.foundation_type : null,
      show_foundation: lastStore ? lastStore.show_foundation : null,
      pierCount,
      pierH,
      maxContentY,
    };
  }

  function setShowStuds(on) {
    showStuds = !!on;
    if (studsToggle) studsToggle.checked = showStuds;
    if (lastPlan) {
      preserveCamera = true;
      buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
    }
  }

  function setShowFloorFraming(on) {
    floorFramingManual = true;
    showFloorFraming = !!on;
    if (floorFramingToggle) floorFramingToggle.checked = showFloorFraming;
    if (lastPlan) {
      preserveCamera = true;
      buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
    }
  }

  /** Sample world positions of RO framing meshes for a window (for drag verify). */
  function debugRoPositions(winId) {
    const g = roFramingGroups.get(winId);
    if (!g) return [];
    const out = [];
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (!o.isMesh) return;
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      out.push([Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000, Math.round(p.z * 1000) / 1000]);
    });
    return out;
  }

  function debugWinPosition(winId) {
    const rec = windowMeshes.get(winId);
    if (!rec) return null;
    const p = rec.group.position;
    return { x: p.x, y: p.y, z: p.z, w: rec.wFt, h: rec.hFt, sill: rec.sill };
  }

  /** Find first mesh with userData.type === type; return world pos + projected client coords. */
  function debugFindTagged(type) {
    ensure();
    if (!rootGroup || !renderer) return null;
    let found = null;
    rootGroup.traverse((o) => {
      if (found) return;
      if (!o.userData || o.userData.type !== type) return;
      // Prefer a mesh; fall back to group (fixtures tag the group)
      if (o.isMesh) found = o;
      else if (!found && (o.isGroup || o.type === 'Group')) found = o;
    });
    // Second pass if only groups matched first as non-mesh preference race
    if (!found) {
      rootGroup.traverse((o) => {
        if (found) return;
        if (o.userData && o.userData.type === type) found = o;
      });
    }
    if (!found) return null;
    // If group, try a child mesh for a better visual center
    let target = found;
    if (!target.isMesh && target.traverse) {
      target.traverse((c) => {
        if (c.isMesh && target === found) target = c;
      });
    }
    target.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3();
    target.getWorldPosition(wp);
    const ndc = wp.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
    const clientY = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;
    const ud = found.userData || {};
    return {
      type: ud.type,
      label: formatPartLabel(ud),
      world: [wp.x, wp.y, wp.z],
      clientX, clientY,
      ndc: [ndc.x, ndc.y],
    };
  }

  function debugShowPartTagForType(type) {
    const info = debugFindTagged(type);
    if (!info || !info.label) return null;
    showPartTag(info.label, info.clientX, info.clientY);
    return info;
  }

  function debugPartTagState() {
    return {
      visible: !!(partTagEl && !partTagEl.hidden),
      text: partTagEl ? partTagEl.textContent : '',
    };
  }

  return {
    buildFromPlan,
    show,
    onResize,
    setHooks,
    selectWindow,
    getSelectedWindowId,
    getSelectedWindow: () => (selectedWinId ? getWinData(selectedWinId) : null),
    isEditMode: () => !!selectedWinId,
    exitEditMode,
    setShowStuds,
    getShowStuds: () => showStuds,
    setShowFloorFraming,
    getShowFloorFraming: () => showFloorFraming,
    setShowShadows: (on) => { shadowsWanted = !!on; if (shadowsToggle) shadowsToggle.checked = shadowsWanted; applyShadowMode(); },
    getShowShadows: () => !!shadowsWanted && !shadowsAutoOff(),
    debugSetCamera,
    debugScreenshotDataURL,
    debugStats,
    debugGetRoot: () => rootGroup,
    debugApplyWindow: (id, props, opts) => applyLocalWin(id, props, opts),
    debugCommitWindow: (id) => {
      if (!lastPlan) return;
      preserveCamera = true;
      buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
      if (id) selectWindow(id, { silent: true });
    },
    debugRoPositions,
    debugWinPosition,
    debugFindTagged,
    debugShowPartTagForType,
    debugPartTagState,
    debugHidePartTag: hidePartTag,
  };
}

window.HomePlan3D = { createView3D };
export { createView3D };
