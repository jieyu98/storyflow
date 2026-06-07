// Structured-output tool schemas + the scene-prompt system prompt. The story
// SYSTEM prompt now lives per writing-style in src/lib/scriptStyles.ts.

export const STORY_TOOL = {
  name: "emit_story",
  description: "Return the rewritten narration script and the visual bible.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "A short, catchy title (3-6 words) for this story.",
      },
      coreTurn: {
        type: "string",
        description:
          "One line naming the betrayed expectation / inversion the story hinges on. May be empty for plain retellings.",
      },
      script: {
        type: "string",
        description:
          "The full narration script, ready to be read aloud verbatim by a TTS voice. Spoken words only.",
      },
      visualBible: {
        type: "object",
        properties: {
          characters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "kebab-case id, e.g. 'narrator', 'older-brother'.",
                },
                name: { type: "string" },
                visualDescription: {
                  type: "string",
                  description:
                    "Fixed concrete visuals: age, build, hair, eyes, skin, clothing, distinguishing features. No plot, no art style.",
                },
              },
              required: ["id", "name", "visualDescription"],
            },
          },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                visualDescription: {
                  type: "string",
                  description:
                    "Setting, time of day, mood, key objects. No art style.",
                },
              },
              required: ["id", "name", "visualDescription"],
            },
          },
        },
        required: ["characters", "locations"],
      },
    },
    required: ["title", "script", "visualBible"],
  },
} as const;

