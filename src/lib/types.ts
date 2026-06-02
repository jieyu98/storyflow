// Shared domain types for StoryFlow.

export type Duration = 4 | 6 | 8 | 10;

export const ALL_DURATIONS: Duration[] = [4, 6, 8, 10];

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

/** A timed scene cut from the narration. Prompts are filled in by /api/scenes. */
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
  /** Clip length chosen from the allowed durations, >= span. */
  assignedDuration: Duration;
  text: string;
  /** True when the scene ended on a non-sentence boundary (mid-clause cut). */
  softCut?: boolean;
  /** True when a single word was longer than the largest allowed duration. */
  overflow?: boolean;
  /** Starting-frame description (style preset is appended at display time). */
  imagePrompt?: string;
  /** Motion + camera description for image-to-video tools. */
  animationPrompt?: string;
  /** Ids of bible characters that appear in this scene. */
  characterIds?: string[];
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
  allowedDurations: Duration[];
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
