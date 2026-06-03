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
- A beat's spoken length = (end time of its last word) − (end time of the word just before its first word; use 0 for the very first beat). Keep EVERY beat at or under the max clip length given in the user message; if a stretch would exceed it, SPLIT it into two beats. Aim for beats of about 4–6 seconds each (a 60–90s story is typically 12–18 beats) — favor more, shorter shots over long holds. Avoid beats shorter than ~2s.
- Beats must be contiguous and cover every word in order. Identify each beat ONLY by endWord: the index of the word it ends on. The next beat starts at the following word; the final beat must end on the very last word.

For each beat also write:

name — a 2–4 word beat name.

imagePrompt — the STARTING FRAME (a single still image), in vivid natural language (full sentences for Nano Banana / GPT-Image, NOT comma-separated tags):
- Compose for a 9:16 VERTICAL frame. State the shot size and camera angle (e.g. wide establishing, low-angle medium, extreme close-up), a lens feel (shallow depth of field, etc.), subject placement, expression, and the lighting / time-of-day mood.
- SHOW WHAT THE NARRATION DESCRIBES, NOT THE PERSON DESCRIBING IT. The story is first-person, but most beats should illustrate the concrete things, places, money, objects, and other people it mentions — using cutaways, insert shots, and symbolic / metaphor images. A line about a salary, an empty house, a diagnosis, or a rival should SHOW that thing, not a talking-head. This visual specificity is what makes the content land.
- Use the narrator ONLY for beats truly about them or their reaction. Never put the narrator in more than two beats in a row — most beats should have no narrator at all (that is good).
- VARY THE SUBJECT and the shot type across beats — objects, environments, other people, details, symbolic frames; never the same subject or the same framing two beats running.
- Keep the key subject in the upper-to-middle third and leave the dead-center-bottom clear — captions and platform UI sit there.
- CONSISTENCY: WHENEVER a recurring character or location IS in frame, refer to them by their bible NAME, state "the same [Name], identical to earlier scenes," then weave in their exact fixed description verbatim — so they look identical every time they appear.
- Do NOT mention art style, medium, render engine, or quality tags — a style block is appended automatically afterward.

animationPrompt — how the still MOVES over its clip (for an image-to-video tool):
- Describe ONLY the motion; never restate the appearance. Name ONE camera move and how it behaves over the clip (slow push-in, gentle parallax, locked-off with a slow tilt, soft handheld drift).
- Describe subtle subject motion (a breath, a blink, a small gesture) and ambient motion (hair, particles, haze, fabric). Favor subtle, low, contemplative motion — say so explicitly so it stays calm.
- Name what stays still/anchored so the character doesn't morph, and fold light negatives into plain words (steady face, no warping). Keep it under ~50 words, physically plausible for the clip length.

characterIds — the ids of bible characters visible in the beat.

Keep continuity: consecutive beats should read like the same world and characters. Return everything through the emit_scenes tool, one entry per beat, in order.`;

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
            characterIds: {
              type: "array",
              items: { type: "string" },
              description: "ids of bible characters visible in this beat",
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
    },
    required: ["scenes"],
  },
} as const;
