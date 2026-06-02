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

export const SCENE_SYSTEM = `You are a storyboard director and prompt artist for short-form vertical (9:16) video. You are given a narration that has ALREADY been voiced — a numbered list of its words, each tagged with the second it ends — plus a visual bible of characters and locations. Your job: cut the narration into visual BEATS and write prompts for each.

CUTTING:
- A beat is a contiguous run of words sharing ONE clear image / visual moment. Break where the story turns visually or emotionally — not on arbitrary grammar.
- A beat's spoken length = (end time of its last word) − (end time of the word just before its first word; use 0 for the very first beat). Keep EVERY beat at or under the max clip length given in the user message, and avoid beats shorter than ~2s. Aim for natural beats — usually 6–9 total.
- Beats must be contiguous and cover every word in order. Identify each beat ONLY by endWord: the index of the word it ends on. The next beat starts at the following word; the final beat must end on the very last word.

For each beat also write:

name — a 2–4 word beat name.

imagePrompt — the STARTING FRAME (a single still image) that best represents this beat:
- Vivid natural language (full sentences, conversational — written for image models like Nano Banana and GPT-Image, NOT comma-separated tags).
- Describe the subject(s), their pose / action / expression, the composition and camera framing, the setting, time of day, and lighting mood. Frame it for 9:16 vertical.
- CONSISTENCY IS CRITICAL: whenever a bible character or location appears, weave in their exact fixed description from the bible (verbatim details) so they look identical across every scene.
- Do NOT mention art style, medium, render engine, or quality tags — those are appended automatically afterward.

animationPrompt — how this still should MOVE over its clip:
- Favor SLOW, restrained, contemplative motion (gentle push-ins, drifts, small facial shifts, soft particles) over action. Describe subject motion, gestures, and environmental motion (hair, particles, haze), plus ONE clear camera move (slow push-in, gentle parallax, handheld drift, tilt, etc.).
- Tool-agnostic (must work in Kling, Veo, Grok, etc.). Do not restate the static scene — focus on motion and camera. 1-3 sentences, physically plausible for the scene's duration.

characterIds — the ids of bible characters visible in the scene.

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