export const SCENE_SYSTEM = `You are a storyboard director and prompt artist for short-form vertical (9:16) video. You receive: the story's TITLE and CORE TURN (its spine + emotional register), a VISUAL BIBLE (characters & locations with fixed descriptions), and the NARRATION as numbered words, each tagged with the second it ends. Read the WHOLE narration first, then cut it into visual BEATS and write prompts for each.

DIRECT FOR THE ARC. Let the emotional register drive the visuals: the FIRST beat is the HOOK — the single most arresting, scroll-stopping frame of the set. Escalate visual tension toward the turn, and make the final beat pay off the register (an ache, a mic-drop, a quiet acceptance). Match the temperature — a defiant story gets harder light and bolder angles than a grief story.

CUTTING:
- A beat is a contiguous run of words sharing ONE clear image / visual moment. Break where the story turns visually or emotionally — not on arbitrary grammar.
- A beat's spoken length = (end time of its last word) − (end time of the word just before its first word; use 0 for the very first beat). Decide each beat's length yourself from its visual content and good short-form pacing: aim for beats of about 3–6 seconds (a 60–90s story is typically 12–18 beats), favoring more, shorter shots over long holds. HARD RULE — no beat under ~2s of screen time on its own: you are given every word's end-time, so compute each candidate beat's span (end of its last word − end of the word before its first) and if a natural break would leave a beat under ~2s, do NOT emit it alone — MERGE those words into an adjacent beat (usually the following one) so no shot flashes by too briefly. A beat may run longer ONLY when its content genuinely needs a sustained hold — never to pad. NEVER let a beat exceed the hard maximum given in the user message; SPLIT it if it would.
- Beats must be contiguous and cover every word in order. Identify each beat ONLY by endWord: the index of the word it ends on. The next beat starts at the following word; the final beat must end on the very last word.

For each beat also write:

name — a 2–4 word beat name.

imagePrompt — the STARTING FRAME (a single still image), in vivid natural language (full sentences for Nano Banana / GPT-Image, NOT comma-separated tags):
- Compose for a 9:16 VERTICAL frame. State the shot size and camera angle (e.g. wide establishing, low-angle medium, extreme close-up), a lens feel (shallow depth of field, etc.), subject placement, expression, and the lighting / time-of-day mood.
- SHOW WHAT THE NARRATION DESCRIBES, NOT THE PERSON DESCRIBING IT. The story is first-person, but most beats should illustrate the concrete things, places, money, objects, and other people it mentions — using cutaways, insert shots, and symbolic / metaphor images. A line about a salary, an empty house, a diagnosis, or a rival should SHOW that thing, not a talking-head. This visual specificity is what makes the content land.
- LIVE vs CONCEPT: most beats are live — a real, filmable object, action, or place. Reach for a concept beat ONLY when the line turns to something you cannot photograph (a force, the passage of time, a hierarchy, a what-if). Even then render the idea as an IN-WORLD, CINEMATIC METAPHOR you could actually film — a real ladder with a small figure on it, a fork in a road, scales tipping — set in the SAME world, lighting, and mood as every other beat. Do NOT write it as an infographic, chart, "diagram", "graphic", "cutaway", or any flat medium ("stark white lines on a dark charcoal background", "flat vector"), and do NOT carry meaning with arrows, icons, or labels — the look is decided by the style block appended afterward, and a clinical diagram will clash with a cinematic story. Carry the meaning through what is physically in frame: scale, height, distance, light, gesture.
- Use the narrator ONLY for beats truly about them or their reaction. Never put the narrator in more than two beats in a row — most beats should have no narrator at all (that is good).
- VARY THE SUBJECT and the shot type across beats — objects, environments, other people, details, symbolic frames; never the same subject or the same framing two beats running.
- CAPTIONS / NO BAKED-IN TEXT — never bake any text, title, caption, or label into the image (image tools garble words); carry meaning through the visual itself. A single karaoke word is overlaid low-center at runtime with a heavy black outline + shadow, so it stays readable over ANY image — do NOT reserve, blank out, darken, blur, or wall off a "caption zone", and NEVER split the frame into separate panels, bands, or a letterbox. Describe ONE single continuous, naturally framed 9:16 shot that fills the whole frame; the only nod to captions is to place the main focal point a touch above center so the overlaid word doesn't cover it.
- CONSISTENCY: WHENEVER a recurring character or location IS in frame, refer to them by their bible NAME and weave in their exact fixed description verbatim, so they render identically every time. Each frame is generated on its own with that entity's reference image attached — that reference image plus the verbatim description are what lock the look, so spell out the fixed appearance in full and you may add "matching its reference". Do NOT write "identical to earlier scenes": the single-image generator has no other scenes to compare against, so it does nothing.
- Do NOT mention art style, medium, render engine, or quality tags — a style block is appended automatically afterward.

animationPrompt — how the still MOVES over its clip (for an image-to-video tool):
- Describe ONLY the motion; never restate the appearance. Name ONE camera move and how it behaves over the clip (slow push-in, gentle parallax, locked-off with a slow tilt, soft handheld drift).
- Describe subtle subject motion (a breath, a blink, a small gesture) and ambient motion (hair, particles, haze, fabric). Favor subtle, low, contemplative motion — say so explicitly so it stays calm.
- Name what stays still/anchored so the character doesn't morph, and fold light negatives into plain words (steady face, no warping). Keep it under ~50 words, physically plausible for the clip length.

characterIds — the ids of bible characters visible in the beat.

GROW THE BIBLE WHEN A SUBJECT RECURS. The bible above is the fixed cast, but it may not contain every subject you choose to feature. If a CONCRETE subject — a specific object, prop, place, or person — appears in 2+ beats, OR is a single hero subject whose look must stay identical (e.g. a recurring metaphor object like the same ladder, the same letter, the same phone), and it is NOT already in the bible, then ADD it: emit an entry in bibleAdditions with a NEW kebab-case id, its kind (use "location" for objects/props/places, "character" for people), a short name, and a FIXED, concrete, style-neutral visualDescription — then reference that id in characterIds/locationIds in EVERY beat it appears in. This is what gives the subject one reusable reference image so it looks the same across shots. Do NOT add one-off background subjects, pure abstractions, or anything already in the bible (reference those by their existing id).

Keep continuity: consecutive beats should read like the same world and characters. Return everything through the emit_scenes tool, one entry per beat, in order.`;

