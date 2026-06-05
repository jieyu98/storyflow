// Shared domain types for StoryFlow.

/** Hard ceiling on a single clip's length (seconds). The AI chooses each beat's
 *  length from its content; this is the absolute maximum it may never exceed. */
export const MAX_CLIP_SECONDS = 15;

/** A single spoken word with its time span (seconds) on the voiceover timeline. */
export type Word = {
  text: string;
  start: number;
  end: number;
};

/** Raw character-level alignment returned by ElevenLabs' with-timestamps endpoint. */
export type AlignmentArrays = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** A recurring character with a FIXED visual description for cross-scene consistency. */
export type BibleCharacter = {
  id: string;
  name: string;
  visualDescription: string;
  /** "scene" = minted by scene generation (agent 2); absent = authored with the script (agent 1). */
  origin?: "scene";
};

export type BibleLocation = {
  id: string;
  name: string;
  visualDescription: string;
  /** "scene" = minted by scene generation (agent 2); absent = authored with the script (agent 1). */
  origin?: "scene";
};

export type VisualBible = {
  characters: BibleCharacter[];
  locations: BibleLocation[];
};

/** An AI-authored visual beat with exact timing read from the voiceover. */
export type Scene = {
  index: number;
  startWord: number;
  endWord: number;
  /** Start time of the spoken content (seconds). */
  tStart: number;
  /** End time of the spoken content (seconds). */
  tSpokenEnd: number;
  /** Spoken span = tSpokenEnd - tStart. */
  span: number;
  /** Integer clip length in seconds = min(ceil(span), MAX_CLIP_SECONDS). */
  assignedDuration: number;
  text: string;
  /** Short 2-4 word beat name from the AI. */
  name?: string;
  /** True when span exceeds the max clip length (audio would overflow the clip). */
  clamped?: boolean;
  /** Starting-frame description (style preset is appended at display time). */
  imagePrompt?: string;
  /** Motion + camera description for image-to-video tools. */
  animationPrompt?: string;
  /** Ids of bible characters that appear in this scene. */
  characterIds?: string[];
  /** Ids of bible locations / key objects in this scene (for reference-image reuse). */
  locationIds?: string[];
  /** "live" = a real filmable object/action; "concept" = a visualization of an invisible idea. */
  visualMode?: "live" | "concept";
  /** Short shot label (e.g. "macro insert", "wide establishing"). */
  shotType?: string;
};

export type Project = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  redditText: string;
  script: string;
  visualBible: VisualBible;
  /** Writing-style preset id (see src/lib/scriptStyles.ts). */
  scriptStyleId: string;
  /** The betrayed-expectation / inversion the story hinges on (Recognition style). */
  coreTurn?: string;
  /** Art-style preset id (see src/lib/styles.ts). */
  stylePresetId: string;
  /** Art-style for "concept" scenes (explainer diagrams); falls back to stylePresetId. */
  conceptStylePresetId?: string;
  /** Claude model used to write the script (see STORY_MODELS); falls back to the server default. */
  scriptModelId?: StoryModelId;
  /** Claude model used to cut scenes (see SCENE_MODELS); falls back to the server default. */
  sceneModelId?: SceneModelId;
  /** Gemini image model (see IMAGE_MODELS); falls back to the server default. */
  imageModelId?: GeminiImageModelId;
  /** Generate Gemini images on the Flex tier (~50% cheaper, slower). */
  flexImages?: boolean;
  voiceId?: string;
  voiceName?: string;
  modelId?: string;
  alignment?: AlignmentArrays;
  /** The exact script text that produced the current alignment/voiceover. */
  voicedScript?: string;
  /** Total spoken length in seconds (last word end). */
  audioDuration?: number;
  /** Whether a voiceover blob exists in IndexedDB for this project. */
  hasAudio?: boolean;
  scenes?: Scene[];
  /** Bible entity ids whose reference image the user has marked generated (Automate stepper). */
  refDoneIds?: string[];
  /** Burn karaoke captions into the in-app render (default on when undefined). */
  renderCaptions?: boolean;
  /** Word indices (into the alignment word list) Claude chose to emphasize. */
  captionEmphasis?: number[];
};

