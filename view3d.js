/**
 * HomePlan 3D — Three.js conceptual massing from plan + §5 3D store
 * Sketch walls/rooms win over Guidance footprint when both exist.
 * Empty Plan → ground/grid + empty-state only. Never invent parametric house from answers.
 *
 * Realism P0 (Better tier): Guidance-bound cladding/roofing/foundation materials,
 * late-morning lighting, eave/window/foundation geometry cues. Stud toggle stays
 * educational overlay — finished look when Studs OFF.
 * Interior P0: warm ceiling/room fills, painted finish + baseboard/ceiling/floor
 * when Studs OFF, fixture face polish (cabinets/sink/outlets).
 * Floor framing ON: omit opaque finish deck so open-web floor trusses (~10 in labeled,
 * visual ~13 in) read from interior low/across — not flat top-chord planks.
 * Floor framing span = additionBounds only (wall plates); no overshoot past exterior walls.
 * Roof outline = addition exterior (bounds+WALL_THICK) + clamped eave; plate height roof3.
 * interior1: Roof toggle (session); oven/fridge placeables; door long-press swing;
 * opening drag planes use floor-above-grade (ground1 lift); overhang re-verified flush.
 *
 * Realism2: richer procedural albedo+bump (clapboard/brick/shingles), lumber grain,
 * foundation/ground maps, fascia/soffit eave edge, stronger late-morning sun + soft
 * fill + interior bounce, cleaner soft shadows. Still conceptual — not photoreal CAD.
 *
 * Look1: optional store.cladding_hex tints the cladding preset albedo (pattern stays).
 * Guidance G28 / F25 / roof style remain the drivers; hex is an appearance override.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WALL_THICK = 0.45; // ~5.4 in visual shell
const POST_OVERLAP = 0.025; // slight bite into post so no hairline gap
/** Nominal 2×4 face width along wall (~1.5–1.8"). Readable lumber, not paper-thin. */
const STUD_W = 1.75 / 12; // ~1.75 in face
/** Plate / stud depth matches wall thickness so flush corners stay clean. */
const STUD_D = WALL_THICK;
/** Bottom/top plate height ≈ 1.5 in (2× lumber flat). */
const PLATE_H = 1.5 / 12;
const STUD_OC = 16 / 12; // 16" on center
const DEFAULT_WIN_W = 3;
const DEFAULT_WIN_H = 4;
const DEFAULT_WIN_SILL = 2.5;
const DEFAULT_DOOR_W_IN = 36;
const DEFAULT_DOOR_H_IN = 80;
const MIN_OPENING_W_FT = 0.5; // allow narrow 8 in (8/12) verticals
const MIN_OPENING_H_FT = 1.0;
const WIN_SIZE_PRESETS = [
  { id: '3x4', label: '3×4', w: 36, h: 48 },
  { id: '3x5', label: '3×5', w: 36, h: 60 },
  { id: '4x4', label: '4×4', w: 48, h: 48 },
  { id: '8x24', label: '8×24', w: 8, h: 24, title: 'Narrow 8 in × 2 ft' },
];
const DOOR_SIZE_PRESETS = [
  { id: '36x80', label: '3×7', w: 36, h: 80, title: 'Entry 36×80 in' },
  { id: 'sliding_6x7', label: '6×7', w: 72, h: 84, title: 'Sliding / French 6×7' },
  { id: 'sliding_8x7', label: '8×7', w: 96, h: 84, title: 'Sliding / French 8×7' },
];
const WIN_RECESS = 2.5 / 12; // 2–3 in glass setback
const SILL_PROJ = 1.25 / 12; // projecting exterior sill
const ROOF_THICK = 5 / 12; // ~4–6 in sheathing+shingle visual
const FOUND_REVEAL_SLAB = 0.75; // 9 in reveal
/** World Y of finished grade — ground mesh/grid top. Pier bottoms, slab underside,
 *  crawl stem bottoms, and stair feet all sit ON this plane. Floor plane is above. */
