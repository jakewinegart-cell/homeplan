/**
 * Remodel Guide structured content v1.1
 * REMODEL_GUIDE_HOOK: /workspace/remodel-app-content-v1.md
 */
(function (global) {
  'use strict';

  const STAGES = [
    {
      id: 'A', title: 'Project type & scope',
      questions: [
        { id: 'A1', prompt: 'What kind of project are you planning?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'addition', label: 'Attached room addition' },
            { id: 'remodel', label: 'Remodel existing rooms only' },
            { id: 'both', label: 'Addition + remodel of existing space' },
            { id: 'detached', label: 'Detached structure (garage/ADU — v1 focuses on attached; flagged for later)' },
            { id: 'unsure', label: 'Not sure yet' },
          ] },
        { id: 'A2', prompt: 'Roughly how big is the new or remodeled space?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'u100', label: 'Under 100 sq ft' },
            { id: '100_200', label: '100–200 sq ft' },
            { id: '200_400', label: '200–400 sq ft' },
            { id: '400_600', label: '400–600 sq ft' },
            { id: 'o600', label: 'Over 600 sq ft' },
            { id: 'enter', label: 'I’ll enter square feet' },
          ],
          number_followup: { id: 'A2_sqft', prompt: 'Enter approximate square feet', when: 'enter' } },
        { id: 'A2a', prompt: 'What are the approximate length and width of the addition footprint?',
          help_text: 'Length is usually along the house wall; width is how far the addition sticks out.',
          answer_type: 'footprint', required: true, driver3d: true, additionOnly: true,
          presets: [
            { id: '10x12', l: 10, w: 12, label: '10×12 ft' },
            { id: '12x14', l: 12, w: 14, label: '12×14 ft' },
            { id: '12x16', l: 12, w: 16, label: '12×16 ft' },
            { id: '14x20', l: 14, w: 20, label: '14×20 ft' },
            { id: 'custom', label: 'Custom' },
          ] },
        { id: 'A2b', prompt: 'Which side of the house will the addition attach to?', answer_type: 'single', required: true, driver3d: true, additionOnly: true,
          options: [
            { id: 'back', label: 'Back of house' },
            { id: 'left', label: 'Left side' },
            { id: 'right', label: 'Right side' },
            { id: 'front', label: 'Front' },
            { id: 'corner', label: 'Corner (wraps two sides)' },
            { id: 'unsure', label: 'Not sure yet' },
          ] },
        { id: 'A3', prompt: 'What will the space mainly be used for?', answer_type: 'multi', required: true,
          options: [
            { id: 'bedroom', label: 'Bedroom' }, { id: 'bathroom', label: 'Bathroom' },
            { id: 'kitchen', label: 'Kitchen / kitchenette' }, { id: 'living', label: 'Living / family room' },
            { id: 'office', label: 'Home office' }, { id: 'laundry', label: 'Laundry' },
            { id: 'mudroom', label: 'Mudroom / entry' }, { id: 'other', label: 'Other' },
          ],
          free_text_followup: { id: 'A3_other_text', when: 'other', prompt: 'Describe the use' } },
        { id: 'A4', prompt: 'Do you already have sketches, architect drawings, or a builder’s plan?', answer_type: 'single', required: false,
          options: [
            { id: 'pro', label: 'Yes — professional plans' },
            { id: 'sketch', label: 'Yes — rough sketch only' },
            { id: 'none', label: 'No — starting from scratch' },
          ] },
        { id: 'A5', prompt: 'Permits: where are you with approvals?', help_text: 'This app does not file permits.', answer_type: 'single', required: true,
          options: [
            { id: 'have', label: 'Already have permits' },
            { id: 'will_pull', label: 'Will pull permits myself / with my builder' },
            { id: 'unsure', label: 'Not sure what’s required' },
            { id: 'will_check', label: 'Planning to check with my city/county' },
          ] },
      ],
    },
    {
      id: 'B', title: 'Site & existing house',
      questions: [
        { id: 'B6', prompt: 'About how old is the house?', answer_type: 'single', required: true,
          options: [
            { id: 'pre1950', label: 'Pre-1950' }, { id: '1950_1979', label: '1950–1979' },
            { id: '1980_1999', label: '1980–1999' }, { id: '2000', label: '2000–present' },
            { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'B7', prompt: 'What is the main exterior wall material?', answer_type: 'single', required: true, driver3d: 'texture',
          options: [
            { id: 'wood', label: 'Wood siding / clapboard' }, { id: 'fiber', label: 'Fiber cement' },
            { id: 'vinyl', label: 'Vinyl' }, { id: 'brick', label: 'Brick' },
            { id: 'stucco', label: 'Stucco' }, { id: 'stone', label: 'Stone veneer' },
            { id: 'mixed', label: 'Mixed / not sure' },
          ] },
        { id: 'B8', prompt: 'Is there clear access for materials and equipment (truck, dumpster, concrete)?', answer_type: 'single', required: true,
          options: [
            { id: 'easy', label: 'Easy driveway/side access' }, { id: 'tight', label: 'Tight / alley only' },
            { id: 'steep', label: 'Steep slope or limited access' }, { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'B9', prompt: 'Any known underground utilities or septic near the work area?', answer_type: 'yes_no', required: false,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
        { id: 'B10', prompt: 'Flood zone, HOA, or historic-district rules that apply?', answer_type: 'multi', required: false,
          options: [
            { id: 'flood', label: 'Flood / special hazard zone' }, { id: 'hoa', label: 'HOA design rules' },
            { id: 'historic', label: 'Historic district' }, { id: 'none', label: 'None that I know of' },
            { id: 'unsure', label: 'Not sure' },
          ] },
      ],
    },
    {
      id: 'C', title: 'Rooms & layout intent',
      questions: [
        { id: 'C11', prompt: 'How will the new or remodeled space connect to the house?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'open_wall', label: 'Open to an existing room (remove or open a wall)' },
            { id: 'doorway', label: 'Through a new or existing doorway only' },
            { id: 'hallway', label: 'Hallway connection' },
            { id: 'separate', label: 'Mostly separate with a door' },
            { id: 'remodel_only', label: 'Remodel only — no new connection' },
          ] },
        { id: 'C12', prompt: 'Ceiling height preference for the new/changed space?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'match8', label: 'Match existing (~8 ft common)' },
            { id: 'taller', label: 'Taller than existing' },
            { id: 'vaulted', label: 'Vaulted / cathedral' },
            { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'C12a', prompt: 'Wall / ceiling height in feet (flat ceiling)?', help_text: 'For vaulted spaces this is still the wall (eave) height.',
          answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: '8', label: '8 ft (most common)' }, { id: '9', label: '9 ft' }, { id: '10', label: '10 ft' },
            { id: 'match', label: 'Match existing (use 8 ft until known)' },
            { id: 'other', label: 'Other — enter feet' },
          ],
          number_followup: { id: 'C12a_ft', prompt: 'Height in feet', when: 'other' } },
        { id: 'C13', prompt: 'Natural light priority?', answer_type: 'single', required: true, driver3d: 'soft',
          options: [
            { id: 'lots', label: 'Lots of windows' }, { id: 'balanced', label: 'Balanced' },
            { id: 'minimal', label: 'Minimal new openings' },
            { id: 'skylights', label: 'Skylights / solar tubes also of interest' },
          ] },
        { id: 'C14', prompt: 'Do you need closet, storage, or built-ins in this space?', answer_type: 'multi', required: false,
          options: [
            { id: 'closet', label: 'Clothes closet' }, { id: 'pantry', label: 'Pantry' },
            { id: 'linen', label: 'Linen' }, { id: 'builtin', label: 'Built-in shelves/desk' },
            { id: 'none', label: 'None' },
          ] },
        { id: 'C15', prompt: 'Accessibility or aging-in-place goals?', answer_type: 'multi', required: false,
          options: [
            { id: 'wider', label: 'Wider doorways' }, { id: 'stepfree', label: 'Step-free entry' },
            { id: 'curbless', label: 'Walk-in / curbless shower interest' },
            { id: 'levers', label: 'Lever handles' }, { id: 'none', label: 'Not a priority now' },
          ] },
      ],
    },
    {
      id: 'D', title: 'Structure & openings',
      questions: [
        { id: 'D16', prompt: 'Will you remove or open any interior walls?', answer_type: 'single', required: true, driver3d: true,
          options: [ { id: 'yes', label: 'Yes — one or more walls' }, { id: 'maybe', label: 'Maybe' }, { id: 'no', label: 'No' } ] },
        { id: 'D17b', prompt: 'Will this remodel change exterior openings (doors/windows on outer walls)?',
          answer_type: 'yes_no', required: true, remodelOnly: true,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
        { id: 'D17', prompt: 'New exterior doors — how many and what type?', answer_type: 'multi', required: true, driver3d: true,
          remodelGate: 'exterior_openings',
          options: [
            { id: 'none', label: 'None' }, { id: 'one_entry', label: '1 entry door' },
            { id: 'two_plus', label: '2+ entry doors' }, { id: 'sliding', label: 'Sliding patio' },
            { id: 'french', label: 'French doors' }, { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'D18', prompt: 'New or replaced windows — roughly how many?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'none', label: 'None' }, { id: '1_2', label: '1–2' }, { id: '3_5', label: '3–5' },
            { id: '6plus', label: '6+' }, { id: 'replace', label: 'Replacing existing only (count similar)' },
          ] },
        { id: 'D18b', prompt: 'Rough sizes for new doors and windows?', answer_type: 'opening_presets', required: false, driver3d: true,
          help_text: 'Defaults: entry 3×7 ft, windows 3×4 ft.',
          door_options: [
            { id: '36x80', label: 'Entry door 3×7 ft (36×80 in)', w: 36, h: 80 },
            { id: 'sliding_6x7', label: 'Sliding / French 6×7 ft', w: 72, h: 84 },
            { id: 'sliding_8x7', label: 'Sliding / French 8×7 ft', w: 96, h: 84 },
          ],
          window_options: [
            { id: '3x4', label: 'Windows 3×4 ft', w: 36, h: 48 },
            { id: '3x5', label: 'Windows 3×5 ft', w: 36, h: 60 },
            { id: '4x4', label: 'Windows 4×4 ft', w: 48, h: 48 },
            { id: '8x24', label: 'Narrow 8 in × 2 ft (8×24 in)', w: 8, h: 24 },
            { id: 'mix', label: 'Mix / not sure (use 3×4)' },
          ] },
        { id: 'D19', prompt: 'Any large openings (wider than a normal door/window)?', answer_type: 'yes_no', required: true, driver3d: true,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
        { id: 'D19b', prompt: 'About how wide is the largest opening?', answer_type: 'single', required: true, driver3d: true,
          whenD19Yes: true,
          options: [
            { id: 'u6', label: 'Under 6 ft' }, { id: '6_8', label: '6–8 ft' },
            { id: '8_12', label: '8–12 ft' }, { id: 'o12', label: 'Over 12 ft' },
            { id: 'enter', label: 'Enter feet' }, { id: 'unsure', label: 'Not sure' },
          ],
          number_followup: { id: 'D19b_ft', prompt: 'Width in feet', when: 'enter' } },
        { id: 'D20', prompt: 'Are you tying into an existing load-bearing wall or exterior wall?', answer_type: 'single', required: true, additionOnly: true, driver3d: 'soft',
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
      ],
    },
    {
      id: 'E', title: 'Foundation / floor', skipRemodel: true, additionOnly: true,
      questions: [
        { id: 'E21', prompt: 'What foundation type are you leaning toward?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'slab', label: 'Concrete slab on grade' }, { id: 'crawl', label: 'Crawl space' },
            { id: 'basement', label: 'Full basement under addition' },
            { id: 'piers', label: 'Piers / sonotubes (elevated · pylons)' },
            { id: 'match', label: 'Match existing house' }, { id: 'unsure', label: 'Not sure — need guidance' },
          ] },
        { id: 'E22', prompt: 'Is the addition on flat ground, a slope, or over a basement?', answer_type: 'single', required: true, driver3d: 'soft',
          options: [
            { id: 'flat', label: 'Mostly flat' }, { id: 'gentle', label: 'Gentle slope' },
            { id: 'steep', label: 'Steep slope' }, { id: 'basement', label: 'Over/adjacent to basement' },
          ] },
        { id: 'E23', prompt: 'Finished floor height: match existing house floor?', answer_type: 'yes_no', required: true, driver3d: true,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
      ],
    },
    {
      id: 'F', title: 'Roof & weatherproofing', roofConditional: true,
      questions: [
        { id: 'F0', prompt: 'Will this remodel change the roof (new planes, tie-in, or re-roof in the work area)?',
          answer_type: 'yes_no', required: true, remodelOnly: true,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
        { id: 'F24', prompt: 'How should the new roof meet the existing roof?', answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'same_plane', label: 'Continue same roof plane' },
            { id: 'separate', label: 'Lower/higher separate roof' },
            { id: 'dormer', label: 'Dormer-style' },
            { id: 'flat', label: 'Flat / low-slope section' },
            { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'F24a', prompt: 'What’s the roof pitch (steepness)?',
          help_text: 'Pitch is rise over run — 4:12 means 4 inches up for every 12 inches across.',
          answer_type: 'single', required: true, driver3d: true,
          options: [
            { id: 'flat', label: 'Flat / low-slope (≤2:12)' }, { id: '3_12', label: '3:12' },
            { id: '4_12', label: '4:12 (common)' }, { id: '5_12', label: '5:12' },
            { id: '6_12', label: '6:12' }, { id: '7_12', label: '7:12' },
            { id: '8_12', label: '8:12' }, { id: '9_12', label: '9:12' },
            { id: '12_12', label: '12:12' }, { id: '4_10', label: '4:10' },
            { id: 'match', label: 'Match existing' }, { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'F24style', prompt: 'Roof style for the new work?',
          answer_type: 'single', required: false, driver3d: true,
          options: [
            { id: 'gable', label: 'Gable' },
            { id: 'hip', label: 'Hip' },
            { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'F24b', prompt: 'How far should the roof overhang (eaves)?', answer_type: 'single', required: false, driver3d: true,
          options: [
            { id: '6', label: 'Minimal (~6 in)' }, { id: '12', label: 'Typical (~12 in)' },
            { id: '24', label: 'Deep (~18–24 in)' }, { id: 'match', label: 'Match existing' },
            { id: 'enter', label: 'Enter inches' }, { id: 'unsure', label: 'Not sure' },
          ],
          number_followup: { id: 'F24b_in', prompt: 'Overhang in inches', when: 'enter' } },
        { id: 'F25', prompt: 'Preferred roofing material (match existing if possible)?', answer_type: 'single', required: true, driver3d: 'texture',
          options: [
            { id: 'asphalt', label: 'Asphalt shingles' }, { id: 'metal', label: 'Metal' },
            { id: 'tile', label: 'Tile' }, { id: 'slate', label: 'Slate' },
            { id: 'match', label: 'Match existing' }, { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'F26', prompt: 'Gutters and drainage for the new roof area?', answer_type: 'single', required: false,
          options: [
            { id: 'extend', label: 'Extend existing gutters' },
            { id: 'new', label: 'New gutters/downspouts' },
            { id: 'unsure', label: 'Not sure yet' },
          ] },
      ],
    },
    {
      id: 'G', title: 'Exterior finishes',
      questions: [
        { id: 'G27', prompt: 'Exterior look goal?', answer_type: 'single', required: true,
          options: [
            { id: 'match', label: 'Match existing house closely' }, { id: 'updated', label: 'Similar but updated' },
            { id: 'contrast', label: 'Bold contrast' }, { id: 'undecided', label: 'Undecided' },
          ] },
        { id: 'G28', prompt: 'Primary cladding for the addition / changed exterior?', answer_type: 'single', required: true, driver3d: 'texture',
          options: [
            { id: 'match_b', label: 'Match Stage B material' }, { id: 'fiber', label: 'Fiber cement' },
            { id: 'vinyl', label: 'Vinyl' }, { id: 'eng_wood', label: 'Engineered wood' },
            { id: 'brick', label: 'Brick veneer' }, { id: 'stucco', label: 'Stucco' },
            { id: 'other', label: 'Other / not sure' },
          ] },
        { id: 'G29', prompt: 'Housewrap / weather-resistive barrier awareness', answer_type: 'single', required: true,
          options: [
            { id: 'understand', label: 'I understand we’ll need proper wrap/flashing' },
            { id: 'explain', label: 'Explain more' },
            { id: 'pro', label: 'Builder/pro will handle' },
          ] },
      ],
    },
    {
      id: 'H', title: 'Interior finishes & fixtures',
      questions: [
        { id: 'H30', prompt: 'Overall finish level?', answer_type: 'single', required: true,
          options: [
            { id: 'budget', label: 'Budget-friendly' }, { id: 'mid', label: 'Mid-range (most common)' },
            { id: 'high', label: 'Higher-end' }, { id: 'mix', label: 'Mix by room' },
          ] },
        { id: 'H31', prompt: 'Flooring preference for main new/changed space?', answer_type: 'single', required: true,
          options: [
            { id: 'lvp', label: 'LVP / vinyl plank' }, { id: 'hardwood', label: 'Hardwood' },
            { id: 'engineered', label: 'Engineered wood' }, { id: 'carpet', label: 'Carpet' },
            { id: 'tile', label: 'Tile' }, { id: 'match', label: 'Match existing' },
            { id: 'undecided', label: 'Undecided' },
          ] },
        { id: 'H32', prompt: 'Wall finish?', answer_type: 'single', required: true,
          options: [
            { id: 'drywall', label: 'Paint-ready drywall' }, { id: 'texture', label: 'Texture then paint' },
            { id: 'panel', label: 'Paneled / accent wall' }, { id: 'undecided', label: 'Undecided' },
          ] },
        { id: 'H33', prompt: 'Bathroom or kitchen fixtures in scope?', answer_type: 'multi', required: true, wetRoomsOnly: true,
          options: [
            { id: 'toilet', label: 'Toilet' }, { id: 'vanity', label: 'Vanity/sink' },
            { id: 'shower', label: 'Shower and/or tub' }, { id: 'ksink', label: 'Kitchen sink' },
            { id: 'dw', label: 'Dishwasher hookup' }, { id: 'range', label: 'Range/hood' },
            { id: 'none', label: 'None of these' },
          ] },
        { id: 'H34', prompt: 'Interior doors & trim style?', answer_type: 'single', required: false,
          options: [
            { id: 'match', label: 'Match existing' }, { id: 'modern', label: 'Simple modern' },
            { id: 'traditional', label: 'Traditional / colonial profiles' }, { id: 'undecided', label: 'Undecided' },
          ] },
      ],
    },
    {
      id: 'I', title: 'Mechanical rough-ins',
      questions: [
        { id: 'I35', prompt: 'Heating & cooling for the new/changed space?', answer_type: 'single', required: true,
          options: [
            { id: 'extend', label: 'Extend existing HVAC ducts' }, { id: 'minisplit', label: 'Mini-split / ductless' },
            { id: 'baseboard', label: 'Electric baseboard or similar' },
            { id: 'unsure', label: 'Not sure — need advice' },
            { id: 'no_change', label: 'Remodel only — no change expected' },
          ] },
        { id: 'I36', prompt: 'Electrical: new circuits or panel work expected?', answer_type: 'single', required: true,
          options: [
            { id: 'existing', label: 'Lights and outlets on existing capacity' },
            { id: 'circuits', label: 'Likely new circuits' },
            { id: 'panel', label: 'Panel upgrade possible' }, { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'I37', prompt: 'Plumbing: new supply/drain lines?', answer_type: 'single', required: true, wetRoomsOnly: true,
          options: [
            { id: 'new', label: 'Yes — new wet area' }, { id: 'swap', label: 'Minor fixture swap only' },
            { id: 'none', label: 'None' }, { id: 'unsure', label: 'Not sure' },
          ] },
        { id: 'I38', prompt: 'Any gas appliances in the new work?', answer_type: 'yes_no', required: false,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' } ] },
      ],
    },
    {
      id: 'J', title: 'Timeline & phasing',
      questions: [
        { id: 'J39', prompt: 'When do you hope construction could start?', answer_type: 'single', required: true,
          options: [
            { id: 'asap', label: 'ASAP' }, { id: '1_3', label: '1–3 months' },
            { id: '3_6', label: '3–6 months' }, { id: '6_12', label: '6–12 months' },
            { id: 'exploring', label: 'Just exploring' },
          ] },
        { id: 'J40', prompt: 'Will you live in the home during the work?', answer_type: 'yes_no', required: true,
          options: [ { id: 'yes', label: 'Yes' }, { id: 'partial', label: 'Partially' }, { id: 'no', label: 'No' } ] },
        { id: 'J41', prompt: 'Prefer one continuous build or phases?', answer_type: 'single', required: false,
          options: [
            { id: 'continuous', label: 'One continuous project' },
            { id: 'shell_first', label: 'Exterior/shell first, finishes later' },
            { id: 'finishes_first', label: 'Finishes first in existing rooms' },
            { id: 'unsure', label: 'Not sure' },
          ] },
      ],
    },
    {
      id: 'K', title: 'Budget band',
      questions: [
        { id: 'K42', prompt: 'What’s your comfortable total project budget band?',
          help_text: 'EXAMPLE bands only — not a bid.',
          answer_type: 'single', required: true,
          options: [
            { id: 'u50', label: 'Under $50,000 (EXAMPLE)' },
            { id: '50_100', label: '$50,000–$100,000 (EXAMPLE)' },
            { id: '100_200', label: '$100,000–$200,000 (EXAMPLE)' },
            { id: '200_350', label: '$200,000–$350,000 (EXAMPLE)' },
            { id: 'o350', label: 'Over $350,000 (EXAMPLE)' },
            { id: 'materials_first', label: 'Not sure — show me a materials-first estimate' },
          ] },
        { id: 'K43', prompt: 'How should we treat the materials estimate vs labor?', answer_type: 'single', required: true,
          options: [
            { id: 'both', label: 'Materials breakdown + labor placeholder' },
            { id: 'materials', label: 'Materials only for now' },
            { id: 'have_number', label: 'I have a builder’s number already' },
          ] },
        { id: 'K44', prompt: 'Contingency comfort?', answer_type: 'single', required: false,
          options: [
            { id: '10', label: '10%' }, { id: '15', label: '15% (common)' },
            { id: '20', label: '20%+' }, { id: 'custom', label: 'I’ll set my own' },
          ] },
      ],
    },
  ];

  const RULES = [
    { id: 'r1', type: 'tip', when: (a) => ['addition','both','detached','unsure'].includes(S(a,'A1')),
      text: 'Additions need foundation and roof tie-in plans — we’ll walk through both in plain language.' },
    { id: 'r2', type: 'warning', when: (a) => ['yes','maybe'].includes(S(a,'D16')),
      text: 'This wall might be load-bearing (it helps hold up floors or the roof). Confirm with plans or a structural pro before any cutting. A header or beam is often required.' },
    { id: 'r3', type: 'warning', when: (a) => S(a,'D19') === 'yes',
      text: 'Wide openings almost always need engineered headers or beams. Budget for structural hardware and pro design. Consider contingency toward 15–20%.' },
    { id: 'r4', type: 'tip', when: (a) => hasAny(a,'A3',['bathroom','kitchen','laundry']),
      text: 'Wet rooms need plumbing and waterproofing — failures often come from water management, not just finishes.' },
    { id: 'r5', type: 'tip', when: (a) => ['pre1950','1950_1979'].includes(S(a,'B6')),
      text: 'Older homes may have outdated wiring, plumbing, or materials. A pro inspection before opening walls is smart. Budget contingency for unknowns.' },
    { id: 'r6', type: 'tip', when: (a) => ['brick','stone'].includes(S(a,'B7')) || S(a,'G28') === 'brick',
      text: 'Matching masonry often costs more and may need a specialty mason. Expect lead times — cladding routes to the masonry supplier slot.' },
    { id: 'r7', type: 'warning', when: (a) => ['separate','flat'].includes(S(a,'F24')),
      text: 'Roof transitions and low-slope areas need excellent flashing and membranes. This is a top leak risk zone — don’t skimp on weatherproofing.' },
    { id: 'r8', type: 'tip', when: (a) => ['extend','unsure'].includes(S(a,'I35')),
      text: 'Have HVAC capacity checked before closing walls/ceilings. Undersized systems struggle with new square footage.' },
    { id: 'r9', type: 'warning', when: (a) => ['circuits','panel','unsure'].includes(S(a,'I36')),
      text: 'Electrical work usually requires a licensed electrician and permits. Don’t guess on panel capacity — upgrades can become critical path.' },
    { id: 'r10', type: 'tip', when: (a) => ['tight','steep'].includes(S(a,'B8')),
      text: 'Limited access can raise labor and delivery costs (crane, pump, concrete). Factor higher contingency into your budget band.' },
    { id: 'r11', type: 'tip', when: (a) => S(a,'H30') === 'budget',
      text: 'Budget-friendly finish: EXAMPLE unit costs lean lower. Mid-range upgrades remain available on Materials.' },
    { id: 'r12', type: 'tip', when: (a) => S(a,'H30') === 'high',
      text: 'Higher-end finish: EXAMPLE costs for windows, flooring, and cladding lean upper-tier. Special-order items often mean longer lead times.' },
    { id: 'r13', type: 'warning', when: (a) => {
        const big = ['200_400','400_600','o600'].includes(S(a,'A2')) || (Number(a.A2_sqft)||0) > 200;
        return S(a,'K42') === 'u50' && big && isAdditionish(a);
      }, text: 'Under $50k (EXAMPLE) with over ~200 sq ft addition is aggressive in many US markets. Consider smaller scope, shell-only phase, or a higher band.' },
    { id: 'r14', type: 'tip', when: (a) => S(a,'C12') === 'vaulted',
      text: 'Vaulted ceilings look great but change roof framing, insulation, and often HVAC. Expect higher costs and framing complexity.' },
    { id: 'r15', type: 'tip', when: (a) => ['unsure','will_check'].includes(S(a,'A5')),
      text: 'Most additions and many remodeled bathrooms/kitchens need permits. Check your city/county building department before buying materials or opening walls.' },
  ];

  const EXTRA = [
    { id: 'h1', type: 'tip', when: (a) => S(a,'A1') === 'unsure', text: 'Many projects start as a remodel and grow into an addition. You can change this later.' },
    { id: 'h2', type: 'tip', when: (a) => S(a,'A2') === 'o600' || (Number(a.A2_sqft)||0) > 600, text: 'Larger additions often need more structural and permit planning.' },
    { id: 'h3', type: 'warning', when: (a) => S(a,'C11') === 'open_wall', text: 'Opening a wall may require a header or beam if load-bearing. Don’t cut until confirmed.' },
    { id: 'h4', type: 'tip', when: (a) => S(a,'C13') === 'skylights', text: 'Skylights need careful flashing — plan for quality waterproofing.' },
    { id: 'h5', type: 'warning', when: (a) => ['yes','unsure'].includes(S(a,'B9')), text: 'Call 811 before digging. Locating utilities is free in most areas.' },
    { id: 'h6', type: 'warning', when: (a) => S(a,'I38') === 'yes', text: 'Gas lines require licensed work and leak testing. Never DIY gas without credentials.' },
    { id: 'h7', type: 'tip', when: (a) => ['yes','partial'].includes(S(a,'J40')), text: 'Dust, noise, and temporary loss of rooms are normal when living through a remodel.' },
    { id: 'h8', type: 'tip', when: (a) => !!S(a,'K42'), text: 'Budget bands are rough US residential examples only. Prices here are illustrative, not a bid.' },
    { id: 'h9', type: 'tip', when: (a) => ['3_5','6plus'].includes(S(a,'D18')), text: 'Grouping similar window sizes can save money. Double-pane is standard in many areas.' },
    { id: 'h10', type: 'tip', when: (a) => S(a,'G29') === 'explain', text: 'Under the siding, a weather barrier and correct flashing keep water out.' },
    { id: 'h11', type: 'tip', when: (a) => S(a,'A2b') === 'unsure', text: 'We’ll show the addition on the back by default until you pick a side.' },
  ];

  const SUPPLIERS = [
    { id: 'SUP-LOCAL', name: 'Local lumberyard' },
    { id: 'SUP-HD', name: 'Home Depot (big-box)' },
    { id: 'SUP-LOW', name: "Lowe's (big-box)" },
    { id: 'SUP-WIN', name: 'Specialty window/door dealer' },
    { id: 'SUP-ROOF', name: 'Roofing supply house' },
    { id: 'SUP-MASON', name: 'Masonry / specialty yard' },
    { id: 'SUP-HVAC', name: 'HVAC supply / contractor supply' },
    { id: 'SUP-PLUMB', name: 'Plumbing supply' },
  ];

  const CATEGORIES = [
    'Foundation','Framing lumber','Sheathing','Fasteners & hardware','Roofing',
    'Windows & doors','Exterior cladding & trim','Weather barrier & flashing','Insulation',
    'Drywall','Flooring','Interior trim & doors','Paint & finishes',
    'Plumbing fixtures & allowances','Electrical allowances','HVAC allowances','Misc allowances',
  ];

  const BASE_LINES = [
    { category: 'Foundation', item: 'Slab & footings allowance', uom: 'allowance', qty: 1, unit: 3500, supplier: 'SUP-LOCAL' },
    { category: 'Framing lumber', item: 'Framing lumber & plates', uom: 'allowance', qty: 1, unit: 2800, supplier: 'SUP-LOCAL' },
    { category: 'Framing lumber', item: 'Structural header allowance', uom: 'each', qty: 1, unit: 400, supplier: 'SUP-LOCAL' },
    { category: 'Sheathing', item: 'Wall & roof sheathing', uom: 'sheets', qty: 30, unit: 40, supplier: 'SUP-LOCAL' },
    { category: 'Fasteners & hardware', item: 'Fasteners & hangers', uom: 'allowance', qty: 1, unit: 350, supplier: 'SUP-HD' },
    { category: 'Roofing', item: 'Shingles + underlayment', uom: 'squares', qty: 3, unit: 300, supplier: 'SUP-ROOF' },
    { category: 'Weather barrier & flashing', item: 'Housewrap, tape & flashing', uom: 'allowance', qty: 1, unit: 450, supplier: 'SUP-ROOF' },
    { category: 'Windows & doors', item: 'Windows (EXAMPLE)', uom: 'each', qty: 3, unit: 400, supplier: 'SUP-WIN' },
    { category: 'Windows & doors', item: 'Exterior door (EXAMPLE)', uom: 'each', qty: 1, unit: 700, supplier: 'SUP-WIN' },
    { category: 'Exterior cladding & trim', item: 'Cladding materials', uom: 'sq ft', qty: 450, unit: 3.55, supplier: 'SUP-HD' },
    { category: 'Insulation', item: 'Insulation batts', uom: 'allowance', qty: 1, unit: 900, supplier: 'SUP-HD' },
    { category: 'Drywall', item: 'Drywall + mud allowance', uom: 'allowance', qty: 1, unit: 800, supplier: 'SUP-LOW' },
    { category: 'Flooring', item: 'Flooring materials', uom: 'sq ft', qty: 192, unit: 3.5, supplier: 'SUP-HD' },
    { category: 'Interior trim & doors', item: 'Trim & interior door allowance', uom: 'allowance', qty: 1, unit: 650, supplier: 'SUP-LOW' },
    { category: 'Paint & finishes', item: 'Paint & primer allowance', uom: 'allowance', qty: 1, unit: 450, supplier: 'SUP-HD' },
    { category: 'Plumbing fixtures & allowances', item: 'Bath/kitchen allowance', uom: 'allowance', qty: 1, unit: 3500, supplier: 'SUP-PLUMB' },
    { category: 'Electrical allowances', item: 'Devices & lighting allowance', uom: 'allowance', qty: 1, unit: 1500, supplier: 'SUP-HD' },
    { category: 'HVAC allowances', item: 'HVAC placeholder', uom: 'allowance', qty: 1, unit: 2500, supplier: 'SUP-HVAC' },
    { category: 'Misc allowances', item: 'Dumpster, protection, sealants', uom: 'allowance', qty: 1, unit: 600, supplier: 'SUP-HD' },
  ];

  function S(a, id) { const v = a[id]; return Array.isArray(v) ? v[0] : (v || null); }
  function M(a, id) { const v = a[id]; if (!v) return []; return Array.isArray(v) ? v : [v]; }
  function hasAny(a, id, opts) { return M(a, id).some((x) => opts.includes(x)); }
  function isRemodelOnly(a) { return S(a, 'A1') === 'remodel'; }
  function isAdditionish(a) {
    const t = S(a, 'A1');
    return !t || t === 'addition' || t === 'both' || t === 'detached' || t === 'unsure';
  }
  function hasWetRooms(a) { return hasAny(a, 'A3', ['bathroom', 'kitchen', 'laundry']); }

  function footprintFromBand(a) {
    const band = S(a, 'A2');
    const sq = Number(a.A2_sqft) || 0;
    if (sq > 0) {
      const side = Math.sqrt(sq);
      return { l: Math.round(side * 1.2 * 2) / 2, w: Math.round(side / 1.2 * 2) / 2 };
    }
    const map = {
      u100: { l: 8, w: 10 }, '100_200': { l: 12, w: 16 }, '200_400': { l: 14, w: 20 },
      '400_600': { l: 18, w: 28 }, o600: { l: 24, w: 30 }, enter: { l: 12, w: 16 },
    };
    return map[band] || { l: 12, w: 16 };
  }

  /** §5.1–5.2 3D viewer store from answers */
  function build3DStore(answers) {
    const a = answers || {};
    const defaultsUsed = [];
    const remodel = isRemodelOnly(a);

    let project_mode = S(a, 'A1') || 'addition';
    if (!S(a, 'A1')) defaultsUsed.push('project_mode');

    let footprint_l_ft, footprint_w_ft;
    const fp = a.A2a;
    if (fp && (fp.l || fp.w)) {
      footprint_l_ft = Number(fp.l) || 12;
      footprint_w_ft = Number(fp.w) || 16;
    } else {
      const d = footprintFromBand(a);
      footprint_l_ft = d.l; footprint_w_ft = d.w;
      defaultsUsed.push('footprint_l_ft', 'footprint_w_ft');
    }

    let attach_side = S(a, 'A2b') || 'back';
    if (attach_side === 'unsure') attach_side = 'back';
    if (!S(a, 'A2b')) defaultsUsed.push('attach_side');

    const c12 = S(a, 'C12');
    let ceiling_mode = 'flat';
    if (c12 === 'vaulted') ceiling_mode = 'vaulted';
    else if (c12 === 'taller') ceiling_mode = 'taller';
    else if (c12 === 'unsure' || !c12) { ceiling_mode = 'flat'; if (!c12) defaultsUsed.push('ceiling_mode'); }

    let wall_height_ft = 8;
    const c12a = S(a, 'C12a');
    if (c12a === '9') wall_height_ft = 9;
    else if (c12a === '10') wall_height_ft = 10;
    else if (c12a === 'other' && Number(a.C12a_ft) > 0) wall_height_ft = Number(a.C12a_ft);
    else if (c12a === '8' || c12a === 'match') wall_height_ft = 8;
    else { wall_height_ft = 8; defaultsUsed.push('wall_height_ft'); }

    const pitchMap = {
      flat: 2 / 12, '3_12': 3 / 12, '4_12': 4 / 12, '5_12': 5 / 12, '6_12': 6 / 12,
      '7_12': 7 / 12, '8_12': 8 / 12, '9_12': 9 / 12, '10_12': 10 / 12, '12_12': 12 / 12,
      '4_10': 4 / 10, match: 4 / 12, unsure: 4 / 12,
    };
    let roof_pitch = 4 / 12;
    const f24a = S(a, 'F24a');
    if (f24a && pitchMap[f24a] != null) roof_pitch = pitchMap[f24a];
    else if (a.roof_pitch_custom != null && Number(a.roof_pitch_custom) > 0) roof_pitch = Number(a.roof_pitch_custom);
    else defaultsUsed.push('roof_pitch');

    let roof_style = S(a, 'F24style') || a.roof_style || 'gable';
    if (roof_style === 'unsure' || !roof_style) roof_style = 'gable';
    if (!S(a, 'F24style') && !a.roof_style) defaultsUsed.push('roof_style');

    let eave_overhang_in = 12;
    const f24b = S(a, 'F24b');
    if (f24b === '6') eave_overhang_in = 6;
    else if (f24b === '12' || f24b === 'match') eave_overhang_in = 12;
    else if (f24b === '24') eave_overhang_in = 24;
    else if (f24b === 'enter' && Number(a.F24b_in) > 0) eave_overhang_in = Number(a.F24b_in);
    else defaultsUsed.push('eave_overhang_in');
    // Cap absurd custom overhangs; 3D also clamps. Modest eaves only (~6–36 in).
    if (!(eave_overhang_in >= 0) || !Number.isFinite(eave_overhang_in)) eave_overhang_in = 12;
    else if (eave_overhang_in > 36) eave_overhang_in = 36;

    let door_w = 36, door_h = 80, win_w = 36, win_h = 48;
    const op = a.D18b || {};
    if (op.door && op.door.w) { door_w = op.door.w; door_h = op.door.h; }
    else defaultsUsed.push('opening_preset_doors');
    if (op.window && op.window.w) { win_w = op.window.w; win_h = op.window.h; }
    else defaultsUsed.push('opening_preset_windows');

    let large_opening_w_ft = 8;
    const d19b = S(a, 'D19b');
    if (d19b === 'u6') large_opening_w_ft = 5;
    else if (d19b === '6_8') large_opening_w_ft = 7;
    else if (d19b === '8_12') large_opening_w_ft = 10;
    else if (d19b === 'o12') large_opening_w_ft = 14;
    else if (d19b === 'enter' && Number(a.D19b_ft) > 0) large_opening_w_ft = Number(a.D19b_ft);
    else if (S(a, 'D19') === 'yes') defaultsUsed.push('large_opening_w_ft');

    const winBand = S(a, 'D18');
    let window_count = 3;
    if (winBand === 'none') window_count = 0;
    else if (winBand === '1_2') window_count = 2;
    else if (winBand === '3_5') window_count = 4;
    else if (winBand === '6plus') window_count = 7;
    else if (winBand === 'replace') window_count = 3;
    else if (S(a, 'C13') === 'lots') window_count = 5;
    else if (S(a, 'C13') === 'minimal') window_count = 1;

    let foundation_type = S(a, 'E21') || 'slab';
    if (!S(a, 'E21')) defaultsUsed.push('foundation_type');
    if (foundation_type === 'unsure' || foundation_type === 'match' || foundation_type === 'unknown') foundation_type = 'slab';
    if (foundation_type === 'sonotube' || foundation_type === 'sonotubes' || foundation_type === 'pier'
        || foundation_type === 'pylon' || foundation_type === 'pylons' || foundation_type === 'pilon') {
      foundation_type = 'piers';
    }

    let roof_tie_in = S(a, 'F24') || 'separate';
    if (!S(a, 'F24')) defaultsUsed.push('roof_tie_in');

    let cladding = S(a, 'G28');
    if (cladding === 'match_b') cladding = S(a, 'B7') || 'fiber';
    else if (!cladding) {
      cladding = S(a, 'B7') || 'fiber';
      defaultsUsed.push('cladding_texture');
    }
    let roofing = S(a, 'F25') || 'asphalt';
    if (!S(a, 'F25')) defaultsUsed.push('roofing_texture');
    if (roofing === 'match' || roofing === 'unsure') roofing = 'asphalt';

    const showRoof = !remodel || ['yes', 'unsure'].includes(S(a, 'F0')) || isAdditionish(a);
    // Show foundation massing for additions, or whenever E21 is set (Plan Foundation control)
    const showFoundation = !remodel || !!S(a, 'E21') || isAdditionish(a);

    return {
      project_mode,
      remodel_only: remodel,
      area_band_sqft: S(a, 'A2'),
      footprint_l_ft,
      footprint_w_ft,
      attach_side,
      connect_type: S(a, 'C11') || 'doorway',
      ceiling_mode,
      wall_height_ft,
      daylight_bias: S(a, 'C13'),
      open_interior_walls: S(a, 'D16'),
      door_types: M(a, 'D17'),
      window_count_band: winBand,
      window_count,
      opening_preset_door_w_in: door_w,
      opening_preset_door_h_in: door_h,
      opening_preset_win_w_in: win_w,
      opening_preset_win_h_in: win_h,
      has_large_opening: S(a, 'D19') === 'yes',
      large_opening_w_ft,
      large_opening_h_ft: 6 + 8 / 12,
      foundation_type,
      site_grade: S(a, 'E22') || 'flat',
      floor_align: S(a, 'E23') || 'yes',
      roof_tie_in,
      roof_pitch,
      roof_style,
      eave_overhang_in,
      cladding_texture: cladding,
      roofing_texture: roofing,
      show_roof: showRoof,
      show_foundation: showFoundation,
      skylights: S(a, 'C13') === 'skylights',
      usingDefaults: defaultsUsed,
      answers: a,
    };
  }

  function shouldShowQuestion(q, answers) {
    if (q.remodelOnly && !isRemodelOnly(answers)) return false;
    if (q.additionOnly && isRemodelOnly(answers)) return false;
    if (q.wetRoomsOnly && S(answers, 'A3') && !hasWetRooms(answers)) return false;
    if (q.id === 'D17' && isRemodelOnly(answers) && S(answers, 'D17b') === 'no') return false;
    if (q.whenD19Yes && S(answers, 'D19') !== 'yes') return false;
    if (['F24', 'F24a', 'F24b', 'F25', 'F26'].includes(q.id) && isRemodelOnly(answers) && S(answers, 'F0') !== 'yes' && S(answers, 'F0') !== 'unsure') return false;
    return true;
  }

  function shouldShowStage(stage, answers) {
    if (stage.skipRemodel && isRemodelOnly(answers)) {
      // Keep Foundation stage visible once E21 is set (e.g. Plan Foundation control)
      // or when an addition footprint answer exists.
      if (stage.id === 'E' && (S(answers, 'E21') || (answers.A2a && (answers.A2a.l || answers.A2a.w)))) {
        return true;
      }
      return false;
    }
    return true;
  }

  function getVisibleQuestions(answers) {
    const list = [];
    STAGES.forEach((stage) => {
      if (!shouldShowStage(stage, answers)) return;
      stage.questions.forEach((q) => {
        if (shouldShowQuestion(q, answers)) list.push({ stage, question: q });
      });
    });
    return list;
  }

  function evaluateRecommendations(answers) {
    const out = [];
    RULES.concat(EXTRA).forEach((r) => {
      try { if (r.when(answers)) out.push({ id: r.id, type: r.type, text: r.text }); } catch (_) {}
    });
    return out;
  }

  function sizeScale(a) {
    const fp = a.A2a;
    if (fp && fp.l && fp.w) return Math.max(0.4, (Number(fp.l) * Number(fp.w)) / 192);
    const entered = Number(a.A2_sqft);
    if (entered > 0) return Math.max(0.4, entered / 192);
    const map = { u100: 0.45, '100_200': 0.85, '200_400': 1.4, '400_600': 2.4, o600: 3.5 };
    return map[S(a, 'A2')] || 1;
  }

  function buildMaterials(answers) {
    const a = answers || {};
    const scale = sizeScale(a);
    const fm = S(a, 'H30') === 'budget' ? 0.85 : S(a, 'H30') === 'high' ? 1.35 : 1;
    const remodel = isRemodelOnly(a);
    const wet = hasWetRooms(a);
    const store = build3DStore(a);
    const wins = store.window_count;
    const masonry = ['brick', 'stone'].includes(S(a, 'B7')) || S(a, 'G28') === 'brick';
    const includeLabor = S(a, 'K43') !== 'materials';
    let contingencyPct = 15;
    if (S(a, 'K44') === '10') contingencyPct = 10;
    if (S(a, 'K44') === '20') contingencyPct = 20;
    if (S(a, 'D19') === 'yes' || ['tight', 'steep'].includes(S(a, 'B8'))) contingencyPct = Math.max(contingencyPct, 15);

    const lines = [];
    BASE_LINES.forEach((base) => {
      let qty = base.qty, unit = base.unit, supplier = base.supplier, include = true;
      if (base.category === 'Foundation') { if (remodel) include = false; else qty = scale; }
      if ((base.category === 'Roofing' || base.category === 'Weather barrier & flashing') && remodel && S(a, 'F0') === 'no') include = false;
      if (['Framing lumber', 'Sheathing', 'Insulation', 'Drywall', 'Misc allowances'].includes(base.category)) {
        qty = base.uom === 'allowance' || base.uom === 'each' ? scale : Math.max(1, Math.round(base.qty * scale));
      }
      if (base.category === 'Roofing' && base.item.indexOf('Shingles') >= 0) qty = Math.max(1, Math.round(3 * scale));
      if (base.category === 'Exterior cladding & trim') {
        qty = Math.round(450 * scale); unit = base.unit * fm;
        if (masonry) supplier = 'SUP-MASON';
      }
      if (base.item.indexOf('Windows') >= 0) {
        qty = wins; unit = fm > 1.1 ? 550 : fm < 0.9 ? 280 : 400;
        if (!wins) include = false;
      }
      if (base.item.indexOf('Exterior door') >= 0) {
        const doors = M(a, 'D17');
        if (doors.includes('none') || (remodel && S(a, 'D17b') === 'no')) include = false;
        else if (doors.includes('two_plus')) qty = 2;
        unit *= fm;
      }
      if (base.category === 'Flooring') {
        qty = Math.round(192 * scale);
        const fl = S(a, 'H31');
        unit = (fl === 'hardwood' ? 6 : fl === 'tile' ? 5 : 3.5) * fm;
      }
      if (['Paint & finishes', 'Interior trim & doors'].includes(base.category)) { qty = scale; unit = base.unit * fm; }
      if (base.category === 'Plumbing fixtures & allowances') { if (!wet) include = false; else { qty = scale; unit = base.unit * fm; } }
      if (base.category === 'Electrical allowances' || base.category === 'HVAC allowances') {
        qty = scale; unit = base.unit * (fm > 1.1 ? 1.2 : 1);
        if (base.category === 'HVAC allowances' && S(a, 'I35') === 'no_change') include = false;
      }
      if (base.item.indexOf('header') >= 0 && S(a, 'D19') === 'yes') qty = Math.max(qty, 2 * scale);
      if (!include) return;
      const extension = Math.round(qty * unit);
      lines.push({ category: base.category, item: base.item, uom: base.uom, qty: Math.round(qty * 100) / 100,
        unit: Math.round(unit * 100) / 100, extension, supplier, example: true });
    });

    const materialsSubtotal = lines.reduce((s, l) => s + l.extension, 0);
    const wastePct = 10;
    const materialsWithWaste = Math.round(materialsSubtotal * 1.1);
    const contingency = Math.round(materialsWithWaste * (contingencyPct / 100));
    const labor = includeLabor ? Math.round(18000 * scale * (fm * 0.5 + 0.5)) : 0;
    const taxPct = 8;
    const tax = Math.round(materialsWithWaste * 0.08);
    return {
      lines, categories: CATEGORIES, suppliers: SUPPLIERS,
      rollup: {
        materialsSubtotal, wastePct, materialsWithWaste, contingencyPct, contingency,
        labor, includeLabor, taxPct, tax, total: materialsWithWaste + contingency + labor + tax,
        disclaimer: 'EXAMPLE ESTIMATES — not quotes. Illustrative US residential ballpark only.',
      },
    };
  }

  global.HomePlanGuide = {
    sourcePath: '/workspace/remodel-app-content-v1.md',
    version: '1.1',
    STAGES, RULES, SUPPLIERS, CATEGORIES,
    getVisibleQuestions, evaluateRecommendations, buildMaterials, build3DStore,
    isRemodelOnly, isAdditionish, hasWetRooms, single: S, multi: M,
  };
})(window);