// Scene-storyboard prompt for INFORMATIONAL / explainer writing styles (e.g. the
// "You should know" style). Same cutting mechanics as SCENE_SYSTEM — only the
// creative direction changes: clarity over emotional arc, literal demonstrative
// shots over metaphor, the object/action as hero, no invented talking head.
export const SCENE_SYSTEM_EXPLAINER = `You are a storyboard director and prompt artist for short-form vertical (9:16) EXPLAINER video. You receive: the tip's TITLE and CORE FACT (the useful thing being taught, often a corrected misconception), a VISUAL BIBLE (key objects, props & locations with fixed descriptions), and the NARRATION as numbered words, each tagged with the second it ends. Read the WHOLE narration first, then cut it into visual BEATS and write prompts for each.

DIRECT FOR CLARITY. The job is to make the USEFUL FACT land and stick — not to build emotional tension. The FIRST beat is the HOOK: the single most scroll-stopping frame, usually the surprising result or the exact mistake people make (e.g. a hand squeezing a tea bag). Then move the eye through the idea: show the claim, make the WHY / MECHANISM visible, then land the practical takeaway. Keep the energy bright, clean, and legible — every frame must read instantly on a phone. When the narration explains something INVISIBLE — a chemical process, a hidden force, what happens "inside," a cause you cannot photograph — make that beat a CONCEPT beat: design a clear visualization of the idea (a cutaway / cross-section, particles or flow, a labeled side-by-side) and tag it visualMode "concept". Never narrate over a static object and hope the idea reads.

CUTTING:
- A beat is a contiguous run of words sharing ONE clear image / visual moment. Break where the explanation turns visually — a new object, a new step, a before/after flip — not on arbitrary grammar.
- A beat's spoken length = (end time of its last word) − (end time of the word just before its first word; use 0 for the very first beat). Decide each beat's length yourself from its visual content and good short-form pacing: aim for beats of about 3–6 seconds (a 60–90s tip is typically 12–18 beats), favoring more, shorter shots over long holds. HARD RULE — no beat under ~2s of screen time on its own: you are given every word's end-time, so compute each candidate beat's span (end of its last word − end of the word before its first) and if a natural break would leave a beat under ~2s, do NOT emit it alone — MERGE those words into an adjacent beat (usually the following one) so no shot flashes by too briefly. A beat may run longer ONLY when its content genuinely needs a sustained hold — never to pad. NEVER let a beat exceed the hard maximum given in the user message; SPLIT it if it would.
- Beats must be contiguous and cover every word in order. Identify each beat ONLY by endWord: the index of the word it ends on. The next beat starts at the following word; the final beat must end on the very last word.

For each beat also write:

name — a 2–4 word beat name.

shotType — a 1–3 word shot label (wide establishing, macro insert, top-down, low-angle, POV, cutaway diagram, etc.). Vary it across beats; never repeat the same shotType back-to-back.

imagePrompt — the STARTING FRAME (a single still image), in vivid natural language (full sentences for Nano Banana / GPT-Image, NOT comma-separated tags):
- Compose for a 9:16 VERTICAL frame. State the shot size and camera angle (e.g. wide establishing, top-down flat-lay, low-angle medium, EXTREME MACRO close-up), a lens feel (shallow depth of field, etc.), subject placement, and the lighting / mood.
- EVERY BEAT IS ONE OF TWO MODES — set visualMode and write the image accordingly:
  • visualMode "live" — the beat shows something REAL you could film: an object, an action, a place (the squeeze, the mug, the leaf). Describe that real scene — the actual object/action, the process, the mechanism made visible. Macro insert shots are a strong tool. Where the fact corrects a mistake, contrast THE COMMON MISTAKE with THE RIGHT WAY across beats (before/after, wrong/right).
  • visualMode "concept" — the beat explains something INVISIBLE (chemistry, a force, time, "what's happening inside"). Design a clear visualization of the idea, and ROTATE the representation across concept beats so no two look alike: a cutaway / cross-section, drifting particles or flowing color, a physical analogy or metaphor object, a simple data-viz (a scale, meter, or bar), a before/after pair, or an icon-and-arrow explainer. Convey the meaning through the VISUAL itself — size, scale, color, position, arrows — not through baked-in words.
- The two modes are RENDERED IN DIFFERENT LOOKS automatically (live shots cinematic, concept shots as clean graphics), so DESCRIBE ONLY WHAT IS SHOWN AND THE COMPOSITION — do NOT specify the medium, photoreal-ness, "flat graphic", "3D", render engine, or quality tags. Never carry meaning with lighting or "mood" alone — if the viewer can't SEE the idea in the frame, it isn't there. Don't re-show the same object with only a lighting tweak.
- NO TEXT BAKED INTO THE IMAGE — image tools garble words and numbers. Never write labels, captions, or figures into the imagePrompt; convey the meaning through the VISUAL itself (size, scale, color, position, arrows), and make the image read with no words at all.
- The OBJECT, ACTION, or DIAGRAM is the hero — most beats should have NO person in them at all. If a hand or figure is needed to demonstrate, keep it a neutral, anonymous demonstrator (hands, a partial figure); never invent a narrator or talking head, and never put a face in a beat that doesn't need one.
- NO REPETITION — this is the most important rule. Every beat must look clearly DIFFERENT from its neighbors at a glance on a phone. Never repeat the same subject, composition, or shotType in two beats running, and do not lean on any single subject across the video. If you have already shown something, find a genuinely new representation — a cutaway, a diagram, a different object, a radically different scale or angle — rather than repeating it. Subtle differences (slightly darker liquid, warmer light, a tiny change of angle) do NOT count as variety.
- CAPTIONS / NO BAKED-IN TEXT — never bake any text, title, caption sentence, or label into the image (image tools garble words); for a diagram use only short one-or-two-word inline labels beside the elements they mark, never a sentence. A single karaoke word is overlaid low-center at runtime with a heavy black outline + shadow, so it stays readable over ANY image — do NOT reserve, blank out, darken, blur, or wall off a "caption zone", and NEVER split the frame into separate panels, bands, or a letterbox. Describe ONE single continuous, naturally framed 9:16 shot that fills the whole frame; the only nod to captions is to place the hero element a touch above center so the overlaid word doesn't cover it.
- CONSISTENCY: when a recurring object or location from the bible appears, refer to it by its bible NAME and weave in its exact fixed description verbatim, so it renders identically every time. Each frame is generated on its own with that entity's reference image attached — that reference image plus the verbatim description are what lock the look, so spell out the fixed appearance in full and you may add "matching its reference". Do NOT write "identical to the earlier scene": the single-image generator has no other scenes to compare against, so it does nothing. (Diagrams and abstract explanatory beats need not match a bible entry.)
- Do NOT mention art style, medium, render engine, or quality tags — a style block is appended automatically afterward.

animationPrompt — how the still MOVES over its clip (for an image-to-video tool):
- Describe ONLY the motion; never restate the appearance. Name ONE camera move and how it behaves over the clip (slow push-in on the object, gentle top-down parallax, locked-off macro with a slow rack focus, soft orbit).
- Describe the demonstrative motion the beat needs (the squeeze, the pour, steam rising, a hand setting something down) plus subtle ambient motion. Keep it clean and controlled rather than dramatic — say so explicitly.
- Name what stays still/anchored so the object doesn't warp, and fold light negatives into plain words (steady object, no warping). Keep it under ~50 words, physically plausible for the clip length.

characterIds — the ids of bible characters visible in the beat (often none for explainer beats).

locationIds — the ids of bible locations / key objects visible in the beat, so the same reference image can be reused across beats for visual consistency. List every bible location or object that actually appears.

GROW THE BIBLE WHEN AN OBJECT RECURS. The bible may not contain every object/prop you feature. If a concrete object, prop, or place appears in 2+ beats (or is a hero object whose look must stay identical across the before/after), and it is NOT already in the bible, ADD it: emit an entry in bibleAdditions with a NEW kebab-case id, kind "location" (or "character" only for a recurring person), a short name, and a FIXED, concrete, style-neutral visualDescription — then reference that id in locationIds in every beat it appears in. Do NOT add one-off subjects, abstract concepts, or anything already in the bible (reference those by their existing id).

Keep continuity: consecutive beats should read like the same clean world and the same objects. Return everything through the emit_scenes tool, one entry per beat, in order.`;