const GRADE_Y = 0;
/** Thin slab pad under floor trusses when Floor framing is ON (ft). */
const SLAB_PAD_H = 0.2;
const PIER_H_DEFAULT = 2.5; // ~2–3 ft elevated reveal
const PIER_SPACING_DEFAULT = 6; // ft o.c. along wall edges
const PIER_DIAMETER_IN_DEFAULT = 12; // sonotube diameter (in)
const PIER_R = 0.5; // 12 in sonotube radius (dia 12 in → r=0.5 ft) — overridden by store
const BASEBOARD_H = 4 / 12; // ~4 in interior trim
const BASEBOARD_T = 0.09; // ~1.1 in thick — readable trim
const PAINT_LINER_T = 0.035; // thin interior paint face
const CEILING_T = 0.08;
const MAX_INTERIOR_LIGHTS = 3;
/** Conceptual floor trusses / joists — EXAMPLE spacing only (not engineering). */
const FLOOR_JOIST_OC = 24 / 12; // ~24 in o.c. — wider gaps so webs read from interior glance
const FLOOR_TRUSS_H = 13 / 12; // ~13 in visual depth (labeled ~10 in; readability from interior)
const FLOOR_TRUSS_CHORD_T = 2.25 / 12; // ~2.25 in chord thickness — side edge reads at glance
const FLOOR_TRUSS_CHORD_W = 4.5 / 12; // ~4.5 in chord face width
const FLOOR_TRUSS_WEB_T = 2 / 12; // ~2 in diagonal/vertical web thickness
const FLOOR_TRUSS_BAY = 1.15; // ~1.15 ft panels — steeper open webs, clearer zigzag
/** @deprecated alias — foundation pad clearance still keyed off truss height */
const FLOOR_IBEAM_H = FLOOR_TRUSS_H;

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
  const roofToggle = container.querySelector('#view3d-roof-toggle');
  const shadowsToggle = container.querySelector('#view3d-shadows-toggle');

  let renderer, scene, camera, controls, animId, rootGroup, labelGroup;
  let raycaster, pointer, plane;
  let showDims = true;
  let showStuds = true; // educational overlay — finished look when OFF
  let showFloorFraming = true; // floor trusses / joists under floor (educational) — default ON so depth reads first
  let floorFramingManual = false; // user touched toggle — stop auto foundation default
  let showRoof = true; // session toggle — default ON (roof visible); hide to place counters from above
  let lastFloorAboveGrade = 0; // world Y lift of floor plane after foundation (ground1)
  let doorSwingOpen = new Map(); // winId -> bool (EXAMPLE door leaf swing)
  let doorSwingAnim = null; // { winId, from, to, t0, dur }
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
  let addMode = null; // null | 'window' | 'door'
  let addPresetWin = { id: '3x4', w: 36, h: 48 };
  let addPresetDoor = { id: '36x80', w: DEFAULT_DOOR_W_IN, h: DEFAULT_DOOR_H_IN };
  let addPendingTap = null; // { x, y, pointerId } — place on short tap
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
    scene.background = new THREE.Color(0xd2deea); // cool late-morning sky (slightly deeper than flat wash)
    scene.fog = new THREE.Fog(0xd2deea, 140, 300);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
    camera.position.set(32, 24, 32);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    canvasHost.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 4;
    controls.maxDistance = 140;
    controls.target.set(0, 4, 0);

    // Realism2 late-morning: warm key sun + cooler sky fill + warm interior bounce
    // One shadow caster only (phone-safe). Soft PCF; bias tuned for wall/roof contact.
    hemiLight = new THREE.HemisphereLight(0xc8d6e8, 0x6b655c, 0.42);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff1d6, 1.18);
    // Azimuth ~135° from front, elevation ~50° — readable form, clean short shadows
    sunLight.position.set(44, 48, 28);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.bias = -0.00015;
    sunLight.shadow.normalBias = 0.028;
    sunLight.shadow.radius = 1.8; // soft but readable penumbra
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 170;
    sunLight.shadow.camera.left = -55;
    sunLight.shadow.camera.right = 55;
    sunLight.shadow.camera.top = 55;
    sunLight.shadow.camera.bottom = -55;
    scene.add(sunLight);
    fillLight = new THREE.DirectionalLight(0xb0c4d8, 0.22); // opposite sky fill — lifts shade side
    fillLight.position.set(-34, 24, -28);
    scene.add(fillLight);
    interiorFill = new THREE.PointLight(0xfff2e4, 2.8, 54, 1.4);
    interiorFill.position.set(0, 6.5, 0);
    interiorFill.castShadow = false;
    scene.add(interiorFill);
    interiorLights = [];
    for (let i = 0; i < MAX_INTERIOR_LIGHTS - 1; i++) {
      const pl = new THREE.PointLight(0xffebd4, 0.0, 36, 1.4);
      pl.castShadow = false;
      pl.visible = false;
      scene.add(pl);
      interiorLights.push(pl);
    }
    ambientWarm = new THREE.AmbientLight(0xffefe2, 0.18); // bounce lift without washing exteriors
    scene.add(ambientWarm);
    renderer.toneMappingExposure = 1.08;

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

        if (roofToggle) {
      roofToggle.checked = showRoof;
      roofToggle.addEventListener('change', () => {
        showRoof = !!roofToggle.checked;
        applyRoofVisibility();
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
    wireOpeningsUI();

    window.addEventListener('resize', onResize);
    applyShadowMode();
    (function loop() {
      animId = requestAnimationFrame(loop);
      tickDoorSwing();
      controls.update();
      renderer.render(scene, camera);
    })();
  }

  function shadowsAutoOff() {
    const w = (canvasHost && canvasHost.clientWidth) || window.innerWidth || 1200;
    const lowDpr = (window.devicePixelRatio || 1) < 1.1 && w < 900;
    return w < 700 || lowDpr;
  }

  function applyRoofVisibility() {
    if (!rootGroup) return;
    rootGroup.traverse((o) => {
      if (!o || !o.userData) return;
      if (o.userData.type === 'additionRoof') o.visible = !!showRoof;
    });
    if (roofToggle) roofToggle.checked = !!showRoof;
  }

  function setShowRoof(on) {
    showRoof = !!on;
    applyRoofVisibility();
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
            if (o.material.bumpMap) o.material.bumpMap.dispose();
            if (o.material.roughnessMap) o.material.roughnessMap.dispose();
            if (o.material.normalMap) o.material.normalMap.dispose();
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
  function makePatternTexture(pattern, baseHex, coursePx, opts) {
    const size = (opts && opts.size) || 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const base = baseHex || '#C8C4BC';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const course = Math.max(6, Math.round((coursePx || 28) * (size / 256)));

    function shadeHex(hex, amt) {
      const c = new THREE.Color(hex);
      c.offsetHSL(0, 0, amt);
      return '#' + c.getHexString();
    }

    if (pattern === 'clapboard') {
      // Clear horizontal courses with bevel highlight + deep shadow line (reads at orbit)
      for (let y = 0; y < size; y += course) {
        const band = shadeHex(base, ((y / course) % 3 === 0) ? 0.025 : (((y / course) % 3 === 1) ? -0.02 : 0.01));
        ctx.fillStyle = band;
        ctx.fillRect(0, y, size, course);
        // soft top highlight (bevel)
        const g = ctx.createLinearGradient(0, y, 0, y + Math.max(3, course * 0.35));
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, size, Math.max(3, course * 0.35));
        // deep course shadow line
        ctx.fillStyle = 'rgba(30,22,12,0.42)';
        ctx.fillRect(0, y + course - 3, size, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(0, y + course - 4, size, 1);
        // subtle vertical board joints
        for (let x = ((y / course) % 2) * 48; x < size; x += 96) {
          ctx.fillStyle = 'rgba(40,30,20,0.08)';
          ctx.fillRect(x, y, 1, course - 3);
        }
      }
    } else if (pattern === 'brick') {
      ctx.fillStyle = '#D4CEC4'; // mortar field
      ctx.fillRect(0, 0, size, size);
      const bh = Math.max(14, Math.round(course));
      const bw = Math.round(bh * 2.85);
      const mortar = 3;
      for (let row = 0, y = 0; y < size; y += bh, row++) {
        const off = (row % 2) ? bw / 2 : 0;
        for (let x = -bw; x < size + bw; x += bw) {
          const n = ((x * 13 + y * 7) % 9) - 4;
          ctx.fillStyle = shadeHex(base, n * 0.012);
          ctx.fillRect(x + off + mortar, y + mortar, bw - mortar * 2, bh - mortar * 2);
          // brick edge bevel
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + off + mortar + 0.5, y + mortar + 0.5, bw - mortar * 2 - 1, bh - mortar * 2 - 1);
          ctx.strokeStyle = 'rgba(40,25,18,0.35)';
          ctx.strokeRect(x + off + mortar - 0.5, y + mortar - 0.5, bw - mortar * 2 + 1, bh - mortar * 2 + 1);
        }
      }
    } else if (pattern === 'stone') {
      ctx.fillStyle = shadeHex(base, -0.04);
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 36; i++) {
        const x = (i * 73) % size, y = (i * 47) % size;
        const w = 36 + (i % 5) * 14, h = 22 + (i % 4) * 10;
        ctx.fillStyle = shadeHex(base, ((i % 5) - 2) * 0.03);
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(20,18,16,0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      }
    } else if (pattern === 'noise') {
      const img = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() * 36) - 18;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
      }
      ctx.putImageData(img, 0, 0);
    } else if (pattern === 'shingle') {
      // Asphalt tabs — courses parallel to eave; stronger butt + granules so tabs read at orbit
      const th = Math.max(18, Math.round(size / 12));
      const tw = Math.round(th * 2.4);
      for (let row = 0, y = 0; y < size + th; y += th, row++) {
        const off = (row % 2) ? tw / 2 : 0;
        const rowShade = shadeHex(base, (row % 3 === 0) ? 0.05 : (row % 3 === 1 ? -0.04 : 0.01));
        for (let x = -tw; x < size + tw; x += tw) {
          const tabJitter = ((x + row * 17) % 5) - 2;
          ctx.fillStyle = shadeHex(rowShade, tabJitter * 0.02);
          ctx.fillRect(x + off, y, tw - 1, th - 1);
          // granule speckles — denser for asphalt read
          for (let s = 0; s < 18; s++) {
            ctx.fillStyle = (s % 2) ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.12)';
            ctx.fillRect(x + off + ((s * 19 + row) % Math.max(4, tw - 4)), y + ((s * 11) % Math.max(4, th - 4)), 2, 2);
          }
          // vertical tab cut
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(x + off + tw - 2, y, 2, th - 1);
          // butt shadow (bottom of exposure)
          ctx.fillStyle = 'rgba(0,0,0,0.48)';
          ctx.fillRect(x + off, y + th - 4, tw - 1, 4);
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(x + off + 2, y + 2, tw - 6, 2);
        }
      }
    } else if (pattern === 'rib') {
      for (let x = 0; x < size; x += Math.round(size / 14)) {
        const g = ctx.createLinearGradient(x, 0, x + 10, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.28)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 10, size);
      }
    } else if (pattern === 'tile') {
      for (let y = 0; y < size; y += 36) {
        for (let x = 0; x < size; x += 36) {
          ctx.beginPath();
          ctx.ellipse(x + 18, y + 22, 15, 17, 0, Math.PI, 0);
          ctx.fillStyle = shadeHex(base, ((x + y) % 7) * 0.008 - 0.02);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.ellipse(x + 18, y + 20, 12, 14, 0, Math.PI, 0);
          ctx.stroke();
        }
      }
    } else if (pattern === 'slate') {
      const th = 26, tw = 44;
      for (let row = 0, y = 0; y < size; y += th, row++) {
        const off = (row % 2) ? tw / 2 : 0;
        for (let x = -tw; x < size + tw; x += tw) {
          ctx.fillStyle = shadeHex(base, (((x + y) % 5) - 2) * 0.02);
          ctx.fillRect(x + off + 1, y + 1, tw - 3, th - 3);
          ctx.strokeStyle = 'rgba(255,255,255,0.10)';
          ctx.strokeRect(x + off + 2, y + 2, tw - 5, th - 5);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x + off + 1, y + th - 3, tw - 3, 2);
        }
      }
    } else if (pattern === 'membrane') {
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.025 + (i % 3) * 0.012) + ')';
        ctx.beginPath();
        ctx.arc((i * 61) % size, (i * 37) % size, 50 + i * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // faint seam lines
      for (let y = 40; y < size; y += 64) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, y, size, 1);
      }
    } else if (pattern === 'concrete') {
      // Cast concrete: soft mottling + faint form lines
      const img = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() * 22) - 11;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
      }
      ctx.putImageData(img, 0, 0);
      for (let x = 48; x < size; x += 96) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, 0, 2, size);
      }
      for (let y = 64; y < size; y += 128) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, y, size, 1);
      }
    } else if (pattern === 'lumber') {
      // End-grain-ish plank face with long grain streaks
      for (let x = 0; x < size; x += 64) {
        ctx.fillStyle = shadeHex(base, ((x / 64) % 3 === 0) ? 0.04 : (((x / 64) % 3 === 1) ? -0.03 : 0.01));
        ctx.fillRect(x, 0, 62, size);
        ctx.fillStyle = 'rgba(60,40,18,0.22)';
        ctx.fillRect(x + 62, 0, 2, size);
      }
      for (let g = 0; g < 28; g++) {
        ctx.strokeStyle = 'rgba(70,45,20,' + (0.05 + (g % 4) * 0.025) + ')';
        ctx.lineWidth = 1 + (g % 2);
        ctx.beginPath();
        const gx = 8 + (g * 19) % (size - 16);
        ctx.moveTo(gx, 0);
        for (let y = 0; y < size; y += 20) {
          ctx.lineTo(gx + Math.sin((y + g) * 0.08) * 3, y);
        }
        ctx.stroke();
      }
      // occasional knot
      for (let k = 0; k < 3; k++) {
        const kx = 40 + k * 140, ky = 80 + k * 110;
        ctx.fillStyle = 'rgba(90,55,25,0.35)';
        ctx.beginPath();
        ctx.ellipse(kx % size, ky % size, 7, 5, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === 'grass') {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      // broader tonal patches so ground reads past grid at orbit distance
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = shadeHex(base, ((i % 5) - 2) * 0.035);
        ctx.beginPath();
        ctx.ellipse((i * 73) % size, (i * 97) % size, 18 + (i % 7) * 4, 12 + (i % 5) * 3, (i % 10) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 3200; i++) {
        const x = (i * 47) % size, y = (i * 91) % size;
        ctx.fillStyle = (i % 3 === 0)
          ? 'rgba(220,230,140,0.10)'
          : (i % 3 === 1 ? 'rgba(20,40,10,0.16)' : 'rgba(70,110,40,0.12)');
        ctx.fillRect(x, y, 2, 3 + (i % 2));
      }
      // soft gravel / dirt patches
      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = 'rgba(120,110,90,0.18)';
        ctx.beginPath();
        ctx.arc((i * 67) % size, (i * 103) % size, 5 + (i % 6), 0, Math.PI * 2);
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

  /**
   * Grayscale bump companion from the same pattern family.
   * Cheap phone-friendly relief — not a true normal map bake.
   */
  function makeBumpTexture(pattern, coursePx, opts) {
    const size = (opts && opts.size) || 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    const course = Math.max(4, Math.round((coursePx || 24) * (size / 256)));

    if (pattern === 'clapboard') {
      for (let y = 0; y < size; y += course) {
        const g = ctx.createLinearGradient(0, y, 0, y + course);
        g.addColorStop(0, '#b0b0b0');
        g.addColorStop(0.7, '#787878');
        g.addColorStop(0.92, '#505050');
        g.addColorStop(1, '#404040');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, size, course);
      }
    } else if (pattern === 'brick' || pattern === 'stone' || pattern === 'slate' || pattern === 'tile') {
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(0, 0, size, size);
      const bh = Math.max(10, course);
      const bw = Math.round(bh * (pattern === 'brick' ? 2.6 : 2.0));
      for (let row = 0, y = 0; y < size; y += bh, row++) {
        const off = (row % 2) ? bw / 2 : 0;
        for (let x = -bw; x < size + bw; x += bw) {
          ctx.fillStyle = '#9a9a9a';
          ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
        }
      }
    } else if (pattern === 'shingle') {
      const th = Math.max(12, Math.round(size / 14));
      const tw = Math.round(th * 2.3);
      for (let row = 0, y = 0; y < size; y += th, row++) {
        const off = (row % 2) ? tw / 2 : 0;
        for (let x = -tw; x < size + tw; x += tw) {
          ctx.fillStyle = '#969696';
          ctx.fillRect(x + off, y, tw - 1, th - 2);
          ctx.fillStyle = '#505050';
          ctx.fillRect(x + off, y + th - 3, tw - 1, 3);
        }
      }
    } else if (pattern === 'rib') {
      for (let x = 0; x < size; x += Math.round(size / 14)) {
        ctx.fillStyle = '#b8b8b8';
        ctx.fillRect(x, 0, 3, size);
        ctx.fillStyle = '#585858';
        ctx.fillRect(x + 3, 0, 3, size);
      }
    } else if (pattern === 'lumber') {
      for (let x = 0; x < size; x += 32) {
        ctx.fillStyle = (x / 32) % 2 ? '#8e8e8e' : '#7a7a7a';
        ctx.fillRect(x, 0, 30, size);
        ctx.fillStyle = '#555';
        ctx.fillRect(x + 30, 0, 2, size);
      }
    } else if (pattern === 'concrete' || pattern === 'noise' || pattern === 'membrane' || pattern === 'grass') {
      const img = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 110 + ((Math.random() * 40) | 0);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      }
      ctx.putImageData(img, 0, 0);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 2;
    tex.needsUpdate = true;
    return tex;
  }

  function cladMaterial(key, hexOverride) {
    const p = CLAD_PRESETS[key] || CLAD_PRESETS.mixed;
    const hex = (typeof hexOverride === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hexOverride))
      ? hexOverride : p.hex;
    const coursePx = p.pattern === 'noise' ? 64 : Math.max(8, Math.round(256 * (p.courseM / 1.2)));
    const map = makePatternTexture(p.pattern, hex, coursePx, { size: 512 });
    const bump = makeBumpTexture(p.pattern, coursePx, { size: 256 });
    const ru = p.pattern === 'noise' ? 0.32 : (p.pattern === 'brick' ? 1.15 : 0.95);
    map.repeat.set(ru, ru);
    bump.repeat.set(ru, ru);
    // White tint so procedural map drives albedo (avoids flat multiply crush)
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      bumpMap: bump,
      bumpScale: p.pattern === 'clapboard' ? 0.07 : (p.pattern === 'brick' || p.pattern === 'stone' ? 0.055 : 0.028),
      roughness: Math.min(0.95, p.roughness + 0.02),
      metalness: p.metalness,
    });
  }

  function roofMaterial(key, opts) {
    const lowSlope = opts && opts.lowSlope;
    const p = lowSlope ? ROOF_PRESETS.membrane : (ROOF_PRESETS[key] || ROOF_PRESETS.asphalt);
    const map = makePatternTexture(p.pattern, p.hex, p.pattern === 'membrane' ? 80 : 28, { size: 512 });
    const bump = makeBumpTexture(p.pattern, p.pattern === 'membrane' ? 80 : 28, { size: 256 });
    // Tighter repeat so tabs/ribs read on typical addition roofs (~12–20 ft)
    const ru = p.pattern === 'membrane' ? 1.6 : (p.pattern === 'rib' ? 7 : 3.8);
    const rv = p.pattern === 'membrane' ? 1.6 : 3.2;
    map.repeat.set(ru, rv);
    bump.repeat.set(ru, rv);
    const metal = p.metalness > 0.3 ? Math.min(p.metalness, 0.5) : p.metalness;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      bumpMap: bump,
      bumpScale: p.pattern === 'shingle' || p.pattern === 'tile' || p.pattern === 'slate' ? 0.085 : (p.pattern === 'rib' ? 0.06 : 0.02),
      roughness: Math.max(p.roughness, metal > 0.2 ? 0.38 : p.roughness),
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

  /** Roof-plane UVs: U along eave (XZ), V up-slope (uses Y + plan for tab direction). */
  function applyRoofUVs(mesh, scale) {
    if (!mesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    let uv = geo.attributes.uv;
    if (!uv || uv.count !== pos.count) {
      uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
      geo.setAttribute('uv', uv);
    }
    const s = scale || 0.45;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // Mix plan axes so both gable orientations get readable courses
      uv.setXY(i, (x + z) * s * 0.55, (y * 0.85 + (x - z) * 0.15) * s);
    }
    uv.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function foundMaterial(key) {
    const p = FOUND_PRESETS[key] || FOUND_PRESETS.slab;
    const map = makePatternTexture('concrete', p.hex, 48, { size: 256 });
    const bump = makeBumpTexture('concrete', 48, { size: 128 });
    map.repeat.set(2.4, 2.4);
    bump.repeat.set(2.4, 2.4);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      bumpMap: bump,
      bumpScale: 0.028,
      roughness: p.roughness,
      metalness: p.metalness,
    });
  }

  function glassMaterial() {
    // Tinted, slightly reflective glazing veneer over opaque pane
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5BA3D4'),
      transparent: true,
      opacity: 0.55,
      roughness: 0.06,
      metalness: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  function frameMaterial() {
    // Clean painted casing / sash — brighter + smoother than wall paint
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F8F6F1'),
      roughness: 0.38,
      metalness: 0.06,
    });
  }

  /** Painted fascia / barge board at eave edge (P1 detail). */
  function fasciaMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F4F0E8'),
      roughness: 0.48,
      metalness: 0.05,
    });
  }

  /** Soft soffit underside under overhang. */
  function soffitMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E8E2D6'),
      roughness: 0.82,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }

  /** Lumber grain for studs / trusses / plates (educational framing). */
  function lumberMaterial() {
    const map = makePatternTexture('lumber', '#C9A66B', 32, { size: 256 });
    const bump = makeBumpTexture('lumber', 32, { size: 128 });
    map.repeat.set(1.8, 2.6);
    bump.repeat.set(1.8, 2.6);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      bumpMap: bump,
      bumpScale: 0.04,
      roughness: 0.86,
      metalness: 0.02,
    });
  }

  /** Darker/warmer floor-truss lumber — stronger contrast vs grid/ground from interior. */
  function floorTrussLumberMaterial(baseMat) {
    void baseMat;
    const map = makePatternTexture('lumber', '#A8743A', 28, { size: 256 });
    const bump = makeBumpTexture('lumber', 28, { size: 128 });
    map.repeat.set(2.0, 2.8);
    bump.repeat.set(2.0, 2.8);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      bumpMap: bump,
      bumpScale: 0.055,
      roughness: 0.8,
      metalness: 0.03,
    });
  }

  /** Muted grass/gravel ground — less flat plastic. */
  function groundMaterial() {
    const map = makePatternTexture('grass', '#6F7A5E', 40, { size: 512 });
    const bump = makeBumpTexture('grass', 40, { size: 256 });
    map.repeat.set(8, 8);
    bump.repeat.set(8, 8);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      bumpMap: bump,
      bumpScale: 0.025,
      roughness: 0.96,
      metalness: 0.0,
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
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (kind === 'tile') {
      ctx.fillStyle = '#D8D2C8';
      ctx.fillRect(0, 0, size, size);
      const tw = 96, th = 96;
      for (let y = 0; y < size; y += th) {
        for (let x = 0; x < size; x += tw) {
          const shade = 0.90 + ((x + y) % 7) * 0.012;
          ctx.fillStyle = 'rgb(' + Math.round(210 * shade) + ',' + Math.round(200 * shade) + ',' + Math.round(188 * shade) + ')';
          ctx.fillRect(x + 3, y + 3, tw - 6, th - 6);
          ctx.strokeStyle = 'rgba(110,100,90,0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
        }
      }
    } else {
      // wood planks along U — richer grain + seam depth
      ctx.fillStyle = '#C4A574';
      ctx.fillRect(0, 0, size, size);
      const ph = 48;
      for (let row = 0, y = 0; y < size; y += ph, row++) {
        const base = row % 3 === 0 ? '#C8A878' : (row % 3 === 1 ? '#B8956A' : '#D0B080');
        ctx.fillStyle = base;
        ctx.fillRect(0, y, size, ph - 1);
        for (let g = 0; g < 7; g++) {
          ctx.strokeStyle = 'rgba(80,50,20,' + (0.05 + (g % 3) * 0.025) + ')';
          ctx.beginPath();
          const gy = y + 5 + g * 6;
          ctx.moveTo(0, gy);
          for (let x = 0; x < size; x += 14) {
            ctx.lineTo(x + 7, gy + ((x + row * 3) % 5) - 2);
            ctx.lineTo(x + 14, gy);
          }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(50,32,14,0.28)';
        ctx.fillRect(0, y + ph - 3, size, 3);
        const joint = ((row * 97) % (size - 50)) + 25;
        ctx.fillStyle = 'rgba(50,32,14,0.22)';
        ctx.fillRect(joint, y, 2, ph - 3);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.repeat.set(kind === 'tile' ? 4.5 : 4, kind === 'tile' ? 4.5 : 4);
    tex.needsUpdate = true;
    return tex;
  }

  function floorMaterial(kind) {
    const map = makeFloorTexture(kind || 'wood');
    const bump = makeBumpTexture(kind === 'tile' ? 'slate' : 'lumber', 28, { size: 128 });
    bump.repeat.copy(map.repeat);
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(kind === 'tile' ? '#D0CAC0' : '#C4A574'),
      map,
      bumpMap: bump,
      bumpScale: kind === 'tile' ? 0.012 : 0.02,
      roughness: kind === 'tile' ? 0.68 : 0.76,
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
    if (sunLight) sunLight.intensity = finished ? 0.95 : 1.18;
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
    // Always default ON (including slab): Jake wants trusses visible first;
    // toggle still restores opaque finish flooring when unchecked.
    void foundationType;
    return true;
  }

  /**
   * Conceptual wood floor TRUSS grid under a rectangular floor (EXAMPLE spacing).
   * ~10 in labeled depth (visual ~13 in) with top/bottom chords + open webs so
   * depth reads from interior low/across — not only side/under. Not engineering.
   */
  function addFloorFraming(cx, cz, lenX, lenZ, group, lumberMat, opts) {
    const w = Math.abs(lenX);
    const d = Math.abs(lenZ);
    if (w < 2 || d < 2 || !group) return null;
    const wrap = new THREE.Group();
    wrap.userData = { type: 'floorFraming', example: true };
    group.add(wrap);

    const oc = (opts && opts.ocFt) || FLOOR_JOIST_OC;
    const trussH = (opts && opts.beamH) || FLOOR_TRUSS_H;
    const chordT = FLOOR_TRUSS_CHORD_T;
    const chordW = FLOOR_TRUSS_CHORD_W;
    const webT = FLOOR_TRUSS_WEB_T;
    const bay = FLOOR_TRUSS_BAY;
    // Top of truss just under floor slab (~0.02–0.05 below y=0 local)
    const topY = (opts && opts.topY != null) ? opts.topY : -0.04;
    const midY = topY - trussH / 2;
    // Richer/darker floor-truss lumber vs ground/grid so chords+webs pop from interior
    const mat = floorTrussLumberMaterial(lumberMat);

    const tag = { type: 'floorTruss', label: '~10 in floor truss', example: true };
    const girderTag = { type: 'floorTruss', label: '~10 in floor girder', example: true };

    function tagMesh(mesh, ud) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = Object.assign({}, ud);
      return mesh;
    }

    /** Web member in truss local X–Y plane (span along +X). */
    function addWebXY(g, x0, y0, x1, y1, thick, depth, ud) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 0.04) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, thick, depth), mat);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      mesh.rotation.z = Math.atan2(dy, dx);
      tagMesh(mesh, ud);
      g.add(mesh);
    }

    function addFloorTruss(x, z, length, rotY) {
      const g = new THREE.Group();
      g.position.set(x, midY, z);
      g.rotation.y = rotY || 0;
      g.userData = Object.assign({}, tag);

      const halfL = length / 2;
      const yTop = trussH / 2 - chordT / 2;
      const yBot = -(trussH / 2 - chordT / 2);
      const innerTop = trussH / 2 - chordT;
      const innerBot = -(trussH / 2 - chordT);
      const clearH = Math.max(0.15, innerTop - innerBot);

      // Top + bottom chords (full span) — thick enough to read as lumber
      const topChord = new THREE.Mesh(new THREE.BoxGeometry(length, chordT, chordW), mat);
      topChord.position.set(0, yTop, 0);
      tagMesh(topChord, tag);
      g.add(topChord);
      const botChord = new THREE.Mesh(new THREE.BoxGeometry(length, chordT, chordW), mat);
      botChord.position.set(0, yBot, 0);
      tagMesh(botChord, tag);
      g.add(botChord);

      // End verticals + panel webs (diagonals + intermediate verticals)
      const nBay = Math.max(1, Math.round(length / bay));
      const panel = length / nBay;
      for (let i = 0; i <= nBay; i++) {
        const xV = -halfL + i * panel;
        // vertical web
        const vert = new THREE.Mesh(new THREE.BoxGeometry(webT, clearH, chordW * 0.85), mat);
        vert.position.set(xV, 0, 0);
        tagMesh(vert, tag);
        g.add(vert);
        if (i < nBay) {
          const xA = xV;
          const xB = xV + panel;
          // Alternating diagonal for classic open-web look
          if (i % 2 === 0) {
            addWebXY(g, xA + webT * 0.4, innerBot, xB - webT * 0.4, innerTop, webT, chordW * 0.75, tag);
          } else {
            addWebXY(g, xA + webT * 0.4, innerTop, xB - webT * 0.4, innerBot, webT, chordW * 0.75, tag);
          }
        }
      }
      wrap.add(g);
    }

    // Span the LONGER plan dim so looking across the short room span (typical
    // interior) faces truss sides (chords + webs), not just ends / flat planks.
    // Footprint (lenX×lenZ) MUST be the addition wall-plate rectangle only —
    // callers pass additionBounds, never bloated planBounds.
    const spanAlongX = w >= d;
    const placeRun = spanAlongX ? d : w; // place trusses along the short axis
    const n = Math.max(2, Math.round(placeRun / oc) + 1);

    // Keep every chord/web at or inside the footprint edge. Outer face of rim
    // girders sits on the plate line; main spans tuck inside. Modest bearing on
    // plates is fine; no long overshoot past remodel exterior walls.
    const halfChord = chordW / 2;
    const edgeClear = halfChord; // rim outer face on footprint edge
    const spanClear = Math.max(edgeClear, Math.min(0.35, Math.min(w, d) * 0.04));
    const spanLenX = Math.max(1, w - spanClear * 2);
    const spanLenZ = Math.max(1, d - spanClear * 2);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      if (spanAlongX) {
        const z = cz - d / 2 + spanClear + t * (d - spanClear * 2);
        addFloorTruss(cx, z, spanLenX, 0);
      } else {
        const x = cx - w / 2 + spanClear + t * (w - spanClear * 2);
        addFloorTruss(x, cz, spanLenZ, Math.PI / 2);
      }
    }

    // Perimeter girders — same open-web truss look (labeled girder) so side views
    // show chords + diagonals instead of a solid flat band.
    function addGirderTruss(x, z, length, rotY) {
      // Re-use addFloorTruss then re-tag as girder
      const before = wrap.children.length;
      addFloorTruss(x, z, length, rotY);
      for (let i = before; i < wrap.children.length; i++) {
        const g = wrap.children[i];
        g.userData = Object.assign({}, girderTag);
        g.traverse((c) => {
          if (c.userData && c.userData.type === 'floorTruss') {
            c.userData = Object.assign({}, girderTag);
          }
        });
      }
    }
    // Rim girders: outer chord face on footprint edge (not outside)
    const girderLenX = Math.max(1, w - edgeClear * 2);
    const girderLenZ = Math.max(1, d - edgeClear * 2);
    addGirderTruss(cx, cz - d / 2 + edgeClear, girderLenX, 0);
    addGirderTruss(cx, cz + d / 2 - edgeClear, girderLenX, 0);
    addGirderTruss(cx - w / 2 + edgeClear, cz, girderLenZ, Math.PI / 2);
    addGirderTruss(cx + w / 2 - edgeClear, cz, girderLenZ, Math.PI / 2);

    return wrap;
  }

  /**
   * How far below local floor Y=0 the foundation contact sits (before grade lift).
   * After lift, that contact lands on GRADE_Y and the floor is this many ft above grade.
   * Piers: 0 (columns already span GRADE_Y→pierH; building is lifted by pierH separately).
   * Basement: 0 (stem intentionally buried below grade; floor stays at grade).
   */
  function foundationContactDepth(ft, framingOn) {
    if (ft === 'piers' || ft === 'basement') return 0;
    if (ft === 'crawl') return 2.5;
    if (ft === 'slab') {
      if (framingOn) {
        // Match pad placement in buildFromPlan: under truss bottom
        const beamBot = -0.02 - FLOOR_IBEAM_H;
        const padCenterY = beamBot - SLAB_PAD_H / 2 - 0.02;
        const padBottom = padCenterY - SLAB_PAD_H / 2;
        return Math.max(0.2, -padBottom);
      }
      return FOUND_REVEAL_SLAB;
    }
    return 0;
  }

  /** Floor elevation above GRADE_Y after foundation is applied. */
  function floorElevationAboveGrade(ft, store, framingOn) {
    if (ft === 'piers') {
      return (store && store.pier_height_ft > 0) ? store.pier_height_ft : PIER_H_DEFAULT;
    }
    if (ft === 'crawl') return 2.5;
    if (ft === 'basement') return 0; // floor at grade; stem below
    if (ft === 'slab') return foundationContactDepth('slab', framingOn);
    return 0.75;
  }

  /**
   * Raise building content so foundation bottoms / pier tops meet the grade convention.
   * Never moves ground, grid, or stairs-from-grade (added after lift).
   */
  function liftRootToGrade(root, amount, opts) {
    if (!(amount > 0) || !root) return;
    const skipPierFound = !!(opts && opts.skipPierFoundation);
    [...root.children].forEach((ch) => {
      if (!ch) return;
      if (ch.type === 'GridHelper') return;
      if (ch.userData && ch.userData.type === 'ground') return;
      if (ch.userData && ch.userData.type === 'grid') return;
      if (ch.userData && (ch.userData.skipPierLift || ch.userData.type === 'stairsFromGrade')) return;
      if (skipPierFound && ch.userData && ch.userData.type === 'pierFoundation') return;
      ch.position.y += amount;
    });
  }

  /** Place ground mesh + contact blot + grid all on GRADE_Y (tiny epsilons avoid z-fight). */
  function addGradePlane(root, trulyEmpty, store) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      groundMaterial()
    );
    ground.rotation.x = -Math.PI / 2;
    // Flush with GRADE_Y so pier/slab/stair feet read planted (not a hairline float).
    ground.position.y = GRADE_Y;
    if (ground.material) {
      ground.material.polygonOffset = true;
      ground.material.polygonOffsetFactor = 1;
      ground.material.polygonOffsetUnits = 1;
    }
    ground.receiveShadow = true;
    ground.userData = { type: 'ground' };
    root.add(ground);

    if (!trulyEmpty) {
      const contact = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(10, (store.footprint_l_ft || 14) * 0.55), 48),
        new THREE.MeshBasicMaterial({ color: 0x2a2a22, transparent: true, opacity: 0.18, depthWrite: false })
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = GRADE_Y + 0.004;
      contact.userData = { type: 'ground' };
      root.add(contact);
    }

    const grid = new THREE.GridHelper(80, 40, 0x9aab90, 0xb8c4a8);
    grid.position.y = GRADE_Y + 0.015;
    const gMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gMats.forEach((m) => { if (m) { m.transparent = true; m.opacity = 0.28; } });
    grid.userData = { type: 'grid' };
    grid.traverse((o) => { o.userData = { type: 'grid' }; });
    root.add(grid);
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
   * bearing wall lines). Never mid-span under open floor.
   * opts.walls: plan walls in plan-ft (with opts.ox/oz origin) → wall-aware placement.
   * Without walls: perimeter of the ax,az / addL×addW rectangle only.
   * opts.spacingFt / diameterIn / pierCount from store dials (EXAMPLE defaults).
   */
  function addPierFoundation(ax, az, addL, addW, pierH, foundMat, beamMat, group, opts) {
    const wrap = new THREE.Group();
    const opts0 = opts || {};
    const h = pierH > 0 ? pierH : PIER_H_DEFAULT;
    let spacing = opts0.spacingFt > 0 ? opts0.spacingFt : PIER_SPACING_DEFAULT;
    if (spacing < 2) spacing = 2;
    if (spacing > 20) spacing = 20;
    const diaIn = opts0.diameterIn > 0 ? opts0.diameterIn : PIER_DIAMETER_IN_DEFAULT;
    const pierR = Math.max(0.2, (diaIn / 12) / 2); // inches → ft radius
    const wantCount = opts0.pierCount > 0 ? Math.round(opts0.pierCount) : 0;
    wrap.userData = {
      type: 'pierFoundation', pierH: h,
      spacingFt: spacing, diameterIn: diaIn, wantCount,
    };
    group.add(wrap);
    group = wrap;
    const pierMap = new Map();
    function addPierPt(px, pz) {
      const k = keyPt(px, pz);
      if (!pierMap.has(k)) pierMap.set(k, [px, pz]);
    }
    function placeAlongSegment(x1, z1, x2, z2, sp) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.05) return;
      const n = Math.max(2, Math.round(len / sp) + 1);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        addPierPt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
      }
    }

    const walls = opts0.walls || null;
    const wallOx = opts0.ox != null ? opts0.ox : 0;
    const wallOz = opts0.oz != null ? opts0.oz : 0;
    const segments = [];
    if (walls && walls.length) {
      walls.forEach((w) => {
        segments.push([w.x1 - wallOx, w.y1 - wallOz, w.x2 - wallOx, w.y2 - wallOz]);
      });
    } else {
      // Parametric / no sketch walls: perimeter of rectangle only (no interior grid).
      const inset = Math.min(1.0, Math.min(addL, addW) * 0.12);
      const x0 = ax - addL / 2 + inset;
      const x1 = ax + addL / 2 - inset;
      const z0 = az - addW / 2 + inset;
      const z1 = az + addW / 2 - inset;
      segments.push([x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]);
    }

    if (wantCount > 0) {
      // Explicit count: corners first, then fill along edges (still edge-only).
      let totalLen = 0;
      const lens = segments.map(([x1, z1, x2, z2]) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        totalLen += len;
        return len;
      });
      const n = Math.max(4, Math.min(80, wantCount));
      segments.forEach(([x1, z1, x2, z2]) => {
        addPierPt(x1, z1);
        addPierPt(x2, z2);
      });
      if (pierMap.size > n) {
        const all = Array.from(pierMap.values());
        pierMap.clear();
        for (let i = 0; i < n; i++) {
          const idx = Math.round(i * (all.length - 1) / Math.max(1, n - 1));
          addPierPt(all[idx][0], all[idx][1]);
        }
      } else if (pierMap.size < n && totalLen > 0.1) {
        const need = n - pierMap.size;
        // Place `need` intermediates along longest edges, spaced away from ends
        const ranked = segments
          .map((seg, i) => ({ seg, len: lens[i], i }))
          .filter((r) => r.len > 1.0)
          .sort((a, b) => b.len - a.len);
        let placed = 0;
        let pass = 0;
        while (placed < need && pass < 8 && ranked.length) {
          for (let r = 0; r < ranked.length && placed < need; r++) {
            const { seg, len } = ranked[r];
            const slots = pass + 2; // divide edge into more parts each pass
            for (let k = 1; k < slots && placed < need; k++) {
              const t = k / slots;
              if (t < 0.08 || t > 0.92) continue;
              const before = pierMap.size;
              addPierPt(seg[0] + (seg[2] - seg[0]) * t, seg[1] + (seg[3] - seg[1]) * t);
              if (pierMap.size > before) placed += 1;
            }
          }
          pass += 1;
        }
        // Final trim if we slightly overshot
        if (pierMap.size > n) {
          const all = Array.from(pierMap.values());
          pierMap.clear();
          for (let i = 0; i < n; i++) {
            const idx = Math.round(i * (all.length - 1) / Math.max(1, n - 1));
            addPierPt(all[idx][0], all[idx][1]);
          }
        }
      }
    } else {
      // Spacing-driven density along each edge (corners + o.c.)
      segments.forEach(([x1, z1, x2, z2]) => placeAlongSegment(x1, z1, x2, z2, spacing));
    }
    const pierPositions = Array.from(pierMap.values());
    wrap.userData.count = pierPositions.length;
    wrap.userData.pierR = pierR;

    pierPositions.forEach(([px, pz]) => {
      // Footing pad sits ON grade (bottom at GRADE_Y); column from grade to pier top.
      const padH = 0.25;
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(pierR * 1.6, pierR * 1.7, padH, 12),
        foundMat
      );
      pad.position.set(px, GRADE_Y + padH / 2, pz);
      pad.receiveShadow = true;
      pad.userData = { type: 'pier', label: 'Pier footing' };
      group.add(pad);
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(pierR, pierR * 1.05, h, 16),
        foundMat
      );
      cyl.position.set(px, GRADE_Y + h / 2, pz);
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      cyl.userData = { type: 'pier', label: 'Pier / sonotube' };
      group.add(cyl);
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
    return { pierH: h, count: pierPositions.length, spacingFt: spacing, diameterIn: diaIn, pierR };
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


  /** Painted corner board for clapboard / fiber / vinyl (P1 trim cue). */
  function cornerBoardMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F2EEE6'),
      roughness: 0.58,
      metalness: 0.03,
    });
  }

  function wantsCornerBoards(cladKey) {
    return cladKey === 'wood' || cladKey === 'fiber' || cladKey === 'vinyl' || cladKey === 'eng_wood';
  }

  /** Vertical trim at exterior corner — ~3.5 in face, proud of cladding plane. */
  function cornerBoardAt(x, z, height, group, mat) {
    if (height < 0.5) return null;
    const face = 3.5 / 12;
    const board = new THREE.Mesh(new THREE.BoxGeometry(face, height * 0.995, face), mat || cornerBoardMaterial());
    board.position.set(x, height / 2, z);
    board.castShadow = true;
    board.receiveShadow = true;
    board.userData = { type: 'trim', label: 'Corner board' };
    group.add(board);
    return board;
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

    // Overlay window that reads on BOTH wall faces (local ±Z; exterior side varies by wall).
    const depth = WALL_THICK + 0.1;
    const trim = 0.16;
    const jamb = 0.1;
    const cy = sill + hFt / 2;
    const outerZ = WALL_THICK / 2;
    const narrow = !isDoor && wFt < 1.15;

    const paneMat = isDoor
      ? mat(0x6b4a32, { roughness: 0.68, metalness: 0.06 })
      : mat(0x2f6f9a, { roughness: 0.14, metalness: 0.32 });
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.15, wFt - 0.04), Math.max(0.15, hFt - 0.04), depth),
      paneMat
    );
    pane.position.set(0, cy, 0);
    pane.castShadow = true;

    const gw = Math.max(0.1, wFt - jamb * 2);
    const gh = Math.max(0.1, hFt - jamb * 2);
    const glassDepth = 0.04;
    const glassZ = depth / 2 - 0.015;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, glassDepth), isDoor ? paneMat : glassMat);
    glass.position.set(0, cy, glassZ);
    const glass2 = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, glassDepth), isDoor ? paneMat : glassMat);
    glass2.position.set(0, cy, -glassZ);

    // Door leaf hinged at left jamb (EXAMPLE swing). Windows stay fixed on g.
    let doorLeaf = null;
    if (isDoor) {
      doorLeaf = new THREE.Group();
      doorLeaf.position.set(-wFt / 2, 0, 0);
      doorLeaf.userData = { type: 'doorLeaf', winId, openingType: 'door' };
      // Shift contents so leaf origin is hinge; panel still fills opening when closed
      pane.position.x += wFt / 2;
      glass.position.x += wFt / 2;
      glass2.position.x += wFt / 2;
      doorLeaf.add(pane, glass, glass2);
      g.add(doorLeaf);
      if (winId && doorSwingOpen.get(winId)) {
        doorLeaf.rotation.y = -Math.PI * 0.72;
      }
    } else {
      g.add(pane, glass, glass2);
    }

    // Casing on BOTH faces (exterior side depends on wall winding)
    const casingT = 0.1;
    const casingZ = outerZ + casingT / 2 + 0.02;
    function addCasingPair(sign) {
      const z = sign * casingZ;
      const L = new THREE.Mesh(new THREE.BoxGeometry(trim, hFt + trim * 1.2, casingT), frameMat);
      L.position.set(-(wFt / 2 + trim / 2), cy + trim * 0.05, z);
      L.castShadow = true;
      g.add(L);
      const R = new THREE.Mesh(new THREE.BoxGeometry(trim, hFt + trim * 1.2, casingT), frameMat);
      R.position.set(wFt / 2 + trim / 2, cy + trim * 0.05, z);
      R.castShadow = true;
      g.add(R);
      const T = new THREE.Mesh(new THREE.BoxGeometry(wFt + trim * 2, trim, casingT), frameMat);
      T.position.set(0, sill + hFt + trim / 2, z);
      T.castShadow = true;
      g.add(T);
      // Bottom casing / stool under sill for windows; under door too as threshold cue
      const B = new THREE.Mesh(
        new THREE.BoxGeometry(wFt + trim * 2, isDoor ? trim * 0.55 : trim * 0.7, casingT),
        frameMat
      );
      B.position.set(0, sill + (isDoor ? trim * 0.2 : -trim * 0.15), z);
      B.castShadow = true;
      g.add(B);
      return { L, R, T, B };
    }
    const casA = addCasingPair(1);
    const casB = addCasingPair(-1);
    const frame = casA.T; // selection highlight target

    // Projecting sill — extends both sides so either face reads a stool
    let sillMesh = null;
    let sillLip = null;
    let sillLip2 = null;
    if (!isDoor && sill > 0.05) {
      const sillH = 0.13;
      const sillDepth = WALL_THICK + SILL_PROJ * 2 + 0.18;
      sillMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wFt + trim * 2 + 0.16, sillH, sillDepth),
        frameMat
      );
      sillMesh.position.set(0, sill - sillH * 0.15, 0);
      sillMesh.castShadow = true;
      sillMesh.userData = { type: 'windowSill', label: 'Window sill', winId };
      g.add(sillMesh);
      sillLip = new THREE.Mesh(
        new THREE.BoxGeometry(wFt + trim * 2 + 0.2, 0.05, 0.09),
        frameMat
      );
      sillLip.position.set(0, sill + 0.025, outerZ + SILL_PROJ + 0.07);
      sillLip.castShadow = true;
      g.add(sillLip);
      sillLip2 = new THREE.Mesh(
        new THREE.BoxGeometry(wFt + trim * 2 + 0.2, 0.05, 0.09),
        frameMat
      );
      sillLip2.position.set(0, sill + 0.025, -(outerZ + SILL_PROJ + 0.07));
      sillLip2.castShadow = true;
      g.add(sillLip2);
    }

    // Sash / mullion on BOTH faces
    let mull = null;
    let mull2 = null;
    let mullH = null;
    let mullH2 = null;
    const mullD = 0.07;
    const mullZ = glassZ + 0.02;
    if (isDoor) {
      mullH = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.2, wFt - 0.2), 0.1, mullD),
        mat(0x5a3d28, { roughness: 0.62, metalness: 0.08 })
      );
      mullH.position.set(wFt / 2, sill + hFt * 0.4, mullZ);
      mull = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, Math.max(0.2, hFt * 0.28), 0.08),
        mat(0xc4a882, { roughness: 0.48, metalness: 0.38 })
      );
      mull.position.set(wFt / 2 + wFt * 0.32, cy, mullZ + 0.02);
      if (doorLeaf) {
        doorLeaf.add(mullH, mull);
      } else {
        g.add(mullH, mull);
      }
    } else {
      const sashH = narrow ? 0.045 : 0.06;
      mullH = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.08, gw), sashH, mullD), frameMat);
      mullH.position.set(0, cy, mullZ);
      g.add(mullH);
      mullH2 = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.08, gw), sashH, mullD), frameMat);
      mullH2.position.set(0, cy, -mullZ);
      g.add(mullH2);
      if (!narrow) {
        mull = new THREE.Mesh(new THREE.BoxGeometry(0.07, Math.max(0.1, gh), mullD), frameMat);
        mull.position.set(0, cy, mullZ);
        g.add(mull);
        mull2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, Math.max(0.1, gh), mullD), frameMat);
        mull2.position.set(0, cy, -mullZ);
        g.add(mull2);
      }
    }

    if (winId) {
      frame.material = frameMat.clone();
      const share = frame.material;
      pane.material = paneMat.clone ? paneMat.clone() : paneMat;
      glass.material = isDoor ? pane.material : (glassMat.clone ? glassMat.clone() : glassMat);
      glass2.material = glass.material;
      const frameParts = [
        casA.L, casA.R, casA.T, casA.B, casB.L, casB.R, casB.T, casB.B,
        sillMesh, sillLip, sillLip2, mullH, mullH2, mull, mull2,
      ];
      frameParts.forEach((m) => {
        if (!m) return;
        if (isDoor && (m === mull || m === mullH)) return;
        m.material = share;
      });
      if (isDoor) {
        if (mull) mull.material = mull.material.clone();
        if (mullH) mullH.material = mullH.material.clone();
      }

      const openType = opts.openingType || (isDoor ? 'door' : 'window');
      const tag = { type: 'window', winId, openingType: openType };
      g.userData = tag;
      if (doorLeaf) doorLeaf.userData = Object.assign({}, tag, { type: 'window', doorLeaf: true });
      [pane, glass, glass2, frame, casA.L, casA.R, casA.T, casA.B, casB.L, casB.R, casB.T, casB.B,
        mull, mull2, mullH, mullH2, sillMesh, sillLip, sillLip2].forEach((m) => {
        if (m) m.userData = tag;
      });
      interactiveObjects.push(pane, glass, glass2, casA.L, casA.R, casA.T, casB.L, casB.R, casB.T);
      if (sillMesh) interactiveObjects.push(sillMesh);
      if (mullH) interactiveObjects.push(mullH);
      if (mull) interactiveObjects.push(mull);

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

      windowMeshes.set(winId, {
        group: g, glass, glass2, frame, pane, doorLeaf,
        mull, mull2, mullH, mullH2,
        casingL: casA.L, casingR: casA.R, casingTop: casA.T, casingBot: casA.B,
        casingL2: casB.L, casingR2: casB.R, casingTop2: casB.T, casingBot2: casB.B,
        sillMesh, sillLip, sillLip2,
        leftH, rightH, topH, wFt, hFt, sill,
        openingType: opts.openingType || (isDoor ? 'door' : 'window'),
        narrow,
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
    const soffitMat = soffitMaterial();
    const fasciaMat = fasciaMaterial();
    const FASCIA_H = 7 / 12; // ~7 in fascia face
    const FASCIA_T = 1.5 / 12;
    function plane(corners, mat, label) {
      const verts = new Float32Array(corners.flat());
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const mesh = new THREE.Mesh(geo, mat || roofMat);
      applyRoofUVs(mesh, 0.65);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: 'roof', label: label || 'Roof' };
      group.add(mesh);
      return mesh;
    }
    function addThickPlanes(topCorners) {
      plane(topCorners, roofMat, 'Roof');
      // Underside = soffit cue (lighter) for eave/roof thickness
      const bot = topCorners.map((c) => [c[0], c[1] - thick, c[2]]);
      plane(bot, soffitMat, 'Soffit');
    }
    function addFasciaBar(w, h, d, x, y, z) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fasciaMat);
      edge.position.set(x, y, z);
      edge.castShadow = true;
      edge.receiveShadow = true;
      edge.userData = { type: 'roof', label: 'Fascia' };
      group.add(edge);
    }
    if (alongZ) {
      addThickPlanes([[-W / 2, eaveY, -D / 2], [0, ridgeY, -D / 2], [0, ridgeY, D / 2], [-W / 2, eaveY, D / 2]]);
      addThickPlanes([[W / 2, eaveY, -D / 2], [0, ridgeY, -D / 2], [0, ridgeY, D / 2], [W / 2, eaveY, D / 2]]);
      // Roof edge thickness + painted fascia hanging at eave tip
      [[-W / 2], [W / 2]].forEach(([x]) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(thick * 0.85, thick, D), roofMat);
        edge.position.set(x, eaveY - thick / 2, 0);
        applyRoofUVs(edge, 0.65);
        edge.castShadow = true;
        edge.userData = { type: 'roof', label: 'Roof eave' };
        group.add(edge);
        addFasciaBar(FASCIA_T, FASCIA_H, D * 0.98, x + (x < 0 ? -FASCIA_T * 0.3 : FASCIA_T * 0.3), eaveY - thick - FASCIA_H / 2 + 0.02, 0);
      });
      // Rake / barge fascia on gable ends
      [[-D / 2], [D / 2]].forEach(([z]) => {
        addFasciaBar(W * 0.98, FASCIA_H * 0.85, FASCIA_T, 0, eaveY - thick - FASCIA_H * 0.4, z + (z < 0 ? -FASCIA_T * 0.2 : FASCIA_T * 0.2));
      });
    } else {
      addThickPlanes([[-W / 2, eaveY, -D / 2], [-W / 2, ridgeY, 0], [W / 2, ridgeY, 0], [W / 2, eaveY, -D / 2]]);
      addThickPlanes([[-W / 2, eaveY, D / 2], [-W / 2, ridgeY, 0], [W / 2, ridgeY, 0], [W / 2, eaveY, D / 2]]);
      [[-D / 2], [D / 2]].forEach(([z]) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(W, thick, thick * 0.85), roofMat);
        edge.position.set(0, eaveY - thick / 2, z);
        applyRoofUVs(edge, 0.65);
        edge.castShadow = true;
        edge.userData = { type: 'roof', label: 'Roof eave' };
        group.add(edge);
        addFasciaBar(W * 0.98, FASCIA_H, FASCIA_T, 0, eaveY - thick - FASCIA_H / 2 + 0.02, z + (z < 0 ? -FASCIA_T * 0.3 : FASCIA_T * 0.3));
      });
      [[-W / 2], [W / 2]].forEach(([x]) => {
        addFasciaBar(FASCIA_T, FASCIA_H * 0.85, D * 0.98, x + (x < 0 ? -FASCIA_T * 0.2 : FASCIA_T * 0.2), eaveY - thick - FASCIA_H * 0.4, 0);
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
    const soffitMat = soffitMaterial();
    const fasciaMat = fasciaMaterial();
    const FASCIA_H = 7 / 12;
    const FASCIA_T = 1.5 / 12;
    function addFace(corners, indices) {
      const verts = new Float32Array(corners.flat());
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, roofMat);
      applyRoofUVs(mesh, 0.65);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: 'roof', label: 'Roof' };
      group.add(mesh);
      // underside soffit for thickness
      const bot = corners.map((c) => [c[0], c[1] - thick, c[2]]);
      const verts2 = new Float32Array(bot.flat());
      const geo2 = new THREE.BufferGeometry();
      geo2.setAttribute('position', new THREE.BufferAttribute(verts2, 3));
      geo2.setIndex(indices);
      const mesh2 = new THREE.Mesh(geo2, soffitMat);
      applyRoofUVs(mesh2, 0.65);
      mesh2.castShadow = true;
      mesh2.userData = { type: 'roof', label: 'Soffit' };
      group.add(mesh2);
    }
    // Simple perimeter fascia band at eave height (hip)
    function addHipFascia() {
      const y = eaveY - thick - FASCIA_H / 2 + 0.02;
      [[0, -D / 2], [0, D / 2]].forEach(([x, z]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, FASCIA_H, FASCIA_T), fasciaMat);
        m.position.set(x, y, z + (z < 0 ? -FASCIA_T * 0.25 : FASCIA_T * 0.25));
        m.castShadow = true;
        m.userData = { type: 'roof', label: 'Fascia' };
        group.add(m);
      });
      [[-W / 2, 0], [W / 2, 0]].forEach(([x, z]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(FASCIA_T, FASCIA_H, D * 0.98), fasciaMat);
        m.position.set(x + (x < 0 ? -FASCIA_T * 0.25 : FASCIA_T * 0.25), y, z);
        m.castShadow = true;
        m.userData = { type: 'roof', label: 'Fascia' };
        group.add(m);
      });
    }
    addHipFascia();
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

  /** Decks / stairs alone are real Plan content — must not fall through to parametric house. */
  function planHasOutdoor(plan) {
    return !!(plan && (
      ((plan.decks || []).length > 0) ||
      ((plan.stairs || []).length > 0)
    ));
  }

  /** True only when Plan canvas carries real drawable geometry.
   *  Fixtures / rooflines / Guidance answers alone do NOT count — they must not spawn a house. */
  function planHasAnyGeometry(plan) {
    if (!plan) return false;
    if (planHasSketch(plan)) return true;
    if (planHasOutdoor(plan)) return true;
    if (plan.existingHouse && plan.existingHouse.lengthFt > 0 && plan.existingHouse.widthFt > 0) return true;
    return false;
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
    (plan.decks || []).forEach((d) => {
      if (!d) return;
      const w = Number(d.w) || 8, depth = Number(d.d != null ? d.d : d.h) || 10;
      c(d.x, d.y); c(d.x + w, d.y + depth);
    });
    (plan.stairs || []).forEach((s) => {
      if (!s || s.x == null || s.y == null) return;
      const hw = (Number(s.width) || 3.5) / 2;
      const hr = (Number(s.runLength) || 10) / 2;
      c(s.x - hw - hr, s.y - hw - hr);
      c(s.x + hw + hr, s.y + hw + hr);
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

  /** 3D camera focus: addition + decks/stairs. Excludes existing house so EXAMPLE
   * decks/stairs (deck1) do not pull framing to the whole site and break wall taps. */
  function focusBounds(plan) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    const c = (x, y) => { any = true; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    (plan.walls || []).forEach((w) => { c(w.x1, w.y1); c(w.x2, w.y2); });
    (plan.rooms || []).forEach((r) => { c(r.x, r.y); c(r.x + r.w, r.y + r.h); });
    (plan.decks || []).forEach((d) => {
      if (!d) return;
      const w = Number(d.w) || 8, depth = Number(d.d != null ? d.d : d.h) || 10;
      c(d.x, d.y); c(d.x + w, d.y + depth);
    });
    (plan.stairs || []).forEach((s) => {
      if (!s || s.x == null || s.y == null) return;
      const hw = (Number(s.width) || 3.5) / 2;
      const hr = (Number(s.runLength) || 10) / 2;
      c(s.x - hw - hr, s.y - hw - hr);
      c(s.x + hw + hr, s.y + hw + hr);
    });
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

      if (id === 'oven_range') {
        const h = ((fx.heightIn != null ? fx.heightIn : 36) / 12);
        const g = new THREE.Group();
        g.position.set(cx, 0, cz);
        g.rotation.y = -rot;
        g.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        const bodyMat = mat(0x3a3e44, { roughness: 0.55, metalness: 0.35 });
        const glassMatO = mat(0x1a2228, { roughness: 0.25, metalness: 0.2 });
        const handleMat = mat(0xc8cdd2, { roughness: 0.35, metalness: 0.55 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(widthFt, h, depthFt), bodyMat);
        body.position.y = h / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);
        // Oven door glass cue
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.78, h * 0.48, 0.04),
          glassMatO
        );
        door.position.set(0, h * 0.38, depthFt / 2 + 0.02);
        g.add(door);
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.55, 0.05, 0.05),
          handleMat
        );
        handle.position.set(0, h * 0.62, depthFt / 2 + 0.06);
        g.add(handle);
        // Cooktop knobs strip
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.9, 0.06, depthFt * 0.35),
          mat(0x2a2e32, { roughness: 0.5, metalness: 0.4 })
        );
        strip.position.set(0, h + 0.02, -depthFt * 0.15);
        g.add(strip);
        group.add(g);
        return;
      }

      if (id === 'fridge') {
        const h = ((fx.heightIn != null ? fx.heightIn : 70) / 12);
        const g = new THREE.Group();
        g.position.set(cx, 0, cz);
        g.rotation.y = -rot;
        g.userData = { type: 'fixture', fixtureId: id, id: fx.id };
        const bodyMat = mat(0xd8dde2, { roughness: 0.42, metalness: 0.28 });
        const darkMat = mat(0x4a5056, { roughness: 0.5, metalness: 0.2 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(widthFt, h, depthFt), bodyMat);
        body.position.y = h / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);
        // Freezer / fridge split seam
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(widthFt * 0.96, 0.03, 0.04),
          darkMat
        );
        seam.position.set(0, h * 0.68, depthFt / 2 + 0.01);
        g.add(seam);
        // Handles
        [[h * 0.82], [h * 0.4]].forEach((yy) => {
          const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, h * 0.12, 0.05),
            darkMat
          );
          handle.position.set(widthFt * 0.38, yy[0], depthFt / 2 + 0.04);
          g.add(handle);
        });
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


  /** EXAMPLE wood deck platform — boards + light joists. Sits on floor plane (pier-lifted). */
  function addDecksFromPlan(plan, ox, oz, group, mats) {
    const list = (plan && plan.decks) || [];
    if (!list.length) return;
    const boardMat = mats && mats.boardMat
      ? mats.boardMat
      : mat(0xc4a574, { roughness: 0.78, metalness: 0.02 });
    const joistMat = mats && mats.joistMat
      ? mats.joistMat
      : mat(0x8a6a3a, { roughness: 0.88, metalness: 0.02 });
    const boardT = 0.12; // ~1.5 in
    const joistH = 0.5;  // ~6 in EXAMPLE
    list.forEach((d0) => {
      const d = d0 || {};
      const w = Math.max(2, Number(d.w) || 8);
      const depth = Math.max(2, Number(d.d != null ? d.d : d.h) || 10);
      const cx = (Number(d.x) || 0) + w / 2 - ox;
      const cz = (Number(d.y) || 0) + depth / 2 - oz;
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      g.userData = { type: 'deck', label: 'Deck', id: d.id, example: true };

      // Joists under boards (run along shorter span for EXAMPLE)
      const spanAlongX = w <= depth;
      const joistLen = spanAlongX ? w : depth;
      const joistSpan = spanAlongX ? depth : w;
      const joistSpacing = 1.33; // ~16 in o.c. EXAMPLE
      const nJ = Math.max(2, Math.round(joistSpan / joistSpacing) + 1);
      for (let i = 0; i < nJ; i++) {
        const t = nJ === 1 ? 0.5 : i / (nJ - 1);
        const off = (t - 0.5) * (joistSpan - 0.2);
        const j = new THREE.Mesh(
          new THREE.BoxGeometry(spanAlongX ? joistLen - 0.1 : 0.12, joistH, spanAlongX ? 0.12 : joistLen - 0.1),
          joistMat
        );
        j.position.set(spanAlongX ? 0 : off, -joistH / 2 - 0.02, spanAlongX ? off : 0);
        j.userData = { type: 'deck', label: 'Deck joist', example: true };
        g.add(j);
      }

      // Top boards
      const boardW = 0.46; // ~5.5 in
      const nB = Math.max(2, Math.ceil(w / boardW));
      const used = nB * boardW;
      const x0 = -used / 2 + boardW / 2;
      for (let i = 0; i < nB; i++) {
        const gap = 0.02;
        const bw = boardW - gap;
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(bw, boardT, depth - 0.08),
          boardMat
        );
        board.position.set(x0 + i * boardW, boardT / 2, 0);
        board.castShadow = true;
        board.receiveShadow = true;
        board.userData = { type: 'deck', label: 'Deck', example: true };
        g.add(board);
      }
      // Rim
      const rimMat = joistMat;
      [
        [w, 0.18, 0.1, 0, boardT / 2, -depth / 2 + 0.05],
        [w, 0.18, 0.1, 0, boardT / 2, depth / 2 - 0.05],
        [0.1, 0.18, depth, -w / 2 + 0.05, boardT / 2, 0],
        [0.1, 0.18, depth, w / 2 - 0.05, boardT / 2, 0],
      ].forEach((p) => {
        const rim = new THREE.Mesh(new THREE.BoxGeometry(p[0], p[1], p[2]), rimMat);
        rim.position.set(p[3], p[4], p[5]);
        rim.userData = { type: 'deck', label: 'Deck rim', example: true };
        g.add(rim);
      });
      group.add(g);
    });
  }

  /**
   * EXAMPLE straight stairs from grade up to floorY (pier height / deck top).
   * Added AFTER pier lift so y is world-absolute (not double-lifted).
   * Treads = twin 2×6 lumber boards side-by-side (EXAMPLE, not engineered).
   * Actual 2×6 ≈ 1.5" × 5.5" — readable lumber proportions matching deck boards.
   */
  function addStairsFromPlan(plan, ox, oz, group, floorY, mats) {
    const list = (plan && plan.stairs) || [];
    if (!list.length) return;
    const riseTotal = Math.max(0.5, Number(floorY) || 0.75);
    const treadMat = mats && mats.treadMat
      ? mats.treadMat
      : mat(0xb8956a, { roughness: 0.72, metalness: 0.03 });
    const stringerMat = mats && mats.stringerMat
      ? mats.stringerMat
      : mat(0x7a5a32, { roughness: 0.85, metalness: 0.02 });
    const riserHTarget = 7 / 12; // ~7 in EXAMPLE
    // Readable 2×6 lumber (match deck boardT / boardW)
    const boardT = 1.5 / 12; // ~1.5 in thick
    const boardFace = 5.5 / 12; // ~5.5 in face (run depth per board)
    const boardGap = 0.015; // ~3/16 in tight reveal so twin 2×6s read like real decking
    // Stringers ≈ 2×12 laid on edge (readable, not stick-thin)
    const strThick = 1.75 / 12; // ~1.75 in face
    const strDepth = 11.25 / 12; // ~11.25 in 2×12 depth
    list.forEach((s0) => {
      const st = s0 || {};
      const width = Math.max(2, Number(st.width) || 3.5);
      const runLength = Math.max(3, Number(st.runLength) || 10);
      const rot = Number(st.rotation) || 0;
      const cx = (Number(st.x) || 0) - ox;
      const cz = (Number(st.y) || 0) - oz;
      const nTreads = Math.max(3, Math.round(riseTotal / riserHTarget));
      const rise = riseTotal / nTreads;
      const treadRun = runLength / nTreads;
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      g.rotation.y = -rot; // plan rot: local +Y (depth) = run toward high/attach
      g.userData = { type: 'stairsFromGrade', label: 'Stairs', id: st.id, example: true, skipPierLift: true };

      // Stringers (two side 2×12 beams) — proportional under twin 2×6 treads
      const hyp = Math.hypot(runLength, riseTotal);
      const pitch = Math.atan2(riseTotal, runLength);
      const strInset = strThick / 2 + 0.02;
      // Center Y so after pitch rotation the low end sits ON grade (not buried by strDepth/2).
      const strCenterY = riseTotal / 2 + (strDepth / 2) * Math.cos(pitch);
      [-width / 2 + strInset, width / 2 - strInset].forEach((sx) => {
        const str = new THREE.Mesh(
          new THREE.BoxGeometry(strThick, strDepth, hyp),
          stringerMat
        );
        str.position.set(sx, strCenterY, 0);
        str.rotation.x = -pitch;
        str.castShadow = true;
        str.receiveShadow = true;
        str.userData = { type: 'stairs', label: 'Stairs stringer', example: true };
        g.add(str);
      });

      // Twin 2×6 treads per step (+ thin 1× riser boards)
      const treadSpan = Math.max(1.5, width - strThick * 2 - 0.06);
      const packDepth = boardFace * 2; // two faces; gap carved from each board
      const nosing = 0.75 / 12; // slight nose past riser
      for (let i = 0; i < nTreads; i++) {
        const yTop = (i + 1) * rise;
        // Local Z: low at -run/2, high at +run/2 — center twin pack on step
        const zStep = -runLength / 2 + (i + 0.5) * treadRun;
        // Front board (lower/run-out) then rear board (toward high end)
        const zFront = zStep - boardFace / 2;
        const zRear = zStep + boardFace / 2;
        [zFront, zRear].forEach((zBoard, bi) => {
          const bw = boardFace - boardGap;
          const tread = new THREE.Mesh(
            new THREE.BoxGeometry(treadSpan, boardT, bw),
            treadMat
          );
          tread.position.set(0, yTop - boardT / 2, zBoard);
          tread.castShadow = true;
          tread.receiveShadow = true;
          tread.userData = {
            type: 'stairs',
            label: bi === 0 ? 'Stair tread 2×6 (front)' : 'Stair tread 2×6 (rear)',
            example: true,
            lumber: '2x6',
          };
          g.add(tread);
        });
        // Thin riser under front of tread pack. Skip grade step (i===0) so
        // boards do not dig below GRADE_Y — stringer feet already meet grade.
        if (i > 0) {
          const riserT = 0.75 / 12; // ~1× thickness
          const riserH = Math.max(0.08, rise - boardT * 0.15);
          const zRiser = zStep - packDepth / 2 + nosing - riserT / 2;
          const riser = new THREE.Mesh(
            new THREE.BoxGeometry(treadSpan - 0.04, riserH, riserT),
            stringerMat
          );
          riser.position.set(0, yTop - boardT - riserH / 2, zRiser);
          riser.castShadow = true;
          riser.userData = { type: 'stairs', label: 'Stairs riser', example: true };
          g.add(riser);
        }
      }
      group.add(g);
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
    lastFloorAboveGrade = 0;
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

    // §2 + realism2 materials from Guidance answers (procedural albedo + bump)
    const wallMat = cladMaterial(cladKey, store.cladding_hex);
    const lumberMat = lumberMaterial();
    const roofMat = roofMaterial(roofKey, { lowSlope });
    const floorMat = floorMaterial('wood');
    const glassMat = glassMaterial();
    const frameMat = frameMaterial();
    const houseMat = cladMaterial('stucco'); // existing mass — neutral until house B7 drives it
    const foundKey = store.foundation_type || 'slab';
    const foundMat = foundMaterial(foundKey === 'piers' ? 'piers' : foundKey);
    const beamMat = foundMaterial('crawl'); // grade beam reads as cast concrete
    const attachMat = mat(0x2f6f6a, { emissive: 0x1a3d3a, emissiveIntensity: 0.12 });
    const frameWallMat = showStuds ? lumberMat : wallMat;
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

    const sketch = planHasSketch(plan);
    // PLAN GEOMETRY IS SOURCE OF TRUTH for 3D massing.
    // Guidance answers (A2a footprint, window_count, attach_side, etc.) must NEVER
    // invent an existing house or addition when Plan has no walls/rooms/decks/stairs/existingHouse.
    // (edit3d2 removed parametric 40×30+addition; edit3d3 hardens empty UX + cache-bust.)
    const trulyEmpty = !planHasAnyGeometry(plan);

    // Hide "Using defaults" on empty Plan — Guidance defaults alone do not spawn a house.
    if (defaultsChip) {
      const using = !trulyEmpty && (store.usingDefaults || []).length > 0;
      defaultsChip.hidden = !using;
    }

    if (emptyEl) {
      emptyEl.hidden = !trulyEmpty;
      if (trulyEmpty) {
        emptyEl.querySelector('p').textContent =
          'Plan is empty. Draw rooms/walls, place a Deck or Stairs, or add an Existing house on the Plan tab — 3D only shows what you drew (Clear wipes the old house). Guidance size answers alone do not build a house.';
      }
    }
    if (canvasHost) canvasHost.style.opacity = trulyEmpty ? '0.3' : '1';

    // Grade at GRADE_Y=0: pier bottoms / slab underside / stair feet sit ON this plane.
    addGradePlane(rootGroup, trulyEmpty, store);

    if (trulyEmpty) {
      // Defensive: zero house/addition meshes — ground + grid only.
      onResize();
      updateInspector(null);
      preserveCamera = false;
      return;
    }

    let focusY = wallH * 0.4;
    let span = 24;

    let focusLocalX = 0, focusLocalZ = 0;
    if (sketch) {
      const b = planBounds(plan);
      const ox = b.cx, oz = b.cy;
      planOrigin = { ox, oz };
      const fb = focusBounds(plan) || b;
      span = Math.max(fb.w, fb.d, 14) + 8;
      focusLocalX = fb.cx - ox;
      focusLocalZ = fb.cy - oz;

      (plan.rooms || []).forEach((r) => {
        const fw = Math.abs(r.w), fd = Math.abs(r.h);
        // Opaque finish flooring hides trusses from above — omit when Floor framing is on
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
        const ehUd = { type: 'existingHouse', label: 'Existing house' };
        boxAt(eh.lengthFt, ehH, eh.widthFt,
          eh.x + eh.lengthFt / 2 - ox, ehH / 2, eh.y + eh.widthFt / 2 - oz,
          houseMat, rootGroup, ehUd);
        addRoofGable(
          (() => { const g = new THREE.Group(); g.position.set(eh.x + eh.lengthFt / 2 - ox, 0, eh.y + eh.widthFt / 2 - oz); g.userData = ehUd; rootGroup.add(g); return g; })(),
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
            if (wantsCornerBoards(cladKey)) {
              const cbMat = cornerBoardMaterial();
              const half = WALL_THICK / 2;
              const rx = room.x - ox, rz = room.y - oz;
              const rw = room.w, rd = room.h;
              [
                [rx - half, rz - half],
                [rx + rw + half, rz - half],
                [rx + rw + half, rz + rd + half],
                [rx - half, rz + rd + half],
              ].forEach(([cx, cz]) => cornerBoardAt(cx, cz, h0, rootGroup, cbMat));
            }
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
      // Decks sit on floor plane (elevated with pier lift)
      addDecksFromPlan(plan, ox, oz, rootGroup, {
        boardMat: floorMat,
        joistMat: lumberMat,
      });

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
        // Roof footprint = addition exterior wall outline only (existing house keeps its roof).
        // additionBounds = wall centerlines; +WALL_THICK → outer stud/plate faces (corners flush).
        // Extra size beyond that comes solely from eave_overhang_in (modest, clamped ≤36 in).
        // Vertical (roof3): underside at wall line = top plate; tip may drop along pitch.
        const ab = additionBounds(plan) || b;
        const roofW = Math.max(ab.w, 1) + WALL_THICK;
        const roofD = Math.max(ab.d, 1) + WALL_THICK;
        const gRoof = new THREE.Group();
        gRoof.position.set(ab.cx - ox, 0, ab.cy - oz);
        gRoof.userData = { type: 'additionRoof' };
        addRoof(gRoof, roofW, roofD, maxWallH, pitch, eaveIn, roofMat, store.roof_tie_in, roofStyle);
        gRoof.visible = !!showRoof;
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

      // Conceptual floor framing / trusses under floor plane (EXAMPLE spacing).
      // Clip strictly to addition wall-plate footprint — NOT planBounds (that
      // includes existing house / eaves and made beams overshoot exterior walls).
      if (showFloorFraming) {
        const ab = additionBounds(plan);
        if (ab) {
          addFloorFraming(
            ab.cx - ox, ab.cy - oz,
            Math.max(ab.w, 2), Math.max(ab.d, 2),
            rootGroup, lumberMat, { topY: -0.02 }
          );
        }
      }

      // Foundation under addition footprint (not planBounds / existing house).
      // Y convention: GRADE_Y=0 is ground. Build foundations in local floor=0 space,
      // then lift content so contact bottoms sit ON grade; stairs span grade→floor.
      if (store.show_foundation !== false) {
        const ft = store.foundation_type || 'slab';
        const bb = planBounds(plan);
        const abFound = additionBounds(plan) || bb;
        const fcx = abFound ? (abFound.cx - ox) : 0;
        const fcz = abFound ? (abFound.cy - oz) : 0;
        const fW = abFound ? Math.max(abFound.w, 4) : (bb ? Math.max(bb.w, 4) : 6);
        const fD = abFound ? Math.max(abFound.d, 4) : (bb ? Math.max(bb.d, 4) : 6);
        let floorAboveGrade = 0;
        if (abFound && ft === 'piers') {
          const pierH = store.pier_height_ft > 0 ? store.pier_height_ft : PIER_H_DEFAULT;
          floorAboveGrade = pierH;
          addPierFoundation(fcx, fcz, fW, fD, pierH, foundMat, beamMat, rootGroup, {
            walls: plan.walls || [],
            ox: ox,
            oz: oz,
            spacingFt: store.pier_spacing_ft,
            diameterIn: store.pier_diameter_in,
            pierCount: store.pier_count,
          });
          // Elevate building onto pier tops (leave ground/grid/piers at grade)
          liftRootToGrade(rootGroup, pierH, { skipPierFoundation: true });
        } else if (abFound && ft === 'slab') {
          // Framing on: thin pad below trusses. Framing off: ~9 in slab reveal.
          // Both hang below local floor=0; lift puts underside ON grade.
          if (showFloorFraming) {
            const padH = SLAB_PAD_H;
            const beamBot = -0.02 - FLOOR_IBEAM_H;
            // Pad = addition exterior (centerline + WALL_THICK), not past walls
            boxAt(fW + WALL_THICK, padH, fD + WALL_THICK,
              fcx, beamBot - padH / 2 - 0.02, fcz, foundMat, rootGroup,
              { type: 'foundation', label: 'Foundation' });
          } else {
            boxAt(fW + WALL_THICK, FOUND_REVEAL_SLAB, fD + WALL_THICK,
              fcx, -FOUND_REVEAL_SLAB / 2, fcz, foundMat, rootGroup,
              { type: 'foundation', label: 'Foundation' });
          }
          floorAboveGrade = foundationContactDepth('slab', showFloorFraming);
          liftRootToGrade(rootGroup, floorAboveGrade);
        } else if (abFound && ft === 'crawl') {
          // Stem built below local floor; lift so stem bottom sits ON grade
          addStemWallRing(fcx, fcz, fW + WALL_THICK, fD + WALL_THICK, 2.5, -2.5, foundMat, rootGroup);
          floorAboveGrade = 2.5;
          liftRootToGrade(rootGroup, floorAboveGrade);
        } else if (abFound && ft === 'basement') {
          // Stem intentionally below grade; floor stays at GRADE_Y (no lift)
          addStemWallRing(fcx, fcz, fW + WALL_THICK, fD + WALL_THICK, 8, -8, foundMat, rootGroup);
          floorAboveGrade = 0.75; // modest door/deck step only
        }
        // Stairs from grade up to elevated floor / deck top (world-absolute, not double-lifted)
        const stairRise = Math.max(0.5, floorAboveGrade || 0.75);
        addStairsFromPlan(plan, ox, oz, rootGroup, stairRise, {
          treadMat: floorMat,
          stringerMat: lumberMat,
        });
        if (floorAboveGrade > 0) focusY += floorAboveGrade;
        lastFloorAboveGrade = floorAboveGrade || 0;
      }
    } else {
      // No walls/rooms: show only what Plan actually has (decks / stairs / existing house).
      // Do NOT invent a parametric 40×30 house + addition from Guidance defaults.
      const b = planBounds(plan);
      if (!b) {
        onResize();
        updateInspector(null);
        return;
      }
      const ox = b.cx, oz = b.cy;
      planOrigin = { ox, oz };
      const fb = focusBounds(plan) || b;
      span = Math.max(fb.w, fb.d, 14) + 8;
      focusLocalX = fb.cx - ox;
      focusLocalZ = fb.cy - oz;
      focusY = 2.5;

      if (plan.existingHouse) {
        const eh = plan.existingHouse;
        const ehH = 9;
        const ehUd = { type: 'existingHouse', label: 'Existing house' };
        boxAt(eh.lengthFt, ehH, eh.widthFt,
          eh.x + eh.lengthFt / 2 - ox, ehH / 2, eh.y + eh.widthFt / 2 - oz,
          houseMat, rootGroup, ehUd);
        addRoofGable(
          (() => { const g = new THREE.Group(); g.position.set(eh.x + eh.lengthFt / 2 - ox, 0, eh.y + eh.widthFt / 2 - oz); g.userData = ehUd; rootGroup.add(g); return g; })(),
          eh.lengthFt, eh.widthFt, ehH, 5 / 12, 12, mat(0x5c5048, { side: THREE.DoubleSide }), 'separate'
        );
        if (showDims) {
          makeLabel('Existing · ' + fmtFt(eh.lengthFt) + ' × ' + fmtFt(eh.widthFt),
            eh.x + eh.lengthFt / 2 - ox, ehH + 1.2, eh.y + eh.widthFt / 2 - oz, labelGroup, 3.5);
        }
        focusY = ehH * 0.4;
      }

      addDecksFromPlan(plan, ox, oz, rootGroup, {
        boardMat: floorMat,
        joistMat: lumberMat,
      });

      // Lone deck/stairs: raise deck to floor-above-grade so joists aren't buried;
      // stairs span GRADE_Y → deck top.
      const ft = store.foundation_type || 'slab';
      const stairRise = Math.max(
        0.5,
        floorElevationAboveGrade(ft, store, showFloorFraming) || 0.75
      );
      [...rootGroup.children].forEach((ch) => {
        if (!ch || !ch.userData) return;
        if (ch.userData.type === 'deck' || ch.userData.type === 'existingHouse') {
          ch.position.y += stairRise;
        }
      });
      addStairsFromPlan(plan, ox, oz, rootGroup, stairRise, {
        treadMat: floorMat,
        stringerMat: lumberMat,
      });
      focusY += stairRise * 0.35;
      lastFloorAboveGrade = stairRise;

      if (!keepCam) controls.target.set(focusLocalX, focusY, focusLocalZ);
    }

    // Warm interior fills at room / footprint centers near ceiling (capped; mobile-dimmed)
    if (!lightCenters.length) {
      lightCenters.push({ x: 0, y: Math.max(3, wallH * 0.88), z: 0, radius: 12 });
    }
    // Bump interior lights when floor was lifted above grade
    if (sketch && store) {
      const ftL = store.foundation_type || 'slab';
      const liftL = floorElevationAboveGrade(ftL, store, showFloorFraming);
      if (liftL > 0) lightCenters.forEach((c) => { c.y += liftL; });
    }
    placeInteriorLights(lightCenters, { studs: showStuds });
    applyShadowMode();

    if (!keepCam) {
      if (sketch) controls.target.set(focusLocalX, focusY, focusLocalZ);
      camera.position.set(
        focusLocalX + span * 0.9,
        Math.max(focusY, 2) + span * 0.55,
        focusLocalZ + span * 0.95
      );
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


  // ---- Door swing (EXAMPLE long-press) ----
  const DOOR_SWING_ANGLE = -Math.PI * 0.72;
  const DOOR_SWING_MS = 420;

  function tickDoorSwing() {
    if (!doorSwingAnim) return;
    const a = doorSwingAnim;
    const rec = windowMeshes.get(a.winId);
    if (!rec || !rec.doorLeaf) {
      doorSwingAnim = null;
      return;
    }
    const u = Math.min(1, (performance.now() - a.t0) / a.dur);
    const ease = u * u * (3 - 2 * u);
    rec.doorLeaf.rotation.y = a.from + (a.to - a.from) * ease;
    if (u >= 1) doorSwingAnim = null;
  }

  function toggleDoorSwing(winId) {
    if (!winId) return false;
    const rec = windowMeshes.get(winId);
    if (!rec || !rec.doorLeaf) return false;
    const open = !doorSwingOpen.get(winId);
    doorSwingOpen.set(winId, open);
    const from = rec.doorLeaf.rotation.y;
    const to = open ? DOOR_SWING_ANGLE : 0;
    doorSwingAnim = { winId, from, to, t0: performance.now(), dur: DOOR_SWING_MS };
    return true;
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
      oven_range: 'Oven / range',
      fridge: 'Fridge',
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
      case 'floorTruss': return ud.label || 'Floor truss';
      case 'floorIBeam': return ud.label || 'Floor truss';
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
    // Door long-press: EXAMPLE swing open/close (label still shows)
    const ud = picked && picked.userData;
    if (ud && ud.type === 'window' && (ud.openingType === 'door' || ud.openingType === 'large') && ud.winId) {
      toggleDoorSwing(ud.winId);
    }
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
    if (e.key === 'Escape') {
      if (addMode) {
        setAddMode(null);
        e.preventDefault();
        return;
      }
      if (selectedWinId) {
        exitEditMode();
        e.preventDefault();
      }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWinId) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      deleteSelectedOpening();
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

    // Add-opening mode: arm a short tap to place on wall (orbit still if drag)
    if (addMode) {
      clearLongPress();
      longPressShown = false;
      lastTapDown = null;
      pendingEmptyExit = null;
      addPendingTap = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, wasDrag: false };
      // Allow orbit if user drags; place on short tap in finishPointerUp
      return;
    }

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
    if (addPendingTap && addPendingTap.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - addPendingTap.x, e.clientY - addPendingTap.y) > TAP_MOVE_PX) {
        addPendingTap.wasDrag = true;
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
      const y = win.sillFt + win.heightFt / 2 + (lastFloorAboveGrade || 0);
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
        newW = Math.max(MIN_OPENING_W_FT, Math.min(wallLen * 0.85, newW));
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
        let newH = pt.y - (win.sillFt + (lastFloorAboveGrade || 0));
        newH = Math.max(MIN_OPENING_H_FT, Math.min(wallH - win.sillFt - 0.2, newH));
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
      addPendingTap = null;
      return;
    }

    // Add mode: short tap places opening on nearest wall under cursor
    if (addPendingTap && (e.pointerId == null || addPendingTap.pointerId === e.pointerId)) {
      const tap = addPendingTap;
      addPendingTap = null;
      if (!tap.wasDrag && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= TAP_MOVE_PX) {
        const placed = tryPlaceOpeningFromEvent(e);
        if (placed) {
          e.preventDefault && e.preventDefault();
          return;
        }
      }
      // Drag / miss: leave add mode sticky so user can try again
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
    // Only handle if the gesture relates to our canvas / active drag / pending exit / long-press / add tap
    if (!renderer) return;
    if (dragState || pendingEmptyExit || suppressOrbit || longPress || longPressShown || addPendingTap) {
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
    // World Y must include foundation lift (ground1); openings live on elevated floor.
    const yLocal = win ? (win.sillFt + win.heightFt / 2) : 4;
    const y = yLocal + (lastFloorAboveGrade || 0);
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

    // Keep foundation lift (ground1): openings are rootGroup children raised by lastFloorAboveGrade
    rec.group.position.set(mx, lastFloorAboveGrade || 0, mz);
    rec.group.rotation.y = -ang;

    const sizeChanged = Math.abs(rec.wFt - wFt) > 1e-4
      || Math.abs(rec.hFt - hFt) > 1e-4
      || Math.abs(rec.sill - sill) > 1e-4;
    if (!sizeChanged) return true;

    // Resize opening contents in place — do not touch framingRoot / studs
    const depth = WALL_THICK + 0.1;
    const trim = 0.16;
    const jamb = 0.1;
    const cy = sill + hFt / 2;
    const outerZ = WALL_THICK / 2;
    const gw = Math.max(0.1, wFt - jamb * 2);
    const gh = Math.max(0.1, hFt - jamb * 2);
    const isDoor = rec.openingType === 'door' || rec.openingType === 'large';
    const narrow = !isDoor && wFt < 1.15;
    const glassDepth = 0.04;
    const glassZ = depth / 2 - 0.015;
    const casingT = 0.1;
    const casingZ = outerZ + casingT / 2 + 0.02;
    const mullD = 0.07;
    const mullZ = glassZ + 0.02;
    const hk = 0.28;

    function resizeCasing(mesh, kind, sign) {
      if (!mesh) return;
      const z = sign * casingZ;
      mesh.geometry.dispose();
      if (kind === 'L' || kind === 'R') {
        mesh.geometry = new THREE.BoxGeometry(trim, hFt + trim * 1.2, casingT);
        mesh.position.set((kind === 'L' ? -1 : 1) * (wFt / 2 + trim / 2), cy + trim * 0.05, z);
      } else if (kind === 'T') {
        mesh.geometry = new THREE.BoxGeometry(wFt + trim * 2, trim, casingT);
        mesh.position.set(0, sill + hFt + trim / 2, z);
      } else {
        mesh.geometry = new THREE.BoxGeometry(wFt + trim * 2, isDoor ? trim * 0.55 : trim * 0.7, casingT);
        mesh.position.set(0, sill + (isDoor ? trim * 0.2 : -trim * 0.15), z);
      }
    }

    // Door leaf hinge at left jamb — panel contents offset by +wFt/2 in leaf space
    const leafX = (isDoor && rec.doorLeaf) ? (wFt / 2) : 0;
    if (rec.doorLeaf) {
      rec.doorLeaf.position.set(-wFt / 2, 0, 0);
    }
    if (rec.pane) {
      rec.pane.geometry.dispose();
      rec.pane.geometry = new THREE.BoxGeometry(Math.max(0.15, wFt - 0.04), Math.max(0.15, hFt - 0.04), depth);
      rec.pane.position.set(leafX, cy, 0);
    }
    if (rec.glass) {
      rec.glass.geometry.dispose();
      rec.glass.geometry = new THREE.BoxGeometry(gw, gh, glassDepth);
      rec.glass.position.set(leafX, cy, glassZ);
    }
    if (rec.glass2) {
      rec.glass2.geometry.dispose();
      rec.glass2.geometry = new THREE.BoxGeometry(gw, gh, glassDepth);
      rec.glass2.position.set(leafX, cy, -glassZ);
    }
    resizeCasing(rec.casingL, 'L', 1);
    resizeCasing(rec.casingR, 'R', 1);
    resizeCasing(rec.casingTop, 'T', 1);
    resizeCasing(rec.casingBot, 'B', 1);
    resizeCasing(rec.casingL2, 'L', -1);
    resizeCasing(rec.casingR2, 'R', -1);
    resizeCasing(rec.casingTop2, 'T', -1);
    resizeCasing(rec.casingBot2, 'B', -1);
    if (rec.sillMesh) {
      const sillH = 0.13;
      const sillDepth = WALL_THICK + SILL_PROJ * 2 + 0.18;
      rec.sillMesh.geometry.dispose();
      rec.sillMesh.geometry = new THREE.BoxGeometry(wFt + trim * 2 + 0.16, sillH, sillDepth);
      rec.sillMesh.position.set(0, sill - sillH * 0.15, 0);
    }
    if (rec.sillLip) {
      rec.sillLip.geometry.dispose();
      rec.sillLip.geometry = new THREE.BoxGeometry(wFt + trim * 2 + 0.2, 0.05, 0.09);
      rec.sillLip.position.set(0, sill + 0.025, outerZ + SILL_PROJ + 0.07);
    }
    if (rec.sillLip2) {
      rec.sillLip2.geometry.dispose();
      rec.sillLip2.geometry = new THREE.BoxGeometry(wFt + trim * 2 + 0.2, 0.05, 0.09);
      rec.sillLip2.position.set(0, sill + 0.025, -(outerZ + SILL_PROJ + 0.07));
    }
    const sashH = narrow ? 0.045 : 0.06;
    if (rec.mullH) {
      rec.mullH.geometry.dispose();
      if (isDoor) {
        rec.mullH.geometry = new THREE.BoxGeometry(Math.max(0.2, wFt - 0.2), 0.1, mullD);
        rec.mullH.position.set(leafX, sill + hFt * 0.4, mullZ);
      } else {
        rec.mullH.geometry = new THREE.BoxGeometry(Math.max(0.08, gw), sashH, mullD);
        rec.mullH.position.set(0, cy, mullZ);
      }
    }
    if (rec.mullH2) {
      rec.mullH2.geometry.dispose();
      rec.mullH2.geometry = new THREE.BoxGeometry(Math.max(0.08, gw), sashH, mullD);
      rec.mullH2.position.set(0, cy, -mullZ);
      rec.mullH2.visible = !isDoor;
    }
    if (rec.mull) {
      rec.mull.geometry.dispose();
      if (isDoor) {
        rec.mull.geometry = new THREE.BoxGeometry(0.07, Math.max(0.2, hFt * 0.28), 0.08);
        rec.mull.position.set(leafX + wFt * 0.32, cy, mullZ + 0.02);
        rec.mull.visible = true;
      } else if (narrow) {
        rec.mull.visible = false;
      } else {
        rec.mull.geometry = new THREE.BoxGeometry(0.07, Math.max(0.1, gh), mullD);
        rec.mull.position.set(0, cy, mullZ);
        rec.mull.visible = true;
      }
    }
    if (rec.mull2) {
      if (narrow || isDoor) {
        rec.mull2.visible = false;
      } else {
        rec.mull2.geometry.dispose();
        rec.mull2.geometry = new THREE.BoxGeometry(0.07, Math.max(0.1, gh), mullD);
        rec.mull2.position.set(0, cy, -mullZ);
        rec.mull2.visible = true;
      }
    }
    if (rec.leftH) rec.leftH.position.set(-wFt / 2 - 0.08, cy, depth * 0.55);
    if (rec.rightH) rec.rightH.position.set(wFt / 2 + 0.08, cy, depth * 0.55);
    if (rec.topH) rec.topH.position.set(0, sill + hFt + 0.1, depth * 0.55);

    rec.wFt = wFt;
    rec.hFt = hFt;
    rec.sill = sill;
    rec.narrow = narrow;
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

  function defaultWinPresetFromStore() {
    const w = (lastStore && lastStore.opening_preset_win_w_in) || 36;
    const h = (lastStore && lastStore.opening_preset_win_h_in) || 48;
    const match = WIN_SIZE_PRESETS.find((p) => p.w === w && p.h === h);
    return match ? { id: match.id, w: match.w, h: match.h } : { id: 'custom', w, h };
  }

  function defaultDoorPresetFromStore() {
    const w = (lastStore && lastStore.opening_preset_door_w_in) || DEFAULT_DOOR_W_IN;
    const h = (lastStore && lastStore.opening_preset_door_h_in) || DEFAULT_DOOR_H_IN;
    const match = DOOR_SIZE_PRESETS.find((p) => p.w === w && p.h === h);
    return match ? { id: match.id, w: match.w, h: match.h } : { id: 'custom', w, h };
  }

  function getActiveAddPreset() {
    if (addMode === 'door') return addPresetDoor;
    return addPresetWin;
  }

  function setAddMode(mode) {
    if (mode && mode !== 'window' && mode !== 'door') mode = null;
    addMode = mode || null;
    addPendingTap = null;
    if (addMode) {
      // Exit edit when entering place mode
      if (selectedWinId) selectWindow(null, { silent: true });
      if (addMode === 'window' && (!addPresetWin || !addPresetWin.w)) {
        addPresetWin = defaultWinPresetFromStore();
      }
      if (addMode === 'door' && (!addPresetDoor || !addPresetDoor.w)) {
        addPresetDoor = defaultDoorPresetFromStore();
      }
    }
    updateAddChrome();
    if (hooks.onAddModeChange) {
      try { hooks.onAddModeChange(addMode); } catch (err) { console.warn(err); }
    }
  }

  function updateAddChrome() {
    const btnWin = container.querySelector('#view3d-add-window');
    const btnDoor = container.querySelector('#view3d-add-door');
    const btnCancel = container.querySelector('#view3d-add-cancel');
    const chips = container.querySelector('#view3d-size-chips');
    const hint = container.querySelector('#view3d-hint');
    if (btnWin) btnWin.classList.toggle('active', addMode === 'window');
    if (btnDoor) btnDoor.classList.toggle('active', addMode === 'door');
    if (btnCancel) {
      if (addMode) { btnCancel.hidden = false; btnCancel.removeAttribute('hidden'); }
      else { btnCancel.hidden = true; btnCancel.setAttribute('hidden', ''); }
    }
    if (chips) {
      if (addMode) {
        chips.hidden = false;
        chips.removeAttribute('hidden');
        renderSizeChips(chips, addMode === 'door' ? DOOR_SIZE_PRESETS : WIN_SIZE_PRESETS, getActiveAddPreset(), (preset) => {
          if (addMode === 'door') addPresetDoor = { id: preset.id, w: preset.w, h: preset.h };
          else addPresetWin = { id: preset.id, w: preset.w, h: preset.h };
          updateAddChrome();
        });
      } else {
        chips.hidden = true;
        chips.setAttribute('hidden', '');
        chips.innerHTML = '';
      }
    }
    if (hint && hint.dataset) {
      if (addMode === 'window') {
        hint.dataset.base = hint.dataset.base || hint.innerHTML;
        hint.innerHTML = '<strong>Add window:</strong> tap a wall to place · pick size chip · Cancel / Esc to exit';
      } else if (addMode === 'door') {
        hint.dataset.base = hint.dataset.base || hint.innerHTML;
        hint.innerHTML = '<strong>Add door:</strong> tap a wall to place · pick size chip · Cancel / Esc to exit';
      } else if (hint.dataset.base) {
        hint.innerHTML = hint.dataset.base;
      }
    }
    if (renderer && renderer.domElement) {
      renderer.domElement.style.cursor = addMode ? 'crosshair' : '';
    }
  }

  function renderSizeChips(host, presets, active, onPick) {
    if (!host) return;
    host.innerHTML = '';
    presets.forEach((preset) => {
      if (!preset.w || !preset.h) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'view3d-size-chip' + (active && active.id === preset.id ? ' active' : '');
      btn.textContent = preset.label;
      btn.title = preset.title || preset.label;
      btn.dataset.presetId = preset.id;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick(preset);
      });
      host.appendChild(btn);
    });
  }

  function wireOpeningsUI() {
    const btnWin = container.querySelector('#view3d-add-window');
    const btnDoor = container.querySelector('#view3d-add-door');
    const btnCancel = container.querySelector('#view3d-add-cancel');
    if (btnWin) {
      btnWin.addEventListener('click', () => {
        setAddMode(addMode === 'window' ? null : 'window');
      });
    }
    if (btnDoor) {
      btnDoor.addEventListener('click', () => {
        setAddMode(addMode === 'door' ? null : 'door');
      });
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', () => setAddMode(null));
    }
    // Seed presets from store when available later; initial defaults OK
    addPresetWin = { id: '3x4', w: 36, h: 48 };
    addPresetDoor = { id: '36x80', w: DEFAULT_DOOR_W_IN, h: DEFAULT_DOOR_H_IN };
    updateAddChrome();
  }

  /** Types that must not win opening-place raycasts (decks/stairs/grid/eh steal hits). */
  const PLACE_SKIP_TYPES = new Set([
    'ground', 'roof', 'floorFraming', 'floorTruss', 'floorIBeam', 'floor', 'floorJunction',
    'pier', 'pierFoundation', 'gradeBeam', 'grid', 'deck', 'stairs', 'stairsFromGrade',
    'foundation', 'existingHouse', 'additionRoof', 'framingRoot',
  ]);
  const PLACE_PREFER_TYPES = new Set([
    'stud', 'window', 'cornerPost', 'topPlate', 'bottomPlate', 'header', 'sill', 'cripple',
    'finishWall', 'wall',
  ]);

  function rawTypeUserData(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.type) return o.userData;
      o = o.parent;
    }
    return null;
  }

  function pickWorldPoint(e) {
    if (!renderer || !rootGroup) return null;
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(rootGroup.children, true);
    let preferred = null;
    let anyUsable = null;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (!h.object || h.object.isSprite) continue;
      // Skip Line/Grid helpers even if untagged
      if (h.object.isLine || h.object.isLineSegments) continue;
      const ud = rawTypeUserData(h.object);
      const type = ud && ud.type;
      if (!type || PLACE_SKIP_TYPES.has(type)) continue;
      if (PLACE_PREFER_TYPES.has(type)) {
        preferred = h.point.clone();
        break;
      }
      if (!anyUsable) anyUsable = h.point.clone();
    }
    // Mid-wall plane (grade-lift aware) — reliable when decks/grid sit in front of walls
    let pierLift = 0;
    if (lastStore) {
      const ftP = lastStore.foundation_type || 'slab';
      pierLift = floorElevationAboveGrade(ftP, lastStore, showFloorFraming);
    }
    const y = (((lastStore && lastStore.wall_height_ft) || 8) * 0.45) + pierLift;
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, y, 0));
    const planePt = new THREE.Vector3();
    const hasPlane = raycaster.ray.intersectPlane(plane, planePt);

    const candidates = [];
    if (preferred) candidates.push(preferred);
    if (anyUsable) candidates.push(anyUsable);
    if (hasPlane) candidates.push(planePt.clone());
    if (!candidates.length) return null;

    // Prefer the candidate nearest a wall (decks no longer win by being first)
    let best = null;
    candidates.forEach((pt) => {
      const near = findNearestWallAt(pt.x, pt.z, 12);
      if (!near) return;
      if (!best || near.dist < best.dist) best = { pt, dist: near.dist };
    });
    if (best) return best.pt;
    return preferred || anyUsable || (hasPlane ? planePt : null);
  }

  function findNearestWallAt(worldX, worldZ, maxDist) {
    if (!lastPlan) return null;
    const ox = planOrigin.ox, oz = planOrigin.oz;
    const px = worldX + ox;
    const py = worldZ + oz;
    let best = null;
    (lastPlan.walls || []).forEach((wall) => {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 < 0.01) return;
      let t = ((px - wall.x1) * dx + (py - wall.y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const qx = wall.x1 + dx * t;
      const qy = wall.y1 + dy * t;
      const dist = Math.hypot(px - qx, py - qy);
      if (!best || dist < best.dist) best = { wall, t, dist, len: Math.sqrt(len2) };
    });
    const lim = maxDist != null ? maxDist : 2.8;
    if (!best || best.dist > lim) return null;
    return best;
  }

  function tryPlaceOpeningFromEvent(e) {
    if (!addMode || !lastPlan) return false;
    const pt = pickWorldPoint(e);
    if (!pt) {
      if (hooks.onToast) hooks.onToast('Tap on or near a wall to place');
      return false;
    }
    // Account for pier lift: content may be raised; walls are relative to rootGroup
    let localX = pt.x, localZ = pt.z;
    if (rootGroup) {
      // pt is world; rootGroup may be at origin — pier lift is on children, wall coords are local
      // Hit points on elevated meshes already include child.position.y but x/z match plan local
    }
    const near = findNearestWallAt(localX, localZ, 5.5);
    if (!near) {
      if (hooks.onToast) hooks.onToast('Tap on or near a wall to place');
      return false;
    }
    const type = addMode;
    const preset = getActiveAddPreset();
    const wIn = preset.w || (type === 'door' ? DEFAULT_DOOR_W_IN : 36);
    const hIn = preset.h || (type === 'door' ? DEFAULT_DOOR_H_IN : 48);
    const widthFt = wIn / 12;
    const heightFt = hIn / 12;
    const halfT = (widthFt / Math.max(near.len, 0.1)) / 2;
    let t = near.t;
    t = Math.max(halfT + 0.02, Math.min(1 - halfT - 0.02, t));
    const payload = {
      type,
      wall_id: near.wall.id,
      t,
      w_ft: Math.round(widthFt * 1000) / 1000,
      h_ft: Math.round(heightFt * 1000) / 1000,
      sill_ft: type === 'door' ? 0 : DEFAULT_WIN_SILL,
      door_type: (type === 'door' && wIn >= 60) ? 'sliding' : null,
      preset_id: preset.id,
    };
    let win = null;
    if (hooks.onOpeningAdd) {
      try { win = hooks.onOpeningAdd(payload); } catch (err) { console.warn(err); }
    } else {
      // Fallback: mutate local plan (verify / standalone)
      if (!lastPlan.windows) lastPlan.windows = [];
      const id = (type === 'door' ? 'door_' : 'win_') + Math.random().toString(36).slice(2, 8);
      win = normalizeWin({
        id, wallId: near.wall.id, t, widthFt: payload.w_ft, heightFt: payload.h_ft,
        sillFt: payload.sill_ft, openingType: type, doorType: payload.door_type,
      }, lastStore);
      lastPlan.windows.push(win);
      preserveCamera = true;
      buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
    }
    setAddMode(null);
    if (win && win.id) {
      // Prefer arming edit on the new opening (place-then-select)
      selectWindow(win.id);
    }
    return !!win;
  }

  function applyInspectorPreset(preset) {
    if (!selectedWinId || !preset || !(preset.w > 0)) return;
    const patch = {
      widthFt: preset.w / 12,
      heightFt: preset.h / 12,
    };
    const win = getWinData(selectedWinId);
    if (win) {
      const isDoor = (win.openingType === 'door' || win.openingType === 'large' || win.autoShared);
      if (isDoor) patch.sillFt = 0;
      else if (preset.h <= 30) patch.sillFt = Math.max(win.sillFt, 2.5); // keep sill for short tall-narrow
    }
    const wall = getWallForWin(win);
    if (win && wall) {
      const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
      const halfT = (patch.widthFt / len) / 2;
      patch.t = Math.max(halfT + 0.01, Math.min(1 - halfT - 0.01, win.t));
    }
    applyLocalWin(selectedWinId, patch);
    const updated = getWinData(selectedWinId);
    if (updated && hooks.onWindowChange) hooks.onWindowChange({ ...updated }, { final: true });
  }

  function deleteSelectedOpening() {
    const id = selectedWinId;
    if (!id) return false;
    let ok = false;
    if (hooks.onOpeningDelete) {
      try { ok = !!hooks.onOpeningDelete(id); } catch (err) { console.warn(err); }
    } else if (lastPlan && lastPlan.windows) {
      const before = lastPlan.windows.length;
      lastPlan.windows = lastPlan.windows.filter((w) => w.id !== id);
      ok = lastPlan.windows.length < before;
      if (ok) {
        preserveCamera = true;
        buildFromPlan(lastPlan, lastStore, { preserveCamera: true });
      }
    }
    if (ok) {
      selectWindow(null);
      if (hooks.onToast) {
        try { hooks.onToast('Opening removed'); } catch (_) {}
      }
    }
    return ok;
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
    const delBtn = inspectorEl.querySelector('#v3d-win-delete');
    if (delBtn) delBtn.addEventListener('click', () => deleteSelectedOpening());
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
    const isDoor = win.openingType === 'door' || win.openingType === 'large' || win.autoShared;
    const presetHost = panel.querySelector('#v3d-insp-presets');
    if (presetHost) {
      const list = isDoor ? DOOR_SIZE_PRESETS : WIN_SIZE_PRESETS;
      const wIn = Math.round(win.widthFt * 12);
      const hIn = Math.round(win.heightFt * 12);
      const active = list.find((p) => p.w === wIn && p.h === hIn) || null;
      renderSizeChips(presetHost, list, active, (preset) => applyInspectorPreset(preset));
    }
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
    let pierTubeCount = 0;
    let pierH = 0;
    let pierSpacingFt = 0;
    let pierDiameterIn = 0;
    let pierPositions = [];
    let gradeBeamCount = 0;
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
          if (o.userData.spacingFt) pierSpacingFt = o.userData.spacingFt;
          if (o.userData.diameterIn) pierDiameterIn = o.userData.diameterIn;
          if (o.userData.count) pierTubeCount = o.userData.count;
        }
        if (o.userData && o.userData.type === 'pier' && o.userData.label === 'Pier / sonotube') {
          pierPositions.push([
            Math.round(o.position.x * 100) / 100,
            Math.round(o.position.z * 100) / 100,
          ]);
        }
        if (o.userData && o.userData.type === 'gradeBeam') gradeBeamCount += 1;
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
      pierTubeCount: pierPositions.length || pierTubeCount,
      pierPositions,
      pierH,
      pierSpacingFt,
      pierDiameterIn: pierDiameterIn || (lastStore && lastStore.pier_diameter_in) || 0,
      pier_spacing_ft: lastStore ? lastStore.pier_spacing_ft : null,
      pier_height_ft: lastStore ? lastStore.pier_height_ft : null,
      pier_diameter_in: lastStore ? lastStore.pier_diameter_in : null,
      pier_count: lastStore ? lastStore.pier_count : null,
      gradeBeamCount,
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
    setShowRoof,
    getShowRoof: () => showRoof,
    debugToggleDoorSwing: toggleDoorSwing,
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
    setAddMode,
    getAddMode: () => addMode,
    deleteSelectedOpening,
    setAddPreset: (kind, preset) => {
      if (kind === 'door') addPresetDoor = Object.assign({}, addPresetDoor, preset || {});
      else addPresetWin = Object.assign({}, addPresetWin, preset || {});
      updateAddChrome();
    },
    getAddPreset: (kind) => (kind === 'door' ? { ...addPresetDoor } : { ...addPresetWin }),
    debugTryPlaceOpening: (clientX, clientY) => tryPlaceOpeningFromEvent({ clientX, clientY }),
    WIN_SIZE_PRESETS,
    DOOR_SIZE_PRESETS,
  };
}

window.HomePlan3D = { createView3D };
export { createView3D };
