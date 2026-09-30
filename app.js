/**
 * HomePlan app shell — Guidance A–K, Materials, 3D, Save/Share (share1 view-only mock)
 * REMODEL_GUIDE_HOOK: /workspace/remodel-app-content-v1.md via guide-data.js
 * BARE_BONES: /workspace/remodel-app-small-budget-v1.md (budget_mode standard|bare_bones)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'homeplan.project.v1';
  const G = () => window.HomePlanGuide;

  const els = {
    navBtns: document.querySelectorAll('.nav-btn'),
    navSelect: document.getElementById('nav-view-select'),
    views: {
      plan: document.getElementById('view-plan'),
      guidance: document.getElementById('view-guidance'),
      materials: document.getElementById('view-materials'),
      view3d: document.getElementById('view-view3d'),
      walkthrough: document.getElementById('view-walkthrough'),
      project: document.getElementById('view-project'),
    },
    projectName: document.getElementById('project-name'),
    projectNamePage: document.getElementById('project-name-page'),
    saveStatus: document.getElementById('save-status'),
    emptyTip: document.getElementById('empty-tip'),
    roomList: document.getElementById('room-list'),
    roomListEmpty: document.getElementById('room-list-empty'),
    propsEmpty: document.getElementById('props-empty'),
    propsFields: document.getElementById('props-fields'),
    propName: document.getElementById('prop-name'),
    propWidth: document.getElementById('prop-width'),
    propLength: document.getElementById('prop-length'),
    propHeight: document.getElementById('prop-height'),
    propHeightWrap: document.getElementById('prop-height-wrap'),
    toast: document.getElementById('toast'),
    shareModal: document.getElementById('share-modal'),
    shareLink: document.getElementById('share-link'),
  };

  let floor = null;
  let view3d = null;
  let qaIndex = 0;
  const qaAnswers = {};
  let toastTimer = null;
  let rebuild3dTimer = null;
  let suppressing3dRebuild = false;
  let planDirtyFor3d = true;
  let tipDismissed = false;
  /** budget_mode: 'standard' | 'bare_bones' — always toggleable; soft-offered on K42=u50 / H30=budget */
  let budgetMode = 'standard';
  let bareBonesOfferDismissed = false;
  const bareBonesMethodChecks = { A: false, B: false, C: false, D: false, E: false };

  let pendingWallHeightRoomId = null;

  function openWallHeightModal(room) {
    // Legacy sheet — not auto-opened after place. Still available if called manually.
    try {
      if (localStorage.getItem('homeplan.wallHeight.dontAsk') === '1') {
        pendingWallHeightRoomId = null;
        return;
      }
    } catch (_) {}
    pendingWallHeightRoomId = room && room.id;
    const modal = document.getElementById('wall-height-modal');
    if (!modal || !pendingWallHeightRoomId) return;
    const heights = (room && room.wallHeights) || {};
    ['north', 'east', 'south', 'west'].forEach((side) => {
      const inp = document.getElementById('wh-' + side);
      if (inp) inp.value = heights[side] != null ? heights[side] : 8;
    });
    modal.hidden = false;
    const first = document.getElementById('wh-north');
    if (first) setTimeout(() => first.focus(), 50);
  }

  function readWallHeightFields() {
    const out = {};
    ['north', 'east', 'south', 'west'].forEach((side) => {
      const inp = document.getElementById('wh-' + side);
      const v = inp ? parseFloat(inp.value) : 8;
      out[side] = (isFinite(v) && v > 0) ? v : 8;
    });
    return out;
  }

  function closeWallHeightModal(useDefaults) {
    const modal = document.getElementById('wall-height-modal');
    if (modal) modal.hidden = true;
    if (pendingWallHeightRoomId && floor && floor.setRoomWallHeights) {
      const heights = useDefaults
        ? { north: 8, east: 8, south: 8, west: 8 }
        : readWallHeightFields();
      floor.setRoomWallHeights(pendingWallHeightRoomId, heights);
      schedule3DRebuild();
      showToast(useDefaults ? 'Walls set to 8 ft' : 'Wall heights saved');
    }
    pendingWallHeightRoomId = null;
  }

  function initWallHeightModal() {
    const done = document.getElementById('wall-height-done');
    const cancel = document.getElementById('wall-height-cancel');
    const backdrop = document.getElementById('wall-height-backdrop');
    const skip = document.getElementById('wall-height-skip');
    const dontAsk = document.getElementById('wall-height-dont-ask');
    if (done) done.addEventListener('click', () => closeWallHeightModal(false));
    if (cancel) cancel.addEventListener('click', () => closeWallHeightModal(true));
    if (backdrop) backdrop.addEventListener('click', () => closeWallHeightModal(true));
    if (skip) skip.addEventListener('click', () => closeWallHeightModal(true));
    if (dontAsk) {
      dontAsk.addEventListener('click', () => {
        try { localStorage.setItem('homeplan.wallHeight.dontAsk', '1'); } catch (_) {}
        closeWallHeightModal(true);
      });
    }
  }


  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2400);
  }

  function money(n) {
    return '$' + Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function switchView(name) {
    Object.entries(els.views).forEach(([key, el]) => {
      if (!el) return;
      const on = key === name;
      el.classList.toggle('active', on);
      if (on) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
    els.navBtns.forEach((btn) => {
      const on = btn.dataset.view === name;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (els.navSelect && els.navSelect.value !== name) {
      els.navSelect.value = name;
    }
    if (name === 'plan' && floor) requestAnimationFrame(() => floor.resize());
    if (name === 'view3d') {
      ensure3D();
      rebuild3D(true);
      pierPanelDismissed = false;
    }
    if (name === 'materials') renderMaterials();
    if (name === 'walkthrough') renderWalkthrough();
    if (typeof refreshPierPanelVisibility === 'function') refreshPierPanelVisibility();
  }

  function schedule3DRebuild() {
    if (suppressing3dRebuild) {
      planDirtyFor3d = true;
      return;
    }
    planDirtyFor3d = true;
    clearTimeout(rebuild3dTimer);
    rebuild3dTimer = setTimeout(() => {
      if (els.views.view3d && els.views.view3d.classList.contains('active')) {
        rebuild3D(true);
      }
    }, 280);
  }

  function ensure3D() {
    if (view3d) return;
    if (!window.HomePlan3D) return;
    view3d = window.HomePlan3D.createView3D(els.views.view3d);
    window.__hpView3d = view3d;
    if (view3d.setHooks) {
      view3d.setHooks({
        onWindowChange(win, meta) {
          if (!floor || !floor.updateWindow || !win) return;
          suppressing3dRebuild = true;
          try {
            floor.updateWindow(win.id, {
              t: win.t,
              widthFt: win.widthFt,
              heightFt: win.heightFt,
              sillFt: win.sillFt,
            });
            if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
          } finally {
            suppressing3dRebuild = false;
          }
          planDirtyFor3d = true;
        },
        onWindowSelect(win) {
          if (!floor) return;
          if (win && win.id) floor.selectById('window', win.id);
        },
        onOpeningAdd(opts) {
          if (!floor || !floor.addOpeningOnWall) return null;
          suppressing3dRebuild = true;
          let win = null;
          try {
            win = floor.addOpeningOnWall(opts);
            if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
          } finally {
            suppressing3dRebuild = false;
          }
          planDirtyFor3d = true;
          rebuild3D(true);
          return win;
        },
        onToast(msg) {
          if (typeof showToast === 'function') showToast(msg);
          else if (els.saveStatus) els.saveStatus.textContent = msg;
        },
      });
    }
  }

  function rebuild3D(force) {
    ensure3D();
    if (!view3d) return;
    if (!force && !planDirtyFor3d) return;
    const prevSel = view3d.getSelectedWindowId ? view3d.getSelectedWindowId() : null;
    const plan = floor ? floor.exportData() : { walls: [], rooms: [], windows: [], rooflines: [] };
    const store = G() ? G().build3DStore(qaAnswers) : {};
    view3d.buildFromPlan(plan, store, { preserveCamera: !!prevSel });
    view3d.show();
    if (prevSel && view3d.selectWindow) view3d.selectWindow(prevSel, { silent: true });
    // Keep 3D add-palette defaults in sync with Guidance D18b presets
    if (view3d.setAddPreset && store) {
      if (store.opening_preset_win_w_in && store.opening_preset_win_h_in) {
        const w = store.opening_preset_win_w_in, h = store.opening_preset_win_h_in;
        const id = (w === 8 && h === 24) ? '8x24' : (w === 36 && h === 60) ? '3x5' : (w === 48 && h === 48) ? '4x4' : '3x4';
        view3d.setAddPreset('window', { id, w, h });
      }
      if (store.opening_preset_door_w_in && store.opening_preset_door_h_in) {
        const w = store.opening_preset_door_w_in, h = store.opening_preset_door_h_in;
        const id = (w === 72 && h === 84) ? 'sliding_6x7' : (w === 96 && h === 84) ? 'sliding_8x7' : '36x80';
        view3d.setAddPreset('door', { id, w, h });
      }
    }
    planDirtyFor3d = false;
  }


  // ---- Fixtures palette chrome (v1) ----
  const FIXTURE_TIP_SHOWN = { sink: false, outlet: false, cabinet: false };

  function syncFixtureSubtypeBar(tool, activeId) {
    const bar = document.getElementById('fixture-subtype-bar');
    const chips = document.getElementById('fixture-subtype-chips');
    const label = document.getElementById('fixture-subtype-label');
    if (!bar || !chips || !floor) return;
    const optsMap = (window.HomePlanFloor && window.HomePlanFloor.FIXTURE_TOOL_OPTIONS) || {};
    const defs = (window.HomePlanFloor && window.HomePlanFloor.FIXTURE_DEFS) || {};
    const opts = optsMap[tool];
    if (!opts || opts.length <= 1) {
      bar.hidden = true;
      chips.innerHTML = '';
      return;
    }
    bar.hidden = false;
    const titles = { cabinet: 'Cabinet', sink: 'Sink', outlet: 'Device', counter: 'Counter' };
    if (label) label.textContent = titles[tool] || 'Type';
    const cur = activeId || (floor.getActiveFixtureId && floor.getActiveFixtureId()) || opts[0];
    chips.innerHTML = '';
    opts.forEach((fid) => {
      const def = defs[fid] || {};
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fixture-chip' + (fid === cur ? ' active' : '');
      btn.dataset.fixtureId = fid;
      btn.textContent = (def.label || fid).replace(/ \(.*\)/, '');
      btn.title = def.label || fid;
      btn.addEventListener('click', () => {
        if (floor.setActiveFixture) floor.setActiveFixture(fid);
        syncFixtureSubtypeBar(tool, fid);
      });
      chips.appendChild(btn);
    });
  }

  function syncWinSizeBar(tool) {
    const bar = document.getElementById('win-size-bar');
    const chips = document.getElementById('win-size-chips');
    if (!bar || !chips || !floor) return;
    if (tool !== 'window') {
      bar.hidden = true;
      chips.innerHTML = '';
      return;
    }
    const presets = (window.HomePlanFloor && window.HomePlanFloor.WIN_SIZE_PRESETS)
      || (floor.WIN_SIZE_PRESETS)
      || [
        { id: '3x4', label: '3×4', wIn: 36, hIn: 48 },
        { id: '3x5', label: '3×5', wIn: 36, hIn: 60 },
        { id: '4x4', label: '4×4', wIn: 48, hIn: 48 },
        { id: '8x24', label: '8×24', wIn: 8, hIn: 24 },
      ];
    bar.hidden = false;
    const cur = (floor.getActiveWinPresetId && floor.getActiveWinPresetId()) || '3x4';
    chips.innerHTML = '';
    presets.forEach((p) => {
      if (!p.wIn) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fixture-chip' + (p.id === cur ? ' active' : '');
      btn.textContent = p.label;
      btn.title = p.title || p.label;
      btn.addEventListener('click', () => {
        if (floor.setActiveWinPresetId) floor.setActiveWinPresetId(p.id);
        syncWinSizeBar('window');
      });
      chips.appendChild(btn);
    });
  }

  function showFixtureTip(fx) {
    if (!fx) return;
    const el = document.getElementById('fixture-tip');
    const id = fx.fixtureId || '';
    let tone = 'example';
    let msg = '';
    if (String(id).startsWith('sink_')) {
      if (FIXTURE_TIP_SHOWN.sink) return;
      FIXTURE_TIP_SHOWN.sink = true;
      tone = 'awareness';
      msg = 'Sinks need supply and drain. New plumbing is usually licensed work and often needs a permit. (EXAMPLE layout only.)';
    } else if (id === 'outlet_duplex' || id === 'switch_single') {
      if (FIXTURE_TIP_SHOWN.outlet) return;
      FIXTURE_TIP_SHOWN.outlet = true;
      tone = 'awareness';
      msg = 'Outlets near water usually need GFCI protection. Spacing and circuits are set by code — an electrician confirms.';
    } else if (id === 'cab_base' || id === 'cab_upper' || id === 'counter_base') {
      if (FIXTURE_TIP_SHOWN.cabinet) return;
      FIXTURE_TIP_SHOWN.cabinet = true;
      tone = 'example';
      msg = 'Showing standard 24 in base / 12 in upper depths (EXAMPLE). Real layouts vary — conceptual only.';
    }
    if (!msg || !el) return;
    el.className = 'fixture-tip ' + tone;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showFixtureTip._t);
    showFixtureTip._t = setTimeout(() => { el.hidden = true; }, 5200);
  }

  // ---- Floor plan ----
  function initFloorPlan() {
    const canvas = document.getElementById('floor-canvas');
    floor = window.HomePlanFloor.createFloorPlan(canvas, {
      onChange() {
        if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
        schedule3DRebuild();
        walkthroughDirty = true;
      },
      onEmptyChange(empty) {
        // Once dismissed, never auto-reshow while empty (was blocking phones).
        if (tipDismissed || !empty) els.emptyTip.classList.add('hidden');
        else els.emptyTip.classList.remove('hidden');
      },
      onInteract() {
        if (!tipDismissed) {
          tipDismissed = true;
          if (els.emptyTip) els.emptyTip.classList.add('hidden');
        }
      },
      onRooms(rooms) { renderRoomList(rooms); },
      onSelection(sel, obj) { renderProps(sel, obj); },
      onToast: showToast,
      onToolChange(tool, extra) {
        document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
          const t = btn.dataset.tool;
          if (t === 'undo' || t === 'clear') return;
          btn.classList.toggle('active', t === tool);
        });
        syncFixtureSubtypeBar(tool, extra && extra.activeFixtureId);
        syncWinSizeBar(tool);
      },
      onDrawChrome(info) {
        const show = !!(info && info.canFinish);
        const barBtn = document.getElementById('btn-draw-done');
        const fab = document.getElementById('draw-done-fab');
        if (barBtn) barBtn.hidden = !show;
        if (fab) fab.hidden = !show;
        if (info && info.tool) {
          syncFixtureSubtypeBar(info.tool, info.activeFixtureId);
          syncWinSizeBar(info.tool);
        }
      },
      onFixturePlaced(fx) {
        showFixtureTip(fx);
      },
      onRoomPlaced(room) {
        // No blocking wall-height sheet — rooms default to 8 ft all sides.
        // Heights stay editable via Selected props (and wizard).
        if (room && room.name) showToast(room.name + ' placed · walls 8 ft (edit in Selected)');
      },
    });
    window.__hpFloor = floor;

    // Default Room tool (easiest on phone) — sync toolbar
    floor.setTool('room');

    document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => floor.setTool(btn.dataset.tool));
    });
    document.getElementById('btn-zoom-in').addEventListener('click', () => floor.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => floor.zoomOut());
    document.getElementById('btn-zoom-reset').addEventListener('click', () => floor.resetView());

    function finishStroke() {
      if (floor && floor.finishCurrentStroke) floor.finishCurrentStroke();
    }
    const doneBar = document.getElementById('btn-draw-done');
    const doneFab = document.getElementById('btn-draw-done-fab');
    if (doneBar) doneBar.addEventListener('click', finishStroke);
    if (doneFab) doneFab.addEventListener('click', finishStroke);

    function dismissEmptyTip(opts) {
      tipDismissed = true;
      if (els.emptyTip) els.emptyTip.classList.add('hidden');
      if (opts && opts.tool) floor.setTool(opts.tool);
      if (opts && opts.toast) showToast(opts.toast);
    }
    const startBtn = document.getElementById('btn-start-drawing');
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissEmptyTip({ tool: 'room', toast: 'Drag on the canvas to draw a room' });
      });
    }
    const gotIt = document.getElementById('btn-got-it-tip');
    if (gotIt) {
      gotIt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissEmptyTip({ tool: 'room' });
      });
    }
    const xTip = document.getElementById('btn-dismiss-tip');
    if (xTip) {
      xTip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissEmptyTip({ tool: 'room' });
      });
    }
    // Dismiss tip when user picks any draw tool from the toolbar
    document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tool;
        if (t && t !== 'undo' && t !== 'clear') dismissEmptyTip();
      });
    });

    els.propName.addEventListener('change', () => floor.updateSelectedProps({ name: els.propName.value }));
    els.propWidth.addEventListener('change', () => floor.updateSelectedProps({ width: parseFloat(els.propWidth.value) }));
    els.propLength.addEventListener('change', () => floor.updateSelectedProps({ length: parseFloat(els.propLength.value) }));
    if (els.propHeight) {
      els.propHeight.addEventListener('change', () => {
        const h = parseFloat(els.propHeight.value);
        if (!isFinite(h) || h <= 0) return;
        floor.updateSelectedProps({ heightFt: h });
      });
    }
    document.getElementById('prop-delete').addEventListener('click', () => floor.deleteSelected());
  }

  function renderRoomList(rooms) {
    els.roomList.innerHTML = '';
    els.roomListEmpty.style.display = rooms.length ? 'none' : 'block';
    rooms.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `${r.name} · ${r.w.toFixed(1)}×${r.h.toFixed(1)} ft`;
      li.addEventListener('click', () => floor.selectById('room', r.id));
      els.roomList.appendChild(li);
    });
  }

  function renderProps(sel, obj) {
    if (!sel || !obj) {
      els.propsEmpty.classList.remove('hidden');
      els.propsFields.classList.add('hidden');
      return;
    }
    els.propsEmpty.classList.add('hidden');
    els.propsFields.classList.remove('hidden');
    const showHeight = sel.type === 'room' || sel.type === 'wall';
    if (els.propHeightWrap) els.propHeightWrap.classList.toggle('hidden', !showHeight);
    if (sel.type === 'room') {
      els.propName.value = obj.name || '';
      els.propWidth.value = obj.w;
      els.propLength.value = obj.h;
      els.propWidth.disabled = false;
      els.propLength.disabled = false;
      if (els.propHeight) {
        const wh = obj.wallHeights || {};
        const vals = ['north', 'east', 'south', 'west'].map((s) => Number(wh[s])).filter((v) => isFinite(v) && v > 0);
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 8;
        els.propHeight.value = Math.round(avg * 10) / 10;
        els.propHeight.disabled = false;
      }
    } else if (sel.type === 'fixture') {
      els.propName.value = obj.label || obj.fixtureId || 'Fixture';
      if (obj.planKind === 'wall') {
        els.propWidth.value = ((obj.plateWIn || 2.75) / 12).toFixed(2);
        els.propLength.value = ((obj.affIn || 12) / 12).toFixed(2);
      } else {
        els.propWidth.value = ((obj.widthIn || 24) / 12).toFixed(2);
        els.propLength.value = ((obj.depthIn || 24) / 12).toFixed(2);
      }
      els.propWidth.disabled = true;
      els.propLength.disabled = true;
      if (els.propHeightWrap) els.propHeightWrap.classList.add('hidden');
      if (els.propHeight) {
        els.propHeight.value = '';
        els.propHeight.disabled = true;
      }
    } else {
      els.propName.value = obj.name || sel.type;
      els.propWidth.value = sel.type === 'wall'
        ? Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1).toFixed(1) : '';
      els.propLength.value = '';
      els.propWidth.disabled = true;
      els.propLength.disabled = true;
      if (els.propHeight) {
        if (sel.type === 'wall') {
          els.propHeight.value = (obj.heightFt != null && isFinite(obj.heightFt)) ? obj.heightFt : 8;
          els.propHeight.disabled = false;
        } else {
          els.propHeight.value = '';
          els.propHeight.disabled = true;
        }
      }
    }
  }


  // ---- Existing house (addition) ----
  let existingHousePrompted = false;
  let walkthroughDirty = true;
  let lastWalkthrough = null;

  function maybePromptExistingHouse(force) {
    if (!floor) return;
    const has = floor.getExistingHouse && floor.getExistingHouse();
    if (!force && has) return;
    openExistingHouseModal();
  }

  function refreshExistingHouseChrome() {
    const btn = document.getElementById('btn-set-existing-house');
    const hint = document.getElementById('existing-house-hint');
    const has = !!(floor && floor.getExistingHouse && floor.getExistingHouse());
    if (btn) {
      btn.classList.toggle('has-house', has);
      btn.title = has
        ? 'Existing house — tap to edit footprint'
        : 'Existing house — set the old / current structure footprint';
    }
    if (hint) hint.textContent = has ? 'Placed · edit' : 'Old structure';
  }

  function openExistingHouseModal() {
    const modal = document.getElementById('existing-house-modal');
    if (!modal) return;
    switchView('plan');
    const cur = floor && floor.getExistingHouse && floor.getExistingHouse();
    const len = document.getElementById('eh-length');
    const wid = document.getElementById('eh-width');
    if (len) len.value = cur ? cur.lengthFt : 40;
    if (wid) wid.value = cur ? cur.widthFt : 30;
    const help = document.getElementById('existing-house-help');
    const projectType = qaAnswers && qaAnswers.A1;
    if (help) {
      if (cur) {
        help.innerHTML = 'Edit the locked footprint of the <strong>old / current</strong> house. Draw addition rooms off its edges.';
      } else if (projectType && projectType !== 'addition' && projectType !== 'unsure') {
        help.innerHTML = 'Place the <strong>old / current</strong> house footprint first (typical for additions). Guidance isn’t set to “addition” yet — we’ll tip that mode when you place it. You can still remodel without this.';
      } else {
        help.innerHTML = 'Start here for an addition: enter the approximate footprint of the <strong>old / current</strong> house. It locks on the Plan so you can draw new rooms off its edges.';
      }
    }
    modal.hidden = false;
    existingHousePrompted = true;
    if (len) setTimeout(() => len.focus(), 40);
  }

  function closeExistingHouseModal(place) {
    const modal = document.getElementById('existing-house-modal');
    if (modal) modal.hidden = true;
    if (!place || !floor || !floor.setExistingHouse) return;
    const lengthFt = parseFloat((document.getElementById('eh-length') || {}).value) || 40;
    const widthFt = parseFloat((document.getElementById('eh-width') || {}).value) || 30;
    floor.setExistingHouse({ lengthFt, widthFt });
    // Soft-align Guidance toward addition when user places an existing house
    if (!qaAnswers.A1 || qaAnswers.A1 === 'remodel') {
      qaAnswers.A1 = 'addition';
      showToast('Existing house placed · Guidance set to addition');
    } else {
      showToast('Existing house placed (locked on Plan)');
    }
    refreshExistingHouseChrome();
    schedule3DRebuild();
    walkthroughDirty = true;
    switchView('plan');
  }

  function initExistingHouseModal() {
    const done = document.getElementById('existing-house-done');
    const skip = document.getElementById('existing-house-skip');
    const backdrop = document.getElementById('existing-house-backdrop');
    const btn = document.getElementById('btn-set-existing-house');
    if (done) done.addEventListener('click', () => closeExistingHouseModal(true));
    if (skip) skip.addEventListener('click', () => closeExistingHouseModal(false));
    if (backdrop) backdrop.addEventListener('click', () => closeExistingHouseModal(false));
    if (btn) {
      btn.addEventListener('click', () => {
        tipDismissed = true;
        if (els.emptyTip) els.emptyTip.classList.add('hidden');
        openExistingHouseModal();
      });
    }
    refreshExistingHouseChrome();
  }


  // ---- Roof pitch & style picker ----
  let roofPickerPitch = '6/12';
  let roofPickerStyle = 'gable';

  function parsePitchLabel(label) {
    const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const rise = parseFloat(m[1]), run = parseFloat(m[2]);
    if (!(rise > 0) || !(run > 0)) return null;
    return { rise, run, ratio: rise / run, label: rise + '/' + run };
  }

  function syncRoofPickerUI() {
    document.querySelectorAll('#roof-pitch-chips .roof-chip').forEach((btn) => {
      const p = btn.dataset.pitch;
      const active = p === 'custom'
        ? roofPickerPitch === 'custom'
        : p === roofPickerPitch;
      btn.classList.toggle('active', active);
    });
    document.querySelectorAll('#roof-style-chips .roof-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.style === roofPickerStyle);
    });
    const wrap = document.getElementById('roof-custom-wrap');
    if (wrap) wrap.classList.toggle('hidden', roofPickerPitch !== 'custom');
  }

  function openRoofPicker() {
    const modal = document.getElementById('roof-picker-modal');
    if (!modal) return;
    tipDismissed = true;
    if (els.emptyTip) els.emptyTip.classList.add('hidden');
    switchView('plan');
    const cur = floor && floor.getRoof ? floor.getRoof() : {};
    if (cur.roofPitchLabel) roofPickerPitch = cur.roofPitchLabel;
    else if (qaAnswers.F24a) {
      const map = {
        flat: '2/12', '3_12': '3/12', '4_12': '4/12', '5_12': '5/12', '6_12': '6/12',
        '7_12': '7/12', '8_12': '8/12', '9_12': '9/12', '12_12': '12/12', '4_10': '4/10',
      };
      roofPickerPitch = map[qaAnswers.F24a] || '6/12';
    } else roofPickerPitch = '6/12';
    roofPickerStyle = cur.roofStyle || qaAnswers.F24style || qaAnswers.roof_style || 'gable';
    if (roofPickerStyle === 'unsure') roofPickerStyle = 'gable';
    const known = ['3/12','4/12','5/12','6/12','7/12','8/12','9/12','12/12','4/10'];
    if (roofPickerPitch && !known.includes(roofPickerPitch)) {
      const parsed = parsePitchLabel(roofPickerPitch);
      roofPickerPitch = 'custom';
      if (parsed) {
        const riseEl = document.getElementById('roof-custom-rise');
        const runEl = document.getElementById('roof-custom-run');
        if (riseEl) riseEl.value = parsed.rise;
        if (runEl) runEl.value = parsed.run;
      }
    }
    const target = document.getElementById('roof-picker-target');
    const room = floor && floor.primaryRoom ? floor.primaryRoom() : null;
    if (target) {
      if (room) target.textContent = 'Applies to ' + (room.name || 'selected room') + ' · updates Guidance & 3D.';
      else target.textContent = 'No room yet — sets plan roof + Guidance/3D. Draw a room anytime.';
    }
    syncRoofPickerUI();
    modal.hidden = false;
  }

  function closeRoofPicker() {
    const modal = document.getElementById('roof-picker-modal');
    if (modal) modal.hidden = true;
  }

  function applyRoofPicker() {
    let label = roofPickerPitch;
    if (label === 'custom') {
      const rise = parseFloat((document.getElementById('roof-custom-rise') || {}).value);
      const run = parseFloat((document.getElementById('roof-custom-run') || {}).value) || 12;
      if (!(rise > 0) || !(run > 0)) {
        showToast('Enter a custom rise and run');
        return;
      }
      label = rise + '/' + run;
    }
    const parsed = parsePitchLabel(label);
    if (!parsed) {
      showToast('Pick a pitch');
      return;
    }
    const style = roofPickerStyle === 'hip' ? 'hip' : 'gable';
    if (floor && floor.setRoof) {
      floor.setRoof({ pitch: parsed.ratio, pitchLabel: parsed.label, style });
    }
    // Sync §5 / Guidance field_ids used by 3D + Walkthrough
    const wiz = window.HomePlanWizard;
    if (wiz && wiz.applyFieldToAnswers) {
      wiz.applyFieldToAnswers(qaAnswers, 'roof_pitch', parsed.label);
      wiz.applyFieldToAnswers(qaAnswers, 'roof_style', style);
    } else {
      const riseRun = parsed.label.split('/');
      const key = riseRun[1] === '10' && riseRun[0] === '4' ? '4_10' : (riseRun[0] + '_12');
      qaAnswers.F24a = key;
      qaAnswers.F24style = style;
      qaAnswers.roof_style = style;
      qaAnswers.roof_pitch_custom = parsed.ratio;
    }
    // Ensure roof shows in remodel mode
    if (qaAnswers.F0 == null) qaAnswers.F0 = 'yes';
    closeRoofPicker();
    schedule3DRebuild();
    walkthroughDirty = true;
    if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
    showToast('Roof · ' + parsed.label + ' ' + style);
  }

  function initRoofPicker() {
    const btn = document.getElementById('btn-roof');
    if (btn) btn.addEventListener('click', openRoofPicker);
    const apply = document.getElementById('roof-picker-apply');
    const cancel = document.getElementById('roof-picker-cancel');
    const backdrop = document.getElementById('roof-picker-backdrop');
    if (apply) apply.addEventListener('click', applyRoofPicker);
    if (cancel) cancel.addEventListener('click', closeRoofPicker);
    if (backdrop) backdrop.addEventListener('click', closeRoofPicker);
    document.querySelectorAll('#roof-pitch-chips .roof-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        roofPickerPitch = chip.dataset.pitch;
        syncRoofPickerUI();
      });
    });
    document.querySelectorAll('#roof-style-chips .roof-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        roofPickerStyle = chip.dataset.style;
        syncRoofPickerUI();
      });
    });
  }

  // ---- Foundation type picker (E21 / piers / sonotubes) ----
  const FOUNDATION_LABELS = {
    slab: 'Slab',
    crawl: 'Crawl space',
    basement: 'Basement',
    piers: 'Piers / sonotubes',
    match: 'Match house',
  };
  const PIER_DEFAULTS = { height: 2.5, spacing: 6, diameter: 12 };
  let foundationPickerType = 'slab';
  let pierPanelDismissed = false;

  function hasAdditionFootprintContext() {
    const a1 = qaAnswers && qaAnswers.A1;
    if (!a1 || a1 === 'addition' || a1 === 'both' || a1 === 'detached' || a1 === 'unsure') return true;
    if (qaAnswers && qaAnswers.E21) return true;
    if (qaAnswers && qaAnswers.A2a && (qaAnswers.A2a.l || qaAnswers.A2a.w)) return true;
    const hasEh = !!(floor && floor.getExistingHouse && floor.getExistingHouse());
    if (hasEh) return true;
    const plan = floor && floor.exportData ? floor.exportData() : null;
    if (plan && ((plan.rooms && plan.rooms.length) || (plan.walls && plan.walls.length))) return true;
    return false;
  }

  function currentFoundationType() {
    let t = (qaAnswers && qaAnswers.E21) || 'slab';
    if (t === 'sonotube' || t === 'sonotubes' || t === 'pier' || t === 'pylon' || t === 'pilon') t = 'piers';
    if (t === 'unsure' || t === 'unknown') t = 'slab';
    return t;
  }

  function readPierFieldsFromAnswers() {
    const h = Number(qaAnswers.pier_height_ft);
    const s = Number(qaAnswers.pier_spacing_ft);
    const d = Number(qaAnswers.pier_diameter_in);
    const c = Number(qaAnswers.pier_count);
    return {
      height: (h > 0 && Number.isFinite(h)) ? h : PIER_DEFAULTS.height,
      spacing: (s > 0 && Number.isFinite(s)) ? s : PIER_DEFAULTS.spacing,
      diameter: (d > 0 && Number.isFinite(d)) ? d : PIER_DEFAULTS.diameter,
      count: (c > 0 && Number.isFinite(c)) ? Math.round(c) : '',
    };
  }

  function writePierFieldsToAnswers(vals) {
    const wiz = window.HomePlanWizard;
    const apply = (id, v) => {
      if (wiz && wiz.applyFieldToAnswers) wiz.applyFieldToAnswers(qaAnswers, id, v);
      else if (v === '' || v == null) delete qaAnswers[id];
      else qaAnswers[id] = v;
    };
    apply('pier_height_ft', vals.height);
    apply('pier_spacing_ft', vals.spacing);
    apply('pier_diameter_in', vals.diameter);
    apply('pier_count', vals.count === '' || vals.count == null ? '' : vals.count);
  }

  function readPierInputsFromModal() {
    const hEl = document.getElementById('pier-height-ft');
    const sEl = document.getElementById('pier-spacing-ft');
    const dEl = document.getElementById('pier-diameter-in');
    const cEl = document.getElementById('pier-count');
    const h = hEl ? parseFloat(hEl.value) : PIER_DEFAULTS.height;
    const s = sEl ? parseFloat(sEl.value) : PIER_DEFAULTS.spacing;
    const d = dEl ? parseFloat(dEl.value) : PIER_DEFAULTS.diameter;
    const cRaw = cEl ? cEl.value.trim() : '';
    const c = cRaw === '' ? '' : parseInt(cRaw, 10);
    return {
      height: Number.isFinite(h) && h > 0 ? h : PIER_DEFAULTS.height,
      spacing: Number.isFinite(s) && s > 0 ? s : PIER_DEFAULTS.spacing,
      diameter: Number.isFinite(d) && d > 0 ? d : PIER_DEFAULTS.diameter,
      count: (c !== '' && Number.isFinite(c) && c > 0) ? c : '',
    };
  }

  function syncPierInputsToModal(vals) {
    const v = vals || readPierFieldsFromAnswers();
    const hEl = document.getElementById('pier-height-ft');
    const sEl = document.getElementById('pier-spacing-ft');
    const dEl = document.getElementById('pier-diameter-in');
    const cEl = document.getElementById('pier-count');
    if (hEl) hEl.value = v.height;
    if (sEl) sEl.value = v.spacing;
    if (dEl) dEl.value = v.diameter;
    if (cEl) cEl.value = v.count === '' || v.count == null ? '' : v.count;
  }

  function syncPierInputsTo3dPanel(vals) {
    const v = vals || readPierFieldsFromAnswers();
    const hEl = document.getElementById('v3d-pier-height');
    const sEl = document.getElementById('v3d-pier-spacing');
    const dEl = document.getElementById('v3d-pier-diameter');
    const cEl = document.getElementById('v3d-pier-count');
    if (hEl) hEl.value = v.height;
    if (sEl) sEl.value = v.spacing;
    if (dEl) dEl.value = v.diameter;
    if (cEl) cEl.value = v.count === '' || v.count == null ? '' : v.count;
  }

  function readPierInputsFrom3dPanel() {
    const hEl = document.getElementById('v3d-pier-height');
    const sEl = document.getElementById('v3d-pier-spacing');
    const dEl = document.getElementById('v3d-pier-diameter');
    const cEl = document.getElementById('v3d-pier-count');
    const h = hEl ? parseFloat(hEl.value) : PIER_DEFAULTS.height;
    const s = sEl ? parseFloat(sEl.value) : PIER_DEFAULTS.spacing;
    const d = dEl ? parseFloat(dEl.value) : PIER_DEFAULTS.diameter;
    const cRaw = cEl ? cEl.value.trim() : '';
    const c = cRaw === '' ? '' : parseInt(cRaw, 10);
    return {
      height: Number.isFinite(h) && h > 0 ? h : PIER_DEFAULTS.height,
      spacing: Number.isFinite(s) && s > 0 ? s : PIER_DEFAULTS.spacing,
      diameter: Number.isFinite(d) && d > 0 ? d : PIER_DEFAULTS.diameter,
      count: (c !== '' && Number.isFinite(c) && c > 0) ? c : '',
    };
  }

  function refreshPierPanelVisibility() {
    const panel = document.getElementById('view3d-pier-panel');
    if (!panel) return;
    const onPiers = currentFoundationType() === 'piers';
    const view3dActive = document.getElementById('view-view3d')
      && !document.getElementById('view-view3d').hidden;
    if (onPiers && view3dActive && !pierPanelDismissed) {
      panel.hidden = false;
      syncPierInputsTo3dPanel();
    } else if (!onPiers) {
      panel.hidden = true;
      pierPanelDismissed = false;
    } else if (!view3dActive) {
      // keep state; hide while off 3D
      panel.hidden = true;
    } else {
      panel.hidden = true;
    }
  }

  function applyPierDialValues(vals, opts) {
    const o = opts || {};
    writePierFieldsToAnswers(vals);
    syncPierInputsToModal(vals);
    syncPierInputsTo3dPanel(vals);
    refreshFoundationChrome();
    schedule3DRebuild();
    walkthroughDirty = true;
    if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
    if (!o.silent) {
      const bits = [
        vals.height + ' ft high',
        vals.spacing + ' ft o.c.',
        vals.diameter + ' in dia',
      ];
      if (vals.count) bits.push(vals.count + ' count');
      showToast('Piers / pylons · ' + bits.join(' · '));
    }
  }

  function refreshFoundationChrome() {
    const hint = document.getElementById('foundation-hint');
    const btn = document.getElementById('btn-foundation');
    const btn3d = document.getElementById('btn-foundation-3d');
    const t = currentFoundationType();
    const label = FOUNDATION_LABELS[t] || t;
    if (hint) {
      if (t === 'piers') {
        const v = readPierFieldsFromAnswers();
        hint.textContent = 'Piers · ' + v.height + ' ft · ' + v.spacing + ' o.c.';
      } else {
        hint.textContent = label;
      }
    }
    if (btn) {
      btn.classList.toggle('has-foundation', !!qaAnswers.E21);
      btn.classList.toggle('foundation-piers', t === 'piers');
      btn.title = 'Foundation — ' + label + (t === 'piers' ? ' (elevated / pylons — edit height, spacing, size)' : '');
    }
    if (btn3d) {
      btn3d.textContent = t === 'piers' ? 'Piers' : ('Fdn · ' + (FOUNDATION_LABELS[t] || t));
      btn3d.classList.toggle('active-foundation', t === 'piers');
    }
    refreshPierPanelVisibility();
  }

  function syncFoundationPickerUI() {
    document.querySelectorAll('#foundation-type-chips .roof-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.foundation === foundationPickerType);
    });
    const note = document.getElementById('foundation-picker-note');
    if (note) {
      const remodelOnly = qaAnswers && qaAnswers.A1 === 'remodel';
      const showNote = remodelOnly && !hasAdditionFootprintContext();
      note.hidden = !showNote;
    }
    const pierSec = document.getElementById('pier-controls-section');
    if (pierSec) {
      pierSec.hidden = foundationPickerType !== 'piers';
      if (foundationPickerType === 'piers') syncPierInputsToModal();
    }
  }

  function openFoundationPicker() {
    const modal = document.getElementById('foundation-picker-modal');
    if (!modal) return;
    foundationPickerType = currentFoundationType();
    if (!FOUNDATION_LABELS[foundationPickerType]) foundationPickerType = 'slab';
    syncPierInputsToModal();
    syncFoundationPickerUI();
    modal.hidden = false;
  }

  function closeFoundationPicker() {
    const modal = document.getElementById('foundation-picker-modal');
    if (modal) modal.hidden = true;
  }

  function applyFoundationPicker() {
    const type = foundationPickerType || 'slab';
    const wiz = window.HomePlanWizard;
    if (wiz && wiz.applyFieldToAnswers) {
      wiz.applyFieldToAnswers(qaAnswers, 'foundation_type', type);
    } else {
      qaAnswers.E21 = type;
    }
    if (type === 'piers') {
      writePierFieldsToAnswers(readPierInputsFromModal());
      pierPanelDismissed = false;
    }
    // Soft-align toward addition so Guidance Section E / 3D foundation stay available
    if (!qaAnswers.A1 || qaAnswers.A1 === 'remodel') {
      qaAnswers.A1 = 'addition';
    }
    closeFoundationPicker();
    refreshFoundationChrome();
    schedule3DRebuild();
    walkthroughDirty = true;
    if (typeof renderQA === 'function') {
      try { renderQA(); } catch (e) { /* ok if Guidance not ready */ }
    }
    if (typeof renderRecs === 'function') {
      try { renderRecs(); } catch (e) { /* ignore */ }
    }
    if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
    const label = FOUNDATION_LABELS[type] || type;
    if (type === 'piers') {
      const v = readPierFieldsFromAnswers();
      showToast('Foundation · Piers / pylons · ' + v.height + ' ft · ' + v.spacing + ' o.c. · ' + v.diameter + ' in');
    } else {
      showToast('Foundation · ' + label);
    }
  }

  function initFoundationPicker() {
    const btn = document.getElementById('btn-foundation');
    const btn3d = document.getElementById('btn-foundation-3d');
    if (btn) btn.addEventListener('click', openFoundationPicker);
    if (btn3d) {
      btn3d.addEventListener('click', () => {
        if (currentFoundationType() === 'piers') {
          // Re-open pier panel on 3D if dismissed; also open foundation picker for full controls
          pierPanelDismissed = false;
          refreshPierPanelVisibility();
        }
        openFoundationPicker();
      });
    }
    const apply = document.getElementById('foundation-picker-apply');
    const cancel = document.getElementById('foundation-picker-cancel');
    const backdrop = document.getElementById('foundation-picker-backdrop');
    if (apply) apply.addEventListener('click', applyFoundationPicker);
    if (cancel) cancel.addEventListener('click', closeFoundationPicker);
    if (backdrop) backdrop.addEventListener('click', closeFoundationPicker);
    document.querySelectorAll('#foundation-type-chips .roof-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        foundationPickerType = chip.dataset.foundation;
        syncFoundationPickerUI();
      });
    });

    // Live dial from foundation modal while on piers (Jake: see 3D update)
    let pierDialTimer = null;
    function livePierFromModal() {
      if (foundationPickerType !== 'piers') return;
      clearTimeout(pierDialTimer);
      pierDialTimer = setTimeout(() => {
        applyPierDialValues(readPierInputsFromModal(), { silent: true });
      }, 180);
    }
    ['pier-height-ft', 'pier-spacing-ft', 'pier-diameter-in', 'pier-count'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', livePierFromModal);
      el.addEventListener('input', livePierFromModal);
    });

    // 3D pier panel
    const pierApply = document.getElementById('v3d-pier-apply');
    const pierClose = document.getElementById('v3d-pier-close');
    if (pierApply) {
      pierApply.addEventListener('click', () => {
        applyPierDialValues(readPierInputsFrom3dPanel());
      });
    }
    if (pierClose) {
      pierClose.addEventListener('click', () => {
        pierPanelDismissed = true;
        const panel = document.getElementById('view3d-pier-panel');
        if (panel) panel.hidden = true;
      });
    }
    let pier3dTimer = null;
    function livePierFrom3d() {
      clearTimeout(pier3dTimer);
      pier3dTimer = setTimeout(() => {
        applyPierDialValues(readPierInputsFrom3dPanel(), { silent: true });
      }, 180);
    }
    ['v3d-pier-height', 'v3d-pier-spacing', 'v3d-pier-diameter', 'v3d-pier-count'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', livePierFrom3d);
      el.addEventListener('input', livePierFrom3d);
    });

    refreshFoundationChrome();
  }

  function wtDiagram(type, tokens) {
    if (type === 'none' || !type) return '';
    const L = tokens.footprint_l_ft || 12, W = tokens.footprint_w_ft || 16;
    const scale = 6;
    const pw = Math.min(220, L * scale), ph = Math.min(160, W * scale);
    if (type === 'sequence_flow' || type === 'materials_order_flow' || type === 'phase_calendar') {
      return '<div class="wt-diagram"><div class="cap">Conceptual diagram · ' + escapeHtml(type) + '</div></div>';
    }
    return '<div class="wt-diagram"><svg width="' + (pw + 40) + '" height="' + (ph + 36) + '" viewBox="0 0 ' + (pw + 40) + ' ' + (ph + 36) + '">' +
      '<rect x="20" y="12" width="' + pw + '" height="' + ph + '" fill="#cfc8be" stroke="#6a6760" stroke-width="2"/>' +
      '<text x="' + (20 + pw / 2) + '" y="' + (12 + ph / 2) + '" text-anchor="middle" font-size="11" fill="#3a3834">Existing</text>' +
      '<rect x="' + (20 + pw * 0.25) + '" y="' + (12 + ph) + '" width="' + (pw * 0.5) + '" height="' + Math.max(28, ph * 0.35) + '" fill="#e6f2f0" stroke="#2f6f6a" stroke-width="2"/>' +
      '<text x="' + (20 + pw / 2) + '" y="' + (12 + ph + Math.max(28, ph * 0.35) / 2 + 4) + '" text-anchor="middle" font-size="10" fill="#2f6f6a">Addition ~' + L + '×' + W + '</text>' +
      '</svg><div class="cap">Conceptual — not construction drawings · ' + escapeHtml(type) + '</div></div>';
  }

  function renderWalkthrough() {
    const host = document.getElementById('wt-content');
    if (!host) return;
    if (!window.HomePlanWalkthrough) {
      host.innerHTML = '<p class="muted">Walkthrough module not loaded.</p>';
      return;
    }
    const plan = floor ? floor.exportData() : {};
    qaAnswers.__budget_mode = budgetMode;
    lastWalkthrough = window.HomePlanWalkthrough.generate(qaAnswers, plan, { budgetMode });
    walkthroughDirty = false;
    const doc = lastWalkthrough;
    const tok = doc.tokens;
    const chip = document.getElementById('wt-defaults-chip');
    if (chip) chip.hidden = !(doc.defaultsUsed && doc.defaultsUsed.length);

    const phasesFlow = doc.phases.map(function (ph) {
      return '<span>Phase ' + escapeHtml(ph.id) + ': ' + escapeHtml(ph.title) + '</span>';
    }).join('');

    let html = '';
    html += '<article class="wt-page" id="wt-p0">' +
      '<span class="wt-badge danger">Not construction documents</span> ' +
      '<span class="wt-badge danger">Not a permit package</span> ' +
      '<span class="wt-badge example">EXAMPLE timing &amp; pricing where shown</span>' +
      (doc.bare_bones ? ' <span class="wt-badge tip">Bare-bones · shell first, finishes later</span>' : '') +
      '<h2>Build Walkthrough (Illustrative)</h2>' +
      '<p><strong>' + escapeHtml(tok.project_label) + '</strong> — ~' + tok.area_sqft + ' sq ft mindset</p>' +
      '<p class="muted small">Generated ' + new Date(doc.generatedAt).toLocaleString() + '</p>' +
      '<p class="wt-footer-note">' + escapeHtml(doc.disclaimer) + '</p></article>';

    html += '<article class="wt-page" id="wt-p1"><h2>Project snapshot</h2><div class="wt-snapshot-grid">' +
      '<div class="wt-snap"><span class="k">Mode</span><span class="v">' + escapeHtml(tok.project_label) + '</span></div>' +
      '<div class="wt-snap"><span class="k">Footprint</span><span class="v">' + tok.footprint_l_ft + ' × ' + tok.footprint_w_ft + ' ft</span></div>' +
      '<div class="wt-snap"><span class="k">Attach</span><span class="v">' + escapeHtml(tok.attach_side) + '</span></div>' +
      '<div class="wt-snap"><span class="k">Foundation</span><span class="v">' + escapeHtml(tok.foundation_type) + '</span></div>' +
      '<div class="wt-snap"><span class="k">Roof</span><span class="v">' + escapeHtml(tok.roof_tie_in) + ' · ' + escapeHtml(tok.roof_pitch) + '</span></div>' +
      '<div class="wt-snap"><span class="k">Wall height</span><span class="v">' + tok.wall_height_ft + ' ft</span></div>' +
      '<div class="wt-snap"><span class="k">Rooms</span><span class="v">' + escapeHtml(tok.room_list) + '</span></div>' +
      '<div class="wt-snap"><span class="k">Openings</span><span class="v">' + tok.window_count + ' win · ' + tok.door_count + ' door</span></div>' +
      '</div>' + wtDiagram('plan_footprint', tok) +
      '<p class="wt-footer-note">Illustrative · EXAMPLE pricing where shown · Not engineered drawings</p></article>';

    html += '<article class="wt-page" id="wt-p2"><h2>Sequence overview</h2><div class="wt-flow">' + phasesFlow + '</div>' +
      '<p class="muted small">Jump: <a href="#wt-p3">Permit callouts</a> · <a href="#wt-p5">Materials order</a> · <a href="#wt-p6">Day-by-day</a></p>' +
      '<p class="wt-footer-note">Illustrative · Not engineered drawings</p></article>';

    html += '<article class="wt-page page-break" id="wt-p3"><h2>Permit callouts</h2>' +
      '<p class="muted small">Awareness only — this app does <strong>not</strong> file permits.</p>';
    doc.permit.forEach(function (b) {
      html += '<div class="wt-callout ' + escapeHtml(b.tone) + '"><strong>' + escapeHtml(b.title) + '</strong><p>' + escapeHtml(b.body) + '</p></div>';
    });
    html += '<p class="wt-footer-note">Illustrative · Not a permit package</p></article>';

    html += '<article class="wt-page page-break" id="wt-p4"><h2>Phased build steps</h2>';
    doc.phases.forEach(function (phase) {
      html += '<h3>Phase ' + escapeHtml(phase.id) + ' — ' + escapeHtml(phase.title) + '</h3>';
      phase.steps.forEach(function (s) {
        html += '<div class="wt-step' + (s.deferred || s.id === 'WT_BB_PAUSE' ? ' deferred-step' : '') + '"><h4>' + escapeHtml(s.title) + '</h4><p>' + escapeHtml(s.body) + '</p>';
        if (s.watch_outs && s.watch_outs.length) {
          html += '<ul class="wt-list watch">';
          s.watch_outs.forEach(function (w) {
            var badge = w.tone === 'must_hire_pro' ? 'danger' : (w.tone === 'example' ? 'example' : (w.tone === 'tip' ? 'tip' : 'aware'));
            html += '<li><span class="wt-badge ' + badge + '">' + escapeHtml(w.tone) + '</span> ' + escapeHtml(w.text) + '</li>';
          });
          html += '</ul>';
        }
        if (s.dont_proceed_until && s.dont_proceed_until.length) {
          html += '<p class="muted small"><strong>Don’t proceed until:</strong></p><ul class="wt-list">';
          s.dont_proceed_until.forEach(function (d) { html += '<li>' + escapeHtml(d) + '</li>'; });
          html += '</ul>';
        }
        if (s.materials_names && s.materials_names.length) {
          html += '<p class="muted small">Materials: ' + s.materials_names.map(escapeHtml).join(', ') + '</p>';
        }
        html += wtDiagram(s.diagram_type, tok);
        html += '</div>';
      });
    });
    html += '<p class="wt-footer-note">Illustrative · Not engineered drawings</p></article>';

    html += '<article class="wt-page page-break" id="wt-p5"><h2>Materials order</h2>' +
      '<p>Buy in this order so materials show up when that phase starts. Amounts are <span class="wt-badge example">EXAMPLE ESTIMATES</span> — not a supplier quote.</p>';
    doc.materialsOrder.forEach(function (g) {
      html += '<div class="wt-buy-group' + (g.deferred ? ' deferred-step' : '') + '"><h4>' + escapeHtml(g.label) + '</h4><p class="muted small">' + escapeHtml(g.note || '') + '</p>';
      if (g.mustHire) html += '<span class="wt-badge danger">must hire pro</span> ';
      if (g.deferred) html += '<span class="wt-badge tip">deferred · Phase 7</span>';
      html += '<ul>';
      g.categories.forEach(function (c) { html += '<li>' + escapeHtml(c.name) + '</li>'; });
      html += '</ul></div>';
    });
    html += '<p class="wt-footer-note">EXAMPLE pricing where shown · Not a bid</p></article>';

    html += '<article class="wt-page page-break" id="wt-p6"><h2>Day-by-day build sequence</h2>' +
      '<p>These day ranges are a <span class="wt-badge example">EXAMPLE</span> for a project like yours — not a builder’s schedule.</p>';
    doc.daySequence.forEach(function (d) {
      var flags = (d.flags || []).map(function (f) {
        var badge = f === 'must_hire_pro' ? 'danger' : (f === 'example' ? 'example' : 'aware');
        return '<span class="wt-badge ' + badge + '">' + escapeHtml(f) + '</span>';
      }).join(' ');
      html += '<div class="wt-day"><div class="span">' + escapeHtml(d.span) + '</div><div><strong>' + escapeHtml(d.label) + '</strong> ' + flags +
        '<div class="muted small">' + escapeHtml(d.maps) + '</div></div></div>';
    });
    html += '<p class="wt-footer-note">EXAMPLE timing · Not a contract schedule</p></article>';

    html += '<article class="wt-page" id="wt-p7"><h2>Materials checklist (detail)</h2>';
    if (doc.materials && doc.materials.lines) {
      html += '<ul class="wt-check">';
      doc.materials.lines.forEach(function (line) {
        html += '<li' + (line.deferred ? ' class="deferred-step"' : '') + '>' + escapeHtml(line.category) + ' — ' + escapeHtml(line.item) +
          (line.deferred ? ' <span class="deferred-tag">Phase 7 · deferred</span>' : '') +
          ' <span class="wt-badge example">EXAMPLE $' + Math.round(line.extension).toLocaleString() + '</span></li>';
      });
      html += '</ul>';
      if (doc.materials.rollup) {
        html += '<p><strong>EXAMPLE total:</strong> $' + Math.round(doc.materials.rollup.total).toLocaleString() +
          ' <span class="wt-badge example">NOT A QUOTE</span></p>';
      }
    } else {
      html += '<p class="muted">Complete Guidance + Materials for EXAMPLE line items.</p>';
    }
    html += '<p class="wt-footer-note">EXAMPLE ESTIMATES — not quotes</p></article>';

    html += '<article class="wt-page page-break" id="wt-p8"><h2>Final weather-tight checklist</h2><ul class="wt-check">' +
      '<li>Roof dry-in complete for new work</li>' +
      '<li>WRB / cladding integrations checked</li>' +
      '<li>Windows and doors flashed and operable</li>' +
      '<li>Water directed away from foundation</li>' +
      '<li>Interior finishes complete for your scope</li>' +
      '<li>Punch list reviewed</li></ul>' +
      '<p class="muted small">Homeowner notes: ________________________________</p>' +
      '<p class="wt-footer-note">Illustrative · Not engineered drawings</p></article>';

    html += '<article class="wt-page page-break" id="wt-p9"><h2>Disclaimers</h2><ul class="wt-list">' +
      '<li>Illustrative homeowner guide based on your answers and drawing</li>' +
      '<li>Follow approved plans and local codes; obtain permits as required</li>' +
      '<li>This app does not file permits or hire contractors</li>' +
      '<li>Diagrams are conceptual — not sealed engineering</li>' +
      '<li>Prices and day bands are EXAMPLE, not quotes or bids</li>' +
      '<li>When in doubt, hire licensed pros (structural, electrical, plumbing, HVAC, gas)</li></ul>' +
      '<p class="wt-footer-note">' + escapeHtml(doc.disclaimer) + '</p></article>';

    host.innerHTML = html;
  }

  function initWalkthrough() {
    const refresh = document.getElementById('btn-wt-refresh');
    const printBtn = document.getElementById('btn-wt-print');
    if (refresh) refresh.addEventListener('click', function () {
      walkthroughDirty = true;
      renderWalkthrough();
      showToast('Walkthrough refreshed');
    });
    if (printBtn) printBtn.addEventListener('click', function () {
      renderWalkthrough();
      switchView('walkthrough');
      setTimeout(function () { window.print(); }, 200);
    });
    const defChip = document.getElementById('wt-defaults-chip');
    if (defChip) defChip.addEventListener('click', function () { switchView('guidance'); });
  }


  // ---- Guidance ----
  function visibleList() {
    return G().getVisibleQuestions(qaAnswers);
  }

  function commitAnswer(qid, value) {
    qaAnswers[qid] = value;
    // Remodel skip: clear addition-only when switching to remodel
    if (qid === 'A1' && value === 'remodel') {
      delete qaAnswers.A2a;
      delete qaAnswers.A2b;
    }
    if (qid === 'A1' && (value === 'addition' || value === 'both' || value === 'unsure')) {
      maybePromptExistingHouse();
    }
    // Soft-offer bare-bones when Stage K Under $50k or H30 Budget-friendly
    if ((qid === 'K42' && value === 'u50') || (qid === 'H30' && value === 'budget')) {
      bareBonesOfferDismissed = false;
    }
    qaAnswers.__budget_mode = budgetMode;
    renderQA();
    renderRecs();
    updateBareBonesOffer();
    renderMaterials();
    refreshFoundationChrome();
    schedule3DRebuild();
    walkthroughDirty = true;
  }

  function renderRecs() {
    const list = document.getElementById('recs-list');
    const recs = G().evaluateRecommendations(qaAnswers);
    if (!recs.length) {
      list.innerHTML = '<li class="placeholder-chip">Answer a few questions — tips and warnings appear here.</li>';
      return;
    }
    list.innerHTML = recs.map((r) =>
      `<li class="rec-item rec-${r.type}"><span class="rec-badge">${r.type}</span>${escapeHtml(r.text)}</li>`
    ).join('');
  }

  function renderQA() {
    const list = visibleList();
    if (!list.length) return;
    if (qaIndex >= list.length) qaIndex = list.length - 1;
    if (qaIndex < 0) qaIndex = 0;
    const { stage, question: q } = list[qaIndex];

    document.getElementById('qa-stage-id').textContent = stage.id;
    document.getElementById('qa-stage-title').textContent = stage.title;
    document.getElementById('qa-step-num').textContent = String(qaIndex + 1);
    document.getElementById('qa-step-total').textContent = String(list.length);
    document.getElementById('qa-progress-bar').style.width = (((qaIndex + 1) / list.length) * 100) + '%';
    document.getElementById('qa-question').textContent = q.prompt;

    const help = document.getElementById('qa-help');
    if (q.help_text) {
      help.textContent = q.help_text;
      help.classList.remove('hidden');
    } else help.classList.add('hidden');

    const opts = document.getElementById('qa-options');
    const extra = document.getElementById('qa-extra');
    opts.innerHTML = '';
    extra.innerHTML = '';

    document.getElementById('qa-skip').style.visibility = q.required === false ? 'visible' : 'hidden';
    document.getElementById('qa-back').disabled = qaIndex === 0;
    document.getElementById('qa-next').textContent = qaIndex === list.length - 1 ? 'Finish' : 'Next';

    if (q.answer_type === 'footprint') {
      renderFootprint(q, opts, extra);
    } else if (q.answer_type === 'opening_presets') {
      renderOpeningPresets(q, opts, extra);
    } else if (q.answer_type === 'multi') {
      const cur = Array.isArray(qaAnswers[q.id]) ? qaAnswers[q.id] : [];
      q.options.forEach((o) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qa-option' + (cur.includes(o.id) ? ' selected' : '');
        btn.textContent = o.label;
        btn.addEventListener('click', () => {
          let next = cur.slice();
          if (o.id === 'none') next = ['none'];
          else {
            next = next.filter((x) => x !== 'none');
            if (next.includes(o.id)) next = next.filter((x) => x !== o.id);
            else next.push(o.id);
          }
          commitAnswer(q.id, next);
          if (q.free_text_followup && next.includes(q.free_text_followup.when)) {
            /* re-render shows text */
          }
        });
        opts.appendChild(btn);
      });
      if (q.free_text_followup && cur.includes(q.free_text_followup.when)) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = q.free_text_followup.prompt;
        inp.value = qaAnswers[q.free_text_followup.id] || '';
        inp.className = 'qa-text-input';
        inp.addEventListener('change', () => {
          qaAnswers[q.free_text_followup.id] = inp.value;
          schedule3DRebuild();
        });
        extra.appendChild(inp);
      }
    } else {
      // single / yes_no
      const cur = qaAnswers[q.id];
      (q.options || []).forEach((o) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qa-option' + (cur === o.id ? ' selected' : '');
        btn.textContent = o.label;
        btn.addEventListener('click', () => commitAnswer(q.id, o.id));
        opts.appendChild(btn);
      });
      if (q.number_followup && cur === q.number_followup.when) {
        const wrap = document.createElement('label');
        wrap.className = 'field';
        wrap.textContent = q.number_followup.prompt;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = '0';
        inp.step = '0.5';
        inp.value = qaAnswers[q.number_followup.id] || '';
        inp.addEventListener('change', () => {
          qaAnswers[q.number_followup.id] = parseFloat(inp.value);
          renderMaterials();
          schedule3DRebuild();
        });
        wrap.appendChild(inp);
        extra.appendChild(wrap);
      }
    }

    // Inline callout for current answers
    const callout = document.getElementById('qa-inline-callout');
    const recs = G().evaluateRecommendations(qaAnswers);
    const related = recs.find((r) => r.type === 'warning') || recs[0];
    if (related && Object.keys(qaAnswers).length) {
      callout.className = 'qa-callout ' + related.type;
      callout.textContent = related.text;
      callout.classList.remove('hidden');
    } else {
      callout.classList.add('hidden');
    }
    updateBareBonesOffer();
  }

  function renderFootprint(q, opts, extra) {
    const cur = qaAnswers.A2a || {};
    (q.presets || []).forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qa-option' + ((cur.preset === p.id || (p.l && cur.l === p.l && cur.w === p.w)) ? ' selected' : '');
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        if (p.id === 'custom') {
          commitAnswer('A2a', { preset: 'custom', l: cur.l || 12, w: cur.w || 16 });
        } else {
          commitAnswer('A2a', { preset: p.id, l: p.l, w: p.w });
        }
      });
      opts.appendChild(btn);
    });
    const row = document.createElement('div');
    row.className = 'footprint-inputs';
    row.innerHTML = `
      <label class="field">Length (ft)<input type="number" id="fp-l" min="4" step="0.5" value="${cur.l || ''}" /></label>
      <label class="field">Width (ft)<input type="number" id="fp-w" min="4" step="0.5" value="${cur.w || ''}" /></label>
    `;
    extra.appendChild(row);
    const apply = () => {
      const l = parseFloat(document.getElementById('fp-l').value);
      const w = parseFloat(document.getElementById('fp-w').value);
      if (l > 0 && w > 0) commitAnswer('A2a', { preset: 'custom', l, w });
    };
    row.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', apply));
  }

  function renderOpeningPresets(q, opts, extra) {
    const cur = qaAnswers.D18b || {};
    const h = document.createElement('p');
    h.className = 'muted small';
    h.textContent = 'Door size';
    opts.appendChild(h);
    (q.door_options || []).forEach((o) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qa-option' + (cur.door && cur.door.id === o.id ? ' selected' : '');
      btn.textContent = o.label;
      btn.addEventListener('click', () => {
        commitAnswer('D18b', Object.assign({}, cur, { door: { id: o.id, w: o.w, h: o.h } }));
      });
      opts.appendChild(btn);
    });
    const h2 = document.createElement('p');
    h2.className = 'muted small';
    h2.style.marginTop = '0.75rem';
    h2.textContent = 'Window size';
    extra.appendChild(h2);
    (q.window_options || []).forEach((o) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qa-option' + (cur.window && cur.window.id === o.id ? ' selected' : '');
      btn.textContent = o.label;
      btn.addEventListener('click', () => {
        const win = o.id === 'mix' ? { id: 'mix', w: 36, h: 48 } : { id: o.id, w: o.w, h: o.h };
        commitAnswer('D18b', Object.assign({}, qaAnswers.D18b || {}, { window: win }));
      });
      extra.appendChild(btn);
    });
  }

  function initQA() {
    document.getElementById('qa-back').addEventListener('click', () => {
      if (qaIndex > 0) { qaIndex--; renderQA(); }
    });
    document.getElementById('qa-skip').addEventListener('click', () => {
      const list = visibleList();
      if (qaIndex < list.length - 1) { qaIndex++; renderQA(); }
    });
    document.getElementById('qa-next').addEventListener('click', () => {
      const list = visibleList();
      const cur = list[qaIndex];
      if (cur && cur.question.required && qaAnswers[cur.question.id] == null) {
        showToast('Pick an option to continue (or use Skip on optional questions)');
        return;
      }
      if (qaIndex < list.length - 1) {
        qaIndex++;
        renderQA();
      } else {
        showToast('Guidance complete — review Materials & 3D');
        switchView('materials');
      }
    });
    renderQA();
    renderRecs();
  }

  // ---- Materials ----
  function supplierName(id) {
    const s = (G().SUPPLIERS || []).find((x) => x.id === id);
    return s ? s.name : id;
  }

  function setBudgetMode(mode, opts) {
    const next = mode === 'bare_bones' ? 'bare_bones' : 'standard';
    const silent = opts && opts.silent;
    budgetMode = next;
    qaAnswers.__budget_mode = next;
    syncBudgetModeUI();
    renderBareBonesMethodPanel();
    renderMaterials();
    walkthroughDirty = true;
    if (!silent) {
      showToast(next === 'bare_bones'
        ? 'Bare-bones plan ON — shell first, finishes later'
        : 'Standard budget plan');
    }
  }

  function syncBudgetModeUI() {
    document.querySelectorAll('[data-budget-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-budget-mode') === budgetMode);
    });
    const chips = document.getElementById('bare-bones-chips');
    if (chips) chips.hidden = budgetMode !== 'bare_bones';
    const panel = document.getElementById('bare-bones-method-panel');
    if (panel) panel.hidden = budgetMode !== 'bare_bones';
    updateBareBonesOffer();
  }

  function updateBareBonesOffer() {
    const offer = document.getElementById('bare-bones-offer');
    if (!offer || !G()) return;
    const should = G().shouldOfferBareBones(qaAnswers) && budgetMode !== 'bare_bones' && !bareBonesOfferDismissed;
    offer.hidden = !should;
  }

  function renderBareBonesMethodPanel() {
    const panel = document.getElementById('bare-bones-method-panel');
    if (!panel || !G() || !G().buildBareBonesPlan) return;
    const plan = G().buildBareBonesPlan(qaAnswers, { budgetMode });
    const stepsHost = document.getElementById('bb-method-steps');
    const mustHost = document.getElementById('bb-shell-must');
    const cutHost = document.getElementById('bb-cut-list');
    const disc = document.getElementById('bb-method-disclaimer');
    if (!stepsHost) return;

    stepsHost.innerHTML = '';
    (plan.method || []).forEach((step) => {
      const li = document.createElement('li');
      const checked = !!bareBonesMethodChecks[step.id];
      li.className = 'bb-method-step' + (checked ? ' done' : '');
      li.innerHTML =
        '<input type="checkbox" id="bb-check-' + step.id + '" ' + (checked ? 'checked' : '') + ' aria-label="Step ' + step.id + '" />' +
        '<div><span class="bb-step-letter">' + escapeHtml(step.id) + '</span>' +
        '<span class="bb-step-title">' + escapeHtml(step.title) + '</span>' +
        '<span class="bb-step-summary">' + escapeHtml(step.summary) + '</span>' +
        '<span class="bb-step-details">' + escapeHtml(step.details) + '</span></div>';
      const cb = li.querySelector('input');
      cb.addEventListener('change', () => {
        bareBonesMethodChecks[step.id] = cb.checked;
        li.classList.toggle('done', cb.checked);
      });
      stepsHost.appendChild(li);
    });

    if (mustHost) {
      mustHost.innerHTML = (plan.shell_must || []).map((t) => '<li>' + escapeHtml(t) + '</li>').join('');
    }
    if (cutHost) {
      const cuts = plan.cut_list || [];
      if (!cuts.length) {
        cutHost.innerHTML = '<li class="muted">No plan-aware cuts yet — answer Guidance (vaults, openings, cladding, HVAC) to populate.</li>';
      } else {
        cutHost.innerHTML = cuts.map((c) =>
          '<li><span class="cut-if">' + escapeHtml(c.if_present) + ':</span> <span class="cut-sug">' + escapeHtml(c.suggestion) + '</span></li>'
        ).join('');
      }
    }
    if (disc) disc.textContent = plan.disclaimer || '';

    const defChip = document.getElementById('bb-deferred-chip');
    if (defChip) {
      const names = (plan.deferred_categories || []).join(', ') || 'flooring, paint, trim, fixtures';
      defChip.textContent = 'Deferred: ' + names;
    }
  }

  function renderMaterials() {
    if (!G()) return;
    qaAnswers.__budget_mode = budgetMode;
    const data = G().buildMaterials(qaAnswers, { budgetMode });
    const tbody = document.querySelector('#materials-table tbody');
    tbody.innerHTML = '';
    data.lines.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.deferred) tr.className = 'deferred-line';
      const deferTag = row.deferred ? ' <span class="deferred-tag">Phase 7 · deferred</span>' : '';
      tr.innerHTML = `
        <td><span class="cat-pill">${escapeHtml(row.category)}</span>${deferTag}</td>
        <td>${escapeHtml(row.item)}</td>
        <td>${escapeHtml(supplierName(row.supplier))}</td>
        <td>${row.qty}</td>
        <td>${escapeHtml(row.uom)}</td>
        <td>${money(row.unit)} <span class="example-tag">EXAMPLE</span></td>
        <td>${money(row.extension)} <span class="example-tag">EXAMPLE</span></td>
      `;
      tbody.appendChild(tr);
    });
    const r = data.rollup;
    document.getElementById('materials-total').textContent = money(r.total);
    document.getElementById('materials-with-waste').textContent = money(r.materialsWithWaste);
    document.getElementById('materials-count').textContent = String(
      data.bare_bones ? (data.activeLines || data.lines.filter((l) => !l.deferred)).length : data.lines.length
    );

    const dl = document.getElementById('rollup-dl');
    let deferredRow = '';
    if (data.bare_bones && r.deferredSubtotal) {
      deferredRow = `<div><dt>Deferred finishes (Phase 7, not in shell total)</dt><dd>${money(r.deferredSubtotal)} EXAMPLE</dd></div>`;
    }
    dl.innerHTML = `
      <div><dt>Materials subtotal${data.bare_bones ? ' (shell-active)' : ''}</dt><dd>${money(r.materialsSubtotal)} EXAMPLE</dd></div>
      <div><dt>Waste (${r.wastePct}%)</dt><dd>${money(r.materialsWithWaste - r.materialsSubtotal)} EXAMPLE</dd></div>
      <div><dt>Materials with waste</dt><dd>${money(r.materialsWithWaste)} EXAMPLE</dd></div>
      <div><dt>Contingency (${r.contingencyPct}%)</dt><dd>${money(r.contingency)} EXAMPLE</dd></div>
      ${deferredRow}
      <div><dt>Labor placeholder ${r.includeLabor ? '' : '(hidden)'}</dt><dd>${r.includeLabor ? money(r.labor) + ' EXAMPLE' : '—'}</dd></div>
      <div><dt>Tax placeholder (${r.taxPct}% on materials w/ waste)</dt><dd>${money(r.tax)} EXAMPLE</dd></div>
      <div class="rollup-total"><dt>EXAMPLE ${data.bare_bones ? 'shell-first ' : ''}project total (NOT A QUOTE)</dt><dd>${money(r.total)}</dd></div>
    `;
    document.getElementById('rollup-disclaimer').textContent = r.disclaimer;
    syncBudgetModeUI();
    if (budgetMode === 'bare_bones') renderBareBonesMethodPanel();
  }

  function initBudgetModeControls() {
    document.querySelectorAll('[data-budget-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setBudgetMode(btn.getAttribute('data-budget-mode')));
    });
    const accept = document.getElementById('btn-bare-bones-accept');
    const dismiss = document.getElementById('btn-bare-bones-dismiss');
    if (accept) accept.addEventListener('click', () => setBudgetMode('bare_bones'));
    if (dismiss) dismiss.addEventListener('click', () => {
      bareBonesOfferDismissed = true;
      updateBareBonesOffer();
    });
    syncBudgetModeUI();
  }

  function initMaterials() {
    initBudgetModeControls();
    renderMaterials();
  }

  // ---- Project save / share ----
  function buildProjectPayload() {
    qaAnswers.__budget_mode = budgetMode;
    return {
      version: 2,
      name: els.projectName.value.trim() || 'My Remodel',
      savedAt: new Date().toISOString(),
      plan: floor ? floor.exportData() : null,
      guidance: { answers: { ...qaAnswers }, stepIndex: qaIndex },
      budget_mode: budgetMode,
      bareBonesMethodChecks: { ...bareBonesMethodChecks },
      // REMODEL_GUIDE_HOOK: content v1.2 + bare-bones small-budget
      guideSource: G() ? G().sourcePath : null,
    };
  }

  function saveProject() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildProjectPayload()));
      const when = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      els.saveStatus.textContent = 'Saved locally · ' + when;
      showToast('Project saved in this browser');
    } catch (_) {
      showToast('Could not save (storage full or blocked)');
    }
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.name) {
        els.projectName.value = data.name;
        els.projectNamePage.value = data.name;
      }
      if (data.plan && floor) floor.importData(data.plan);
      if (data.guidance) {
        Object.assign(qaAnswers, data.guidance.answers || {});
        qaIndex = data.guidance.stepIndex || 0;
      }
      if (data.budget_mode === 'bare_bones' || (data.guidance && data.guidance.answers && data.guidance.answers.__budget_mode === 'bare_bones')) {
        budgetMode = 'bare_bones';
      } else if (data.budget_mode === 'standard') {
        budgetMode = 'standard';
      }
      if (data.bareBonesMethodChecks) Object.assign(bareBonesMethodChecks, data.bareBonesMethodChecks);
      qaAnswers.__budget_mode = budgetMode;
      if (data.guidance) {
        renderQA();
        renderRecs();
        updateBareBonesOffer();
        renderMaterials();
      }
      if (data.savedAt) {
        els.saveStatus.textContent = 'Restored · saved ' + new Date(data.savedAt).toLocaleString(undefined, {
          dateStyle: 'medium', timeStyle: 'short',
        });
      }
      planDirtyFor3d = true;
      return true;
    } catch (_) { return false; }
  }

  function downloadJSON() {
    const payload = buildProjectPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ((payload.name || 'project').replace(/[^\w\-]+/g, '-').slice(0, 40)) + '-homeplan.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('JSON downloaded');
  }

  function openShareModal() {
    // EXAMPLE placeholder only — not a live guest join URL
    const slug = (els.projectName.value || 'demo').toLowerCase().replace(/[^\w]+/g, '-').slice(0, 32) || 'demo';
    let origin = 'https://homeplan.example';
    try { origin = window.location.origin || origin; } catch (_) { /* ignore */ }
    const path = (window.location.pathname || '/').replace(/\/[^/]*$/, '/') || '/';
    els.shareLink.value = origin + path + 'index.html?p=' + encodeURIComponent(slug) + '&k=view';
    els.shareModal.hidden = false;
    const copyBtn = document.getElementById('btn-copy-link');
    if (copyBtn) copyBtn.focus();
  }

  function initProject() {
    els.projectNamePage.value = els.projectName.value;
    els.projectName.addEventListener('change', () => { els.projectNamePage.value = els.projectName.value; });
    els.projectNamePage.addEventListener('input', () => { els.projectName.value = els.projectNamePage.value; });

    document.getElementById('btn-save').addEventListener('click', saveProject);
    document.getElementById('btn-save-page').addEventListener('click', saveProject);
    document.getElementById('btn-share').addEventListener('click', openShareModal);
    document.getElementById('btn-share-page').addEventListener('click', openShareModal);
    document.getElementById('btn-export-json').addEventListener('click', downloadJSON);
    document.getElementById('btn-download-share').addEventListener('click', () => { downloadJSON(); els.shareModal.hidden = true; });
    document.getElementById('btn-copy-link').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(els.shareLink.value);
        showToast('EXAMPLE link copied · not live');
      } catch (_) {
        els.shareLink.select();
        showToast('Select & copy the EXAMPLE link');
      }
    });
    const revokeBtn = document.getElementById('btn-revoke-share');
    if (revokeBtn) {
      revokeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Revoke · Coming soon');
      });
    }
    els.shareModal.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', () => { els.shareModal.hidden = true; });
    });
  }

  function initNav() {
    els.navBtns.forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    if (els.navSelect) {
      els.navSelect.addEventListener('change', () => {
        const v = els.navSelect.value;
        if (v) switchView(v);
      });
    }
    const goto = document.getElementById('btn-goto-plan');
    if (goto) goto.addEventListener('click', () => switchView('plan'));
    const chip = document.getElementById('view3d-defaults-chip');
    if (chip) chip.addEventListener('click', () => switchView('guidance'));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }


  // ---- Remodel Guide (Structure Wizard) ----
  const W = () => window.HomePlanWizard;
  let wizardOpen = false;
  let wizardPending = null;
  let wizardUndoStack = []; // { planSnap, answersSnap }
  const WIZARD_MAX_UNDO = 20;

  function getWizardSelection() {
    if (!floor || !floor.getSelectedObject) return null;
    const obj = floor.getSelectedObject();
    if (!obj) return null;
    // Infer type from selected object shape
    let type = null;
    if (obj.wallId != null && obj.t != null) type = 'window';
    else if (obj.x1 != null && obj.y1 != null && obj.x2 != null) type = 'wall';
    else if (obj.w != null && obj.h != null && obj.x != null) type = 'room';
    if (!type) return null;
    return { type, id: obj.id, obj };
  }

  function wizardContext() {
    return {
      answers: qaAnswers,
      selection: getWizardSelection(),
      plan: floor ? floor.exportData() : null,
      pending: wizardPending,
    };
  }

  function openWizard() {
    const panel = document.getElementById('wizard-panel');
    if (!panel) return;
    panel.hidden = false;
    wizardOpen = true;
    const disc = document.getElementById('wizard-disclaimer');
    if (disc && W()) disc.textContent = W().DISCLAIMER;
    renderWizardChips();
    const thread = document.getElementById('wizard-thread');
    if (thread && !thread.dataset.seeded) {
      appendWizardGuide({
        confirmation: {
          title: 'Hi — I’m your Remodel Guide',
          body: (W() && W().HELP_TEXT) || 'Tell me what to change on the plan or 3D.',
        },
        status: 'parsed',
        flags: [],
      });
      thread.dataset.seeded = '1';
    }
    updateWizardUndoBtn();
    const inp = document.getElementById('wizard-input');
    if (inp) setTimeout(() => inp.focus(), 50);
  }

  function closeWizard() {
    const panel = document.getElementById('wizard-panel');
    if (panel) panel.hidden = true;
    wizardOpen = false;
    hideWizardConfirm();
  }

  function renderWizardChips() {
    const host = document.getElementById('wizard-chips');
    if (!host || !W()) return;
    host.innerHTML = '';
    (W().STARTER_CHIPS || []).forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wiz-chip';
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        const inp = document.getElementById('wizard-input');
        if (inp) inp.value = c.text;
        handleWizardSubmit(c.text);
      });
      host.appendChild(btn);
    });
  }

  function flagsHtml(flags) {
    if (!flags || !flags.length) return '';
    return '<div class="wiz-flags">' + flags.map((f) =>
      '<span class="wiz-badge ' + f + '">' + (f === 'must_hire_pro' ? 'Hire a licensed pro' :
        f === 'example' ? 'EXAMPLE' :
        f === 'destructive' ? 'Destructive' :
        f === 'addition_only' ? 'Addition' : f) + '</span>'
    ).join('') + '</div>';
  }

  function calloutHtml(callout) {
    if (!callout || !callout.text) return '';
    const tone = callout.tone || 'tip';
    return '<div class="wiz-callout ' + tone + '">' + escapeHtml(callout.text) + '</div>';
  }

  function formatBody(body) {
    // allow simple **bold** from templates
    const esc = escapeHtml(body || '');
    return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function appendWizardUser(text) {
    const thread = document.getElementById('wizard-thread');
    if (!thread) return;
    const div = document.createElement('div');
    div.className = 'wiz-msg user';
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  function appendWizardGuide(turn) {
    const thread = document.getElementById('wizard-thread');
    if (!thread) return;
    const div = document.createElement('div');
    div.className = 'wiz-msg guide';
    const title = (turn.confirmation && turn.confirmation.title) || 'Remodel Guide';
    const body = (turn.confirmation && turn.confirmation.body) || '';
    let html = '<strong>' + escapeHtml(title) + '</strong>';
    html += flagsHtml(turn.flags);
    html += '<div class="body">' + formatBody(body) + '</div>';
    html += calloutHtml(turn.callout);
    if (turn.status === 'needs_clarify' && turn.clarify_question) {
      html += '<p class="wiz-clarify-prompt">' + escapeHtml(turn.clarify_question.prompt || '') + '</p>';
      html += '<div class="wiz-clarify-chips"></div>';
    }
    div.innerHTML = html;
    if (turn.status === 'needs_clarify' && turn.clarify_question) {
      const chipHost = div.querySelector('.wiz-clarify-chips');
      (turn.clarify_question.chips || []).forEach((chip) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wiz-chip';
        btn.textContent = chip.label || chip.id;
        btn.addEventListener('click', () => {
          if (!W()) return;
          const next = W().applyClarifyFill(turn, chip.fill || {}, wizardContext());
          appendWizardUser(chip.label || chip.id);
          presentWizardTurn(next);
        });
        chipHost.appendChild(btn);
      });
    }
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  function hideWizardConfirm() {
    const el = document.getElementById('wizard-confirm');
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }

  function showWizardConfirm(turn) {
    const el = document.getElementById('wizard-confirm');
    if (!el) return;
    const destructive = (turn.flags || []).includes('destructive');
    const mustPro = (turn.flags || []).includes('must_hire_pro');
    // Hard rule: never silent apply for destructive / must_hire_pro / geometry
    el.hidden = false;
    el.innerHTML =
      '<div class="wizard-confirm-card' + (destructive ? ' destructive' : '') + '">' +
      '<h3>' + escapeHtml((turn.confirmation && turn.confirmation.title) || 'Confirm change') + '</h3>' +
      flagsHtml(turn.flags) +
      '<div class="body">' + formatBody((turn.confirmation && turn.confirmation.body) || '') + '</div>' +
      calloutHtml(turn.callout) +
      '<div class="wizard-confirm-actions">' +
      '<button type="button" class="btn btn-ghost" id="wizard-cancel">Cancel</button>' +
      '<button type="button" class="btn ' + (destructive || mustPro ? 'btn-danger-apply' : 'btn-accent') +
      '" id="wizard-apply">' + (destructive ? 'Remove / Apply' : 'Apply') + '</button>' +
      '</div></div>';
    document.getElementById('wizard-cancel').addEventListener('click', () => {
      hideWizardConfirm();
      wizardPending = null;
      appendWizardGuide({
        confirmation: { title: 'Cancelled', body: 'No changes applied.' },
        status: 'cancelled',
        flags: [],
      });
    });
    document.getElementById('wizard-apply').addEventListener('click', () => {
      applyWizardTurn(turn);
    });
  }

  function presentWizardTurn(turn) {
    if (!turn) return;
    if (turn.status === 'needs_clarify') {
      wizardPending = turn;
      appendWizardGuide(turn);
      hideWizardConfirm();
      return;
    }
    wizardPending = null;
    appendWizardGuide(turn);

    if (turn.status === 'refused' || turn.intent_id === 'session.help' || turn.intent_id === 'session.refuse') {
      hideWizardConfirm();
      return;
    }

    const ops = turn.mutation_ops || [];
    if (!ops.length || (ops.length === 1 && ops[0].op === 'noop_clarify')) {
      hideWizardConfirm();
      return;
    }

    // Undo can apply after soft confirm — still show confirm sheet
    showWizardConfirm(turn);
    // Keep pending for Apply
    wizardPending = turn;
  }

  function snapshotAnswers() {
    return JSON.parse(JSON.stringify(qaAnswers));
  }

  function restoreAnswers(snap) {
    Object.keys(qaAnswers).forEach((k) => { delete qaAnswers[k]; });
    Object.assign(qaAnswers, snap || {});
  }

  function pushWizardUndo() {
    wizardUndoStack.push({
      planSnap: floor && floor.snapshotPlan ? floor.snapshotPlan() : (floor ? floor.exportData() : null),
      answersSnap: snapshotAnswers(),
    });
    if (wizardUndoStack.length > WIZARD_MAX_UNDO) wizardUndoStack.shift();
    updateWizardUndoBtn();
  }

  function updateWizardUndoBtn() {
    const btn = document.getElementById('wizard-undo');
    if (btn) btn.disabled = wizardUndoStack.length === 0;
  }

  function undoWizardMutation() {
    if (!wizardUndoStack.length) {
      showToast('Nothing to undo');
      return false;
    }
    const prev = wizardUndoStack.pop();
    updateWizardUndoBtn();
    if (prev.planSnap && floor) {
      if (floor.restorePlanSnapshot) floor.restorePlanSnapshot(prev.planSnap);
      else floor.importData(prev.planSnap);
    }
    restoreAnswers(prev.answersSnap);
    afterWizardMutate();
    appendWizardGuide({
      confirmation: { title: 'Undone', body: 'Restored the previous Remodel Guide change.' },
      status: 'applied',
      flags: [],
    });
    hideWizardConfirm();
    wizardPending = null;
    showToast('Guide change undone');
    return true;
  }

  function applyWizardOps(ops) {
    if (!W()) return;
    ops = ops || [];
    for (const op of ops) {
      if (!op || !op.op) continue;
      switch (op.op) {
        case 'noop_clarify':
          break;
        case 'undo':
          undoWizardMutation();
          return 'undone';
        case 'set_field':
          W().applyFieldToAnswers(qaAnswers, op.field_id, op.value);
          break;
        case 'set_wall_height':
          if (floor && floor.setWallHeight) {
            floor.setWallHeight({
              all: !!op.all,
              side: op.side,
              wall_id: op.wall_id,
              height_ft: op.height_ft,
            });
          }
          if (op.all && op.height_ft != null) {
            W().applyFieldToAnswers(qaAnswers, 'wall_height_ft', op.height_ft);
          }
          if (op.side && op.height_ft != null) {
            const map = Object.assign({}, qaAnswers.wall_height_by_side || {});
            map[op.side] = op.height_ft;
            W().applyFieldToAnswers(qaAnswers, 'wall_height_by_side', map);
          }
          break;
        case 'resize_footprint':
          if (floor && floor.resizeRoomFootprint) {
            floor.resizeRoomFootprint(op.l_ft, op.w_ft);
          }
          break;
        case 'set_attach_side':
          W().applyFieldToAnswers(qaAnswers, 'attach_side', op.attach_side);
          break;
        case 'add_wall':
          if (floor && floor.addInteriorWall) {
            floor.addInteriorWall({ orientation: op.orientation, offset_ft: op.offset_ft });
          }
          break;
        case 'move_wall':
          if (floor && floor.moveWallById) {
            floor.moveWallById(op.wall_id, op.offset_ft, op.direction, op.side);
          }
          break;
        case 'remove_wall':
          if (floor && floor.removeWallById) {
            floor.removeWallById(op.wall_id, op.side);
          }
          break;
        case 'add_opening':
          if (floor && floor.addOpeningOnWall) {
            floor.addOpeningOnWall(op);
          }
          break;
        case 'move_opening':
          if (floor && floor.moveOpening) {
            floor.moveOpening(op.opening_id, op.t_delta);
          }
          break;
        case 'resize_opening':
          if (floor && floor.resizeOpening) {
            floor.resizeOpening(op.opening_id, op.w_ft, op.h_ft);
          }
          break;
        case 'remove_opening':
          if (floor && floor.removeOpening) {
            floor.removeOpening(op.opening_id);
          }
          break;
        case 'set_roof':
          if (op.roof_pitch != null) W().applyFieldToAnswers(qaAnswers, 'roof_pitch', op.roof_pitch);
          if (op.roof_tie_in != null) W().applyFieldToAnswers(qaAnswers, 'roof_tie_in', op.roof_tie_in);
          if (op.eave_overhang_in != null) W().applyFieldToAnswers(qaAnswers, 'eave_overhang_in', op.eave_overhang_in);
          break;
        case 'set_foundation':
          if (op.foundation_type != null) W().applyFieldToAnswers(qaAnswers, 'foundation_type', op.foundation_type);
          break;
        case 'set_connect_type':
          W().applyFieldToAnswers(qaAnswers, 'connect_type', op.connect_type);
          break;
        case 'label_room':
          if (floor && floor.labelRoom) {
            floor.labelRoom(op.room_id, op.use);
          }
          // sync multi rooms_use / A3
          {
            const cur = Array.isArray(qaAnswers.A3) ? qaAnswers.A3.slice() : [];
            if (op.use && !cur.includes(op.use)) cur.push(op.use);
            qaAnswers.A3 = cur;
          }
          break;
        default:
          break;
      }
    }
    return 'applied';
  }

  function afterWizardMutate() {
    walkthroughDirty = true;
    planDirtyFor3d = true;
    refreshFoundationChrome();
    schedule3DRebuild();
    // Force rebuild if 3D visible; also refresh materials/QA if open
    if (els.views.view3d && els.views.view3d.classList.contains('active')) {
      rebuild3D(true);
    }
    if (els.views.materials && els.views.materials.classList.contains('active')) {
      renderMaterials();
    }
    if (els.views.guidance && els.views.guidance.classList.contains('active')) {
      renderQA();
      renderRecs();
    }
    if (els.views.walkthrough && els.views.walkthrough.classList.contains('active')) {
      // leave stale until refresh; chip handled by walkthroughDirty
    }
    if (els.saveStatus) els.saveStatus.textContent = 'Unsaved changes — click Save to keep them.';
  }

  function applyWizardTurn(turn) {
    if (!turn) return;
    const flags = turn.flags || [];
    // Safety: never auto-apply destructive without going through Apply button (we are here from Apply)
    const ops = turn.mutation_ops || [];
    const isUndoOnly = ops.length === 1 && ops[0].op === 'undo';

    if (!isUndoOnly) {
      pushWizardUndo();
    }
    const result = applyWizardOps(ops);
    hideWizardConfirm();
    wizardPending = null;

    if (result === 'undone') return;

    afterWizardMutate();
    appendWizardGuide({
      confirmation: {
        title: 'Applied',
        body: 'Working plan and 3D updated (conceptual). Use Undo in the Guide header to revert this change group.',
      },
      status: 'applied',
      flags: flags.filter((f) => f === 'must_hire_pro' || f === 'example'),
      callout: flags.includes('must_hire_pro')
        ? { tone: 'must_hire_pro', text: 'Remember: hire a licensed pro for structural / MEP work — the Guide does not design it.' }
        : null,
    });
    showToast('Guide change applied');
  }

  function handleWizardSubmit(raw) {
    const text = (raw != null ? raw : (document.getElementById('wizard-input') || {}).value || '').trim();
    if (!text) return;
    const inp = document.getElementById('wizard-input');
    if (inp) inp.value = '';
    if (!W()) {
      showToast('Wizard data not loaded');
      return;
    }
    appendWizardUser(text);
    const turn = W().parseCommand(text, wizardContext());
    presentWizardTurn(turn);
  }

  function initWizard() {
    if (!W()) {
      console.warn('HomePlanWizard missing — load wizard-data.js');
      return;
    }
    const openBtn = document.getElementById('btn-remodel-guide');
    const fab = document.getElementById('wizard-fab');
    const closeBtn = document.getElementById('wizard-close');
    const form = document.getElementById('wizard-form');
    const undoBtn = document.getElementById('wizard-undo');
    if (openBtn) openBtn.addEventListener('click', openWizard);
    if (fab) fab.addEventListener('click', openWizard);
    if (closeBtn) closeBtn.addEventListener('click', closeWizard);
    if (undoBtn) undoBtn.addEventListener('click', () => {
      if (wizardUndoStack.length) undoWizardMutation();
    });
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleWizardSubmit();
      });
    }
    const disc = document.getElementById('wizard-disclaimer');
    if (disc) disc.textContent = W().DISCLAIMER;
    renderWizardChips();
  }


  function boot() {
    if (!G()) {
      console.error('HomePlanGuide missing — load guide-data.js first');
      return;
    }
    initNav();
    initFloorPlan();
    initWallHeightModal();
    initExistingHouseModal();
    initRoofPicker();
    initFoundationPicker();
    initWalkthrough();
    initQA();
    initMaterials();
    initProject();
    initWizard();

    // Wait briefly for Three.js module
    const try3d = () => {
      if (window.HomePlan3D) ensure3D();
      else setTimeout(try3d, 50);
    };
    try3d();

    const restored = loadProject();
    if (restored) showToast('Restored saved project');
    refreshExistingHouseChrome();
    refreshFoundationChrome();
    switchView('plan');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