export const SCENE_TOOL = {
  name: "emit_scenes",
  description:
    "Return the ordered visual beats: where each one ends plus its prompts.",
  input_schema: {
    type: "object" as const,
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            endWord: {
              type: "integer",
              description:
                "Index of the last word included in this beat (from the numbered narration).",
            },
            name: {
              type: "string",
              description: "2-4 word beat name.",
            },
            shotType: {
              type: "string",
              description:
                "1-3 word shot label (wide, macro insert, top-down, low-angle, POV, cutaway diagram). Vary across beats; never repeat back-to-back.",
            },
            visualMode: {
              type: "string",
              enum: ["live", "concept"],
              description:
                "\"live\" = a real filmable object/action/place; \"concept\" = a visualization of an invisible idea (diagram/cutaway/particles). Picks the render style. Default \"live\".",
            },
            characterIds: {
              type: "array",
              items: { type: "string" },
              description: "ids of bible characters visible in this beat",
            },
            locationIds: {
              type: "array",
              items: { type: "string" },
              description:
                "ids of bible locations / key objects visible in this beat, so the same reference image can be reused for visual consistency",
            },
            imagePrompt: {
              type: "string",
              description:
                "Starting-frame description in natural language. No art style/medium/render engine.",
            },
            animationPrompt: {
              type: "string",
              description:
                "Motion + camera for image-to-video. Tool-agnostic. 1-3 sentences.",
            },
          },
          required: ["endWord", "name", "imagePrompt", "animationPrompt"],
        },
      },
      bibleAdditions: {
        type: "array",
        description:
          "NEW recurring subjects to add to the visual bible (see the system prompt). Omit or leave empty if there are none.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                "new kebab-case id, unique and NOT already in the bible (e.g. 'class-ladder', 'narrator-laptop').",
            },
            kind: {
              type: "string",
              enum: ["character", "location"],
              description:
                "'character' for a recurring person; 'location' for a recurring object, prop, or place.",
            },
            name: { type: "string", description: "short human name." },
            visualDescription: {
              type: "string",
              description:
                "Fixed, concrete, style-neutral visuals so it looks identical every appearance. No art style/medium.",
            },
          },
          required: ["id", "kind", "name", "visualDescription"],
        },
      },
    },
    required: ["scenes"],
  },
} as const;

