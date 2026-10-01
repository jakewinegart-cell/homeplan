**3D openings edit (`?v=edit3d1`):** Restored Add Window/Door place + Delete in 3D after deck1. Grid/deck/stairs/existing-house no longer steal wall taps; camera focuses on addition+decks; inspector Delete + Delete key remove openings.

**Look + roof/truss (`?v=roof4`):** Floor open-web trusses clipped to **addition wall-plate footprint** only (no overshoot past exterior walls; planBounds/existing-house bloat removed). Roof outline = addition **exterior** walls (`additionBounds` + `WALL_THICK`) + modest clamped eave; corners flush with stud/plate outer faces; underside-at-plate (roof3) kept. Prior Look panel (`look1`) cladding/roofing/color controls unchanged. **EXAMPLE.**

**Look (`?v=look1`):** Plan + 3D **Look** panel — cladding (wood / fiber cement / vinyl / brick / stone → `G28` / clad presets), roofing (asphalt / metal / tile / slate → `F25`), roof style (gable / hip → `F24style`), and named siding colors that set `cladding_hex` (tints cladding albedo; Natural keeps the preset). Writes the same Guidance answers so 3D rebuilds immediately. **EXAMPLE.** Guidance stays the source of truth. Does not add pier dials.

**3D / realism (`?v=realism2`):** richer procedural cladding/roofing/foundation/ground + lumber grain (albedo+bump), late-morning sun + fill + interior bounce, soft shadows, fascia/soffit/corner-board cues — still conceptual. Keeps winlook windows, truss2 floor trusses, roof3 plate, edge piers + **piers1** dials, openings1, share1, budget1.

**3D / piers (`?v=piers1`):** editable pier height / spacing / diameter / count · **roof height (`?v=roof3`):** addition roof **underside** at wall line sits on / above top plate (`max` wall `heightFt`); top surface = plate + roof thickness; overhang tip may drop along pitch outside walls. Rise from building half-span; footprint = addition bounds + wall thickness + clamped eave. Pier lift still raises roof with structure. Piers / sonotubes only under **wall edges** (corners + perimeter), never mid-span.


# HomePlan — Remodel & Additions (prototype)

Friendly homeowner-facing remodel / addition planner. Vanilla HTML/CSS/JS — no build step.

**Content:** Remodel Guide **v1.1** (`/workspace/remodel-app-content-v1.md`) via `guide-data.js`  
**REMODEL_GUIDE_HOOK** points at that path.

## How to open

```bash
# Prefer a local server (Three.js ES modules need HTTP, not always file://):
cd /workspace/remodel-app
python3 -m http.server 8765
# visit http://localhost:8765
```

`index.html` may also open directly in some browsers; CDN access is required for Three.js.

## What’s implemented

### Plan (2D) — primary editing
Walls, rooms, windows, **Roof** pitch/style picker, **Existing** house footprint, **Foundation** picker (slab / crawl / basement / **piers · sonotubes**), undo/clear, snap grid, zoom/pan, sidebar props, localStorage save.

### Guidance — Stages A–K
Full Q&A from content v1.1 (types: single / multi / number / yes-no / footprint / opening presets).  
Remodel-only skip map: hide **E**; hide **A2a/A2b**; **F** only if roof changes; exterior doors gated.  
**15 if-then rules** + callouts → recommendations panel.  
3D driver fields: **A1, A2, A2a, A2b, C11, C12, C12a, D16–D19b, E21–E23, F24–F24b**, etc.

### Materials — EXAMPLE ESTIMATES only
17 categories, 8 supplier slots, waste / contingency / labor / tax rollup. Rescales from answers. Every dollar labeled EXAMPLE.

### 3D — live simplified (not a placeholder)
Three.js + OrbitControls (CDN). Rebuilds from the **same plan model** as Save, plus §5 3D store from Guidance (debounced on answer commit).

| Source | Behavior |
|--------|----------|
| Drawn walls/rooms | Sketch **wins** — extrude walls, floors, windows, roofline ridge |
| No sketch + addition | Parametric house box + footprint L×W on attach side |
| Remodel-only, empty plan | Empty state → Plan tab |
| Defaults | 8 ft walls, 4:12 pitch, 12 in eave (chip: “Using defaults”) |

Orbit: drag · zoom: scroll · pan: right-drag.

**3D / studs (`?v=wizard2`):** flush corners via room outline extrude + shared corner posts; dimension sprites (toggle); warmer wall/floor/roof/glass/frame materials; click-drag windows in 3D (syncs to Plan).

**3D / interior (`?v=interior1`):** warmer ceiling/room point fills (capped, auto-dim on narrow screens); finished look when **Studs OFF** — painted liners, ~4 in baseboard, wood floor texture, light ceiling plane, soft wall/floor junction; fixture face polish (cabinet door seams, deeper sink basin, outlet plate contrast). **Shadows** kill-switch unchanged (still auto-off on narrow/low-DPR). **Floor framing / I-beams** toggle — conceptual steel joists under the floor (EXAMPLE ~20 in o.c.); default ON for all foundations (including slab) so I-beams read from above; uncheck to restore finish flooring. Conceptual visualization — not construction docs.

