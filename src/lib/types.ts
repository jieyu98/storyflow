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
};

export type BibleLocation = {
  id: string;
  name: string;
  visualDescription: string;
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
  /** Optional caption/label to overlay in the editor — never baked into the image. */
  onScreenText?: string;
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
};

/** Trimmed voice shape surfaced to the client by /api/voices. */
export type VoiceOption = {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string | null;
  labels?: Record<string, string>;
};

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
