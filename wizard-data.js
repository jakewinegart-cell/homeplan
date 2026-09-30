/**
 * Remodel Guide (Structure Wizard) — catalog, rule parser, confirm templates
 * Spec: /workspace/remodel-app-structure-wizard-v1.md v1.0
 * Field ids align with remodel-app-content-v1.md §5
 */
(function (global) {
  'use strict';

  const BEARING_CALLOUT =
    'This wall might be load-bearing (it helps hold up floors or the roof above). Opening or removing it usually needs a header or beam sized by a licensed pro. The Guide will update your working plan and 3D so you can explore the idea — it will not design the structure. Confirm only if you want the conceptual change.';

  const LARGE_OPENING_CALLOUT =
    'Wide openings almost always need engineered headers or beams. Budget for structural hardware and pro design. We won’t invent a size here.';

  const DISCLAIMER =
    'Conceptual plan & 3D — not engineered drawings · App does not file permits.';

  const HELP_TEXT =
    'I can update your working plan and 3D for: footprint size, attach side, wall heights / ceilings, add·move·remove walls, doors / windows / large openings, roof pitch·tie-in·eaves, foundation, room labels, and undo. Everything is conceptual — not permits, bids, or engineering. Try a starter chip below.';

  const STARTER_CHIPS = [
    { id: 'ex_footprint', label: 'Set footprint 14×20', text: 'Make the addition 14 by 20' },
    { id: 'ex_height', label: 'Wall height 9 ft', text: 'Set wall height to 9 feet' },
    { id: 'ex_window', label: 'Add window', text: 'Add a window on the back wall' },
    { id: 'ex_roof', label: 'Roof pitch 6:12', text: 'Set roof pitch to 6:12' },
    { id: 'ex_help', label: 'What can you do?', text: 'Help' },
  ];

  const SIDE_ALIASES = {
    back: 'back', rear: 'back', behind: 'back',
    front: 'front',
    left: 'left',
    right: 'right',
    corner: 'corner', wrap: 'corner',
    north: 'north', top: 'north',
    south: 'south', bottom: 'south',
    east: 'east',
    west: 'west',
  };

  const ATTACH_SIDES = new Set(['back', 'left', 'right', 'front', 'corner']);
  const CARDINAL = new Set(['north', 'east', 'south', 'west']);

  const ROOM_USES = {
    bedroom: 'bedroom', bed: 'bedroom',
    bathroom: 'bathroom', bath: 'bathroom',
    kitchen: 'kitchen', kitchenette: 'kitchen',
    living: 'living', 'family room': 'living', family: 'living',
    office: 'office', 'home office': 'office',
    laundry: 'laundry',
    mudroom: 'mudroom', entry: 'mudroom',
    other: 'other',
  };

  const DOOR_TYPES = {
    entry: 'entry', exterior: 'entry',
    sliding: 'sliding', patio: 'sliding', slider: 'sliding',
    french: 'french',
  };

  const CEILING_MODES = {
    flat: 'flat', normal: 'flat',
    taller: 'taller', tall: 'taller', higher: 'taller',
    vaulted: 'vaulted', vault: 'vaulted', cathedral: 'vaulted',
    match: 'unknown', unknown: 'unknown',
  };

  const FOUNDATION_TYPES = {
    slab: 'slab',
    crawl: 'crawl', 'crawl space': 'crawl', crawlspace: 'crawl',
    basement: 'basement',
    piers: 'piers', pier: 'piers', sonotube: 'piers', sonotubes: 'piers',
    'pier foundation': 'piers', elevated: 'piers',
    pylon: 'piers', pylons: 'piers', pilon: 'piers', pilons: 'piers',
    'pylon foundation': 'piers',
    match: 'match',
    unknown: 'unknown', unsure: 'unknown',
  };

  const ROOF_TIE = {
    continuous: 'continuous', same: 'continuous', continue: 'continuous',
    separate: 'separate', lower: 'separate',
    dormer: 'dormer',
    'low-slope': 'low-slope', lowslope: 'low-slope', flat: 'low-slope',
  };

  const CONNECT_TYPES = {
    doorway: 'doorway', door: 'doorway',
    open: 'open', fully: 'open', 'open wall': 'open',
    hall: 'hall', hallway: 'hall',
    opening: 'opening',
  };

  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      // Dimension separator only: 12x16 / 12×16 — do not rewrite letters inside words
      .replace(/(\d)\s*[×x]\s*(\d)/g, '$1 by $2')
      .replace(/['']/g, "'")
      .replace(/[^\w\s:./+\-']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractFeetPairs(text) {
    // 14 by 20, 14x20, 14 × 20, 12 ft by 16 ft
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?/);
    if (m) return { a: parseFloat(m[1]), b: parseFloat(m[2]) };
    return null;
  }

  function extractFeet(text) {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:ft|feet)\b/,
      /(\d+(?:\.\d+)?)\s*'/,
      /\bto\s+(\d+(?:\.\d+)?)\b/,
      /\b(?:height|tall|raise|set|make|use)\s+(?:walls?\s+|ceilings?\s+)?(?:to\s+)?(\d+(?:\.\d+)?)\b/,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return parseFloat(m[1]);
    }
    // lone number near end for "wall height 9"
    const lone = text.match(/\b(\d+(?:\.\d+)?)\b/);
    return lone ? parseFloat(lone[1]) : null;
  }

  function extractInches(text) {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")\b/);
    if (m) return parseFloat(m[1]);
    const n = text.match(/(\d+(?:\.\d+)?)\s*(?:inch|inches)?\s*overhang/);
    if (n) return parseFloat(n[1]);
    return null;
  }

  function extractPitch(text) {
    const m = text.match(/(\d+)\s*[:/]\s*12\b/);
    if (m) return m[1] + ':12';
    if (/\blow\s*slope|flat\b/.test(text)) return '2:12';
    if (/\bsteeper|steep\b/.test(text)) return null; // need clarify
    if (/\bmatch\b/.test(text) && /\broof|pitch\b/.test(text)) return '4:12';
    return null;
  }

  function extractSide(text) {
    // prefer longer phrases first
    if (/\bcorner\b|\bwrap\b/.test(text)) return 'corner';
    const words = text.split(/\s+/);
    for (const w of words) {
      if (SIDE_ALIASES[w]) return SIDE_ALIASES[w];
    }
    return null;
  }

  function attachSideFromText(text) {
    const s = extractSide(text);
    if (s && ATTACH_SIDES.has(s)) return s;
    if (s === 'north') return 'front';
    if (s === 'south') return 'back';
    if (s === 'east') return 'right';
    if (s === 'west') return 'left';
    return null;
  }

  function wallSideFromText(text) {
    const s = extractSide(text);
    if (!s) return null;
    if (CARDINAL.has(s)) return s;
    // map house-relative to plan cardinals (back=south default mental model)
    if (s === 'back') return 'south';
    if (s === 'front') return 'north';
    if (s === 'left') return 'west';
    if (s === 'right') return 'east';
    return null;
  }

  function extractCount(text) {
    const m = text.match(/\b(\d+)\s+windows?\b/) || text.match(/\badd\s+(\d+)\b/);
    if (m) return parseInt(m[1], 10);
    if (/\btwo\b/.test(text)) return 2;
    if (/\bthree\b/.test(text)) return 3;
    if (/\bmore\b/.test(text)) return 2;
    return 1;
  }

  function extractDelta(text) {
    const m = text.match(/\+?\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|'|)\s*(?:on|to)?\s*(?:the\s+)?(width|length|both|sides?)?/);
    if (m) {
      return {
        delta: parseFloat(m[1]),
        axis: m[2] && m[2].startsWith('len') ? 'length' : (m[2] && m[2].startsWith('wid') ? 'width' : (m[2] === 'both' || m[2] === 'sides' ? 'both' : null)),
      };
    }
    const bump = text.match(/\bbump\s+(?:it\s+)?up\s+(\d+(?:\.\d+)?)/);
    if (bump) return { delta: parseFloat(bump[1]), axis: null };
    return null;
  }

  function extractArea(text) {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|square\s*feet|sf)\b/);
    return m ? parseFloat(m[1]) : null;
  }

  function projectMode(ctx) {
    const a = (ctx && ctx.answers) || {};
    const v = Array.isArray(a.A1) ? a.A1[0] : a.A1;
    return v || 'addition';
  }

  function isRemodelOnly(ctx) {
    return projectMode(ctx) === 'remodel';
  }

  function selectionSlots(ctx) {
    const sel = (ctx && ctx.selection) || null;
    if (!sel) return {};
    const out = {};
    if (sel.type === 'wall' && sel.id) {
      out.wall_id = sel.id;
      if (sel.obj && sel.obj.side) out.side = sel.obj.side;
    }
    if (sel.type === 'window' && sel.id) out.opening_id = sel.id;
    if (sel.type === 'room' && sel.id) out.room_id = sel.id;
    return out;
  }

  function currentFootprint(ctx) {
    const a = (ctx && ctx.answers) || {};
    const fp = a.A2a || {};
    let l = Number(fp.l) || 12;
    let w = Number(fp.w) || 16;
    const plan = ctx && ctx.plan;
    if (plan && plan.rooms && plan.rooms.length) {
      const r = plan.rooms[0];
      if (r.w > 0 && r.h > 0) { l = r.w; w = r.h; }
    }
    return { l, w };
  }

  function refuse(item, extras) {
    return Object.assign({
      intent_id: 'session.refuse',
      slots: {},
      confirmation: {
        title: 'Out of scope',
        body: 'I can update your working plan and 3D to explore the idea, but I can’t ' + item +
          '. For that, talk to a licensed pro / your building department. Want to adjust the layout instead?',
      },
      mutation_ops: [],
      flags: ['must_hire_pro'],
      callout: { tone: 'must_hire_pro', text: 'The Guide never invents engineering sizes, files permits, or creates bids.' },
      status: 'refused',
    }, extras || {});
  }

  function softRefuseAddition(intentId) {
    return {
      intent_id: intentId,
      slots: {},
      confirmation: {
        title: 'Remodel mode',
        body: 'You’re in remodel mode — try selecting a room or wall on the plan instead of a new footprint. Switch project type in Guidance to include an addition if you need footprint / attach / foundation commands.',
      },
      mutation_ops: [],
      flags: ['addition_only'],
      callout: { tone: 'tip', text: 'Tip: change “What kind of project” in Guidance to Addition or Both.' },
      status: 'refused',
    };
  }

  function result(partial) {
    const r = Object.assign({
      intent_id: 'session.help',
      slots: {},
      mutation_ops: [],
      flags: [],
      status: 'parsed',
    }, partial);
    if (!r.confirmation && r.status !== 'needs_clarify') {
      r.confirmation = { title: 'Confirm', body: 'Apply this change to the working plan and 3D?' };
    }
    return r;
  }

  function tpl(s, vars) {
    return String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  }

  // ---- Intent parsers ----

  function parseFootprintSet(text, ctx) {
    if (!/(footprint|addition|make\s+(?:the\s+)?(?:addition|it)|resize|set\s+length|change\s+(?:size|footprint)|by\s+\d)/.test(text) &&
        !extractFeetPairs(text)) return null;
    if (!/(footprint|addition|length|width|resize|by\s+\d|\d+\s*(?:by|x)\s*\d+)/.test(text)) return null;
    // avoid stealing wall height
    if (/wall\s*height|ceiling|raise\s+the\s+\w+\s+wall/.test(text) && !/footprint|addition/.test(text)) return null;

    if (isRemodelOnly(ctx)) return softRefuseAddition('footprint.set');

    const pair = extractFeetPairs(text);
    if (!pair) {
      return result({
        intent_id: 'footprint.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'What length and width (ft)?',
          chips: [
            { id: '12x16', label: '12×16', fill: { footprint_l_ft: 12, footprint_w_ft: 16 } },
            { id: '14x20', label: '14×20', fill: { footprint_l_ft: 14, footprint_w_ft: 20 } },
            { id: '10x12', label: '10×12', fill: { footprint_l_ft: 10, footprint_w_ft: 12 } },
            { id: '12x14', label: '12×14', fill: { footprint_l_ft: 12, footprint_w_ft: 14 } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['addition_only', 'example'],
      });
    }
    const l = pair.a, w = pair.b;
    const sqft = Math.round(l * w);
    return result({
      intent_id: 'footprint.set',
      slots: { footprint_l_ft: l, footprint_w_ft: w },
      confirmation: {
        title: 'Resize footprint',
        body: tpl('Resize the addition footprint to **{{l}} ft × {{w}} ft** (~{{sqft}} sq ft). Plan outline and 3D slab will update.', { l, w, sqft }),
      },
      mutation_ops: [
        { op: 'resize_footprint', l_ft: l, w_ft: w },
        { op: 'set_field', field_id: 'footprint_l_ft', value: l },
        { op: 'set_field', field_id: 'footprint_w_ft', value: w },
      ],
      flags: ['addition_only', 'example'],
      callout: { tone: 'example', text: 'Common sizes are illustrative — adjust anytime.' },
      status: 'awaiting_confirm',
    });
  }

  function parseFootprintScale(text, ctx) {
    if (!/(a\s+little\s+bigger|bigger|bump|scale|about\s+\d+\s*(?:sq|square)|make\s+it\s+(?:bigger|larger|smaller))/.test(text)) return null;
    if (isRemodelOnly(ctx)) return softRefuseAddition('footprint.scale');

    const area = extractArea(text);
    const deltaInfo = extractDelta(text);
    const cur = currentFootprint(ctx);

    if (!area && (!deltaInfo || deltaInfo.delta == null)) {
      return result({
        intent_id: 'footprint.scale',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'How much wider or longer — e.g. +2 ft on the width, or a target sq ft?',
          chips: [
            { id: 'p2w', label: '+2 ft width', fill: { delta: 2, axis: 'width' } },
            { id: 'p2l', label: '+2 ft length', fill: { delta: 2, axis: 'length' } },
            { id: 'a200', label: '~200 sq ft', fill: { area_sqft: 200 } },
            { id: 'a280', label: '~280 sq ft', fill: { area_sqft: 280 } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['addition_only', 'example'],
      });
    }

    let l = cur.l, w = cur.w;
    if (area) {
      const aspect = cur.l / (cur.w || 1);
      w = Math.sqrt(area / (aspect || 1));
      l = area / w;
      l = Math.round(l * 2) / 2;
      w = Math.round(w * 2) / 2;
    } else if (deltaInfo) {
      const ax = deltaInfo.axis || 'width';
      if (ax === 'length' || ax === 'both') l = cur.l + deltaInfo.delta;
      if (ax === 'width' || ax === 'both' || !deltaInfo.axis) w = cur.w + deltaInfo.delta;
    }
    const sqft = Math.round(l * w);
    return result({
      intent_id: 'footprint.scale',
      slots: { footprint_l_ft: l, footprint_w_ft: w, area_sqft: sqft },
      confirmation: {
        title: 'Update footprint',
        body: tpl('Update footprint to about **{{sqft}} sq ft** ({{l}}×{{w}} ft).', { sqft, l, w }),
      },
      mutation_ops: [
        { op: 'resize_footprint', l_ft: l, w_ft: w },
        { op: 'set_field', field_id: 'footprint_l_ft', value: l },
        { op: 'set_field', field_id: 'footprint_w_ft', value: w },
      ],
      flags: ['addition_only', 'example'],
      status: 'awaiting_confirm',
    });
  }

  function parseAttachSide(text, ctx) {
    if (/(window|door|opening|french|sliding)/.test(text) && !/attach|addition/.test(text)) return null;
    if (!/(attach|put\s+(?:the\s+)?addition|move\s+it\s+to|addition\s+on\s+the|on\s+the\s+(?:back|front|left|right)\s+(?:of\s+(?:the\s+)?)?house|corner\s+wrap)/.test(text)) return null;
    if (isRemodelOnly(ctx)) return softRefuseAddition('attach_side.set');
    let side = attachSideFromText(text);
    if (!side) {
      return result({
        intent_id: 'attach_side.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Which side — back, left, right, front, or corner?',
          chips: ['back', 'left', 'right', 'front', 'corner'].map((s) => ({
            id: s, label: s.charAt(0).toUpperCase() + s.slice(1), fill: { attach_side: s },
          })),
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['addition_only'],
      });
    }
    return result({
      intent_id: 'attach_side.set',
      slots: { attach_side: side },
      confirmation: {
        title: 'Attach side',
        body: tpl('Place the addition on the **{{attach_side}}** of the house. The shared wall highlight will move.', { attach_side: side }),
      },
      mutation_ops: [
        { op: 'set_attach_side', attach_side: side },
        { op: 'set_field', field_id: 'attach_side', value: side },
      ],
      flags: ['addition_only'],
      status: 'awaiting_confirm',
    });
  }

  function parseWallHeightAll(text) {
    // Ceiling mode phrases (vaulted/flat/taller) belong to ceiling_mode.set
    if (/(vaulted|vault|cathedral|flat\s+ceiling|taller\s+ceiling|ceiling\s+mode|match\s+existing\s+height)/.test(text) &&
        !/wall\s*height|\d+\s*(?:ft|foot|feet)\s+walls?|walls?\s+to\s+\d/.test(text)) return null;
    if (!/(wall\s*height|foot\s+walls|ft\s+walls|walls?\s+to\s+\d|set\s+walls?|use\s+\d+\s*foot|make\s+ceilings?\s+\d|\d+\s*foot\s+walls|ceilings?\s+\d)/.test(text)) return null;
    // Per-side language → leave for set_side (unless explicitly all/every)
    if (/\b(left|right|back|front|north|south|east|west|this)\s+wall\b/.test(text) && !/all\s+walls|every\s+wall|wall\s*height/.test(text)) return null;
    const h = extractFeet(text);
    if (h == null || h < 6 || h > 20) {
      return result({
        intent_id: 'wall_height.set_all',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'What wall (plate) height?',
          chips: [
            { id: '8', label: '8 ft', fill: { wall_height_ft: 8 } },
            { id: '9', label: '9 ft', fill: { wall_height_ft: 9 } },
            { id: '10', label: '10 ft', fill: { wall_height_ft: 10 } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['example'],
      });
    }
    const ops = [
      { op: 'set_wall_height', all: true, height_ft: h },
      { op: 'set_field', field_id: 'wall_height_ft', value: h },
    ];
    if (/vault/.test(text)) {
      ops.push({ op: 'set_field', field_id: 'ceiling_mode', value: 'vaulted' });
    }
    return result({
      intent_id: 'wall_height.set_all',
      slots: { wall_height_ft: h },
      confirmation: {
        title: 'Wall height',
        body: tpl('Set wall (plate) height to **{{h}} ft** for the new/changed space. 3D walls will extrude to that height.', { h }),
      },
      mutation_ops: ops,
      flags: ['example'],
      status: 'awaiting_confirm',
    });
  }

  function parseWallHeightSide(text, ctx) {
    if (/(remove|delete|knock\s+out|open\s+up)\s+/.test(text)) return null;
    if (/wall\s*height|ceilings?|\d+\s*foot\s+walls|use\s+\d+\s*foot\s+walls/.test(text) &&
        !/\b(left|right|back|front|north|south|east|west|this)\s+wall\b/.test(text)) return null;
    if (!/(raise|make|set).{0,40}(left|right|back|front|north|south|east|west|this)\s+wall|(left|right|back|front|north|south|east|west|this)\s+wall.{0,30}(to|at)\s*\d|this\s+wall\s+to/.test(text)) return null;
    if (/all\s+walls|every\s+wall/.test(text)) return null;

    const sel = selectionSlots(ctx);
    let side = wallSideFromText(text) || sel.side || null;
    const wallId = sel.wall_id || null;
    const h = extractFeet(text);

    if (!side && !wallId) {
      return result({
        intent_id: 'wall_height.set_side',
        slots: h != null ? { wall_height_ft: h } : {},
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Which wall — back, left, right, front, or tap a wall on the plan?',
          chips: [
            { id: 'back', label: 'Back', fill: { side: 'south' } },
            { id: 'left', label: 'Left', fill: { side: 'west' } },
            { id: 'right', label: 'Right', fill: { side: 'east' } },
            { id: 'front', label: 'Front', fill: { side: 'north' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    if (h == null) {
      return result({
        intent_id: 'wall_height.set_side',
        slots: { side: side || undefined, wall_id: wallId || undefined },
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'What height for that wall?',
          chips: [
            { id: '8', label: '8 ft', fill: { wall_height_ft: 8 } },
            { id: '9', label: '9 ft', fill: { wall_height_ft: 9 } },
            { id: '10', label: '10 ft', fill: { wall_height_ft: 10 } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    const label = side || 'selected';
    return result({
      intent_id: 'wall_height.set_side',
      slots: { side, wall_id: wallId, wall_height_ft: h },
      confirmation: {
        title: 'Per-side wall height',
        body: tpl('Set the **{{side}}** wall height to **{{h}} ft** (other walls stay as they are unless you change them).', { side: label, h }),
      },
      mutation_ops: [
        { op: 'set_wall_height', side: side || undefined, wall_id: wallId || undefined, height_ft: h },
      ],
      callout: { tone: tipTone(), text: 'Mixed heights may imply complex roof/plate conditions — conceptual only.' },
      status: 'awaiting_confirm',
    });
  }

  function tipTone() { return 'tip'; }

  function parseCeilingMode(text) {
    if (!/(vaulted|vault|cathedral|flat.{0,24}ceiling|taller.{0,16}ceiling|match\s+existing\s+height|ceiling\s+mode|want\s+a\s+vault)/.test(text)) return null;
    let mode = null;
    for (const [k, v] of Object.entries(CEILING_MODES)) {
      if (text.includes(k)) { mode = v; break; }
    }
    if (!mode) mode = 'flat';
    return result({
      intent_id: 'ceiling_mode.set',
      slots: { ceiling_mode: mode },
      confirmation: {
        title: 'Ceiling mode',
        body: tpl('Set ceiling mode to **{{mode}}**. Vaulted uses your wall height as the eave and pitches the roof volume from there.', { mode }),
      },
      mutation_ops: [{ op: 'set_field', field_id: 'ceiling_mode', value: mode }],
      callout: mode === 'vaulted'
        ? { tone: 'tip', text: 'Vaulted ceilings add framing / insulation / HVAC complexity — not fake engineering.' }
        : null,
      status: 'awaiting_confirm',
    });
  }

  function parseWallAdd(text) {
    if (!/(add\s+(?:a\s+)?(?:interior\s+)?wall|split\s+the\s+room|closet\s+wall|partition)/.test(text)) return null;
    const offset = extractFeet(text);
    let orientation = null;
    if (/left.?right|across|horizontal|east.?west/.test(text)) orientation = 'horizontal';
    if (/front.?back|vertical|north.?south/.test(text)) orientation = 'vertical';

    if (!orientation && offset == null) {
      return result({
        intent_id: 'wall.add',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Where should it run — left-right across the room, or front-back?',
          chips: [
            { id: 'lr', label: 'Left–right (across)', fill: { orientation: 'horizontal' } },
            { id: 'fb', label: 'Front–back', fill: { orientation: 'vertical' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['example'],
      });
    }
    const orient = orientation || 'horizontal';
    const off = offset != null ? offset : 8;
    const phrase = orient === 'horizontal'
      ? ('about ' + off + ' ft from the back, running left–right')
      : ('about ' + off + ' ft from the left, running front–back');
    return result({
      intent_id: 'wall.add',
      slots: { orientation: orient, offset_ft: off },
      confirmation: {
        title: 'Add wall',
        body: tpl('Add a new wall {{placement_phrase}} on the plan. You can nudge it after.', { placement_phrase: phrase }),
      },
      mutation_ops: [{ op: 'add_wall', orientation: orient, offset_ft: off }],
      flags: ['example'],
      status: 'awaiting_confirm',
    });
  }

  function parseWallMove(text, ctx) {
    if (!/(move|nudge|push).{0,30}wall/.test(text)) return null;
    const sel = selectionSlots(ctx);
    const offset = extractFeet(text);
    let direction = 'out';
    if (/\bin\b|inward|toward/.test(text)) direction = 'in';
    if (/\bout\b|outward|away/.test(text)) direction = 'out';

    if (!sel.wall_id) {
      return result({
        intent_id: 'wall.move',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Which wall? Tap it on the plan, then try again — or say back / left / right / front.',
          chips: [
            { id: 'back', label: 'Back', fill: { side: 'south' } },
            { id: 'left', label: 'Left', fill: { side: 'west' } },
            { id: 'right', label: 'Right', fill: { side: 'east' } },
            { id: 'front', label: 'Front', fill: { side: 'north' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    if (offset == null) {
      return result({
        intent_id: 'wall.move',
        slots: { wall_id: sel.wall_id },
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'How far should it move?',
          chips: [
            { id: '1o', label: '1 ft out', fill: { offset_ft: 1, direction: 'out' } },
            { id: '2o', label: '2 ft out', fill: { offset_ft: 2, direction: 'out' } },
            { id: '2i', label: '2 ft in', fill: { offset_ft: 2, direction: 'in' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    return result({
      intent_id: 'wall.move',
      slots: { wall_id: sel.wall_id, offset_ft: offset, direction },
      confirmation: {
        title: 'Move wall',
        body: tpl('Move the selected wall **{{offset}} ft {{direction}}**.', { offset, direction }),
      },
      mutation_ops: [{ op: 'move_wall', wall_id: sel.wall_id, offset_ft: offset, direction, side: sel.side }],
      flags: [],
      callout: { tone: 'must_hire_pro', text: 'If this is a shared or likely bearing wall, have a pro review before building.' },
      status: 'awaiting_confirm',
    });
  }

  function parseWallRemove(text, ctx) {
    if (!/(remove|delete|knock\s*(?:out|down)|open\s+up).{0,40}wall/.test(text)) return null;
    const sel = selectionSlots(ctx);
    if (!sel.wall_id && !wallSideFromText(text)) {
      return result({
        intent_id: 'wall.remove',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Which wall should we remove? Tap it on the plan.',
          chips: [
            { id: 'sel', label: 'I’ll tap the wall', fill: { wait_selection: true } },
            { id: 'opening', label: 'Wide opening instead', fill: { prefer_opening: true } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['destructive', 'must_hire_pro'],
      });
    }
    const wallId = sel.wall_id;
    const side = sel.side || wallSideFromText(text);
    return result({
      intent_id: 'wall.remove',
      slots: { wall_id: wallId, side },
      confirmation: {
        title: 'Remove wall',
        body: '**Remove** the selected wall from the working plan and 3D. This is a big change — confirm only if you mean it.',
      },
      mutation_ops: [
        { op: 'remove_wall', wall_id: wallId, side },
        { op: 'set_field', field_id: 'open_interior_walls', value: 'yes' },
      ],
      flags: ['destructive', 'must_hire_pro'],
      callout: { tone: 'must_hire_pro', text: BEARING_CALLOUT },
      status: 'awaiting_confirm',
    });
  }

  function parseOpeningAddDoor(text, ctx) {
    if (!/(add|put|place).{0,30}(door|french|sliding\s+patio)|french\s+doors?|sliding\s+(?:patio\s+)?doors?/.test(text)) return null;
    if (/\bwindow\b/.test(text) && !/\bdoor\b/.test(text)) return null;

    let doorType = 'entry';
    for (const [k, v] of Object.entries(DOOR_TYPES)) {
      if (text.includes(k)) { doorType = v; break; }
    }
    const sel = selectionSlots(ctx);
    let side = wallSideFromText(text) || sel.side;
    if (!side && !sel.wall_id) {
      return result({
        intent_id: 'opening.add_door',
        slots: { door_type: doorType },
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Which wall for the door?',
          chips: [
            { id: 'back', label: 'Back', fill: { side: 'south' } },
            { id: 'left', label: 'Left', fill: { side: 'west' } },
            { id: 'right', label: 'Right', fill: { side: 'east' } },
            { id: 'front', label: 'Front', fill: { side: 'north' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['example'],
      });
    }
    if (!/\b(entry|sliding|french|patio)\b/.test(text) && doorType === 'entry' && /door/.test(text)) {
      // optional: already defaulted entry — OK without extra clarify if side known
    }
    let w = 3, h = 80 / 12;
    if (doorType === 'sliding' || doorType === 'french') { w = 6; h = 7; }
    const pair = extractFeetPairs(text);
    if (pair) { w = pair.a; h = pair.b; }

    const sideLabel = side || 'selected';
    return result({
      intent_id: 'opening.add_door',
      slots: { door_type: doorType, side, wall_id: sel.wall_id, w_ft: w, h_ft: h },
      confirmation: {
        title: 'Add door',
        body: tpl('Add a **{{door_type}}** door on the **{{side}}** wall (rough opening ~{{w}}×{{h}}). Conceptual — not a shop drawing.', {
          door_type: doorType, side: sideLabel, w: w + ' ft', h: (Math.round(h * 12) + ' in'),
        }),
      },
      mutation_ops: [
        { op: 'add_opening', type: 'door', door_type: doorType, wall_id: sel.wall_id, side, w_ft: w, h_ft: h },
        { op: 'set_field', field_id: 'door_types', value: doorType },
      ],
      flags: ['example'],
      status: 'awaiting_confirm',
    });
  }

  function parseOpeningAddWindow(text, ctx) {
    if (!/(add|put|place|more).{0,40}windows?|windows?\s+for\s+light/.test(text)) return null;
    if (/\bdoor\b/.test(text) && !/\bwindow\b/.test(text)) return null;

    const sel = selectionSlots(ctx);
    let side = wallSideFromText(text) || sel.side;
    const count = extractCount(text);
    let w = 3, h = 4;
    const pair = extractFeetPairs(text);
    if (pair) { w = pair.a; h = pair.b; }
    // "3 by 4 window"
    if (!side && !sel.wall_id) {
      return result({
        intent_id: 'opening.add_window',
        slots: { count, w_ft: w, h_ft: h },
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Which wall for the window(s)?',
          chips: [
            { id: 'back', label: 'Back', fill: { side: 'south' } },
            { id: 'left', label: 'Left', fill: { side: 'west' } },
            { id: 'right', label: 'Right', fill: { side: 'east' } },
            { id: 'front', label: 'Front', fill: { side: 'north' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['example'],
      });
    }
    const sideLabel = side || 'selected';
    const ops = [];
    for (let i = 0; i < count; i++) {
      ops.push({
        op: 'add_opening', type: 'window', wall_id: sel.wall_id, side,
        w_ft: w, h_ft: h, t: count === 1 ? 0.5 : (i + 1) / (count + 1),
      });
    }
    ops.push({ op: 'set_field', field_id: 'window_count_band', value: 'bump' });
    return result({
      intent_id: 'opening.add_window',
      slots: { side, wall_id: sel.wall_id, count, w_ft: w, h_ft: h },
      confirmation: {
        title: 'Add window(s)',
        body: tpl('Add **{{count}}** window(s) on the **{{side}}** wall (~{{w}}×{{h}} each).', {
          count, side: sideLabel, w: w + ' ft', h: h + ' ft',
        }),
      },
      mutation_ops: ops,
      flags: ['example'],
      callout: { tone: 'tip', text: 'Daylight tip: balance glass on non-attach walls when you can.' },
      status: 'awaiting_confirm',
    });
  }

  function parseOpeningAddLarge(text, ctx) {
    if (!/(large\s+opening|wide\s+opening|open\s+an?\s+\d|big\s+opening|\d+\s*foot\s+opening|span\s+into)/.test(text)) return null;
    const sel = selectionSlots(ctx);
    let side = wallSideFromText(text) || sel.side || 'attach';
    let w = extractFeet(text);
    if (w == null) {
      return result({
        intent_id: 'opening.add_large',
        slots: { side },
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'About how wide?',
          chips: [
            { id: 'u6', label: 'Under 6 ft', fill: { large_opening_w_ft: 5 } },
            { id: '68', label: '6–8 ft', fill: { large_opening_w_ft: 7 } },
            { id: '8', label: '8 ft', fill: { large_opening_w_ft: 8 } },
            { id: '812', label: '8–12 ft', fill: { large_opening_w_ft: 10 } },
            { id: 'ns', label: 'Not sure → 8 ft', fill: { large_opening_w_ft: 8 } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['must_hire_pro', 'example'],
      });
    }
    const h = 6 + 8 / 12;
    return result({
      intent_id: 'opening.add_large',
      slots: { large_opening_w_ft: w, side, wall_id: sel.wall_id },
      confirmation: {
        title: 'Wide opening',
        body: tpl('Create a **wide opening ~{{w}} ft** on the **{{side}}** wall. Wide openings almost always need an engineered header — we’ll flag hire-a-pro; we won’t invent a beam size.', {
          w, side: side === 'attach' ? 'attach' : side,
        }),
      },
      mutation_ops: [
        { op: 'add_opening', type: 'large', wall_id: sel.wall_id, side, w_ft: w, h_ft: h },
        { op: 'set_field', field_id: 'has_large_opening', value: 'yes' },
        { op: 'set_field', field_id: 'large_opening_w_ft', value: w },
        { op: 'set_field', field_id: 'connect_type', value: 'open' },
      ],
      flags: ['must_hire_pro', 'example'],
      callout: { tone: 'must_hire_pro', text: LARGE_OPENING_CALLOUT },
      status: 'awaiting_confirm',
    });
  }

  function parseOpeningMoveResizeRemove(text, ctx) {
    const sel = selectionSlots(ctx);
    if (/(remove|delete).{0,20}(window|door|opening)/.test(text)) {
      if (!sel.opening_id) {
        return result({
          intent_id: 'opening.remove',
          status: 'needs_clarify',
          clarify_question: {
            prompt: 'Which opening? Tap a window on the plan.',
            chips: [{ id: 'tap', label: 'I’ll tap it', fill: { wait_selection: true } }],
          },
          mutation_ops: [{ op: 'noop_clarify' }],
          flags: ['destructive'],
        });
      }
      return result({
        intent_id: 'opening.remove',
        slots: { opening_id: sel.opening_id },
        confirmation: {
          title: 'Remove opening',
          body: '**Remove** the selected opening from the working plan and 3D.',
        },
        mutation_ops: [{ op: 'remove_opening', opening_id: sel.opening_id }],
        flags: ['destructive'],
        status: 'awaiting_confirm',
      });
    }
    if (/(resize|make).{0,30}(window|door|opening)|(\d+)\s*(?:by|x)\s*(\d+).{0,10}(window|door)/.test(text)) {
      if (!sel.opening_id) {
        return result({
          intent_id: 'opening.resize',
          status: 'needs_clarify',
          clarify_question: {
            prompt: 'Which opening should we resize? Tap it on the plan.',
            chips: [{ id: 'tap', label: 'I’ll tap it', fill: { wait_selection: true } }],
          },
          mutation_ops: [{ op: 'noop_clarify' }],
        });
      }
      const pair = extractFeetPairs(text);
      let w = pair ? pair.a : null;
      let h = pair ? pair.b : null;
      // inches form 36 by 80
      if (pair && pair.a > 15) { w = pair.a / 12; h = pair.b / 12; }
      if (w == null) {
        return result({
          intent_id: 'opening.resize',
          slots: { opening_id: sel.opening_id },
          status: 'needs_clarify',
          clarify_question: {
            prompt: 'New size (ft)?',
            chips: [
              { id: '34', label: '3×4 window', fill: { w_ft: 3, h_ft: 4 } },
              { id: '36', label: '3×6.7 door', fill: { w_ft: 3, h_ft: 80 / 12 } },
              { id: '67', label: '6×7 patio', fill: { w_ft: 6, h_ft: 7 } },
            ],
          },
          mutation_ops: [{ op: 'noop_clarify' }],
        });
      }
      const flags = w >= 6 ? ['must_hire_pro'] : [];
      return result({
        intent_id: 'opening.resize',
        slots: { opening_id: sel.opening_id, w_ft: w, h_ft: h },
        confirmation: {
          title: 'Resize opening',
          body: tpl('Resize the selected opening to about **{{w}}×{{h}} ft**.', { w, h: Math.round(h * 10) / 10 }),
        },
        mutation_ops: [{ op: 'resize_opening', opening_id: sel.opening_id, w_ft: w, h_ft: h }],
        flags,
        callout: w >= 6 ? { tone: 'must_hire_pro', text: LARGE_OPENING_CALLOUT } : null,
        status: 'awaiting_confirm',
      });
    }
    if (/move.{0,20}(window|door|opening)/.test(text)) {
      if (!sel.opening_id) {
        return result({
          intent_id: 'opening.move',
          status: 'needs_clarify',
          clarify_question: {
            prompt: 'Which opening? Tap it on the plan first.',
            chips: [{ id: 'tap', label: 'I’ll tap it', fill: { wait_selection: true } }],
          },
          mutation_ops: [{ op: 'noop_clarify' }],
        });
      }
      let tDelta = 0.1;
      if (/\bleft\b/.test(text)) tDelta = -0.1;
      if (/\bright\b/.test(text)) tDelta = 0.1;
      return result({
        intent_id: 'opening.move',
        slots: { opening_id: sel.opening_id, t_delta: tDelta },
        confirmation: {
          title: 'Move opening',
          body: 'Nudge the selected opening along its wall.',
        },
        mutation_ops: [{ op: 'move_opening', opening_id: sel.opening_id, t_delta: tDelta }],
        status: 'awaiting_confirm',
      });
    }
    return null;
  }

  function parseConnectType(text) {
    if (!/(connect|open\s+it\s+fully|doorway\s+into|through\s+a\s+hall|connection\s+to\s+the\s+house)/.test(text)) return null;
    let ct = null;
    for (const [k, v] of Object.entries(CONNECT_TYPES)) {
      if (text.includes(k)) { ct = v; break; }
    }
    if (!ct) {
      return result({
        intent_id: 'connect_type.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'How should it connect to the house?',
          chips: [
            { id: 'doorway', label: 'Doorway', fill: { connect_type: 'doorway' } },
            { id: 'open', label: 'Open fully', fill: { connect_type: 'open' } },
            { id: 'hall', label: 'Through a hall', fill: { connect_type: 'hall' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    const flags = (ct === 'open' || ct === 'opening') ? ['must_hire_pro', 'addition_only'] : ['addition_only'];
    return result({
      intent_id: 'connect_type.set',
      slots: { connect_type: ct },
      confirmation: {
        title: 'Connection type',
        body: tpl('Connection to the house: **{{connect_type}}**.', { connect_type: ct }),
      },
      mutation_ops: [
        { op: 'set_connect_type', connect_type: ct },
        { op: 'set_field', field_id: 'connect_type', value: ct },
      ],
      flags,
      callout: flags.includes('must_hire_pro')
        ? { tone: 'must_hire_pro', text: BEARING_CALLOUT }
        : null,
      status: 'awaiting_confirm',
    });
  }

  function parseRoofPitch(text) {
    if (!/(roof\s+pitch|pitch\s+to|steeper|low\s*slope\s+roof|\d+\s*[:/]\s*12)/.test(text)) return null;
    let pitch = extractPitch(text);
    if (!pitch && /steeper|steep/.test(text)) {
      return result({
        intent_id: 'roof.pitch.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Pick a pitch:',
          chips: [
            { id: '4', label: '4:12 (common)', fill: { roof_pitch: '4:12' } },
            { id: '6', label: '6:12', fill: { roof_pitch: '6:12' } },
            { id: '8', label: '8:12', fill: { roof_pitch: '8:12' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['example'],
      });
    }
    if (!pitch) pitch = '4:12';
    return result({
      intent_id: 'roof.pitch.set',
      slots: { roof_pitch: pitch },
      confirmation: {
        title: 'Roof pitch',
        body: tpl('Set roof pitch to **{{pitch}}**. 3D roof mesh slope will update (conceptual).', { pitch }),
      },
      mutation_ops: [
        { op: 'set_roof', roof_pitch: pitch },
        { op: 'set_field', field_id: 'roof_pitch', value: pitch },
      ],
      flags: ['example'],
      callout: pitch === '2:12'
        ? { tone: 'tip', text: 'Low-slope roofs need careful flashing / membrane details — not fake detailing here.' }
        : null,
      status: 'awaiting_confirm',
    });
  }

  function parseRoofTieIn(text) {
    if (!/(continue\s+the\s+same\s+roof|separate\s+lower\s+roof|dormer|roof\s+meets|tie.?in|flat\s+roof\s+section)/.test(text)) return null;
    let tie = null;
    for (const [k, v] of Object.entries(ROOF_TIE)) {
      if (text.includes(k)) { tie = v; break; }
    }
    if (!tie) {
      return result({
        intent_id: 'roof.tie_in.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'How should the roof meet the house?',
          chips: [
            { id: 'cont', label: 'Continuous', fill: { roof_tie_in: 'continuous' } },
            { id: 'sep', label: 'Separate lower', fill: { roof_tie_in: 'separate' } },
            { id: 'dor', label: 'Dormer-style', fill: { roof_tie_in: 'dormer' } },
            { id: 'low', label: 'Low-slope / flat', fill: { roof_tie_in: 'low-slope' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    return result({
      intent_id: 'roof.tie_in.set',
      slots: { roof_tie_in: tie },
      confirmation: {
        title: 'Roof tie-in',
        body: tpl('Roof meets the house as **{{tie_in}}**.', { tie_in: tie }),
      },
      mutation_ops: [
        { op: 'set_roof', roof_tie_in: tie },
        { op: 'set_field', field_id: 'roof_tie_in', value: tie },
      ],
      callout: (tie === 'separate' || tie === 'low-slope')
        ? { tone: 'tip', text: 'Separate / low-slope ties need careful waterproofing at the joint.' }
        : null,
      status: 'awaiting_confirm',
    });
  }

  function parseRoofEave(text) {
    if (!/(eave|overhang|deeper\s+eaves|minimal\s+overhang)/.test(text)) return null;
    let inches = extractInches(text);
    if (inches == null) {
      const ft = extractFeet(text);
      if (ft != null && ft <= 3) inches = ft * 12;
    }
    if (inches == null) {
      if (/minimal|small/.test(text)) inches = 6;
      else if (/deeper|deep|large/.test(text)) inches = 24;
    }
    if (inches == null) {
      return result({
        intent_id: 'roof.eave.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Eave overhang?',
          chips: [
            { id: '6', label: '6 in', fill: { eave_overhang_in: 6 } },
            { id: '12', label: '12 in', fill: { eave_overhang_in: 12 } },
            { id: '18', label: '18 in', fill: { eave_overhang_in: 18 } },
            { id: '24', label: '24 in', fill: { eave_overhang_in: 24 } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['example'],
      });
    }
    return result({
      intent_id: 'roof.eave.set',
      slots: { eave_overhang_in: inches },
      confirmation: {
        title: 'Eave overhang',
        body: tpl('Set eave overhang to about **{{in}} in**.', { in: inches }),
      },
      mutation_ops: [
        { op: 'set_roof', eave_overhang_in: inches },
        { op: 'set_field', field_id: 'eave_overhang_in', value: inches },
      ],
      flags: ['example'],
      status: 'awaiting_confirm',
    });
  }

  function hasAdditionPlanContext(ctx) {
    const plan = ctx && ctx.plan;
    if (!plan) return false;
    if (plan.existingHouse) return true;
    if (plan.rooms && plan.rooms.length) return true;
    if (plan.walls && plan.walls.length) return true;
    return false;
  }

  function parseFoundation(text, ctx) {
    if (!/(foundation|slab|crawl\s*space|basement\s+under|match\s+the\s+house\s+foundation|pier|sonotube|pylon|pilon|elevated\s+on\s+pier)/.test(text)) return null;
    if (isRemodelOnly(ctx) && /foundation|slab|crawl|basement|pier|sonotube|pylon|pilon/.test(text) && !hasAdditionPlanContext(ctx)) {
      return softRefuseAddition('foundation.type.set');
    }
    let type = null;
    for (const [k, v] of Object.entries(FOUNDATION_TYPES)) {
      if (text.includes(k)) { type = v; break; }
    }
    if (!type) {
      return result({
        intent_id: 'foundation.type.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'Foundation approach?',
          chips: [
            { id: 'slab', label: 'Slab', fill: { foundation_type: 'slab' } },
            { id: 'crawl', label: 'Crawl space', fill: { foundation_type: 'crawl' } },
            { id: 'basement', label: 'Basement', fill: { foundation_type: 'basement' } },
            { id: 'piers', label: 'Piers / sonotubes (pylons)', fill: { foundation_type: 'piers' } },
            { id: 'match', label: 'Match house', fill: { foundation_type: 'match' } },
          ],
        },
        mutation_ops: [{ op: 'noop_clarify' }],
        flags: ['addition_only'],
      });
    }
    if (/footing|beam\s+size|what\s+size/.test(text)) {
      return refuse('size footings or beams');
    }
    return result({
      intent_id: 'foundation.type.set',
      slots: { foundation_type: type },
      confirmation: {
        title: 'Foundation',
        body: tpl('Foundation approach: **{{type}}**. 3D will show slab, crawl, basement, or elevated piers / sonotubes under **wall edges only** (not mid-span) — not a soils or structural design.', { type }),
      },
      mutation_ops: [
        { op: 'set_foundation', foundation_type: type },
        { op: 'set_field', field_id: 'foundation_type', value: type },
      ],
      flags: ['addition_only'],
      callout: (type === 'basement' || /slope|steep/.test(text))
        ? { tone: 'tip', text: 'Sloped sites and basements often need engineering — explore massing only here.' }
        : null,
      status: 'awaiting_confirm',
    });
  }

  function parseFloorAlignSiteGrade(text, ctx) {
    if (/floor\s+align|match\s+(?:existing\s+)?floor|step\s+(?:down|up)/.test(text)) {
      if (isRemodelOnly(ctx)) return softRefuseAddition('foundation.floor_align.set');
      const align = /step/.test(text) ? 'no' : 'yes';
      return result({
        intent_id: 'foundation.floor_align.set',
        slots: { floor_align: align },
        confirmation: {
          title: 'Floor align',
          body: align === 'yes'
            ? 'Match the addition floor to the existing house floor (conceptual).'
            : 'Show a small step between house and addition floors (illustrative).',
        },
        mutation_ops: [{ op: 'set_field', field_id: 'floor_align', value: align }],
        flags: ['addition_only'],
        status: 'awaiting_confirm',
      });
    }
    if (/site\s+grade|steep\s+lot|gentle\s+slope|flat\s+(?:lot|grade|site)/.test(text)) {
      if (isRemodelOnly(ctx)) return softRefuseAddition('foundation.site_grade.set');
      let grade = 'flat';
      if (/steep/.test(text)) grade = 'steep';
      else if (/gentle|mild/.test(text)) grade = 'gentle';
      return result({
        intent_id: 'foundation.site_grade.set',
        slots: { site_grade: grade },
        confirmation: {
          title: 'Site grade',
          body: tpl('Illustrative site grade: **{{g}}** (tilt only — not a grading plan).', { g: grade }),
        },
        mutation_ops: [{ op: 'set_field', field_id: 'site_grade', value: grade }],
        flags: ['addition_only'],
        callout: grade === 'steep' ? { tone: 'tip', text: 'Steep grades often need extra engineering and access planning.' } : null,
        status: 'awaiting_confirm',
      });
    }
    return null;
  }

  function parseRoomLabel(text, ctx) {
    if (!/(label|call\s+(?:it|the)|this\s+room\s+is|room\s+is\s+a|kitchenette|bedroom|bathroom|home\s+office)/.test(text)) return null;
    let use = null;
    for (const [k, v] of Object.entries(ROOM_USES)) {
      if (text.includes(k)) { use = v; break; }
    }
    const sel = selectionSlots(ctx);
    if (!use) {
      return result({
        intent_id: 'room.label.set',
        status: 'needs_clarify',
        clarify_question: {
          prompt: 'What use label?',
          chips: ['bedroom', 'bathroom', 'kitchen', 'living', 'office', 'laundry', 'mudroom'].map((u) => ({
            id: u, label: u.charAt(0).toUpperCase() + u.slice(1), fill: { use: u },
          })),
        },
        mutation_ops: [{ op: 'noop_clarify' }],
      });
    }
    const roomLabel = sel.room_id ? 'selected room' : 'the addition / primary room';
    const wet = ['bathroom', 'kitchen', 'laundry'].includes(use);
    return result({
      intent_id: 'room.label.set',
      slots: { room_id: sel.room_id, use },
      confirmation: {
        title: 'Room label',
        body: tpl('Label **{{room}}** as **{{use}}**. We’ll emphasize plumbing/waterproofing tips if it’s a wet room.', {
          room: roomLabel, use,
        }),
      },
      mutation_ops: [{ op: 'label_room', room_id: sel.room_id, use }],
      callout: wet ? { tone: 'tip', text: 'Wet rooms need plumbing and waterproofing — tips only, not MEP design.' } : null,
      status: 'awaiting_confirm',
    });
  }

  function parseUndo(text) {
    if (!/^(undo|go\s+back|revert|put\s+.+?\s+back|undo\s+last)/.test(text) && !/\bundo\b/.test(text)) return null;
    return result({
      intent_id: 'session.undo',
      confirmation: { title: 'Undo', body: 'Undo the last Remodel Guide change?' },
      mutation_ops: [{ op: 'undo' }],
      status: 'awaiting_confirm',
    });
  }

  function parseHelp(text) {
    if (!text || /^(help|hi|hello|\?)$/.test(text) || /what\s+can\s+you\s+do|commands?|examples?/.test(text)) {
      return result({
        intent_id: 'session.help',
        confirmation: { title: 'Remodel Guide', body: HELP_TEXT },
        mutation_ops: [{ op: 'noop_clarify' }],
        status: 'parsed',
        flags: [],
      });
    }
    return null;
  }

  function parseRefuseOutOfScope(text) {
    if (/beam\s+size|what\s+size\s+beam|header\s+size|size\s+(?:the\s+)?(?:beam|header|footing|joist)/.test(text)) {
      return refuse('invent a beam / header / footing size');
    }
    if (/file\s+(?:my\s+)?permit|submit\s+to\s+(?:the\s+)?city|pull\s+permits?\s+for\s+me/.test(text)) {
      return refuse('file permits or submit to the city');
    }
    if (/hire\s+(?:a\s+)?contractor|get\s+(?:me\s+)?bids?|collect\s+bids?/.test(text)) {
      return refuse('hire contractors or collect bids');
    }
    if (/up\s+to\s+code|code\s+compliant|is\s+this\s+legal/.test(text)) {
      return result({
        intent_id: 'session.refuse',
        confirmation: {
          title: 'Code awareness',
          body: 'I can help you explore a conceptual layout, but your local building department / a licensed pro is the source of truth for code. Want to adjust the plan instead?',
        },
        mutation_ops: [],
        flags: [],
        callout: { tone: 'awareness', text: 'Awareness only — not a code verdict.' },
        status: 'refused',
      });
    }
    return null;
  }

  /**
   * Parse homeowner command → structured turn result
   * @param {string} rawText
   * @param {{ answers?: object, selection?: object, plan?: object, pending?: object }} ctx
   */
  function parseCommand(rawText, ctx) {
    ctx = ctx || {};
    const text = normalizeText(rawText);

    // Resume pending clarify with free-text answer
    if (ctx.pending && ctx.pending.intent_id && ctx.pending.status === 'needs_clarify') {
      return resumeClarify(text, rawText, ctx);
    }

    const refused = parseRefuseOutOfScope(text);
    if (refused) return refused;

    const ordered = [
      parseHelp,
      parseUndo,
      parseRefuseOutOfScope,
      parseFootprintSet,
      parseFootprintScale,
      parseWallRemove,
      parseWallMove,
      parseWallAdd,
      parseOpeningAddLarge,
      parseOpeningAddDoor,
      parseOpeningAddWindow,
      parseOpeningMoveResizeRemove,
      parseCeilingMode,
      parseWallHeightAll,
      parseWallHeightSide,
      parseAttachSide,
      parseConnectType,
      parseRoofPitch,
      parseRoofTieIn,
      parseRoofEave,
      parseFoundation,
      parseFloorAlignSiteGrade,
      parseRoomLabel,
    ];

    for (const fn of ordered) {
      const r = fn.length >= 2 ? fn(text, ctx) : fn(text);
      if (r) return r;
    }

    return result({
      intent_id: 'session.help',
      confirmation: {
        title: 'Not sure I caught that',
        body: 'Try something like “make the addition 14 by 20”, “set wall height to 9 feet”, or “add a window on the back wall”. Or tap Help.',
      },
      mutation_ops: [{ op: 'noop_clarify' }],
      status: 'parsed',
    });
  }

  function resumeClarify(text, rawText, ctx) {
    const pending = ctx.pending;
    const fill = {};
    // Try chip-like numeric / side fills from free text
    const pair = extractFeetPairs(text);
    if (pair) {
      fill.footprint_l_ft = pair.a;
      fill.footprint_w_ft = pair.b;
      fill.w_ft = pair.a;
      fill.h_ft = pair.b;
    }
    const ft = extractFeet(text);
    if (ft != null) {
      fill.wall_height_ft = ft;
      fill.offset_ft = ft;
      fill.large_opening_w_ft = ft;
      fill.height_ft = ft;
    }
    const side = wallSideFromText(text) || attachSideFromText(text);
    if (side) {
      if (ATTACH_SIDES.has(side)) fill.attach_side = side;
      fill.side = CARDINAL.has(side) ? side : wallSideFromText(side) || side;
    }
    const pitch = extractPitch(text);
    if (pitch) fill.roof_pitch = pitch;
    const inches = extractInches(text);
    if (inches != null) fill.eave_overhang_in = inches;
    for (const [k, v] of Object.entries(FOUNDATION_TYPES)) {
      if (text.includes(k)) fill.foundation_type = v;
    }
    for (const [k, v] of Object.entries(ROOM_USES)) {
      if (text.includes(k)) fill.use = v;
    }
    for (const [k, v] of Object.entries(CEILING_MODES)) {
      if (text.includes(k)) fill.ceiling_mode = v;
    }
    for (const [k, v] of Object.entries(CONNECT_TYPES)) {
      if (text.includes(k)) fill.connect_type = v;
    }
    for (const [k, v] of Object.entries(ROOF_TIE)) {
      if (text.includes(k)) fill.roof_tie_in = v;
    }
    if (/horizontal|left.?right|across/.test(text)) fill.orientation = 'horizontal';
    if (/vertical|front.?back/.test(text)) fill.orientation = 'vertical';
    if (/prefer_opening|wide\s+opening\s+instead/.test(text) || fill.prefer_opening) {
      return parseOpeningAddLarge('open an 8 foot span', ctx);
    }

    return applyClarifyFill(pending, fill, ctx);
  }

  /**
   * Apply a chip fill to a pending clarify turn and re-emit confirmation
   */
  function applyClarifyFill(pending, fill, ctx) {
    const slots = Object.assign({}, pending.slots || {}, fill || {});
    const intent = pending.intent_id;
    const fakeCtx = Object.assign({}, ctx, { pending: null });

    // Rebuild by synthesizing a command from slots
    if (intent === 'footprint.set' && slots.footprint_l_ft && slots.footprint_w_ft) {
      return parseCommand('make the addition ' + slots.footprint_l_ft + ' by ' + slots.footprint_w_ft, fakeCtx);
    }
    if (intent === 'footprint.scale') {
      if (slots.area_sqft) return parseCommand('make it about ' + slots.area_sqft + ' square feet', fakeCtx);
      if (slots.delta != null) {
        const axis = slots.axis || 'width';
        return parseCommand('bump it up ' + slots.delta + ' feet on the ' + axis, fakeCtx);
      }
    }
    if (intent === 'attach_side.set' && slots.attach_side) {
      return parseCommand('attach it to the ' + slots.attach_side, fakeCtx);
    }
    if (intent === 'wall_height.set_all' && slots.wall_height_ft) {
      return parseCommand('set wall height to ' + slots.wall_height_ft + ' feet', fakeCtx);
    }
    if (intent === 'wall_height.set_side') {
      const side = slots.side || 'back';
      const h = slots.wall_height_ft;
      if (h) return parseCommand('make the ' + side + ' wall ' + h + ' feet', fakeCtx);
      // side filled, still need height — re-ask height only
      return parseWallHeightSide('make the ' + side + ' wall taller', fakeCtx);
    }
    if (intent === 'wall.add' && slots.orientation) {
      return parseCommand('add a wall ' + (slots.orientation === 'horizontal' ? 'left-right across the room' : 'front-back') +
        (slots.offset_ft ? ' about ' + slots.offset_ft + ' feet' : ''), fakeCtx);
    }
    if (intent === 'wall.move') {
      if (slots.side && !fakeCtx.selection) {
        // resolve side to selection-like via plan
        fakeCtx.selection = { type: 'wall', id: null, obj: { side: slots.side } };
      }
      if (slots.offset_ft) {
        return parseCommand('move this wall ' + slots.offset_ft + ' feet ' + (slots.direction || 'out'), Object.assign({}, fakeCtx, {
          selection: fakeCtx.selection || ctx.selection,
        }));
      }
    }
    if (intent === 'wall.remove') {
      if (slots.prefer_opening) return parseOpeningAddLarge('open an 8 foot span', fakeCtx);
      if (slots.wait_selection) {
        return result({
          intent_id: 'wall.remove',
          status: 'needs_clarify',
          clarify_question: {
            prompt: 'Tap a wall on the plan, then say “remove this wall”.',
            chips: [],
          },
          mutation_ops: [{ op: 'noop_clarify' }],
          flags: ['destructive', 'must_hire_pro'],
        });
      }
    }
    if (intent === 'opening.add_door' && slots.side) {
      return parseCommand('add a ' + (slots.door_type || 'entry') + ' door on the ' + slots.side + ' wall', fakeCtx);
    }
    if (intent === 'opening.add_window' && slots.side) {
      const c = slots.count || 1;
      return parseCommand('add ' + c + ' window on the ' + slots.side + ' wall', fakeCtx);
    }
    if (intent === 'opening.add_large' && slots.large_opening_w_ft) {
      return parseCommand('open a ' + slots.large_opening_w_ft + ' foot span', fakeCtx);
    }
    if (intent === 'opening.resize' && slots.w_ft) {
      return parseCommand('make the door ' + slots.w_ft + ' by ' + (slots.h_ft || 4), Object.assign({}, fakeCtx, { selection: ctx.selection }));
    }
    if (intent === 'connect_type.set' && slots.connect_type) {
      return parseCommand(slots.connect_type === 'open' ? 'open it fully to the living room' :
        slots.connect_type === 'hall' ? 'connect through a hall' : 'just a doorway into the house', fakeCtx);
    }
    if (intent === 'roof.pitch.set' && slots.roof_pitch) {
      return parseCommand('set roof pitch to ' + slots.roof_pitch, fakeCtx);
    }
    if (intent === 'roof.tie_in.set' && slots.roof_tie_in) {
      return parseCommand(slots.roof_tie_in === 'continuous' ? 'continue the same roof plane' :
        slots.roof_tie_in === 'dormer' ? 'add a dormer-style roof' :
        slots.roof_tie_in === 'low-slope' ? 'flat roof section' : 'separate lower roof', fakeCtx);
    }
    if (intent === 'roof.eave.set' && slots.eave_overhang_in) {
      return parseCommand(slots.eave_overhang_in + ' inch overhang', fakeCtx);
    }
    if (intent === 'foundation.type.set' && slots.foundation_type) {
      return parseCommand('use a ' + slots.foundation_type, fakeCtx);
    }
    if (intent === 'room.label.set' && slots.use) {
      return parseCommand('label it ' + slots.use, fakeCtx);
    }

    // Fallback: keep pending
    return result({
      intent_id: intent,
      slots,
      status: 'needs_clarify',
      clarify_question: pending.clarify_question,
      mutation_ops: [{ op: 'noop_clarify' }],
      flags: pending.flags || [],
      confirmation: { title: 'Still need a bit more', body: (pending.clarify_question && pending.clarify_question.prompt) || 'Can you pick one of the options?' },
    });
  }

  /**
   * Map §5 field_id writes onto qaAnswers question ids that build3DStore reads
   */
  function applyFieldToAnswers(answers, fieldId, value) {
    const a = answers;
    switch (fieldId) {
      case 'footprint_l_ft': {
        const cur = Object.assign({}, a.A2a || {});
        cur.l = value; cur.preset = 'custom';
        a.A2a = cur;
        break;
      }
      case 'footprint_w_ft': {
        const cur = Object.assign({}, a.A2a || {});
        cur.w = value; cur.preset = 'custom';
        a.A2a = cur;
        break;
      }
      case 'attach_side':
        a.A2b = value;
        break;
      case 'wall_height_ft': {
        const n = Number(value);
        if (n === 8) a.C12a = '8';
        else if (n === 9) a.C12a = '9';
        else if (n === 10) a.C12a = '10';
        else { a.C12a = 'other'; a.C12a_ft = n; }
        break;
      }
      case 'ceiling_mode': {
        if (value === 'vaulted') a.C12 = 'vaulted';
        else if (value === 'taller') a.C12 = 'taller';
        else if (value === 'unknown') a.C12 = 'unsure';
        else a.C12 = 'flat';
        break;
      }
      case 'connect_type':
        a.C11 = value === 'open' ? 'open' : (value === 'hall' ? 'hall' : 'doorway');
        break;
      case 'roof_pitch': {
        const m = String(value).match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
        if (m) {
          const rise = m[1], run = m[2];
          if (run === '10' && rise === '4') a.F24a = '4_10';
          else if (run === '12') {
            const map = {
              2: 'flat', 3: '3_12', 4: '4_12', 5: '5_12', 6: '6_12',
              7: '7_12', 8: '8_12', 9: '9_12', 10: '10_12', 12: '12_12',
            };
            a.F24a = map[rise] || map[String(Math.round(Number(rise)))] || '4_12';
            if (!map[rise] && !map[String(Math.round(Number(rise)))]) {
              a.F24a = '4_12';
              a.roof_pitch_custom = Number(rise) / Number(run);
            }
          } else {
            a.F24a = '4_12';
            a.roof_pitch_custom = Number(rise) / Number(run);
          }
        } else {
          a.F24a = '4_12';
        }
        break;
      }
      case 'roof_style': {
        const s = String(value || '').toLowerCase();
        a.F24style = s === 'hip' ? 'hip' : 'gable';
        a.roof_style = a.F24style;
        break;
      }
      case 'roof_tie_in':
        a.F24 = value === 'low-slope' ? 'flat' : value;
        break;
      case 'eave_overhang_in': {
        const n = Number(value);
        if (n === 6) a.F24b = '6';
        else if (n === 12) a.F24b = '12';
        else if (n >= 18) { a.F24b = '24'; if (n !== 24) { a.F24b = 'enter'; a.F24b_in = n; } }
        else { a.F24b = 'enter'; a.F24b_in = n; }
        break;
      }
      case 'foundation_type':
        a.E21 = value;
        break;
      case 'pier_height_ft': {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) a.pier_height_ft = n;
        break;
      }
      case 'pier_spacing_ft': {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) a.pier_spacing_ft = n;
        break;
      }
      case 'pier_diameter_in': {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) a.pier_diameter_in = n;
        break;
      }
      case 'pier_count': {
        if (value == null || value === '' || value === 0 || value === '0') {
          delete a.pier_count;
        } else {
          const n = Number(value);
          if (Number.isFinite(n) && n > 0) a.pier_count = Math.round(n);
        }
        break;
      }
      case 'floor_align':
        a.E23 = value;
        break;
      case 'site_grade':
        a.E22 = value;
        break;
      case 'has_large_opening':
        a.D19 = value === 'yes' || value === true ? 'yes' : 'no';
        break;
      case 'large_opening_w_ft': {
        a.D19 = 'yes';
        const n = Number(value);
        if (n < 6) a.D19b = 'u6';
        else if (n <= 8) a.D19b = '6_8';
        else if (n <= 12) a.D19b = '8_12';
        else { a.D19b = 'enter'; a.D19b_ft = n; }
        break;
      }
      case 'open_interior_walls':
        a.D16 = value;
        break;
      case 'door_types': {
        const cur = Array.isArray(a.D17) ? a.D17.slice() : [];
        const v = value === 'entry' ? 'one' : value;
        if (!cur.includes(v) && !cur.includes(value)) cur.push(value === 'entry' ? 'one' : value);
        a.D17 = cur.filter((x) => x !== 'none');
        break;
      }
      case 'window_count_band':
        if (value === 'bump') {
          const cur = a.D18;
          if (cur === 'none' || !cur) a.D18 = '1_2';
          else if (cur === '1_2') a.D18 = '3_5';
          else if (cur === '3_5') a.D18 = '6plus';
        } else {
          a.D18 = value;
        }
        break;
      case 'wall_height_by_side':
        a.wall_height_by_side = Object.assign({}, a.wall_height_by_side || {}, value);
        break;
      case 'project_mode':
        a.A1 = value;
        break;
      default:
        a[fieldId] = value;
    }
  }

  global.HomePlanWizard = {
    parseCommand,
    applyClarifyFill,
    applyFieldToAnswers,
    STARTER_CHIPS,
    DISCLAIMER,
    HELP_TEXT,
    BEARING_CALLOUT,
    LARGE_OPENING_CALLOUT,
    version: '1.0',
  };
})(window);