/* --------------------------- caption emphasis ---------------------------- */

export const EMPHASIS_SYSTEM = `You decide which parts of a short vertical (TikTok/Reels) video's narration to visually EMPHASIZE in karaoke-style captions. The narration is given as a numbered list of "index:word" tokens (words may carry trailing punctuation). Captions show ONE word at a time; emphasized words pop in a bright accent colour, plain words stay white.

Return the 0-based indices of the CRUCIAL content — the standout words, short phrases, and the occasional whole short punchy sentence that carry the meaning and the emotional punch. Highlight a crucial unit as a WHOLE (a phrase as a contiguous run), not chopped into single words:
- crucial single words — numbers/amounts ("48", "$38,000", "six"), names, strong nouns/verbs;
- crucial short PHRASES — as a contiguous run (e.g. "phone man", "three-bedroom house", "higher on the ladder", "one rung below");
- a RARE, very short, punchy SENTENCE that is a genuine emotional beat or turn — every word of it (e.g. "Lower middle class. Lower.", "So. For what, exactly?"). A neutral scene-setting fact ("Mom stayed home.", "We had a dog.") is NOT a punch line — leave those plain.

CALIBRATION — this is the most important part:
- The plain white words must stay the MAJORITY. Highlights are the standout moments that make a beat POP — aim for roughly a QUARTER of the words, and never more than about a third. If more than ~a third is highlighted, you are highlighting too much and nothing stands out.
- Most highlighted spans are 1–5 words. Within a sentence, pick the single most important phrase — do NOT highlight the whole sentence unless it is short and genuinely a punch line.
- NEVER highlight long, multi-clause or multi-sentence stretches.
- Contiguous indices are expected WITHIN a highlighted phrase (include small glue words inside the span so it stays unbroken) — but keep the spans themselves short and surrounded by plain words.`;