/* ---------------------------- clip batch (Grok) --------------------------- */
// Async Grok Batch API job that generates many scene clips at once (cheaper,
// slower). State lives in its own `clip_batches` DB table (NOT on the Project
// JSON) because a server-side background poller writes it concurrently with the
// client's fire-and-forget project saves.

export type ClipBatchReqState = "pending" | "succeeded" | "failed" | "downloaded";

export type ClipBatchRequest = {
  sceneIndex: number;
  /** `scene-<index>` — links a batch result back to its scene. */
  batchRequestId: string;
  state: ClipBatchReqState;
  error?: string;
};

export type ClipBatch = {
  /** xAI batch id. */
  batchId: string;
  createdAt: number;
  /** xAI results expiry (ms epoch) — after this the signed media is unreachable. */
  expiresAt?: number;
  status: "open" | "complete" | "cancelled" | "expired";
  requests: ClipBatchRequest[];
  counts?: { total: number; pending: number; success: number; error: number };
  /** Cumulative cost (ticks, 1e-10 USD) already metered — guards double-charging. */
  costTicks?: number;
};

/** Trimmed voice shape surfaced to the client by /api/voices. */
export type VoiceOption = {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string | null;
  labels?: Record<string, string>;
};

/** Claude models offered for the user-selectable steps (script writing, scene cutting). */
export type ClaudeModelId =
  | "claude-sonnet-4-6"
  | "claude-opus-4-8"
  | "claude-haiku-4-5-20251001";

export type ClaudeModelOption = {
  id: ClaudeModelId;
  name: string;
  blurb: string;
};

/* --- script writing (`/api/story`) --- */
export type StoryModelId = ClaudeModelId;

export const STORY_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Sonnet 4.6",
    blurb: "Balanced quality and speed. Default.",
  },
  {
    id: "claude-opus-4-8",
    name: "Opus 4.8",
    blurb: "Richest, most vivid writing. Slower.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Haiku 4.5",
    blurb: "Fastest and cheapest.",
  },
];

export const DEFAULT_STORY_MODEL_ID: StoryModelId = "claude-sonnet-4-6";

/* --- scene cutting (`/api/scenes`) --- */
export type SceneModelId = ClaudeModelId;
export type SceneModelOption = ClaudeModelOption;

export const SCENE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Sonnet 4.6",
    blurb: "Balanced quality and speed. Default.",
  },
  {
    id: "claude-opus-4-8",
    name: "Opus 4.8",
    blurb: "Best reasoning — sharper beat cuts. Slower.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Haiku 4.5",
    blurb: "Fastest and cheapest.",
  },
];

export const DEFAULT_SCENE_MODEL_ID: SceneModelId = "claude-sonnet-4-6";

/* --- Gemini image generation (`/api/projects/[id]/images/generate`) --- */
export type GeminiImageModelId =
  | "gemini-3-pro-image"
  | "gemini-3.1-flash-image"
  | "gemini-2.5-flash-image";

export type ImageModelOption = {
  id: GeminiImageModelId;
  name: string;
  blurb: string;
};

export const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    blurb: "Best quality + text/reference consistency. ~$0.13/image. Default.",
  },
  {
    id: "gemini-3.1-flash-image",
    name: "Nano Banana 2",
    blurb: "Flash — cheaper & faster. ~$0.07/image.",
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Nano Banana 1",
    blurb: "Original, cheapest. ~$0.04/image.",
  },
];

export const DEFAULT_IMAGE_MODEL_ID: GeminiImageModelId = "gemini-3-pro-image";

/** TTS model options that reliably return word/character alignment. */
export type TtsModelId = "eleven_multilingual_v2" | "eleven_flash_v2_5";

export type TtsModelOption = {
  id: TtsModelId;
  name: string;
  blurb: string;
};

export const TTS_MODELS: TtsModelOption[] = [
  {
    id: "eleven_multilingual_v2",
    name: "Multilingual v2",
    blurb: "Warmest, most natural narration. Default.",
  },
  {
    id: "eleven_flash_v2_5",
    name: "Flash v2.5",
    blurb: "Faster & cheaper, still timestamped.",
  },
];