## Files

| Path | Role |
|------|------|
| `index.html` | Shell |
| `styles.css` | UI |
| `floorplan.js` | 2D canvas |
| `guide-data.js` | Q&A, rules, materials, `build3DStore` |
| `view3d.js` | Three.js scene (ES module) |
| `app.js` | Nav, save, wiring |

## Existing house (additions)
- Guidance project type = addition → prompt for existing house L×W (default 40×30).
- Locked muted footprint on Plan (not selectable). Plan tool **House** reopens the prompt.
- Saved with project; shown in 3D as distinct mass.

## 3D realism (`?v=realism2`)

Visible step up from sketch / early P0 massing — still **conceptual** (not CAD / photoreal):

- **Materials:** clapboard/brick/stone courses, asphalt tabs, concrete mottling, lumber grain, grass/gravel ground — procedural canvas albedo + bump (no external texture packs).
- **Lighting:** late-morning warm sun (1 shadow caster), cooler sky fill, warm interior bounce; Shadows toggle (phone auto-off).
- **Detail:** fascia + soffit at eaves, corner boards on clapboard-family cladding, window recess/sill/casing (winlook).
- **Preserved:** studs / floor framing toggles, pier dials, roof3 plate height, openings1, share1, budget1.
- **Disclaimer:** Conceptual visualization — not construction documents.

## Foundation (E21 / piers) — `?v=piers1`
- Plan toolbar **Foundation** (under **Existing**) and 3D **Foundation** button open the same picker as Guidance **E21**.
- Options: slab, crawl space, basement, **Piers / sonotubes** (elevated — also called pylons / pilons), match house. Stored value for piers is always `piers`.
- Selecting updates Guidance answers, persists with Save, and rebuilds 3D (piers raise the addition on sonotubes). **Piers only under wall edges** (corners + along exterior/bearing lines) — never mid-span under open floor; grade beam follows those edge lines.
- **Piers / pylons panel** (`piers1`): when foundation is piers, editable dials for **Height** (`pier_height_ft`, default ~2.5), **Spacing o.c.** (`pier_spacing_ft`, default ~6), **Diameter** (`pier_diameter_in`, default 12 → cylinder radius), and optional **Count** (`pier_count` — blank = spacing-driven; set count to redistribute along wall edges). Shown in the Foundation picker and as a 3D side panel.
- Guidance Section **E** shows when A1 is addition (or both / unsure); remodel-only hides E until Foundation is set from Plan or project type changes. Soft-sets A1 → addition when you pick a foundation type.
- Wizard phrases (`piers`, `sonotubes`, `pylons`, `elevated`) still map to `foundation_type: piers`.

## Walkthrough
- **Walkthrough** tab: printable Build Walkthrough from plan + Guidance (P0–P9).
- Includes **Permit callouts**, **Materials order**, **Day-by-day** sequence.
- Print / Save PDF via browser. Disclaimers on screen and print.

## Mobile
- Plan canvas uses **CSS-pixel** pointer mapping (fixes HiDPI / phone DPR miss).
- `touch-action: none` + `preventDefault` on draw gestures; **one finger draws**, **two fingers pan/pinch**.
- Default tool is **Room**; empty tip **Start drawing** selects Room and dismisses the tip.
- **Done** (toolbar + floating) finishes wall chains and rooflines (no Enter/double-tap required).
- Try on phone: open Plan → tap **Existing** to place the old house → **Start drawing** (or Room) → finger-drag a rectangle → **Wall** / **Window** as needed → **Roof** for pitch & style (gable/hip) → **Foundation** for slab / crawl / **piers · sonotubes**.

## Network note
Three.js loads from `cdn.jsdelivr.net` via import map. Offline = 3D tab won’t render.


### Remodel Guide (Structure Wizard)
- Slide-over **Remodel Guide** from the topbar **Guide** button or the floating **Remodel Guide** FAB (Plan / 3D / anywhere).
- Natural-language commands (rule/keyword parser — no LLM): footprint, attach side, wall heights, walls, doors/windows/large openings, roof, foundation, room labels, undo/help.
- Flow: parse → optional one clarify (chips) → confirmation sheet → **Apply** / Cancel.
- Mutations write the same §5 `field_id`s as Guidance + plan geometry; one undo group per Apply.
- Safety: confirm for destructive / `must_hire_pro`; refuses beam sizing, permit filing, fake bids; addition-only soft-refuse in remodel mode.
- Files: `wizard-data.js` (catalog + parser), wired in `app.js` / `styles.css` / `index.html`; floorplan mutation helpers in `floorplan.js`.

## Still placeholder / next
- Real supplier APIs  
- Real share hosting  
- Richer cladding/roof textures (optional color presets only in v1)  
- Photoreal interiors / full PBR (interior P0 is readable massing only)
