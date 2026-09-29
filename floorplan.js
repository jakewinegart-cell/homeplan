/**
 * HomePlan floor-plan canvas
 * Tools: select, wall, room, window, fixtures (counter/cabinet/sink/outlet) + Roof picker
 */
(function (global) {
  'use strict';

  const FT_PER_GRID = 1; // 1 grid unit = 1 ft in model space
  const PX_PER_FT = 20;  // base pixels per foot at zoom 1
  const SNAP = 0.5;     // snap to half-foot

  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function snapVal(v) {
    return Math.round(v / SNAP) * SNAP;
  }

  function pointNearSegment(p, a, b, thresh) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-8) return { d: dist(p, a), t: 0, pt: { x: a.x, y: a.y } };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const pt = { x: a.x + t * dx, y: a.y + t * dy };
    return { d: dist(p, pt), t, pt };
  }


  const DEFAULT_WIN_WIDTH_FT = 3;
  const DEFAULT_WIN_HEIGHT_FT = 4;
  const DEFAULT_WIN_SILL_FT = 2.5;

  const DEFAULT_DOOR_WIDTH_FT = 32 / 12;  // 2′8″
  const DEFAULT_DOOR_HEIGHT_FT = 80 / 12; // 6′8″
  const WIN_SIZE_PRESETS = [
    { id: '3x4', label: '3×4', wIn: 36, hIn: 48 },
    { id: '3x5', label: '3×5', wIn: 36, hIn: 60 },
    { id: '4x4', label: '4×4', wIn: 48, hIn: 48 },
    { id: '8x24', label: '8×24', wIn: 8, hIn: 24, title: 'Narrow 8 in × 2 ft' },
  ];
  const SHARED_EDGE_EPS_FT = 0.25;
  const SHARED_EDGE_MIN_OVERLAP_FT = 2.0;

  function normalizeWindow(win) {
    if (!win) return null;
    const t = win.t != null ? Number(win.t) : 0.5;
    const openingType = win.openingType || (win.autoShared ? 'door' : null);
    const isDoor = openingType === 'door' || openingType === 'large';
    const out = {
      id: win.id || uid(isDoor ? 'door' : 'win'),
      wallId: win.wallId,
      t: isFinite(t) ? Math.max(0, Math.min(1, t)) : 0.5,
      widthFt: (win.widthFt > 0) ? Number(win.widthFt) : (isDoor ? DEFAULT_DOOR_WIDTH_FT : DEFAULT_WIN_WIDTH_FT),
      heightFt: (win.heightFt > 0) ? Number(win.heightFt) : (isDoor ? DEFAULT_DOOR_HEIGHT_FT : DEFAULT_WIN_HEIGHT_FT),
      sillFt: (win.sillFt != null && win.sillFt >= 0)
        ? Number(win.sillFt)
        : (isDoor ? 0 : DEFAULT_WIN_SILL_FT),
    };
    if (openingType) out.openingType = openingType;
    if (win.doorType) out.doorType = win.doorType;
    if (win.autoShared) out.autoShared = true;
    if (win.sharedKey) out.sharedKey = win.sharedKey;
    if (win.pairKey) out.pairKey = win.pairKey;
    return out;
  }


  // ---- Fixtures v1 (dims from remodel-app-fixtures-v1.md — EXAMPLE / conceptual) ----
  const IN_PER_FT = 12;
  const FIXTURE_DEFS = {
    counter_base: {
      fixtureId: 'counter_base',
      label: 'Counter (base run)',
      depthIn: 24,
      heightIn: 36,       // top AFF
      thicknessIn: 1.5,
      overhangIn: 1,
      defaultWidthIn: 36,
      planKind: 'floor',
      tool: 'counter',
    },
    cab_base: {
      fixtureId: 'cab_base',
      label: 'Base cabinet',
      depthIn: 24,
      heightIn: 34.5,
      defaultWidthIn: 24,
      modulesIn: [12, 18, 24, 30, 36],
      planKind: 'floor',
      tool: 'cabinet',
    },
    cab_upper: {
      fixtureId: 'cab_upper',
      label: 'Upper cabinet',
      depthIn: 12,
      heightIn: 30,
      defaultWidthIn: 30,
      bottomAffIn: 54,
      modulesIn: [12, 18, 24, 30, 36],
      planKind: 'floor',
      dashed: true,
      tool: 'cabinet',
    },
    sink_kitchen: {
      fixtureId: 'sink_kitchen',
      label: 'Kitchen sink',
      widthIn: 30,
      depthIn: 22,
      defaultWidthIn: 30,
      planKind: 'floor',
      oval: true,
      tool: 'sink',
    },
    sink_bar: {
      fixtureId: 'sink_bar',
      label: 'Bar / prep sink',
      widthIn: 15,
      depthIn: 15,
      defaultWidthIn: 15,
      planKind: 'floor',
      oval: true,
      tool: 'sink',
    },
    sink_bath: {
      fixtureId: 'sink_bath',
      label: 'Bath sink / lav',
      widthIn: 19,
      depthIn: 16,
      defaultWidthIn: 19,
      planKind: 'floor',
      oval: true,
      tool: 'sink',
    },
    outlet_duplex: {
      fixtureId: 'outlet_duplex',
      label: 'Outlet',
      plateWIn: 2.75,
      plateHIn: 4.5,
      affIn: 12,
      counterAffIn: 42,
      planKind: 'wall',
      tool: 'outlet',
    },
    switch_single: {
      fixtureId: 'switch_single',
      label: 'Light switch',
      plateWIn: 2.75,
      plateHIn: 4.5,
      affIn: 48,
      planKind: 'wall',
      tool: 'outlet',
    },
  };

  const FIXTURE_TOOL_DEFAULTS = {
    counter: 'counter_base',
    cabinet: 'cab_base',
    sink: 'sink_kitchen',
    outlet: 'outlet_duplex',
  };

  const FIXTURE_TOOL_OPTIONS = {
    counter: ['counter_base'],
    cabinet: ['cab_base', 'cab_upper'],
    sink: ['sink_kitchen', 'sink_bar', 'sink_bath'],
    outlet: ['outlet_duplex', 'switch_single'],
  };

  function fixtureDef(id) {
    return FIXTURE_DEFS[id] || null;
  }

  function normalizeFixture(fx) {
    if (!fx) return null;
    const id = fx.fixtureId || fx.type || 'cab_base';
    const def = FIXTURE_DEFS[id] || FIXTURE_DEFS.cab_base;
    const out = {
      id: fx.id || uid('fix'),
      fixtureId: def.fixtureId,
      label: fx.label || def.label,
      planKind: def.planKind,
    };
    if (def.planKind === 'wall') {
      out.wallId = fx.wallId || null;
      out.t = (fx.t != null && isFinite(Number(fx.t))) ? Math.max(0, Math.min(1, Number(fx.t))) : 0.5;
      out.affIn = (fx.affIn != null && isFinite(Number(fx.affIn))) ? Number(fx.affIn) : def.affIn;
      out.plateWIn = def.plateWIn;
      out.plateHIn = def.plateHIn;
      if (fx.roomId) out.roomId = fx.roomId;
    } else {
      out.x = Number(fx.x) || 0;
      out.y = Number(fx.y) || 0;
      out.rot = (fx.rot != null && isFinite(Number(fx.rot))) ? Number(fx.rot) : 0;
      const wIn = fx.widthIn != null ? Number(fx.widthIn) : (def.defaultWidthIn || def.widthIn || 24);
      const dIn = fx.depthIn != null ? Number(fx.depthIn) : (def.depthIn || 24);
      out.widthIn = isFinite(wIn) && wIn > 0 ? wIn : (def.defaultWidthIn || 24);
      out.depthIn = isFinite(dIn) && dIn > 0 ? dIn : (def.depthIn || 24);
      if (def.heightIn != null) out.heightIn = fx.heightIn != null ? Number(fx.heightIn) : def.heightIn;
      if (def.thicknessIn != null) out.thicknessIn = def.thicknessIn;
      if (def.overhangIn != null) out.overhangIn = def.overhangIn;
      if (def.bottomAffIn != null) out.bottomAffIn = fx.bottomAffIn != null ? Number(fx.bottomAffIn) : def.bottomAffIn;
      if (fx.wallId) out.wallId = fx.wallId;
      if (fx.t != null) out.t = Number(fx.t);
      if (fx.roomId) out.roomId = fx.roomId;
    }
    return out;
  }

  function createFloorPlan(canvas, hooks) {
    const ctx = canvas.getContext('2d');
    const state = {
      walls: [],      // {id, x1,y1,x2,y2}
      rooms: [],      // {id, name, x,y,w,h}  w/h in ft
      windows: [],    // {id, wallId, t, widthFt, heightFt, sillFt}
      fixtures: [],   // counters/cabinets/sinks/outlets — see FIXTURE_DEFS
      activeFixtureId: 'counter_base',
      activeWinPresetId: '3x4',
      rooflines: [],  // {id, points:[{x,y},...]} legacy freehand ridges
      roofPitch: null,       // numeric rise/run (e.g. 6/12)
      roofPitchLabel: null,  // '6/12'
      roofStyle: null,       // 'gable' | 'hip'
      tool: 'select',
      selected: null, // {type, id}
      zoom: 1,
      panX: 40,
      panY: 40,
      history: [],
      drawing: null,  // in-progress gesture
      spaceDown: false,
      panning: false,
      lastPan: null,
      activePointers: new Map(), // pointerId -> {x,y}
      pinchStartDist: null,
      pinchStartZoom: 1,
      // Locked existing house footprint (addition context) — not selectable
      existingHouse: null, // { lengthFt, widthFt, x, y }
    };

    function pushHistory() {
      state.history.push(JSON.stringify({
        walls: state.walls,
        rooms: state.rooms,
        windows: state.windows,
        fixtures: state.fixtures,
        rooflines: state.rooflines,
        roofPitch: state.roofPitch,
        roofPitchLabel: state.roofPitchLabel,
        roofStyle: state.roofStyle,
      }));
      if (state.history.length > 40) state.history.shift();
    }

    function undo() {
      if (!state.history.length) return;
      const prev = JSON.parse(state.history.pop());
      state.walls = prev.walls;
      state.rooms = prev.rooms;
      state.windows = prev.windows;
      state.fixtures = (prev.fixtures || []).map(normalizeFixture).filter(Boolean);
      state.rooflines = prev.rooflines;
      state.roofPitch = prev.roofPitch != null ? prev.roofPitch : null;
      state.roofPitchLabel = prev.roofPitchLabel || null;
      state.roofStyle = prev.roofStyle || null;
      state.selected = null;
      state.drawing = null;
      notify();
      draw();
    }

    function clearAll() {
      if (!state.walls.length && !state.rooms.length && !state.windows.length && !state.fixtures.length && !state.rooflines.length) return;
      pushHistory();
      state.walls = [];
      state.rooms = [];
      state.windows = [];
      state.fixtures = [];
      state.rooflines = [];
      state.roofPitch = null;
      state.roofPitchLabel = null;
      state.roofStyle = null;
      state.selected = null;
      state.drawing = null;
      notify();
      draw();
    }

    function setTool(tool) {
      if (tool === 'undo') { undo(); return; }
      if (tool === 'clear') {
        if (confirm('Clear the entire floor plan?')) clearAll();
        return;
      }
      // Freehand roofline demoted — Roof toolbar opens the pitch/style picker instead
      if (tool === 'roofline') {
        if (hooks.onToast) hooks.onToast('Use Roof for pitch & style (freehand demoted)');
        tool = 'select';
      }
      // Finishing mid-draw when switching away
      if (tool !== state.tool) {
        if (state.drawing && state.drawing.kind === 'roofline') finishRoofline();
        else if (state.drawing && state.drawing.kind === 'wall-chain') {
          state.drawing = null;
        }
      }
      state.tool = tool;
      if (FIXTURE_TOOL_DEFAULTS[tool]) {
        const opts = FIXTURE_TOOL_OPTIONS[tool] || [];
        if (!opts.includes(state.activeFixtureId)) {
          state.activeFixtureId = FIXTURE_TOOL_DEFAULTS[tool];
        }
      }
      if (!(state.drawing && (state.drawing.kind === 'wall-chain' || state.drawing.kind === 'roofline'))) {
        state.drawing = null;
      }
      canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
      draw();
      updateDrawChrome();
      if (hooks.onToolChange) hooks.onToolChange(tool, { activeFixtureId: state.activeFixtureId });
    }

    function canFinishStroke() {
      const d = state.drawing;
      if (!d) return false;
      if (d.kind === 'wall-chain') return true;
      if (d.kind === 'roofline' && d.points && d.points.length >= 1) return true;
      return false;
    }

    function finishCurrentStroke() {
      if (state.drawing && state.drawing.kind === 'roofline') {
        finishRoofline();
        updateDrawChrome();
        return;
      }
      if (state.drawing && state.drawing.kind === 'wall-chain') {
        state.drawing = null;
        draw();
        updateDrawChrome();
        if (hooks.onToast) hooks.onToast('Wall chain finished');
        return;
      }
    }

    function updateDrawChrome() {
      if (hooks.onDrawChrome) hooks.onDrawChrome({
        tool: state.tool,
        canFinish: canFinishStroke(),
        drawingKind: state.drawing && state.drawing.kind,
        activeFixtureId: state.activeFixtureId,
        fixtureOptions: FIXTURE_TOOL_OPTIONS[state.tool] || null,
      });
    }

    function worldFromEvent(e) {
      // CSS pixels only — must match toScreen/pan after ctx.setTransform(dpr,…)
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const scale = PX_PER_FT * state.zoom;
      return {
        x: (sx - state.panX) / scale,
        y: (sy - state.panY) / scale,
      };
    }

    function isPrimaryDrawPointer(e) {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        return e.isPrimary !== false;
      }
      // mouse: only left button (button 0); ignore right/middle
      return e.button === 0 || e.button === -1;
    }

    function isPanGesture(e) {
      if (state.spaceDown) return true;
      if (e.pointerType === 'mouse' && (e.button === 1 || (e.button === 0 && e.altKey))) return true;
      return false;
    }

    function toScreen(wx, wy) {
      const scale = PX_PER_FT * state.zoom;
      return {
        x: wx * scale + state.panX,
        y: wy * scale + state.panY,
      };
    }

    function snapPoint(p) {
      return { x: snapVal(p.x), y: snapVal(p.y) };
    }

    function screenFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const HANDLE_HIT_PX = 30;   // touch-friendly hit target (~24–32+)
    const HANDLE_DRAW_PX = 11;
    const ROOM_MIN_FT = 1;

    function getRoomHandles(room) {
      const x0 = room.x, y0 = room.y;
      const x1 = room.x + room.w, y1 = room.y + room.h;
      const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      return [
        { id: 'nw', x: x0, y: y0 },
        { id: 'n',  x: xm, y: y0 },
        { id: 'ne', x: x1, y: y0 },
        { id: 'e',  x: x1, y: ym },
        { id: 'se', x: x1, y: y1 },
        { id: 's',  x: xm, y: y1 },
        { id: 'sw', x: x0, y: y1 },
        { id: 'w',  x: x0, y: ym },
      ];
    }

    function hitTestResizeHandle(e) {
      if (!state.selected || state.selected.type !== 'room') return null;
      const room = state.rooms.find((r) => r.id === state.selected.id);
      if (!room) return null;
      const sp = screenFromEvent(e);
      const half = HANDLE_HIT_PX / 2;
      for (const h of getRoomHandles(room)) {
        const s = toScreen(h.x, h.y);
        if (Math.abs(sp.x - s.x) <= half && Math.abs(sp.y - s.y) <= half) {
          return { handle: h.id, roomId: room.id };
        }
      }
      return null;
    }


    const DEFAULT_WALL_HEIGHT_FT = 8;
    const ROOM_SIDES = ['north', 'east', 'south', 'west'];

    /** Plan Y grows downward: north = top (min y), south = bottom (max y). */
    function roomEdgeCoords(room) {
      const x = room.x, y = room.y, w = room.w, h = room.h;
      return {
        north: { x1: x, y1: y, x2: x + w, y2: y },
        east:  { x1: x + w, y1: y, x2: x + w, y2: y + h },
        south: { x1: x + w, y1: y + h, x2: x, y2: y + h },
        west:  { x1: x, y1: y + h, x2: x, y2: y },
      };
    }

    function sideLabel(side) {
      const map = {
        north: 'North (top)',
        east: 'East (right)',
        south: 'South (bottom)',
        west: 'West (left)',
      };
      return map[side] || side;
    }

    function normalizeHeights(heights) {
      const out = {};
      ROOM_SIDES.forEach((s) => {
        const v = heights && heights[s] != null ? Number(heights[s]) : DEFAULT_WALL_HEIGHT_FT;
        out[s] = (isFinite(v) && v > 0) ? v : DEFAULT_WALL_HEIGHT_FT;
      });
      return out;
    }

    function createRoomWalls(room, heights) {
      const hmap = normalizeHeights(heights || room.wallHeights);
      room.wallHeights = hmap;
      const edges = roomEdgeCoords(room);
      // Drop any prior auto-walls for this room (avoid orphans/dupes)
      const oldIds = new Set((room.wallIds || []).concat(
        state.walls.filter((w) => w.roomId === room.id).map((w) => w.id)
      ));
      if (oldIds.size) {
        state.windows = state.windows.filter((win) => !oldIds.has(win.wallId));
        state.walls = state.walls.filter((w) => w.roomId !== room.id);
      }
      const ids = [];
      ROOM_SIDES.forEach((side) => {
        const e = edges[side];
        const wall = {
          id: uid('wall'),
          x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2,
          roomId: room.id,
          side,
          heightFt: hmap[side],
          name: sideLabel(side),
          auto: true,
        };
        state.walls.push(wall);
        ids.push(wall.id);
      });
      room.wallIds = ids;
      return ids;
    }

    function syncRoomWalls(room) {
      if (!room) return;
      const linked = state.walls.filter((w) => w.roomId === room.id);
      if (!linked.length && !(room.wallIds && room.wallIds.length)) return;
      const hmap = normalizeHeights(room.wallHeights);
      room.wallHeights = hmap;
      const edges = roomEdgeCoords(room);
      const bySide = {};
      linked.forEach((w) => { if (w.side) bySide[w.side] = w; });
      const ids = [];
      ROOM_SIDES.forEach((side) => {
        const e = edges[side];
        let w = bySide[side];
        if (!w) {
          w = {
            id: uid('wall'),
            roomId: room.id,
            side,
            auto: true,
            name: sideLabel(side),
            heightFt: hmap[side],
          };
          state.walls.push(w);
        }
        w.x1 = e.x1; w.y1 = e.y1; w.x2 = e.x2; w.y2 = e.y2;
        w.roomId = room.id;
        w.side = side;
        w.auto = true;
        if (w.heightFt == null) w.heightFt = hmap[side];
        else hmap[side] = w.heightFt;
        if (!w.name) w.name = sideLabel(side);
        ids.push(w.id);
      });
      // Remove extras for this room
      const idSet = new Set(ids);
      state.windows = state.windows.filter((win) => {
        const wall = state.walls.find((x) => x.id === win.wallId);
        if (wall && wall.roomId === room.id && !idSet.has(wall.id)) return false;
        return true;
      });
      state.walls = state.walls.filter((w) => w.roomId !== room.id || idSet.has(w.id));
      room.wallIds = ids;
      room.wallHeights = hmap;
    }

    function setRoomWallHeights(roomId, heights) {
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const hmap = normalizeHeights(heights);
      room.wallHeights = hmap;
      state.walls.filter((w) => w.roomId === roomId).forEach((w) => {
        if (w.side && hmap[w.side] != null) w.heightFt = hmap[w.side];
      });
      notify();
      draw();
    }

    function applyRoomResize(room, handle, worldPt) {
      const p = { x: snapVal(worldPt.x), y: snapVal(worldPt.y) };
      let L = room.x, T = room.y, R = room.x + room.w, B = room.y + room.h;
      if (handle === 'nw' || handle === 'w' || handle === 'sw') L = p.x;
      if (handle === 'ne' || handle === 'e' || handle === 'se') R = p.x;
      if (handle === 'nw' || handle === 'n' || handle === 'ne') T = p.y;
      if (handle === 'sw' || handle === 's' || handle === 'se') B = p.y;
      if (R - L < ROOM_MIN_FT) {
        if (handle === 'nw' || handle === 'w' || handle === 'sw') L = R - ROOM_MIN_FT;
        else R = L + ROOM_MIN_FT;
      }
      if (B - T < ROOM_MIN_FT) {
        if (handle === 'nw' || handle === 'n' || handle === 'ne') T = B - ROOM_MIN_FT;
        else B = T + ROOM_MIN_FT;
      }
      room.x = L;
      room.y = T;
      room.w = R - L;
      room.h = B - T;
      syncRoomWalls(room);
    }

    function drawRoomHandles(room) {
      ctx.save();
      for (const h of getRoomHandles(room)) {
        const s = toScreen(h.x, h.y);
        const half = HANDLE_DRAW_PX / 2;
        // invisible larger touch affordance ring
        ctx.beginPath();
        ctx.fillStyle = 'rgba(47,111,106,0.12)';
        ctx.arc(s.x, s.y, HANDLE_HIT_PX / 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2f6f6a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(s.x - half, s.y - half, HANDLE_DRAW_PX, HANDLE_DRAW_PX);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    function findWallNear(p, threshFt) {
      let best = null;
      for (const w of state.walls) {
        const r = pointNearSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }, threshFt);
        if (r.d <= threshFt && (!best || r.d < best.d)) {
          best = { wall: w, ...r };
        }
      }
      return best;
    }

    function wallInwardNormal(wall, at) {
      const ang = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
      let nx = -Math.sin(ang), ny = Math.cos(ang);
      if (wall.roomId) {
        const room = state.rooms.find((r) => r.id === wall.roomId);
        if (room) {
          const cx = room.x + room.w / 2;
          const cy = room.y + room.h / 2;
          if ((cx - at.x) * nx + (cy - at.y) * ny < 0) { nx = -nx; ny = -ny; }
        }
      } else if (state.rooms.length) {
        // Prefer normal pointing toward nearest room center
        let best = null;
        for (const room of state.rooms) {
          const cx = room.x + room.w / 2;
          const cy = room.y + room.h / 2;
          const d = Math.hypot(cx - at.x, cy - at.y);
          if (best == null || d < best.d) best = { d, cx, cy };
        }
        if (best && (best.cx - at.x) * nx + (best.cy - at.y) * ny < 0) {
          nx = -nx; ny = -ny;
        }
      }
      return { nx, ny, ang };
    }

    function roomContaining(p) {
      for (let i = state.rooms.length - 1; i >= 0; i--) {
        const r = state.rooms[i];
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return r;
      }
      return null;
    }

    function pointInFloorFixture(p, fx) {
      if (!fx || fx.planKind === 'wall') return false;
      const hw = ((fx.widthIn || 24) / IN_PER_FT) / 2;
      const hd = ((fx.depthIn || 24) / IN_PER_FT) / 2;
      const ang = fx.rot || 0;
      const c = Math.cos(-ang), s = Math.sin(-ang);
      const dx = p.x - fx.x, dy = p.y - fx.y;
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      return Math.abs(lx) <= hw + 0.05 && Math.abs(ly) <= hd + 0.05;
    }

    function wallFixturePoint(fx) {
      const w = state.walls.find((x) => x.id === fx.wallId);
      if (!w) return null;
      return {
        wall: w,
        x: w.x1 + (w.x2 - w.x1) * fx.t,
        y: w.y1 + (w.y2 - w.y1) * fx.t,
      };
    }

    function hitTestFixture(p) {
      // Floor fixtures (front-most last)
      for (let i = state.fixtures.length - 1; i >= 0; i--) {
        const fx = state.fixtures[i];
        if (fx.planKind === 'wall') continue;
        if (pointInFloorFixture(p, fx)) return { type: 'fixture', id: fx.id };
      }
      // Wall devices (outlets / switches)
      for (let i = state.fixtures.length - 1; i >= 0; i--) {
        const fx = state.fixtures[i];
        if (fx.planKind !== 'wall') continue;
        const pt = wallFixturePoint(fx);
        if (!pt) continue;
        if (dist(p, pt) < 1.0 / state.zoom) return { type: 'fixture', id: fx.id };
      }
      return null;
    }

    function counterUnderWall(wallId) {
      return state.fixtures.some((f) =>
        f.fixtureId === 'counter_base' && f.wallId && f.wallId === wallId
      );
    }

    function snapFloorFixtureToWall(fx, p) {
      const near = findWallNear(p, 2.0);
      const room = roomContaining(p);
      if (room) fx.roomId = room.id;
      if (!near) {
        fx.x = snapVal(p.x);
        fx.y = snapVal(p.y);
        if (fx.rot == null || !isFinite(fx.rot)) fx.rot = 0;
        fx.wallId = null;
        fx.t = null;
        return fx;
      }
      const { nx, ny, ang } = wallInwardNormal(near.wall, near.pt);
      const depthFt = (fx.depthIn || 24) / IN_PER_FT;
      // Upper cabs sit closer to wall (~half depth)
      const inset = depthFt / 2;
      fx.x = near.pt.x + nx * inset;
      fx.y = near.pt.y + ny * inset;
      fx.rot = ang;
      fx.wallId = near.wall.id;
      fx.t = near.t;
      if (near.wall.roomId) fx.roomId = near.wall.roomId;
      return fx;
    }

    function placeWallFixtureAt(fixtureId, raw) {
      const near = findWallNear(raw, 1.5);
      if (!near) return null;
      const def = fixtureDef(fixtureId) || FIXTURE_DEFS.outlet_duplex;
      let aff = def.affIn;
      if (fixtureId === 'outlet_duplex' && counterUnderWall(near.wall.id)) {
        aff = def.counterAffIn || 42;
      }
      const room = near.wall.roomId
        ? state.rooms.find((r) => r.id === near.wall.roomId)
        : roomContaining(near.pt);
      return normalizeFixture({
        id: uid('fix'),
        fixtureId,
        wallId: near.wall.id,
        t: near.t,
        affIn: aff,
        roomId: room ? room.id : undefined,
      });
    }

    function placeFloorFixtureAt(fixtureId, raw) {
      const def = fixtureDef(fixtureId);
      if (!def || def.planKind === 'wall') return null;
      let fx = normalizeFixture({
        id: uid('fix'),
        fixtureId,
        x: raw.x,
        y: raw.y,
        widthIn: def.defaultWidthIn || def.widthIn || 24,
        depthIn: def.depthIn || def.widthIn || 24,
        rot: 0,
      });
      // Sinks prefer centering on a nearby counter if present
      if (String(fixtureId).startsWith('sink_')) {
        let best = null;
        for (const c of state.fixtures) {
          if (c.fixtureId !== 'counter_base') continue;
          const d = dist(raw, { x: c.x, y: c.y });
          if (d < 2.5 && (!best || d < best.d)) best = { d, c };
        }
        if (best) {
          fx.x = best.c.x;
          fx.y = best.c.y;
          fx.rot = best.c.rot || 0;
          fx.wallId = best.c.wallId || null;
          fx.t = best.c.t;
          fx.roomId = best.c.roomId;
          return fx;
        }
      }
      return snapFloorFixtureToWall(fx, raw);
    }

    function setActiveFixture(fixtureId) {
      if (!FIXTURE_DEFS[fixtureId]) return;
      state.activeFixtureId = fixtureId;
      const tool = FIXTURE_DEFS[fixtureId].tool;
      if (state.tool !== tool) {
        state.tool = tool;
        canvas.style.cursor = 'crosshair';
      }
      draw();
      updateDrawChrome();
      if (hooks.onToolChange) hooks.onToolChange(state.tool, { activeFixtureId: state.activeFixtureId });
    }


    function hitTest(p) {
      // Fixtures before rooms so counters/cabs/sinks inside a room stay selectable
      const fxHit = hitTestFixture(p);
      if (fxHit) return fxHit;
      // windows
      for (const win of state.windows) {
        const w = state.walls.find((x) => x.id === win.wallId);
        if (!w) continue;
        const pt = {
          x: w.x1 + (w.x2 - w.x1) * win.t,
          y: w.y1 + (w.y2 - w.y1) * win.t,
        };
        if (dist(p, pt) < 1.2 / state.zoom) return { type: 'window', id: win.id };
      }
      // rooms (fill)
      for (let i = state.rooms.length - 1; i >= 0; i--) {
        const r = state.rooms[i];
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          return { type: 'room', id: r.id };
        }
      }
      // walls
      const near = findWallNear(p, 0.8 / state.zoom);
      if (near) return { type: 'wall', id: near.wall.id };
      // rooflines — near any segment
      for (const rl of state.rooflines) {
        for (let i = 0; i < rl.points.length - 1; i++) {
          const r = pointNearSegment(p, rl.points[i], rl.points[i + 1]);
          if (r.d < 0.9 / state.zoom) return { type: 'roofline', id: rl.id };
        }
      }
      return null;
    }

    function getSelectedObject() {
      if (!state.selected) return null;
      const { type, id } = state.selected;
      if (type === 'room') return state.rooms.find((r) => r.id === id) || null;
      if (type === 'wall') return state.walls.find((w) => w.id === id) || null;
      if (type === 'window') return state.windows.find((w) => w.id === id) || null;
      if (type === 'fixture') return state.fixtures.find((f) => f.id === id) || null;
      if (type === 'roofline') return state.rooflines.find((r) => r.id === id) || null;
      return null;
    }

    function deleteSelected() {
      if (!state.selected) return;
      pushHistory();
      const { type, id } = state.selected;
      if (type === 'room') {
        const room = state.rooms.find((r) => r.id === id);
        const wallIds = new Set(
          (room && room.wallIds) || state.walls.filter((w) => w.roomId === id).map((w) => w.id)
        );
        state.windows = state.windows.filter((w) => !wallIds.has(w.wallId));
        state.fixtures = state.fixtures.filter((f) => f.roomId !== id && !(f.wallId && wallIds.has(f.wallId)));
        state.walls = state.walls.filter((w) => w.roomId !== id && !wallIds.has(w.id));
        state.rooms = state.rooms.filter((r) => r.id !== id);
      }
      if (type === 'wall') {
        const wall = state.walls.find((w) => w.id === id);
        state.walls = state.walls.filter((w) => w.id !== id);
        state.windows = state.windows.filter((w) => w.wallId !== id);
        state.fixtures = state.fixtures.filter((f) => f.wallId !== id);
        if (wall && wall.roomId) {
          const room = state.rooms.find((r) => r.id === wall.roomId);
          if (room && room.wallIds) {
            room.wallIds = room.wallIds.filter((wid) => wid !== id);
          }
        }
      }
      if (type === 'window') state.windows = state.windows.filter((w) => w.id !== id);
      if (type === 'fixture') state.fixtures = state.fixtures.filter((f) => f.id !== id);
      if (type === 'roofline') state.rooflines = state.rooflines.filter((r) => r.id !== id);
      state.selected = null;
      notify();
      draw();
    }

    function updateSelectedProps(props) {
      const obj = getSelectedObject();
      if (!obj || !state.selected) return;
      if (state.selected.type === 'room') {
        if (props.name != null) obj.name = props.name;
        if (props.width != null && props.width > 0) obj.w = Math.max(ROOM_MIN_FT, snapVal(props.width));
        if (props.length != null && props.length > 0) obj.h = Math.max(ROOM_MIN_FT, snapVal(props.length));
        if (props.heightFt != null && props.heightFt > 0) {
          const h = Number(props.heightFt);
          obj.wallHeights = { north: h, east: h, south: h, west: h };
          state.walls.filter((w) => w.roomId === obj.id).forEach((w) => { w.heightFt = h; });
        }
        syncRoomWalls(obj);
      } else if (state.selected.type === 'wall') {
        if (props.name != null) obj.name = props.name;
        if (props.heightFt != null && props.heightFt > 0) {
          obj.heightFt = Number(props.heightFt);
          if (obj.roomId && obj.side) {
            const room = state.rooms.find((r) => r.id === obj.roomId);
            if (room) {
              room.wallHeights = room.wallHeights || {};
              room.wallHeights[obj.side] = obj.heightFt;
            }
          }
        }
      } else if (state.selected.type === 'window') {
        if (props.t != null) {
          const wall = state.walls.find((w) => w.id === obj.wallId);
          let t = Number(props.t);
          if (wall) {
            const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
            const halfT = ((obj.widthFt || DEFAULT_WIN_WIDTH_FT) / len) / 2;
            t = Math.max(halfT, Math.min(1 - halfT, t));
          }
          obj.t = t;
        }
        if (props.widthFt != null && props.widthFt > 0) obj.widthFt = Number(props.widthFt);
        if (props.heightFt != null && props.heightFt > 0) obj.heightFt = Number(props.heightFt);
        if (props.sillFt != null && props.sillFt >= 0) obj.sillFt = Number(props.sillFt);
        Object.assign(obj, normalizeWindow(obj));
      } else if (state.selected.type === 'roofline' && props.name != null) {
        obj.name = props.name;
      }
      notify();
      draw();
    }

    function updateWindow(id, props) {
      const win = state.windows.find((w) => w.id === id);
      if (!win) return null;
      if (props.t != null) win.t = Number(props.t);
      if (props.widthFt != null && props.widthFt > 0) win.widthFt = Number(props.widthFt);
      if (props.heightFt != null && props.heightFt > 0) win.heightFt = Number(props.heightFt);
      if (props.sillFt != null && props.sillFt >= 0) win.sillFt = Number(props.sillFt);
      if (props.wallId) win.wallId = props.wallId;
      // Clamp t so window stays on wall
      const wall = state.walls.find((w) => w.id === win.wallId);
      if (wall) {
        const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
        const halfT = ((win.widthFt || DEFAULT_WIN_WIDTH_FT) / len) / 2;
        win.t = Math.max(halfT + 0.001, Math.min(1 - halfT - 0.001, win.t));
      }
      Object.assign(win, normalizeWindow(win));
      notify();
      draw();
      return win;
    }

    /**
     * Detect colinear opposite wall segments between different rooms that
     * touch/overlap within epsilon; place one auto door at overlap midpoint.
     * Idempotent via sharedKey (sorted room-pair).
     */
    function wallLen(w) {
      return Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
    }

    function projectTOnWall(wall, x, y) {
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-8) return 0.5;
      let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / len2;
      return Math.max(0, Math.min(1, t));
    }

    /** Shared overlap of two walls if colinear + overlapping within eps. */
    function sharedWallOverlap(wa, wb, eps) {
      if (!wa || !wb || wa.roomId === wb.roomId) return null;
      const ax = wa.x2 - wa.x1, ay = wa.y2 - wa.y1;
      const bx = wb.x2 - wb.x1, by = wb.y2 - wb.y1;
      const aVert = Math.abs(ax) < eps && Math.abs(ay) >= eps;
      const bVert = Math.abs(bx) < eps && Math.abs(by) >= eps;
      const aHorz = Math.abs(ay) < eps && Math.abs(ax) >= eps;
      const bHorz = Math.abs(by) < eps && Math.abs(bx) >= eps;

      if (aVert && bVert) {
        const xa = (wa.x1 + wa.x2) / 2;
        const xb = (wb.x1 + wb.x2) / 2;
        if (Math.abs(xa - xb) > eps) return null;
        const a0 = Math.min(wa.y1, wa.y2), a1 = Math.max(wa.y1, wa.y2);
        const b0 = Math.min(wb.y1, wb.y2), b1 = Math.max(wb.y1, wb.y2);
        const o0 = Math.max(a0, b0), o1 = Math.min(a1, b1);
        const len = o1 - o0;
        if (len < SHARED_EDGE_MIN_OVERLAP_FT) return null;
        const midY = (o0 + o1) / 2;
        const x = (xa + xb) / 2;
        return { axis: 'v', midX: x, midY, overlapLen: len, o0, o1 };
      }
      if (aHorz && bHorz) {
        const ya = (wa.y1 + wa.y2) / 2;
        const yb = (wb.y1 + wb.y2) / 2;
        if (Math.abs(ya - yb) > eps) return null;
        const a0 = Math.min(wa.x1, wa.x2), a1 = Math.max(wa.x1, wa.x2);
        const b0 = Math.min(wb.x1, wb.x2), b1 = Math.max(wb.x1, wb.x2);
        const o0 = Math.max(a0, b0), o1 = Math.min(a1, b1);
        const len = o1 - o0;
        if (len < SHARED_EDGE_MIN_OVERLAP_FT) return null;
        const midX = (o0 + o1) / 2;
        const y = (ya + yb) / 2;
        return { axis: 'h', midX, midY: y, overlapLen: len, o0, o1 };
      }
      return null;
    }

    function tInOverlap(wall, ov) {
      const t0 = ov.axis === 'v'
        ? projectTOnWall(wall, ov.midX, ov.o0)
        : projectTOnWall(wall, ov.o0, ov.midY);
      const t1 = ov.axis === 'v'
        ? projectTOnWall(wall, ov.midX, ov.o1)
        : projectTOnWall(wall, ov.o1, ov.midY);
      return { lo: Math.min(t0, t1), hi: Math.max(t0, t1) };
    }

    function hasManualDoorOnOverlap(wa, wb, ov) {
      const ranges = [
        { wallId: wa.id, ...tInOverlap(wa, ov) },
        { wallId: wb.id, ...tInOverlap(wb, ov) },
      ];
      return state.windows.some((win) => {
        if (win.autoShared) return false;
        const isDoor = win.openingType === 'door' || (win.id && String(win.id).indexOf('door') === 0);
        if (!isDoor) return false;
        for (const r of ranges) {
          if (win.wallId !== r.wallId) continue;
          const t = win.t != null ? win.t : 0.5;
          if (t >= r.lo - 0.02 && t <= r.hi + 0.02) return true;
        }
        return false;
      });
    }

    function reconcileAutoSharedDoors() {
      const eps = SHARED_EDGE_EPS_FT;
      const expected = new Map(); // sharedKey -> spec
      const rooms = state.rooms;
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const ra = rooms[i], rb = rooms[j];
          const wallsA = state.walls.filter((w) => w.roomId === ra.id);
          const wallsB = state.walls.filter((w) => w.roomId === rb.id);
          let best = null;
          for (const wa of wallsA) {
            for (const wb of wallsB) {
              const ov = sharedWallOverlap(wa, wb, eps);
              if (!ov) continue;
              if (!best || ov.overlapLen > best.ov.overlapLen) {
                best = { wa, wb, ov };
              }
            }
          }
          if (!best) continue;
          const { wa, wb, ov } = best;
          const ids = [ra.id, rb.id].slice().sort();
          const sharedKey = ids[0] + '|' + ids[1];
          if (hasManualDoorOnOverlap(wa, wb, ov)) continue;

          let widthFt = Math.min(DEFAULT_DOOR_WIDTH_FT, ov.overlapLen * 0.9);
          widthFt = Math.max(2, Math.round(widthFt * 100) / 100);

          // Place on BOTH shared walls so plan+3D passage reads from either room
          [wa, wb].forEach((hostWall) => {
            const midT = projectTOnWall(hostWall, ov.midX, ov.midY);
            const len = wallLen(hostWall);
            const halfT = (widthFt / len) / 2;
            const t = Math.max(halfT + 0.01, Math.min(1 - halfT - 0.01, midT));
            const key = sharedKey + '@' + hostWall.id;
            expected.set(key, {
              wallId: hostWall.id,
              t,
              widthFt,
              heightFt: Math.round(DEFAULT_DOOR_HEIGHT_FT * 100) / 100,
              sillFt: 0,
              openingType: 'door',
              autoShared: true,
              sharedKey: key,
              pairKey: sharedKey,
            });
          });
        }
      }

      // Drop stale auto doors
      state.windows = state.windows.filter((win) => {
        if (!win.autoShared) return true;
        return expected.has(win.sharedKey);
      });

      // Update or create
      expected.forEach((spec, key) => {
        let existing = state.windows.find((w) => w.autoShared && w.sharedKey === key);
        if (existing) {
          existing.wallId = spec.wallId;
          existing.t = spec.t;
          existing.widthFt = spec.widthFt;
          existing.heightFt = spec.heightFt;
          existing.sillFt = 0;
          existing.openingType = 'door';
          existing.autoShared = true;
          existing.sharedKey = key;
          if (spec.pairKey) existing.pairKey = spec.pairKey;
        } else {
          const win = normalizeWindow({
            id: uid('door'),
            wallId: spec.wallId,
            t: spec.t,
            widthFt: spec.widthFt,
            heightFt: spec.heightFt,
            sillFt: 0,
            openingType: 'door',
            autoShared: true,
            sharedKey: key,
            pairKey: spec.pairKey || null,
          });
          state.windows.push(win);
        }
      });
    }

    function notify() {
      reconcileAutoSharedDoors();
      if (hooks.onChange) hooks.onChange(exportData());
      if (hooks.onSelection) hooks.onSelection(state.selected, getSelectedObject());
      if (hooks.onRooms) hooks.onRooms(state.rooms.slice());
    }

    function exportData() {
      return {
        walls: state.walls,
        rooms: state.rooms,
        windows: state.windows.map(normalizeWindow),
        fixtures: state.fixtures.map(normalizeFixture).filter(Boolean),
        rooflines: state.rooflines,
        roofPitch: state.roofPitch,
        roofPitchLabel: state.roofPitchLabel,
        roofStyle: state.roofStyle,
        existingHouse: state.existingHouse ? { ...state.existingHouse } : null,
        view: { zoom: state.zoom, panX: state.panX, panY: state.panY },
      };
    }

    function importData(data) {
      if (!data) return;
      state.walls = data.walls || [];
      state.rooms = data.rooms || [];
      state.windows = (data.windows || []).map(normalizeWindow).filter(Boolean);
      state.fixtures = (data.fixtures || []).map(normalizeFixture).filter(Boolean);
      state.rooflines = data.rooflines || [];
      state.roofPitch = data.roofPitch != null ? data.roofPitch : null;
      state.roofPitchLabel = data.roofPitchLabel || null;
      state.roofStyle = data.roofStyle || null;
      state.existingHouse = data.existingHouse ? { ...data.existingHouse } : null;
      if (data.view) {
        state.zoom = data.view.zoom || 1;
        state.panX = data.view.panX ?? 40;
        state.panY = data.view.panY ?? 40;
      }
      state.selected = null;
      state.drawing = null;
      state.history = [];
      notify();
      draw();
    }

    function setExistingHouse(dims) {
      const lengthFt = Math.max(8, Number(dims && dims.lengthFt) || 40);
      const widthFt = Math.max(8, Number(dims && dims.widthFt) || 30);
      // Place near origin so additions can attach to south (bottom) / east / west edges
      const x = 4;
      const y = 4;
      state.existingHouse = {
        lengthFt, widthFt, x, y,
        locked: true,
        label: 'Existing house',
      };
      // Pan view so house is visible
      state.panX = 40;
      state.panY = 40;
      state.zoom = Math.min(state.zoom, 1);
      notify();
      draw();
      if (hooks.onExistingHouseChange) hooks.onExistingHouseChange(state.existingHouse);
      return state.existingHouse;
    }

    function getExistingHouse() {
      return state.existingHouse ? { ...state.existingHouse } : null;
    }

    function clearExistingHouse() {
      state.existingHouse = null;
      notify();
      draw();
    }

    function isEmpty() {
      return !state.walls.length && !state.rooms.length && !state.windows.length && !state.fixtures.length && !state.rooflines.length;
    }

    // ---- drawing ----
    function resize() {
      const wrap = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function drawGrid(cssW, cssH) {
      const scale = PX_PER_FT * state.zoom;
      const step = scale; // 1 ft
      const majorEvery = 5;
      ctx.save();
      ctx.beginPath();
      const startX = state.panX % step;
      const startY = state.panY % step;
      for (let x = startX; x < cssW; x += step) {
        const worldX = (x - state.panX) / scale;
        const major = Math.abs(Math.round(worldX / majorEvery) * majorEvery - worldX) < 0.01;
        ctx.strokeStyle = major ? '#d5cfc6' : '#e4dfd7';
        ctx.lineWidth = major ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, cssH);
        ctx.stroke();
      }
      for (let y = startY; y < cssH; y += step) {
        const worldY = (y - state.panY) / scale;
        const major = Math.abs(Math.round(worldY / majorEvery) * majorEvery - worldY) < 0.01;
        ctx.strokeStyle = major ? '#d5cfc6' : '#e4dfd7';
        ctx.lineWidth = major ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(cssW, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw() {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#ebe7e1';
      ctx.fillRect(0, 0, cssW, cssH);
      drawGrid(cssW, cssH);

      // Locked existing house (under addition geometry)
      if (state.existingHouse) {
        const eh = state.existingHouse;
        const a = toScreen(eh.x, eh.y);
        const b = toScreen(eh.x + eh.lengthFt, eh.y + eh.widthFt);
        const rw = b.x - a.x, rh = b.y - a.y;
        ctx.fillStyle = 'rgba(120, 118, 112, 0.55)';
        ctx.strokeStyle = '#6a6760';
        ctx.lineWidth = 2;
        ctx.fillRect(a.x, a.y, rw, rh);
        ctx.strokeRect(a.x, a.y, rw, rh);
        // Hatch for "locked / not editable"
        ctx.save();
        ctx.beginPath();
        ctx.rect(a.x, a.y, rw, rh);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        const step = 14;
        for (let i = -rh; i < rw + rh; i += step) {
          ctx.beginPath();
          ctx.moveTo(a.x + i, a.y);
          ctx.lineTo(a.x + i + rh, a.y + rh);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#3a3834';
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Existing house', (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = '#5c5850';
        ctx.fillText(`${eh.lengthFt} × ${eh.widthFt} ft · locked`, (a.x + b.x) / 2, (a.y + b.y) / 2 + 10);
      }

      // rooms
      for (const r of state.rooms) {
        const a = toScreen(r.x, r.y);
        const b = toScreen(r.x + r.w, r.y + r.h);
        const sel = state.selected && state.selected.type === 'room' && state.selected.id === r.id;
        ctx.fillStyle = sel ? 'rgba(47,111,106,0.18)' : 'rgba(255,255,255,0.72)';
        ctx.strokeStyle = sel ? '#2f6f6a' : '#8a9a96';
        ctx.lineWidth = sel ? 2.5 : 1.5;
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.fillStyle = '#1c2329';
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.name || 'Room', (a.x + b.x) / 2, (a.y + b.y) / 2 - 10);
        ctx.fillStyle = '#5c6770';
        ctx.font = '12px system-ui, sans-serif';
        const dims = `${Math.abs(r.w).toFixed(1)} × ${Math.abs(r.h).toFixed(1)} ft`;
        ctx.fillText(dims, (a.x + b.x) / 2, (a.y + b.y) / 2 + 6);
        const rLabel = r.roofPitchLabel || (r === state.rooms[0] ? state.roofPitchLabel : null);
        const rStyle = r.roofStyle || (r === state.rooms[0] ? state.roofStyle : null);
        if (rLabel || rStyle) {
          const roofTxt = 'Roof · ' + (rLabel || '') + (rStyle ? ' ' + rStyle : '');
          ctx.fillStyle = '#8a4b32';
          ctx.font = '600 11px system-ui, sans-serif';
          ctx.fillText(roofTxt.trim(), (a.x + b.x) / 2, (a.y + b.y) / 2 + 20);
        }
      }

      // resize handles for selected room
      if (state.selected && state.selected.type === 'room') {
        const selRoom = state.rooms.find((r) => r.id === state.selected.id);
        if (selRoom) drawRoomHandles(selRoom);
      }

      // walls
      for (const w of state.walls) {
        const a = toScreen(w.x1, w.y1);
        const b = toScreen(w.x2, w.y2);
        const sel = state.selected && state.selected.type === 'wall' && state.selected.id === w.id;
        ctx.strokeStyle = sel ? '#2f6f6a' : '#2a343c';
        ctx.lineWidth = sel ? 5 : 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // openings — windows (tick) vs doors (gap + swing arc)
      for (const win of state.windows) {
        const nw = normalizeWindow(win);
        Object.assign(win, nw);
        const w = state.walls.find((x) => x.id === win.wallId);
        if (!w) continue;
        const mx = w.x1 + (w.x2 - w.x1) * win.t;
        const my = w.y1 + (w.y2 - w.y1) * win.t;
        const ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
        const half = Math.max(0.6, (win.widthFt || DEFAULT_WIN_WIDTH_FT) / 2);
        const px = Math.cos(ang) * half;
        const py = Math.sin(ang) * half;
        const s1 = toScreen(mx - px, my - py);
        const s2 = toScreen(mx + px, my + py);
        const sel = state.selected && state.selected.type === 'window' && state.selected.id === win.id;
        const isDoor = win.openingType === 'door' || win.autoShared;
        // Auto pair places openings on both walls — only draw one swing per pairKey
        if (win.autoShared && win.pairKey) {
          const peers = state.windows.filter((w) => w.autoShared && w.pairKey === win.pairKey);
          if (peers.length > 1) {
            const sorted = peers.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
            if (sorted[0].id !== win.id) continue;
          }
        }

        if (isDoor) {
          // Thicker gap along wall + quarter-circle swing (inward-ish)
          const inward = 1; // world ft swing radius uses door half*2 = width
          const nx = -Math.sin(ang) * inward;
          const ny = Math.cos(ang) * inward;
          // Prefer swing into room if wall has roomId
          let sx = nx, sy = ny;
          if (w.roomId) {
            const room = state.rooms.find((r) => r.id === w.roomId);
            if (room) {
              const cx = room.x + room.w / 2;
              const cy = room.y + room.h / 2;
              const toC = { x: cx - mx, y: cy - my };
              if (toC.x * nx + toC.y * ny < 0) { sx = -nx; sy = -ny; }
            }
          }
          ctx.strokeStyle = sel ? '#2f6f6a' : '#5a4030';
          ctx.lineWidth = 5;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
          // hinge at s1, swing leaf to inward
          const hinge = s1;
          const leafEnd = toScreen(mx - px + sx * (win.widthFt || DEFAULT_DOOR_WIDTH_FT), my - py + sy * (win.widthFt || DEFAULT_DOOR_WIDTH_FT));
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hinge.x, hinge.y);
          ctx.lineTo(leafEnd.x, leafEnd.y);
          ctx.stroke();
          // arc
          const rPx = Math.hypot(s2.x - s1.x, s2.y - s1.y);
          const a0 = Math.atan2(s2.y - s1.y, s2.x - s1.x);
          const a1 = Math.atan2(leafEnd.y - s1.y, leafEnd.x - s1.x);
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          // sweep the shorter quarter-ish arc
          let start = a0, end = a1;
          let delta = end - start;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          ctx.arc(s1.x, s1.y, rPx, start, start + delta, delta < 0);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Richer 2D window: frame rectangle + glass fill + optional mullion
          const halfT = 0.28; // frame thickness perpendicular to wall (world ft)
          const nx = -Math.sin(ang) * halfT;
          const ny = Math.cos(ang) * halfT;
          const a1 = toScreen(mx - px + nx, my - py + ny);
          const a2 = toScreen(mx + px + nx, my + py + ny);
          const b1 = toScreen(mx - px - nx, my - py - ny);
          const b2 = toScreen(mx + px - nx, my + py - ny);
          ctx.fillStyle = sel ? 'rgba(47,111,106,0.22)' : 'rgba(90,155,200,0.32)';
          ctx.beginPath();
          ctx.moveTo(a1.x, a1.y);
          ctx.lineTo(a2.x, a2.y);
          ctx.lineTo(b2.x, b2.y);
          ctx.lineTo(b1.x, b1.y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = sel ? '#2f6f6a' : '#3d6b9a';
          ctx.lineWidth = sel ? 2.5 : 2;
          ctx.stroke();
          // Inner glass edge cue
          const inset = 0.12;
          const ix = -Math.sin(ang) * (halfT - inset);
          const iy = Math.cos(ang) * (halfT - inset);
          const ipx = Math.cos(ang) * Math.max(0.15, half - 0.15);
          const ipy = Math.sin(ang) * Math.max(0.15, half - 0.15);
          const ia1 = toScreen(mx - ipx + ix, my - ipy + iy);
          const ia2 = toScreen(mx + ipx + ix, my + ipy + iy);
          const ib1 = toScreen(mx - ipx - ix, my - ipy - iy);
          const ib2 = toScreen(mx + ipx - ix, my + ipy - iy);
          ctx.strokeStyle = sel ? '#2f6f6a' : '#5a8ab0';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(ia1.x, ia1.y);
          ctx.lineTo(ia2.x, ia2.y);
          ctx.lineTo(ib2.x, ib2.y);
          ctx.lineTo(ib1.x, ib1.y);
          ctx.closePath();
          ctx.stroke();
          // Center mullion when wide enough (skip on narrow 8×24)
          if ((win.widthFt || DEFAULT_WIN_WIDTH_FT) >= 1.2) {
            const c1 = toScreen(mx + nx * 0.85, my + ny * 0.85);
            const c2 = toScreen(mx - nx * 0.85, my - ny * 0.85);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.stroke();
          }
        }
      }


      // fixtures (counters / cabinets / sinks / outlets)
      for (const fx0 of state.fixtures) {
        const fx = normalizeFixture(fx0);
        if (!fx) continue;
        Object.assign(fx0, fx);
        const sel = state.selected && state.selected.type === 'fixture' && state.selected.id === fx.id;
        const def = fixtureDef(fx.fixtureId) || {};
        if (fx.planKind === 'wall') {
          const pt = wallFixturePoint(fx);
          if (!pt) continue;
          const ang = Math.atan2(pt.wall.y2 - pt.wall.y1, pt.wall.x2 - pt.wall.x1);
          const nx = -Math.sin(ang) * 0.35;
          const ny = Math.cos(ang) * 0.35;
          const s = toScreen(pt.x, pt.y);
          const n1 = toScreen(pt.x + nx, pt.y + ny);
          ctx.fillStyle = sel ? '#2f6f6a' : (fx.fixtureId === 'switch_single' ? '#5a6a3a' : '#c9a227');
          ctx.strokeStyle = sel ? '#2f6f6a' : '#5a4a10';
          ctx.lineWidth = sel ? 2 : 1.25;
          const sz = Math.max(5, 7 * state.zoom);
          ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
          ctx.strokeRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(n1.x, n1.y);
          ctx.stroke();
          continue;
        }
        const hw = (fx.widthIn / IN_PER_FT) / 2;
        const hd = (fx.depthIn / IN_PER_FT) / 2;
        const ang = fx.rot || 0;
        const c = Math.cos(ang), s = Math.sin(ang);
        const corners = [
          { x: fx.x + (-hw) * c - (-hd) * s, y: fx.y + (-hw) * s + (-hd) * c },
          { x: fx.x + ( hw) * c - (-hd) * s, y: fx.y + ( hw) * s + (-hd) * c },
          { x: fx.x + ( hw) * c - ( hd) * s, y: fx.y + ( hw) * s + ( hd) * c },
          { x: fx.x + (-hw) * c - ( hd) * s, y: fx.y + (-hw) * s + ( hd) * c },
        ].map((pt) => toScreen(pt.x, pt.y));
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        let fill = 'rgba(180, 150, 110, 0.45)';
        let stroke = '#7a6240';
        if (fx.fixtureId === 'cab_base') { fill = 'rgba(120, 140, 160, 0.4)'; stroke = '#4a5a6a'; }
        if (fx.fixtureId === 'cab_upper') { fill = 'rgba(120, 140, 160, 0.22)'; stroke = '#4a5a6a'; }
        if (String(fx.fixtureId).startsWith('sink_')) { fill = 'rgba(140, 180, 200, 0.35)'; stroke = '#3d6b9a'; }
        if (sel) { fill = 'rgba(47,111,106,0.28)'; stroke = '#2f6f6a'; }
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = sel ? 2.5 : 1.5;
        if (def.dashed || fx.fixtureId === 'cab_upper') ctx.setLineDash([5, 4]);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        if (def.oval || String(fx.fixtureId).startsWith('sink_')) {
          // inner bowl oval
          const mid = toScreen(fx.x, fx.y);
          const rx = Math.max(4, hw * PX_PER_FT * state.zoom * 0.7);
          const ry = Math.max(3, hd * PX_PER_FT * state.zoom * 0.55);
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = sel ? '#2f6f6a' : '#3d6b9a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
        // tiny label at zoom
        if (state.zoom >= 0.7) {
          const mid = toScreen(fx.x, fx.y);
          ctx.fillStyle = '#3a3834';
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const short = (fx.label || '').replace(/ \(.*\)/, '').split(' ')[0];
          ctx.fillText(short, mid.x, mid.y);
        }
      }

      // rooflines
      for (const rl of state.rooflines) {
        if (rl.points.length < 2) continue;
        const sel = state.selected && state.selected.type === 'roofline' && state.selected.id === rl.id;
        ctx.strokeStyle = sel ? '#2f6f6a' : '#b05a3c';
        ctx.lineWidth = sel ? 2.5 : 2;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        const p0 = toScreen(rl.points[0].x, rl.points[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < rl.points.length; i++) {
          const p = toScreen(rl.points[i].x, rl.points[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // ridge dots
        for (const pt of rl.points) {
          const s = toScreen(pt.x, pt.y);
          ctx.fillStyle = sel ? '#2f6f6a' : '#b05a3c';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // in-progress drawing preview
      const d = state.drawing;
      if (d) {
        if (d.kind === 'wall' && d.start) {
          const a = toScreen(d.start.x, d.start.y);
          const b = toScreen(d.current.x, d.current.y);
          ctx.strokeStyle = 'rgba(47,111,106,0.85)';
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
          // length label
          const len = dist(d.start, d.current);
          ctx.fillStyle = '#2f6f6a';
          ctx.font = '600 12px system-ui';
          ctx.fillText(len.toFixed(1) + ' ft', (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 8);
        }
        if (d.kind === 'room' && d.start) {
          const x1 = Math.min(d.start.x, d.current.x);
          const y1 = Math.min(d.start.y, d.current.y);
          const x2 = Math.max(d.start.x, d.current.x);
          const y2 = Math.max(d.start.y, d.current.y);
          const a = toScreen(x1, y1);
          const b = toScreen(x2, y2);
          ctx.fillStyle = 'rgba(47,111,106,0.12)';
          ctx.strokeStyle = '#2f6f6a';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
          ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
          ctx.setLineDash([]);
        }
        if (d.kind === 'roofline' && d.points && d.points.length) {
          ctx.strokeStyle = 'rgba(176,90,60,0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          const p0 = toScreen(d.points[0].x, d.points[0].y);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < d.points.length; i++) {
            const p = toScreen(d.points[i].x, d.points[i].y);
            ctx.lineTo(p.x, p.y);
          }
          if (d.current) {
            const c = toScreen(d.current.x, d.current.y);
            ctx.lineTo(c.x, c.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (hooks.onEmptyChange) hooks.onEmptyChange(isEmpty());
    }

    // ---- pointer handlers ----
    function onPointerDown(e) {
      state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two-finger pan / pinch start
      if (state.activePointers.size >= 2) {
        e.preventDefault();
        state.drawing = null; // cancel in-progress one-finger stroke
        const pts = [...state.activePointers.values()];
        state.panning = true;
        state.lastPan = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
        state.pinchStartDist = Math.hypot(dx, dy) || 1;
        state.pinchStartZoom = state.zoom;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        updateDrawChrome();
        return;
      }

      if (isPanGesture(e)) {
        e.preventDefault();
        state.panning = true;
        state.lastPan = { x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      if (!isPrimaryDrawPointer(e)) return;

      e.preventDefault();
      if (hooks.onInteract) hooks.onInteract();
      const raw = worldFromEvent(e);
      const p = snapPoint(raw);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}

      // Resize handles win over tool actions when a room is selected
      const handleHit = hitTestResizeHandle(e);
      if (handleHit) {
        const room = state.rooms.find((r) => r.id === handleHit.roomId);
        if (room) {
          state.selected = { type: 'room', id: room.id };
          state.drawing = {
            kind: 'resize-room',
            id: room.id,
            handle: handleHit.handle,
            moved: false,
          };
          notify();
          draw();
          updateDrawChrome();
          return;
        }
      }

      // Body-drag: select+move room from interior (not handles).
      // Works on Select tool, Room tool (hit existing room), or any tool when
      // the already-selected room's interior is pressed — so post-place drag
      // works without switching tools. Touch uses same pointer path.
      const hit = hitTest(raw);
      const hitSelectedRoom = !!(
        hit && hit.type === 'room' &&
        state.selected && state.selected.type === 'room' &&
        state.selected.id === hit.id
      );
      const canBodyMoveRoom = !!(
        hit && hit.type === 'room' && (
          state.tool === 'select' ||
          state.tool === 'room' ||
          hitSelectedRoom
        )
      );
      if (canBodyMoveRoom) {
        const room = state.rooms.find((r) => r.id === hit.id);
        if (room) {
          state.selected = { type: 'room', id: room.id };
          state.drawing = {
            kind: 'move-room',
            id: room.id,
            ox: raw.x - room.x,
            oy: raw.y - room.y,
            moved: false,
          };
          notify();
          draw();
          updateDrawChrome();
          return;
        }
      }

      if (state.tool === 'select') {
        state.selected = hit;
        if (hit && hit.type === 'fixture') {
          const fx = state.fixtures.find((f) => f.id === hit.id);
          if (fx && fx.planKind !== 'wall') {
            state.drawing = {
              kind: 'move-fixture',
              id: fx.id,
              ox: raw.x - fx.x,
              oy: raw.y - fx.y,
              moved: false,
            };
          } else if (fx && fx.planKind === 'wall') {
            state.drawing = { kind: 'move-wall-fixture', id: fx.id, moved: false };
          }
        }
        notify();
        draw();
        updateDrawChrome();
        return;
      }

      if (state.tool === 'wall') {
        if (state.drawing && state.drawing.kind === 'wall-chain') {
          const start = state.drawing.start;
          if (dist(start, p) > 0.25) {
            pushHistory();
            state.walls.push({ id: uid('wall'), x1: start.x, y1: start.y, x2: p.x, y2: p.y, heightFt: DEFAULT_WALL_HEIGHT_FT });
            state.drawing = { kind: 'wall-chain', start: p, current: p };
            notify();
          }
          draw();
          updateDrawChrome();
          return;
        }
        state.drawing = { kind: 'wall', start: p, current: p, dragged: false };
        draw();
        updateDrawChrome();
        return;
      }

      if (state.tool === 'room') {
        const fxHit = hitTestFixture(raw);
        if (fxHit) {
          state.selected = fxHit;
          const fx = state.fixtures.find((f) => f.id === fxHit.id);
          if (fx && fx.planKind !== 'wall') {
            state.drawing = {
              kind: 'move-fixture',
              id: fx.id,
              ox: raw.x - fx.x,
              oy: raw.y - fx.y,
              moved: false,
            };
          }
          notify();
          draw();
          updateDrawChrome();
          return;
        }
        state.drawing = { kind: 'room', start: p, current: p };
        draw();
        updateDrawChrome();
        return;
      }

      if (state.tool === 'window') {
        const near = findWallNear(raw, 1.5);
        if (near) {
          pushHistory();
          const preset = WIN_SIZE_PRESETS.find((x) => x.id === state.activeWinPresetId) || WIN_SIZE_PRESETS[0];
          const widthFt = (preset && preset.wIn) ? preset.wIn / 12 : DEFAULT_WIN_WIDTH_FT;
          const heightFt = (preset && preset.hIn) ? preset.hIn / 12 : DEFAULT_WIN_HEIGHT_FT;
          state.windows.push(normalizeWindow({
            id: uid('win'), wallId: near.wall.id, t: near.t,
            widthFt, heightFt, sillFt: DEFAULT_WIN_SILL_FT,
          }));
          state.selected = { type: 'window', id: state.windows[state.windows.length - 1].id };
          notify();
          draw();
        } else if (hooks.onToast) {
          hooks.onToast('Tap on or near a wall to place a window');
        }
        updateDrawChrome();
        return;
      }

      if (state.tool === 'counter' || state.tool === 'cabinet' || state.tool === 'sink' || state.tool === 'outlet') {
        // Re-select / move only same-tool fixtures (so sinks can drop on counters; outlets on walls)
        const fxHit = hitTestFixture(raw);
        if (fxHit) {
          const fx = state.fixtures.find((f) => f.id === fxHit.id);
          const fxTool = fx && fixtureDef(fx.fixtureId) ? fixtureDef(fx.fixtureId).tool : null;
          const sameTool = fxTool === state.tool;
          // Sink tool: ignore counter/cab hits so a sink can place on a run
          // Outlet tool: ignore floor fixtures; only move existing wall devices
          const allowMove = sameTool && (
            state.tool !== 'outlet' || (fx && fx.planKind === 'wall')
          ) && (
            state.tool !== 'sink' || String(fx.fixtureId || '').startsWith('sink_')
          );
          if (allowMove) {
            state.selected = fxHit;
            if (fx && fx.planKind !== 'wall') {
              state.drawing = {
                kind: 'move-fixture',
                id: fx.id,
                ox: raw.x - fx.x,
                oy: raw.y - fx.y,
                moved: false,
              };
            } else if (fx && fx.planKind === 'wall') {
              state.drawing = { kind: 'move-wall-fixture', id: fx.id, moved: false };
            }
            notify();
            draw();
            updateDrawChrome();
            return;
          }
        }
        const fid = state.activeFixtureId || FIXTURE_TOOL_DEFAULTS[state.tool];
        const def = fixtureDef(fid);
        if (!def) { updateDrawChrome(); return; }
        pushHistory();
        let placed = null;
        if (def.planKind === 'wall') {
          placed = placeWallFixtureAt(fid, raw);
          if (!placed && hooks.onToast) hooks.onToast('Tap on or near a wall to place ' + (def.label || 'device'));
        } else {
          placed = placeFloorFixtureAt(fid, raw);
        }
        if (placed) {
          state.fixtures.push(placed);
          state.selected = { type: 'fixture', id: placed.id };
          if (placed.planKind !== 'wall') {
            state.drawing = {
              kind: 'move-fixture',
              id: placed.id,
              ox: raw.x - placed.x,
              oy: raw.y - placed.y,
              moved: false,
              justPlaced: true,
            };
          }
          notify();
          draw();
          if (hooks.onFixturePlaced) hooks.onFixturePlaced(placed);
        }
        updateDrawChrome();
        return;
      }

      if (state.tool === 'roofline') {
        if (!state.drawing || state.drawing.kind !== 'roofline') {
          state.drawing = { kind: 'roofline', points: [p], current: p };
        } else {
          state.drawing.points.push(p);
          state.drawing.current = p;
        }
        draw();
        updateDrawChrome();
        return;
      }
    }

    function onPointerMove(e) {
      if (state.activePointers.has(e.pointerId)) {
        state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Two-finger pan + pinch zoom
      if (state.activePointers.size >= 2) {
        e.preventDefault();
        const pts = [...state.activePointers.values()];
        const mid = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        if (state.lastPan) {
          state.panX += mid.x - state.lastPan.x;
          state.panY += mid.y - state.lastPan.y;
        }
        state.lastPan = mid;
        const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
        const distNow = Math.hypot(dx, dy) || 1;
        if (state.pinchStartDist) {
          const factor = distNow / state.pinchStartDist;
          state.zoom = Math.min(4, Math.max(0.35, state.pinchStartZoom * factor));
        }
        state.panning = true;
        draw();
        return;
      }

      if (state.panning && state.lastPan) {
        e.preventDefault();
        const dx = e.clientX - state.lastPan.x;
        const dy = e.clientY - state.lastPan.y;
        state.panX += dx;
        state.panY += dy;
        state.lastPan = { x: e.clientX, y: e.clientY };
        draw();
        return;
      }

      if (!state.drawing) return;
      e.preventDefault();
      const raw = worldFromEvent(e);
      const p = snapPoint(raw);

      if (state.drawing.kind === 'wall' || state.drawing.kind === 'wall-chain') {
        state.drawing.current = p;
        if (state.drawing.kind === 'wall' && dist(state.drawing.start, p) > 0.3) {
          state.drawing.dragged = true;
        }
        draw();
      } else if (state.drawing.kind === 'room') {
        state.drawing.current = p;
        draw();
      } else if (state.drawing.kind === 'roofline') {
        state.drawing.current = p;
        draw();
      } else if (state.drawing.kind === 'move-room') {
        const room = state.rooms.find((r) => r.id === state.drawing.id);
        if (room) {
          if (!state.drawing.moved) {
            pushHistory();
            state.drawing.moved = true;
          }
          room.x = snapVal(raw.x - state.drawing.ox);
          room.y = snapVal(raw.y - state.drawing.oy);
          syncRoomWalls(room);
          notify();
          draw();
        }
      } else if (state.drawing.kind === 'resize-room') {
        const room = state.rooms.find((r) => r.id === state.drawing.id);
        if (room) {
          if (!state.drawing.moved) {
            pushHistory();
            state.drawing.moved = true;
          }
          applyRoomResize(room, state.drawing.handle, raw);
          notify();
          draw();
        }
      } else if (state.drawing.kind === 'move-fixture') {
        const fx = state.fixtures.find((f) => f.id === state.drawing.id);
        if (fx) {
          if (!state.drawing.moved && !state.drawing.justPlaced) {
            pushHistory();
            state.drawing.moved = true;
          }
          const np = { x: raw.x - state.drawing.ox, y: raw.y - state.drawing.oy };
          fx.x = np.x;
          fx.y = np.y;
          snapFloorFixtureToWall(fx, np);
          notify();
          draw();
        }
      } else if (state.drawing.kind === 'move-wall-fixture') {
        const fx = state.fixtures.find((f) => f.id === state.drawing.id);
        if (fx) {
          const near = findWallNear(raw, 2.0);
          if (near) {
            if (!state.drawing.moved) {
              pushHistory();
              state.drawing.moved = true;
            }
            fx.wallId = near.wall.id;
            fx.t = near.t;
            if (fx.fixtureId === 'outlet_duplex') {
              const def = fixtureDef('outlet_duplex');
              fx.affIn = counterUnderWall(near.wall.id) ? (def.counterAffIn || 42) : (def.affIn || 12);
            }
            if (near.wall.roomId) fx.roomId = near.wall.roomId;
            notify();
            draw();
          }
        }
      }
    }

    function onPointerUp(e) {
      state.activePointers.delete(e.pointerId);

      if (state.activePointers.size < 2) {
        state.pinchStartDist = null;
      }
      if (state.activePointers.size === 0) {
        if (state.panning) {
          state.panning = false;
          state.lastPan = null;
          try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
          // If we were two-finger panning, don't also finish a draw
          return;
        }
      } else if (state.panning && state.activePointers.size === 1) {
        // Dropped to one finger after pinch — stop pan, don't start draw mid-gesture
        const rem = [...state.activePointers.values()][0];
        state.lastPan = { x: rem.x, y: rem.y };
        return;
      }

      if (state.panning && state.activePointers.size === 0) {
        state.panning = false;
        state.lastPan = null;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      if (!state.drawing) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      e.preventDefault();
      const raw = worldFromEvent(e);
      const p = snapPoint(raw);

      if (state.drawing.kind === 'wall') {
        if (state.drawing.dragged && dist(state.drawing.start, p) > 0.25) {
          pushHistory();
          state.walls.push({
            id: uid('wall'),
            x1: state.drawing.start.x,
            y1: state.drawing.start.y,
            x2: p.x,
            y2: p.y,
            heightFt: DEFAULT_WALL_HEIGHT_FT,
          });
          state.drawing = { kind: 'wall-chain', start: p, current: p };
          notify();
        } else {
          state.drawing = { kind: 'wall-chain', start: state.drawing.start, current: state.drawing.start };
        }
        draw();
        updateDrawChrome();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      if (state.drawing.kind === 'room') {
        const x1 = Math.min(state.drawing.start.x, p.x);
        const y1 = Math.min(state.drawing.start.y, p.y);
        const w = Math.abs(p.x - state.drawing.start.x);
        const h = Math.abs(p.y - state.drawing.start.y);
        state.drawing = null;
        if (w > 0.35 && h > 0.35) {
          pushHistory();
          const n = state.rooms.length + 1;
          const room = {
            id: uid('room'),
            name: 'Room ' + n,
            x: x1, y: y1, w, h,
            wallHeights: normalizeHeights(null),
            wallIds: [],
          };
          state.rooms.push(room);
          createRoomWalls(room);
          state.selected = { type: 'room', id: room.id };
          notify();
          if (hooks.onRoomPlaced) hooks.onRoomPlaced(room);
        }
        draw();
        updateDrawChrome();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      if (state.drawing.kind === 'move-room' || state.drawing.kind === 'resize-room' ||
          state.drawing.kind === 'move-fixture' || state.drawing.kind === 'move-wall-fixture') {
        state.drawing = null;
        notify();
        draw();
        updateDrawChrome();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      // roofline: points already added on pointerdown; keep going until Done
      updateDrawChrome();
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }


    function finishRoofline() {
      if (!state.drawing || state.drawing.kind !== 'roofline') return;
      const pts = state.drawing.points.slice();
      state.drawing = null;
      if (pts.length >= 2) {
        pushHistory();
        const rl = { id: uid('roof'), name: 'Roofline', points: pts };
        state.rooflines.push(rl);
        state.selected = { type: 'roofline', id: rl.id };
        notify();
      }
      draw();
      updateDrawChrome();
    }

    function onDblClick(e) {
      if (state.tool === 'roofline') {
        e.preventDefault();
        finishRoofline();
      }
      if (state.tool === 'wall' && state.drawing && state.drawing.kind === 'wall-chain') {
        state.drawing = null;
        draw();
        updateDrawChrome();
      }
    }

    function onWheel(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const before = worldFromEvent(e);
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      state.zoom = Math.min(4, Math.max(0.35, state.zoom * factor));
      const scale = PX_PER_FT * state.zoom;
      state.panX = sx - before.x * scale;
      state.panY = sy - before.y * scale;
      draw();
    }

    function onKeyDown(e) {
      if (e.code === 'Space' && !e.repeat) {
        state.spaceDown = true;
        canvas.style.cursor = 'grab';
      }
      if (e.key === 'Escape') {
        state.drawing = null;
        draw();
        updateDrawChrome();
      }
      if (e.key === 'Enter' && state.tool === 'roofline') {
        finishRoofline();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    }

    function onKeyUp(e) {
      if (e.code === 'Space') {
        state.spaceDown = false;
        canvas.style.cursor = state.tool === 'select' ? 'default' : 'crosshair';
      }
    }

    function zoomBy(factor) {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const cx = cssW / 2, cy = cssH / 2;
      const scale0 = PX_PER_FT * state.zoom;
      const wx = (cx - state.panX) / scale0;
      const wy = (cy - state.panY) / scale0;
      state.zoom = Math.min(4, Math.max(0.35, state.zoom * factor));
      const scale = PX_PER_FT * state.zoom;
      state.panX = cx - wx * scale;
      state.panY = cy - wy * scale;
      draw();
    }

    function resetView() {
      state.zoom = 1;
      state.panX = 40;
      state.panY = 40;
      draw();
    }

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    // Block browser touch gestures (scroll/zoom) on the canvas surface
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);

    // initial
    resize();

    // Prefer Room as easiest first-draw path (esp. mobile)
    state.tool = 'room';
    canvas.style.cursor = 'crosshair';
    updateDrawChrome();


    // ---- Structure Wizard mutation helpers ----
    function primaryRoom() {
      if (state.selected && state.selected.type === 'room') {
        const r = state.rooms.find((x) => x.id === state.selected.id);
        if (r) return r;
      }
      return state.rooms[0] || null;
    }

    function findWallBySide(side, roomId) {
      const walls = state.walls.filter((w) => {
        if (side && w.side !== side) return false;
        if (roomId && w.roomId !== roomId) return false;
        return true;
      });
      if (walls.length) return walls[0];
      // free walls: approximate by orientation
      if (!side) return state.walls[0] || null;
      return null;
    }

    function resolveWall(wallId, side) {
      if (wallId) {
        const w = state.walls.find((x) => x.id === wallId);
        if (w) return w;
      }
      if (side) {
        const room = primaryRoom();
        return findWallBySide(side, room && room.id);
      }
      if (state.selected && state.selected.type === 'wall') {
        return state.walls.find((x) => x.id === state.selected.id) || null;
      }
      return null;
    }

    function resizeRoomFootprint(lFt, wFt, roomId) {
      pushHistory();
      let room = roomId ? state.rooms.find((r) => r.id === roomId) : primaryRoom();
      if (!room) {
        // create a default room at origin-ish
        room = {
          id: uid('room'),
          name: 'Addition',
          x: 10, y: 10,
          w: Number(lFt) || 12,
          h: Number(wFt) || 16,
          wallHeights: { north: 8, east: 8, south: 8, west: 8 },
          use: 'other',
        };
        state.rooms.push(room);
        createRoomWalls(room, room.wallHeights);
      } else {
        const cx = room.x + room.w / 2;
        const cy = room.y + room.h / 2;
        room.w = Math.max(4, Number(lFt) || room.w);
        room.h = Math.max(4, Number(wFt) || room.h);
        room.x = snapVal(cx - room.w / 2);
        room.y = snapVal(cy - room.h / 2);
        syncRoomWalls(room);
      }
      notify();
      draw();
      return room;
    }

    function setAllWallHeights(heightFt) {
      pushHistory();
      const h = Math.max(1, Number(heightFt) || 8);
      state.rooms.forEach((room) => {
        const heights = { north: h, east: h, south: h, west: h };
        room.wallHeights = heights;
        state.walls.filter((w) => w.roomId === room.id).forEach((w) => { w.heightFt = h; });
      });
      state.walls.forEach((w) => {
        if (!w.roomId) w.heightFt = h;
      });
      notify();
      draw();
    }

    function setWallHeight(opts) {
      opts = opts || {};
      const h = Math.max(1, Number(opts.height_ft) || 8);
      if (opts.all) {
        setAllWallHeights(h);
        return;
      }
      pushHistory();
      const wall = resolveWall(opts.wall_id, opts.side);
      if (wall) {
        wall.heightFt = h;
        if (wall.roomId && wall.side) {
          const room = state.rooms.find((r) => r.id === wall.roomId);
          if (room) {
            room.wallHeights = room.wallHeights || {};
            room.wallHeights[wall.side] = h;
          }
        }
      } else if (opts.side) {
        const room = primaryRoom();
        if (room) {
          room.wallHeights = room.wallHeights || { north: 8, east: 8, south: 8, west: 8 };
          room.wallHeights[opts.side] = h;
          state.walls.filter((w) => w.roomId === room.id && w.side === opts.side).forEach((w) => {
            w.heightFt = h;
          });
        }
      }
      notify();
      draw();
    }

    function addInteriorWall(opts) {
      opts = opts || {};
      const room = primaryRoom();
      if (!room) {
        if (hooks.onToast) hooks.onToast('Draw a room first, then add a wall');
        return null;
      }
      pushHistory();
      const orient = opts.orientation === 'vertical' ? 'vertical' : 'horizontal';
      const off = Number(opts.offset_ft);
      const offset = isFinite(off) && off > 0 ? off : (orient === 'horizontal' ? room.h / 2 : room.w / 2);
      let wall;
      if (orient === 'horizontal') {
        const y = snapVal(room.y + Math.min(room.h - 0.5, Math.max(0.5, offset)));
        wall = {
          id: uid('wall'),
          x1: room.x, y1: y, x2: room.x + room.w, y2: y,
          roomId: room.id,
          heightFt: (room.wallHeights && room.wallHeights.north) || 8,
          name: 'Interior',
          auto: false,
          interior: true,
        };
      } else {
        const x = snapVal(room.x + Math.min(room.w - 0.5, Math.max(0.5, offset)));
        wall = {
          id: uid('wall'),
          x1: x, y1: room.y, x2: x, y2: room.y + room.h,
          roomId: room.id,
          heightFt: (room.wallHeights && room.wallHeights.west) || 8,
          name: 'Interior',
          auto: false,
          interior: true,
        };
      }
      state.walls.push(wall);
      state.selected = { type: 'wall', id: wall.id };
      notify();
      draw();
      return wall;
    }

    function moveWallById(wallId, offsetFt, direction, side) {
      const wall = resolveWall(wallId, side);
      if (!wall) {
        if (hooks.onToast) hooks.onToast('Select a wall first');
        return null;
      }
      pushHistory();
      const dist = Number(offsetFt) || 0;
      const sign = direction === 'in' ? -1 : 1;
      const room = wall.roomId ? state.rooms.find((r) => r.id === wall.roomId) : null;

      if (room && wall.side) {
        // Move exterior side by resizing room
        const d = dist * sign;
        if (wall.side === 'north') { room.y -= d; room.h += d; }
        else if (wall.side === 'south') { room.h += d; }
        else if (wall.side === 'west') { room.x -= d; room.w += d; }
        else if (wall.side === 'east') { room.w += d; }
        if (room.w < 4) room.w = 4;
        if (room.h < 4) room.h = 4;
        syncRoomWalls(room);
      } else {
        // Translate free / interior wall perpendicular to its length
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const ox = nx * dist * sign;
        const oy = ny * dist * sign;
        wall.x1 = snapVal(wall.x1 + ox);
        wall.y1 = snapVal(wall.y1 + oy);
        wall.x2 = snapVal(wall.x2 + ox);
        wall.y2 = snapVal(wall.y2 + oy);
      }
      notify();
      draw();
      return wall;
    }

    function removeWallById(wallId, side) {
      const wall = resolveWall(wallId, side);
      if (!wall) {
        if (hooks.onToast) hooks.onToast('Select a wall to remove');
        return false;
      }
      pushHistory();
      const id = wall.id;
      // If auto room wall, convert room? Prefer deleting segment and clearing wallIds entry
      state.windows = state.windows.filter((w) => w.wallId !== id);
      state.walls = state.walls.filter((w) => w.id !== id);
      state.rooms.forEach((room) => {
        if (room.wallIds) room.wallIds = room.wallIds.filter((wid) => wid !== id);
      });
      if (state.selected && state.selected.id === id) state.selected = null;
      notify();
      draw();
      return true;
    }

    function addOpeningOnWall(opts) {
      opts = opts || {};
      const wall = resolveWall(opts.wall_id, opts.side === 'attach' ? null : opts.side);
      let target = wall;
      if (!target) {
        // prefer non-north? use first exterior wall of primary room
        const room = primaryRoom();
        if (room) {
          const prefer = opts.side && opts.side !== 'attach' ? opts.side : 'south';
          target = findWallBySide(prefer, room.id) || state.walls.find((w) => w.roomId === room.id);
        }
      }
      if (!target && state.walls.length) target = state.walls[0];
      if (!target) {
        if (hooks.onToast) hooks.onToast('Draw a room or wall first');
        return null;
      }
      pushHistory();
      const type = opts.type || 'window';
      let widthFt = Number(opts.w_ft);
      let heightFt = Number(opts.h_ft);
      let sillFt = opts.sill_ft != null ? Number(opts.sill_ft) : 2.5;
      if (type === 'door' || type === 'large') sillFt = 0;
      else if (!(sillFt >= 0)) sillFt = DEFAULT_WIN_SILL_FT;
      if (!(widthFt > 0)) {
        if (type === 'door') widthFt = opts.door_type === 'sliding' || opts.door_type === 'french' ? 6 : 3;
        else if (type === 'large') widthFt = 8;
        else widthFt = DEFAULT_WIN_WIDTH_FT;
      }
      if (!(heightFt > 0)) {
        if (type === 'door') heightFt = opts.door_type === 'sliding' || opts.door_type === 'french' ? 7 : 80 / 12;
        else if (type === 'large') heightFt = 6 + 8 / 12;
        else heightFt = DEFAULT_WIN_HEIGHT_FT;
      }
      const t = opts.t != null ? Number(opts.t) : 0.5;
      const win = normalizeWindow({
        id: uid(type === 'door' ? 'door' : (type === 'large' ? 'open' : 'win')),
        wallId: target.id,
        t,
        widthFt,
        heightFt,
        sillFt,
        openingType: type,
        doorType: opts.door_type || null,
      });
      // extend normalize to keep openingType
      win.openingType = type;
      if (opts.door_type) win.doorType = opts.door_type;
      state.windows.push(win);
      state.selected = { type: 'window', id: win.id };
      notify();
      draw();
      return win;
    }

    function moveOpening(openingId, tDelta) {
      const win = state.windows.find((w) => w.id === openingId);
      if (!win) return null;
      pushHistory();
      win.t = Math.max(0.05, Math.min(0.95, (win.t || 0.5) + (Number(tDelta) || 0.1)));
      updateWindow(win.id, { t: win.t });
      return win;
    }

    function resizeOpening(openingId, wFt, hFt) {
      const win = state.windows.find((w) => w.id === openingId);
      if (!win) return null;
      pushHistory();
      const props = {};
      if (wFt > 0) props.widthFt = wFt;
      if (hFt > 0) props.heightFt = hFt;
      updateWindow(openingId, props);
      return win;
    }

    function removeOpening(openingId) {
      const win = state.windows.find((w) => w.id === openingId);
      if (!win) return false;
      pushHistory();
      state.windows = state.windows.filter((w) => w.id !== openingId);
      if (state.selected && state.selected.id === openingId) state.selected = null;
      notify();
      draw();
      return true;
    }

    function labelRoom(roomId, use) {
      pushHistory();
      let room = roomId ? state.rooms.find((r) => r.id === roomId) : primaryRoom();
      if (!room && state.rooms.length) room = state.rooms[0];
      if (!room) {
        if (hooks.onToast) hooks.onToast('Draw a room first');
        return null;
      }
      room.use = use;
      const pretty = use ? use.charAt(0).toUpperCase() + use.slice(1) : room.name;
      room.name = pretty || room.name || 'Room';
      notify();
      draw();
      return room;
    }

    function snapshotPlan() {
      return JSON.parse(JSON.stringify({
        walls: state.walls,
        rooms: state.rooms,
        windows: state.windows,
        fixtures: state.fixtures,
        rooflines: state.rooflines,
        roofPitch: state.roofPitch,
        roofPitchLabel: state.roofPitchLabel,
        roofStyle: state.roofStyle,
      }));
    }

    function restorePlanSnapshot(snap) {
      if (!snap) return;
      state.walls = snap.walls || [];
      state.rooms = snap.rooms || [];
      state.windows = (snap.windows || []).map(normalizeWindow).filter(Boolean);
      state.fixtures = (snap.fixtures || []).map(normalizeFixture).filter(Boolean);
      // re-apply openingType if present in snap
      (snap.windows || []).forEach((src, i) => {
        if (state.windows[i] && src.openingType) state.windows[i].openingType = src.openingType;
        if (state.windows[i] && src.doorType) state.windows[i].doorType = src.doorType;
      });
      state.rooflines = snap.rooflines || [];
      state.roofPitch = snap.roofPitch != null ? snap.roofPitch : null;
      state.roofPitchLabel = snap.roofPitchLabel || null;
      state.roofStyle = snap.roofStyle || null;
      state.selected = null;
      notify();
      draw();
    }

    function setRoof(opts) {
      opts = opts || {};
      const pitch = Number(opts.pitch);
      const pitchLabel = opts.pitchLabel || (isFinite(pitch) ? String(opts.pitchLabel || '') : null);
      const style = opts.style === 'hip' ? 'hip' : 'gable';
      pushHistory();
      state.roofPitch = isFinite(pitch) ? pitch : null;
      state.roofPitchLabel = pitchLabel || null;
      state.roofStyle = style;
      const room = primaryRoom();
      if (room) {
        room.roofPitch = state.roofPitch;
        room.roofPitchLabel = state.roofPitchLabel;
        room.roofStyle = style;
      }
      notify();
      draw();
      return {
        roomId: room ? room.id : null,
        roofPitch: state.roofPitch,
        roofPitchLabel: state.roofPitchLabel,
        roofStyle: state.roofStyle,
      };
    }

    function getRoof() {
      return {
        roofPitch: state.roofPitch,
        roofPitchLabel: state.roofPitchLabel,
        roofStyle: state.roofStyle,
      };
    }


    return {
      setTool,
      undo,
      clearAll,
      exportData,
      importData,
      getSelectedObject,
      deleteSelected,
      updateSelectedProps,
      updateWindow,
      finishCurrentStroke,
      canFinishStroke,
      setRoomWallHeights,
      syncRoomWalls,
      setExistingHouse,
      getExistingHouse,
      clearExistingHouse,
      resizeRoomFootprint,
      setAllWallHeights,
      setWallHeight,
      addInteriorWall,
      moveWallById,
      removeWallById,
      addOpeningOnWall,
      moveOpening,
      resizeOpening,
      removeOpening,
      labelRoom,
      snapshotPlan,
      restorePlanSnapshot,
      setRoof,
      getRoof,
      primaryRoom,
      resolveWall,
      setActiveFixture,
      getActiveFixtureId() { return state.activeFixtureId; },
      getFixtureDefs() { return FIXTURE_DEFS; },
      getFixtureToolOptions() { return FIXTURE_TOOL_OPTIONS; },

      selectById(type, id) {
        state.selected = { type, id };
        notify();
        draw();
      },
      zoomIn() { zoomBy(1.15); },
      zoomOut() { zoomBy(1 / 1.15); },
      resetView,
      resize,
      isEmpty,
      getTool() { return state.tool; },
      getActiveWinPresetId() { return state.activeWinPresetId || '3x4'; },
      setActiveWinPresetId(id) {
        const ok = WIN_SIZE_PRESETS.some((p) => p.id === id);
        state.activeWinPresetId = ok ? id : '3x4';
        if (hooks.onToolChange) hooks.onToolChange(state.tool, { activeWinPresetId: state.activeWinPresetId });
        return state.activeWinPresetId;
      },
      WIN_SIZE_PRESETS,
    };
  }

  global.HomePlanFloor = { createFloorPlan, FIXTURE_DEFS, FIXTURE_TOOL_OPTIONS, FIXTURE_TOOL_DEFAULTS, WIN_SIZE_PRESETS };
})(window);