export const EMPHASIS_TOOL = {
  name: "emit_emphasis",
  description: "Return the word indices to emphasize in the captions.",
  input_schema: {
    type: "object" as const,
    properties: {
      indices: {
        type: "array",
        items: { type: "integer" },
        description:
          "0-based indices of every word in the crucial content. Contiguous runs are expected for highlighted phrases and whole sentences.",
      },
    },
    required: ["indices"],
  },
} as const;

/* --- social caption + hashtags (`/api/projects/[id]/social`) --- */

export const CAPTION_SYSTEM = `You write the posting caption + hashtags for a short-form vertical video (TikTok / Reels / Shorts), given its narration script.

Return via the emit_caption tool:
- description: keep it SHORT. ONE punchy sentence, about 60 to 100 characters (never more than ~120), that hooks a scroller and captures the emotional core of the story. Prefer ending on a question or a gut-punch line that invites comments. Match the story's tone; never force hype on a sad or reflective story. Natural, spoken language, at most one tasteful emoji. IMPORTANT: do NOT use em dashes or en dashes (the "—" or "–" characters) anywhere; use commas, periods, or two short sentences instead. Do NOT put any hashtags inside the description.
- hashtags: EXACTLY 5 hashtags, each WITHOUT the leading "#", lowercase, no spaces or punctuation. Mix 1–2 broad discovery tags with 3–4 niche tags specific to this story's topic and audience. No spammy, banned, or engagement-bait tags.`;

export const CAPTION_TOOL = {
  name: "emit_caption",
  description: "Return a short social caption and exactly 5 hashtags.",
  input_schema: {
    type: "object" as const,
    properties: {
      description: {
        type: "string",
        description:
          "Short post caption: one punchy sentence (~60 to 100 chars). No em or en dashes. No hashtags. At most one emoji.",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description:
          "Exactly 5 hashtags WITHOUT the leading '#', lowercase, no spaces (e.g. 'followyourpassion').",
      },
    },
    required: ["description", "hashtags"],
  },
} as const;

/* --- visual bible from a finished script (`/api/projects/[id]/bible`) --- */
// Used when the user PASTED their own narration (so the script-writing agent
// never ran). Builds the same kind of cast agent 1 would, without rewriting.

export const BIBLE_SYSTEM = `You build the VISUAL BIBLE for a finished short-form narration script. You are NOT rewriting or changing the script — only cataloguing its visual cast so every shot of it stays consistent.

Read the whole narration, then return via the emit_bible tool:
- characters: every recurring PERSON the narration features (include the narrator only if they are actually shown; include named or clearly recurring people). For each: a kebab-case id, a short name, and a FIXED, concrete, style-neutral visualDescription (age, build, hair, eyes, skin, clothing, distinguishing features). No plot, no mood, no art style — only what they look like.
- locations: the recurring PLACES and key recurring OBJECTS/props the narration features (a specific room, a car, a phone, a letter — anything that must look identical each time it appears). For each: a kebab-case id, a short name, and a FIXED, concrete, style-neutral visualDescription (setting, key objects, materials). No art style.

Only include subjects that actually recur or are visually important; skip one-off background details and pure abstractions. Keep descriptions concrete and consistent so the same id always renders the same way. Return empty arrays if the script has no recurring subjects.`;

export const BIBLE_TOOL = {
  name: "emit_bible",
  description:
    "Return the visual bible (recurring characters + locations/objects) for a finished narration script.",
  input_schema: {
    type: "object" as const,
    properties: {
      visualBible: {
        type: "object",
        properties: {
          characters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "kebab-case id, e.g. 'narrator', 'older-brother'.",
                },
                name: { type: "string" },
                visualDescription: {
                  type: "string",
                  description:
                    "Fixed concrete visuals: age, build, hair, eyes, skin, clothing, distinguishing features. No plot, no art style.",
                },
              },
              required: ["id", "name", "visualDescription"],
            },
          },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                visualDescription: {
                  type: "string",
                  description:
                    "Setting, key objects, materials. Concrete and style-neutral. No art style.",
                },
              },
              required: ["id", "name", "visualDescription"],
            },
          },
        },
        required: ["characters", "locations"],
      },
    },
    required: ["visualBible"],
  },
} as const;
