/**
 * Build Walkthrough generator — from remodel-app-walkthrough-feature-v1.md
 * REMODEL_GUIDE_HOOK / WALKTHROUGH: /workspace/remodel-app-walkthrough-feature-v1.md
 */
(function (global) {
  'use strict';

  const CAT = [
    '', 'Foundation', 'Framing lumber', 'Sheathing', 'Fasteners & hardware', 'Roofing',
    'Windows & doors', 'Exterior cladding & trim', 'Weather barrier & flashing', 'Insulation',
    'Drywall', 'Flooring', 'Interior trim & doors', 'Paint & finishes',
    'Plumbing fixtures & allowances', 'Electrical allowances', 'HVAC allowances', 'Misc allowances',
  ];

  function S(a, id) {
    const v = a[id];
    return Array.isArray(v) ? v[0] : (v || null);
  }
  function M(a, id) {
    const v = a[id];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }
  function hasAny(a, id, opts) {
    return M(a, id).some((x) => opts.includes(x));
  }

  function deriveContext(answers, plan, store) {
    const a = answers || {};
    const st = store || (global.HomePlanGuide && global.HomePlanGuide.build3DStore(a)) || {};
    const mode = st.project_mode || S(a, 'A1') || 'addition';
    const remodel = mode === 'remodel';
    const additionish = mode === 'addition' || mode === 'both' || mode === 'detached' || mode === 'unsure';
    const wet = hasAny(a, 'A3', ['bathroom', 'kitchen', 'laundry']);
    const roofOn = !remodel || ['yes', 'unsure'].includes(S(a, 'F0'));
    const area = (st.footprint_l_ft || 12) * (st.footprint_w_ft || 16);
    const rooms = M(a, 'A3').map((id) => {
      const map = { bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living',
        office: 'Office', laundry: 'Laundry', mudroom: 'Mudroom', other: 'Other' };
      return map[id] || id;
    });
    if (plan && plan.rooms) {
      plan.rooms.forEach((r) => { if (r.name && !rooms.includes(r.name)) rooms.push(r.name); });
    }
    const winCount = st.window_count != null ? st.window_count : 3;
    let doorCount = 0;
    const doors = M(a, 'D17');
    if (doors.includes('one_entry')) doorCount = 1;
    if (doors.includes('two_plus')) doorCount = 2;
    if (doors.includes('sliding') || doors.includes('french')) doorCount = Math.max(doorCount, 1);
    if (!doors.length && additionish) doorCount = 1;
    if (doors.includes('none')) doorCount = 0;
    const planWins = plan && plan.windows ? plan.windows.length : 0;
    const openingsSummary = st.has_large_opening
      ? `a large opening (~${st.large_opening_w_ft || 8} ft wide)`
      : 'standard door/window openings';

    const tokens = {
      project_label: mode === 'remodel' ? 'remodel' : mode === 'both' ? 'addition + remodel' : 'attached addition',
      footprint_l_ft: st.footprint_l_ft || 12,
      footprint_w_ft: st.footprint_w_ft || 16,
      wall_height_ft: st.wall_height_ft || 8,
      roof_pitch: st.roof_pitch ? `${Math.round(st.roof_pitch * 12)}:12` : '4:12',
      attach_side: st.attach_side || 'back',
      foundation_type: ({ slab: 'slab', crawl: 'crawl space', basement: 'basement', piers: 'piers / sonotubes' })[st.foundation_type] || (st.foundation_type || 'slab'),
      roof_tie_in: st.roof_tie_in || 'separate',
      room_list: rooms.length ? rooms.join(', ') : 'your spaces',
      window_count: planWins || winCount,
      door_count: doorCount,
      area_sqft: Math.round(area),
      ceiling_mode: st.ceiling_mode || 'flat',
      eave_overhang_in: st.eave_overhang_in != null ? st.eave_overhang_in : 12,
      connect_type: st.connect_type || 'doorway',
      floor_align_phrase: st.floor_align === 'no' ? 'step up/down from the house (confirm on site)' : 'match the existing house floor when possible',
      site_grade: st.site_grade || 'flat',
      opening_summary: openingsSummary,
      roofing_label: ({ asphalt: 'asphalt shingles', metal: 'metal', tile: 'tile', slate: 'slate', match: 'match existing' })[st.roofing_texture] || 'match existing',
      finish_level: ({ budget: 'budget-friendly', mid: 'mid-range', high: 'higher-end', mix: 'mixed' })[S(a, 'H30')] || 'mid-range',
      flooring: ({ lvp: 'LVP', hardwood: 'hardwood', engineered: 'engineered wood', carpet: 'carpet', tile: 'tile', match: 'match existing' })[S(a, 'H31')] || 'your chosen flooring',
      hvac_path: ({ extend: 'extend existing HVAC', minisplit: 'mini-split / ductless', baseboard: 'electric baseboard', unsure: 'TBD with an HVAC pro', no_change: 'no HVAC change expected' })[S(a, 'I35')] || 'TBD with an HVAC pro',
    };

    return {
      answers: a, plan: plan || {}, store: st, mode, remodel, additionish, wet, roofOn,
      tokens, defaultsUsed: st.usingDefaults || [],
    };
  }

  function fill(tpl, tokens) {
    return String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) => (tokens[k] != null ? tokens[k] : '—'));
  }

  function includeStep(id, ctx) {
    const { remodel, additionish, wet, roofOn, store: st, answers: a } = ctx;
    switch (id) {
      case 'WT_PREP_01': return true;
      case 'WT_PREP_02': return additionish || ['yes', 'unsure'].includes(S(a, 'B9'));
      case 'WT_PREP_03': return ['yes', 'partial'].includes(S(a, 'J40')) || additionish;
      case 'WT_FND_01':
      case 'WT_FND_02':
      case 'WT_FND_03': return additionish;
      case 'WT_FND_04': return remodel;
      case 'WT_FRM_01': return additionish && ['crawl', 'basement', 'piers'].includes(st.foundation_type);
      case 'WT_FRM_02': return additionish || ['yes', 'maybe'].includes(S(a, 'D16'));
      case 'WT_FRM_03': return additionish || ['yes', 'maybe'].includes(S(a, 'D16'));
      case 'WT_FRM_04': return st.has_large_opening || ['yes', 'maybe'].includes(S(a, 'D16'));
      case 'WT_ROOF_01':
      case 'WT_ROOF_03': return roofOn && (additionish || remodel);
      case 'WT_ROOF_02': return additionish || roofOn;
      case 'WT_WRB_01': return additionish || roofOn || S(a, 'D17b') === 'yes';
      case 'WT_OPEN_01': return (ctx.tokens.window_count > 0) || (ctx.tokens.door_count > 0);
      case 'WT_EXT_01': return additionish || S(a, 'D17b') === 'yes';
      case 'WT_MEP_01': return wet || S(a, 'I37') === 'new';
      case 'WT_MEP_02': return true;
      case 'WT_MEP_03': return S(a, 'I35') !== 'no_change';
      case 'WT_INS_01':
      case 'WT_DRY_01':
      case 'WT_FIN_01':
      case 'WT_DONE_01': return true;
      default: return true;
    }
  }

  const STEPS = [
    { id: 'WT_PREP_01', phase: '0', phaseTitle: 'Before you dig / open walls', title: 'Confirm your plans and local rules',
      body: 'Before anyone digs or opens walls for your {{project_label}}, make sure you have a clear plan set (even a good sketch reviewed by a pro) and you know what your city or county requires. This walkthrough is a homeowner guide for your drawn layout (~{{area_sqft}} sq ft mindset) — not approved construction documents.',
      watch_outs: [{ tone: 'awareness', text: 'App does not file permits or approve plans.' }, { tone: 'warning', text: 'Illustrative only — follow your approved plans when you have them.' }],
      dont_proceed_until: ['You know whether permits are required for this scope (see Permit callouts).', 'You are not treating this as engineered drawings.'],
      materials_refs: [], diagram_type: 'sequence_flow' },
    { id: 'WT_PREP_02', phase: '0', phaseTitle: 'Before you dig / open walls', title: 'Call 811 before digging',
      body: 'If any digging or foundation work is ahead, call 811 so underground utilities can be marked. Free in most areas. Do this even if you “think” nothing is there.',
      watch_outs: [{ tone: 'warning', text: 'Utility strikes are dangerous and expensive.' }],
      dont_proceed_until: ['811 locate completed or scheduled before excavation.'],
      materials_refs: [17], diagram_type: 'none' },
    { id: 'WT_PREP_03', phase: '0', phaseTitle: 'Before you dig / open walls', title: 'Protect living spaces and paths',
      body: 'If you will live in the home during work, plan dust barriers, temporary entries, and where materials will stage. Tight access may mean smaller deliveries and more hand-carrying.',
      watch_outs: [{ tone: 'tip', text: 'Occupied remodels need extra temporary protection.' }],
      dont_proceed_until: [], materials_refs: [17], diagram_type: 'plan_footprint' },
    { id: 'WT_FND_01', phase: '1', phaseTitle: 'Layout, excavation, foundation', title: 'Mark the addition footprint',
      body: 'Layout the {{footprint_l_ft}} ft × {{footprint_w_ft}} ft footprint on the {{attach_side}} of the house. Square the corners; confirm it matches your drawn plan. Finished floor should {{floor_align_phrase}}.',
      watch_outs: [{ tone: 'awareness', text: 'Do not assume setbacks — verify with your local rules / survey as required.' }],
      dont_proceed_until: ['Footprint matches approved/intended plan.', '811 clearance if excavating.'],
      materials_refs: [1, 17], diagram_type: 'plan_footprint' },
    { id: 'WT_FND_02', phase: '1', phaseTitle: 'Layout, excavation, foundation', title: 'Excavate for your foundation type',
      body: 'Your answers point to a {{foundation_type}} approach on {{site_grade}} ground. Digging depth, forms, and drainage differ a lot by type and frost line — local practice and your plans win.',
      watch_outs: [{ tone: 'warning', text: 'Steep slopes and basement ties often need engineering.' }, { tone: 'example', text: 'EXAMPLE materials quantities are not a soils report.' }],
      dont_proceed_until: ['Foundation approach confirmed for your site.'],
      materials_refs: [1], diagram_type: 'foundation_section' },
    { id: 'WT_FND_03', phase: '1', phaseTitle: 'Layout, excavation, foundation', title: 'Build footings and floor system',
      body: 'Place footings / slab / crawl stem walls per your plans. Include vapor barrier and anchor bolts where required. Match existing floor height when you chose “match.”',
      watch_outs: [{ tone: 'warning', text: 'Concrete work is hard to undo — verify dimensions before the truck arrives.' }],
      dont_proceed_until: ['Inspection hold points from your permit (if any) are satisfied.'],
      materials_refs: [1, 4], diagram_type: 'foundation_section' },
    { id: 'WT_FND_04', phase: '1', phaseTitle: 'Layout, excavation, foundation', title: 'Remodel path — skip new foundation',
      body: 'You’re remodeling existing space, so this walkthrough skips new excavation and foundation. Focus on protection, selective demo, and openings in existing walls.',
      watch_outs: [], dont_proceed_until: [], materials_refs: [17], diagram_type: 'plan_footprint' },
    { id: 'WT_FRM_01', phase: '2', phaseTitle: 'Floor & wall framing', title: 'Frame the floor',
      body: 'For crawl or basement additions, install posts/beams/joists and subfloor so the new floor lands at the planned height. Slab-on-grade projects skip joist framing and move to walls on the slab.',
      watch_outs: [{ tone: 'tip', text: 'Joist direction and hangers matter — follow plans.' }],
      dont_proceed_until: ['Floor plane is flat, square, and aligned to house floor as intended.'],
      materials_refs: [2, 3, 4], diagram_type: 'floor_framing' },
    { id: 'WT_FRM_02', phase: '2', phaseTitle: 'Floor & wall framing', title: 'Stand exterior and interior walls',
      body: 'Frame walls to about {{wall_height_ft}} ft plate height (your ceiling mode: {{ceiling_mode}}). Place openings where your plan shows doors and windows. Use PT sill plates where required on concrete.',
      watch_outs: [{ tone: 'warning', text: 'Do not cut existing house framing until load path is confirmed.' }],
      dont_proceed_until: ['Walls plumbed and braced.', 'Opening locations match plan.'],
      materials_refs: [2, 3, 4], diagram_type: 'plan_footprint' },
    { id: 'WT_FRM_03', phase: '2', phaseTitle: 'Floor & wall framing', title: 'Tie into the existing house wall',
      body: 'Where the addition meets the {{attach_side}} wall, connection type is {{connect_type}}. Opening a load-bearing wall usually needs a header or beam sized by a pro — confirm before cutting.',
      watch_outs: [{ tone: 'must_hire_pro', text: 'MUST-HIRE-PRO territory for structural headers/beams.' }, { tone: 'warning', text: 'Waterproofing the joint later is as critical as the structure.' }],
      dont_proceed_until: ['Structural approach for the opening is confirmed.'],
      materials_refs: [2, 4], diagram_type: 'wall_attach' },
    { id: 'WT_FRM_04', phase: '2', phaseTitle: 'Floor & wall framing', title: 'Frame headers and wide openings',
      body: 'You indicated {{opening_summary}}. Wide openings almost always need engineered headers. Install king/jack studs and headers per plans — do not guess sizes from this guide.',
      watch_outs: [{ tone: 'example', text: 'EXAMPLE lumber lines are not engineering.' }, { tone: 'must_hire_pro', text: 'Hire a licensed pro to size headers/beams.' }],
      dont_proceed_until: ['Header sizes from plans/engineer are on site.'],
      materials_refs: [2, 4], diagram_type: 'opening_schedule' },
    { id: 'WT_ROOF_01', phase: '3', phaseTitle: 'Roof, sheathing, weather barrier', title: 'Frame and tie in the roof',
      body: 'Roof meets the house as {{roof_tie_in}} at about {{roof_pitch}} pitch, with roughly {{eave_overhang_in}} in overhang. Transitions and low-slope areas are leak-risk zones — flashing details matter more than pretty shingles.',
      watch_outs: [{ tone: 'warning', text: 'Separate or flat/low-slope tie-ins need excellent membranes and flashing.' }],
      dont_proceed_until: ['Roof framing matches intended tie-in.'],
      materials_refs: [2, 3, 5, 8], diagram_type: 'roof_flashing' },
    { id: 'WT_ROOF_02', phase: '3', phaseTitle: 'Roof, sheathing, weather barrier', title: 'Sheathe walls and roof',
      body: 'Install wall and roof sheathing to square and stiffen the shell. Nail schedules follow your plans/local practice — not this handout.',
      watch_outs: [], dont_proceed_until: ['Sheathing complete at weather-exposed faces before long wet forecasts if possible.'],
      materials_refs: [3, 4], diagram_type: 'sequence_flow' },
    { id: 'WT_WRB_01', phase: '3', phaseTitle: 'Roof, sheathing, weather barrier', title: 'Weather barrier and opening flashing',
      body: 'Under the siding, install housewrap (WRB) and flash every window and door in shingle fashion. Kickout flashing where roof meets wall keeps water out of the wall. Skipping this is a common costly mistake.',
      watch_outs: [{ tone: 'tip', text: 'Integrate WRB with window flanges per manufacturer instructions.' }],
      dont_proceed_until: ['All rough openings flashed before cladding.'],
      materials_refs: [8, 6], diagram_type: 'wrb_sequence' },
    { id: 'WT_ROOF_03', phase: '3', phaseTitle: 'Roof, sheathing, weather barrier', title: 'Roof underlayment and finish roofing',
      body: 'Dry-in with underlayment, then finish roofing (your preference: {{roofing_label}}). Extend or add gutters so water runs away from the foundation.',
      watch_outs: [{ tone: 'warning', text: 'Do not trap moisture against the existing house roof without proper step flashing.' }],
      dont_proceed_until: ['Weather-tight roof dry-in achieved for the new area.'],
      materials_refs: [5, 8], diagram_type: 'roof_flashing' },
    { id: 'WT_OPEN_01', phase: '4', phaseTitle: 'Windows, doors, exterior cladding', title: 'Set windows and exterior doors',
      body: 'Install about {{window_count}} window(s) and {{door_count}} exterior door(s) per your plan/schedule. Typical defaults if sizes unset: entry 3×7 ft, windows 3×4 ft. Shim plumb; complete flashing; foam/seal air gaps.',
      watch_outs: [{ tone: 'tip', text: 'Special-order sizes have long lead times — order early (see Materials order).' }],
      dont_proceed_until: ['Units on site and flashing complete.'],
      materials_refs: [6, 8], diagram_type: 'opening_schedule' },
    { id: 'WT_EXT_01', phase: '4', phaseTitle: 'Windows, doors, exterior cladding', title: 'Hang exterior cladding and trim',
      body: 'Clad to match your exterior goal. Integrate with WRB; don’t punch holes that bypass flashing. Masonry veneers often need specialty installers and longer lead times.',
      watch_outs: [{ tone: 'tip', text: 'Matching brick/stone is specialty work.' }],
      dont_proceed_until: ['WRB and openings complete behind cladding.'],
      materials_refs: [7, 8], diagram_type: 'wrb_sequence' },
    { id: 'WT_MEP_01', phase: '5', phaseTitle: 'Rough-ins (MEP awareness)', title: 'Plumbing rough-in for wet areas',
      body: 'Bath/kitchen/laundry in scope ({{room_list}}). Run supply/drain/vent per plan. Drains need proper slope and venting — licensed plumbing is typical and often required.',
      watch_outs: [{ tone: 'must_hire_pro', text: 'MUST-HIRE-PRO for most new plumbing.' }],
      dont_proceed_until: ['Rough inspection (if permitted job) passed before cover-up.'],
      materials_refs: [14], diagram_type: 'plan_footprint' },
    { id: 'WT_MEP_02', phase: '5', phaseTitle: 'Rough-ins (MEP awareness)', title: 'Electrical rough-in',
      body: 'Lights, outlets, and any new circuits. Panel upgrades are common critical-path items. Licensed electrician + permit are typical — don’t guess panel capacity.',
      watch_outs: [{ tone: 'must_hire_pro', text: 'MUST-HIRE-PRO for service/panel/circuit work.' }],
      dont_proceed_until: ['Rough electrical inspection as required before insulation/drywall.'],
      materials_refs: [15], diagram_type: 'none' },
    { id: 'WT_MEP_03', phase: '5', phaseTitle: 'Rough-ins (MEP awareness)', title: 'Heating & cooling rough-in',
      body: 'Your path: {{hvac_path}}. Have capacity checked before closing ceilings. Mini-splits need wall openings and condensate planning.',
      watch_outs: [{ tone: 'must_hire_pro', text: 'MUST-HIRE-PRO for refrigerant/gas furnace work.' }],
      dont_proceed_until: ['Equipment locations and duct/line routes agreed.'],
      materials_refs: [16], diagram_type: 'none' },
    { id: 'WT_INS_01', phase: '6', phaseTitle: 'Insulation → drywall → finishes', title: 'Insulate walls and ceiling',
      body: 'Install insulation after MEP rough-ins and required inspections. Vaulted ceilings change insulation details — don’t leave cold spots at the plate.',
      watch_outs: [{ tone: 'awareness', text: 'Match climate-zone practice; this guide is not an energy code calcsheet.' }],
      dont_proceed_until: ['MEP rough-ins inspected/approved as required.'],
      materials_refs: [9], diagram_type: 'sequence_flow' },
    { id: 'WT_DRY_01', phase: '6', phaseTitle: 'Insulation → drywall → finishes', title: 'Hang and finish drywall',
      body: 'Hang drywall (moisture-resistant in baths). Tape/finish to your finish level ({{finish_level}}).',
      watch_outs: [], dont_proceed_until: ['Insulation and any vapor/air details complete as planned.'],
      materials_refs: [10], diagram_type: 'none' },
    { id: 'WT_FIN_01', phase: '6', phaseTitle: 'Insulation → drywall → finishes', title: 'Floors, paint, trim, and fixtures',
      body: 'Install flooring ({{flooring}}), paint, interior doors/trim, then set fixtures. In wet rooms use the right underlayment and waterproofing membranes under tile.',
      watch_outs: [{ tone: 'warning', text: 'Wet-room failures are usually water management, not just tile choice.' }],
      dont_proceed_until: ['Paint-ready surfaces cured as needed.'],
      materials_refs: [11, 12, 13, 14], diagram_type: 'sequence_flow' },
    { id: 'WT_DONE_01', phase: '6', phaseTitle: 'Insulation → drywall → finishes', title: 'Weather-tight and finish checklist',
      body: 'Confirm roof dry-in, WRB/cladding integrations, flashed openings, exterior doors operable, water directed away from foundation, and interior finishes complete for your scope. Keep a punch list.',
      watch_outs: [{ tone: 'awareness', text: 'Final inspections (if any) are between you, your builder, and the building department — not this app.' }],
      dont_proceed_until: ['Punch list reviewed.'],
      materials_refs: [8, 17], diagram_type: 'sequence_flow' },
  ];

  function buildPermitCallouts(ctx) {
    const blocks = [];
    blocks.push({ id: 'PERMIT_ALWAYS', title: 'Permits are between you and your local building department',
      body: 'Most attached additions and many bathroom/kitchen remodels need permits and inspections. This app does not file permits, pull fees, or talk to your city for you. Use your answers as a checklist of what to ask the building department or your builder.',
      tone: 'awareness' });
    if (ctx.additionish) {
      blocks.push({ id: 'PERMIT_ADDITION', title: 'Additions usually need permits',
        body: 'A new footprint, foundation, and roof tie-in almost always trigger building permits. Ask about setbacks, foundation, structural, energy, and inspection hold points before you dig or order concrete.',
        tone: 'awareness' });
    }
    if (ctx.remodel || ctx.mode === 'both') {
      blocks.push({ id: 'PERMIT_REMODEL', title: 'Remodels can still need permits',
        body: 'Opening walls, new plumbing, new electrical circuits, or changing the exterior often needs permits even without a new foundation. When unsure, call the building department with your scope list.',
        tone: 'awareness' });
    }
    if (ctx.wet) {
      blocks.push({ id: 'PERMIT_WET', title: 'Wet rooms',
        body: 'New supply/drain lines and bathroom remodels commonly need plumbing permits and inspections before cover-up.',
        tone: 'awareness' });
    }
    if (['circuits', 'panel', 'unsure'].includes(S(ctx.answers, 'I36'))) {
      blocks.push({ id: 'PERMIT_ELEC', title: 'Electrical',
        body: 'New circuits or panel work typically require a licensed electrician and electrical permit.',
        tone: 'must_hire_pro' });
    }
    if (ctx.store.has_large_opening || ['yes', 'maybe'].includes(S(ctx.answers, 'D16'))) {
      blocks.push({ id: 'PERMIT_STRUCT', title: 'Structural changes',
        body: 'Removing walls or cutting wide openings may need plans reviewed for structure. This walkthrough does not size beams.',
        tone: 'must_hire_pro' });
    }
    const a5 = S(ctx.answers, 'A5');
    let status = 'Check with your city/county before buying materials or opening walls.';
    if (a5 === 'have') status = 'Keep your approved drawings on site; this walkthrough does not replace them.';
    if (a5 === 'will_pull') status = 'Align this step list with your builder’s inspection schedule.';
    blocks.push({ id: 'PERMIT_STATUS_HOOK', title: 'Based on your permit answer', body: status, tone: 'awareness' });
    return blocks;
  }

  function buildMaterialsOrder(ctx) {
    const groups = [
      { id: 'BUY_SITE', label: '1 · Site & protection', cats: [17], skip: false, note: 'Dumpster, protection, layout stakes; 811 is free.' },
      { id: 'BUY_FOUNDATION', label: '2 · Foundation', cats: [1, 4], skip: ctx.remodel, note: 'Skip if remodel-only.' },
      { id: 'BUY_FRAMING', label: '3 · Framing & sheathing', cats: [2, 3, 4], skip: false, note: 'Headers/LVL are allowances — verify sizes with plans.' },
      { id: 'BUY_WEATHER', label: '4 · Roofing & weather barrier', cats: [5, 8], skip: ctx.remodel && !ctx.roofOn, note: 'Order flashing kits early.' },
      { id: 'BUY_OPENINGS', label: '5 · Windows & doors', cats: [6], skip: false, note: 'Long lead — order after rough sizes confirmed.' },
      { id: 'BUY_CLADDING', label: '6 · Exterior cladding', cats: [7], skip: false, note: 'After WRB plan; masonry → specialty.' },
      { id: 'BUY_MEP', label: '7 · MEP allowances', cats: [14, 15, 16], skip: false, note: 'Pros often procure — EXAMPLE only.', mustHire: true },
      { id: 'BUY_INSUL_DRY', label: '8 · Insulation & drywall', cats: [9, 10], skip: false, note: 'After rough-in inspections.' },
      { id: 'BUY_FINISH', label: '9 · Finishes', cats: [11, 12, 13, 14], skip: false, note: 'Wet-area membranes with flooring/tile.' },
    ];
    return groups.filter((g) => !g.skip).map((g) => ({
      ...g,
      categories: g.cats.map((id) => ({ id, name: CAT[id] || ('Category ' + id) })),
    }));
  }

  function buildDaySequence(ctx) {
    const area = ctx.tokens.area_sqft;
    const stretch = area > 400 ? 1.35 : area > 200 ? 1.1 : area < 150 ? 0.85 : 1;
    const bands = [];
    const add = (id, label, start, end, maps, flags) => {
      bands.push({
        id, label,
        span: `Day ${Math.max(1, Math.round(start * stretch))}–${Math.round(end * stretch)}`,
        maps, flags: flags || [],
      });
    };
    add('DAY_PREP', 'Prep, locates, protection', 1, 2, 'WT_PREP_*', ['example']);
    if (ctx.additionish) {
      add('DAY_LAYOUT_DIG', 'Layout & excavation', 2, 4, 'WT_FND_01–02', ['example']);
      const fEnd = ctx.store.foundation_type === 'basement' ? 10 : ctx.store.foundation_type === 'crawl' ? 8 : 7;
      add('DAY_FOUNDATION', 'Footings / slab / stem walls', 3, fEnd, 'WT_FND_03', ['example', 'awareness']);
    }
    add('DAY_FLOOR_WALL', 'Floor (if any) & wall framing', 5, 10, 'WT_FRM_*', ['example']);
    if (ctx.roofOn) add('DAY_ROOF_DRYIN', 'Roof framing, sheathing, dry-in', 8, 14, 'WT_ROOF_*', ['example']);
    add('DAY_WRB_OPENINGS', 'WRB, windows/doors', 12, 16, 'WT_WRB_01, WT_OPEN_01', ['example']);
    if (ctx.additionish || S(ctx.answers, 'D17b') === 'yes') add('DAY_CLAD', 'Cladding', 15, 18, 'WT_EXT_01', ['example']);
    add('DAY_MEP_ROUGH', 'Plumbing / electrical / HVAC rough', 14, 20, 'WT_MEP_*', ['example', 'must_hire_pro']);
    add('DAY_INSPECT_BUFFER', 'Inspection / fix buffer', 20, 23, '—', ['awareness', 'example']);
    add('DAY_INSUL_DRY', 'Insulation & drywall', 18, 25, 'WT_INS_01, WT_DRY_01', ['example']);
    add('DAY_FINISH', 'Floors, paint, trim, fixtures', 24, 35, 'WT_FIN_01', ['example']);
    add('DAY_PUNCH', 'Punch & weather-tight check', 35, 38, 'WT_DONE_01', ['example']);
    return bands;
  }

  function generate(answers, plan) {
    const guide = global.HomePlanGuide;
    const store = guide ? guide.build3DStore(answers || {}) : {};
    const ctx = deriveContext(answers, plan, store);
    const steps = STEPS.filter((s) => includeStep(s.id, ctx)).map((s) => ({
      ...s,
      body: fill(s.body, ctx.tokens),
      materials_names: (s.materials_refs || []).map((id) => CAT[id]).filter(Boolean),
    }));
    const phases = [];
    steps.forEach((s) => {
      let p = phases.find((x) => x.id === s.phase);
      if (!p) { p = { id: s.phase, title: s.phaseTitle, steps: [] }; phases.push(p); }
      p.steps.push(s);
    });

    let materials = null;
    try {
      if (guide && guide.buildMaterials) materials = guide.buildMaterials(answers || {});
    } catch (_) {}

    return {
      generatedAt: new Date().toISOString(),
      sourcePath: '/workspace/remodel-app-walkthrough-feature-v1.md',
      ctx,
      tokens: ctx.tokens,
      defaultsUsed: ctx.defaultsUsed,
      phases,
      steps,
      permit: buildPermitCallouts(ctx),
      materialsOrder: buildMaterialsOrder(ctx),
      daySequence: buildDaySequence(ctx),
      materials,
      disclaimer: 'Illustrative homeowner guide based on your answers and drawing. Not sealed engineering, not a permit package, not a bid. Prices and day bands are EXAMPLE ESTIMATES. App does not file permits or hire contractors.',
    };
  }

  global.HomePlanWalkthrough = { generate, CAT };
})(window);
