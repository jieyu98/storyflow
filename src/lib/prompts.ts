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

export const SCENE_SYSTEM = `You are a storyboard and prompt artist for short-form vertical (9:16) video. You receive a narration script already cut into timed scenes, plus a visual bible of characters and locations. For EACH scene, write two prompts.

imagePrompt — the STARTING FRAME (a single still image) that best represents this beat:
- Vivid natural language (full sentences, conversational — written for image models like Nano Banana and GPT-Image, NOT comma-separated tags).
- Describe the subject(s), their pose / action / expression, the composition and camera framing, the setting, time of day, and lighting mood. Frame it for 9:16 vertical.
- CONSISTENCY IS CRITICAL: whenever a bible character or location appears, weave in their exact fixed description from the bible (verbatim details) so they look identical across every scene.
- Do NOT mention art style, medium, render engine, or quality tags — those are appended automatically afterward.

animationPrompt — how this still should MOVE over its clip:
- Favor SLOW, restrained, contemplative motion (gentle push-ins, drifts, small facial shifts, soft particles) over action. Describe subject motion, gestures, and environmental motion (hair, particles, haze), plus ONE clear camera move (slow push-in, gentle parallax, handheld drift, tilt, etc.).
- Tool-agnostic (must work in Kling, Veo, Grok, etc.). Do not restate the static scene — focus on motion and camera. 1-3 sentences, physically plausible for the scene's duration.

characterIds — the ids of bible characters visible in the scene.

Keep continuity: consecutive scenes should read like the same world and characters. Return everything through the emit_scene_prompts tool, one entry per scene index.`;

export const SCENE_TOOL = {
  name: "emit_scene_prompts",
  description: "Return an image prompt and animation prompt for each scene.",
  input_schema: {
    type: "object" as const,
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            characterIds: {
              type: "array",
              items: { type: "string" },
              description: "ids of bible characters visible in this scene",
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
          required: ["index", "imagePrompt", "animationPrompt"],
        },
      },
    },
    required: ["scenes"],
  },
} as const;
