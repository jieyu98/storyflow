// The 9:16 composition. Shared by TWO callers:
//  - the in-browser <Player> (src/components/PreviewPlayer.tsx) for the preview, and
//  - the @remotion/renderer child process (scripts/render-remotion.mjs) for the
//    in-app MP4 export.
// It sequences each scene's clip under the voiceover by the scene's real timing,
// shows a placeholder for scenes with no clip, and (optionally) burns in
// karaoke captions. `baseUrl` is "" in the Player (relative URLs resolve against
// the page origin) and the absolute dev origin in the render (so the headless
// browser can reach the clip/audio API routes). Sizes are in 1080×1920 space.

import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { clipUrl, imageUrl } from "@/lib/storage";
import type { Scene, Word } from "@/lib/types";

// Loaded deterministically (Remotion waits for it) — Next's CSS font vars don't
// exist in the render bundle, so captions use this concrete family.
const { fontFamily } = loadFont("normal", { weights: ["600", "800"] });

export type PreviewProps = {
  scenes: Scene[];
  /** Indices of scenes that have a clip (Set isn't serializable as inputProps). */
  clipIndices: number[];
  /** Indices of scenes that have a generated starting-frame still. */
  imageIndices?: number[];
  projectId: string;
  clipVersion: number;
  /** Cache-bust nonce for still images (parallel to clipVersion). */
  imageVersion?: number;
  /** Preview the still starting frames instead of the clips (preview-only;
   *  the MP4 render never sets this, so it always uses clips). */
  useStills?: boolean;
  audioSrc: string;
  /** Per-word timings for karaoke captions. */
  captions?: Word[];
  showCaptions?: boolean;
  /** Word indices (into `captions`) to highlight in the accent colour. */
  emphasis?: number[];
  /** "" for the Player; absolute origin (http://localhost:3000) for the render. */
  baseUrl?: string;
};

function SceneLayer({
  scene,
  hasClip,
  hasImage,
  useStills,
  projectId,
  clipVersion,
  imageVersion,
  baseUrl,
}: {
  scene: Scene;
  hasClip: boolean;
  hasImage: boolean;
  useStills: boolean;
  projectId: string;
  clipVersion: number;
  imageVersion: number;
  baseUrl: string;
}) {
  // In stills mode show the starting frame; otherwise the clip. Either falls
  // back to the labelled placeholder when that asset doesn't exist yet.
  const showStill = useStills && hasImage;
  const showClip = !useStills && hasClip;
  return (
    <AbsoluteFill style={{ backgroundColor: "#070a12" }}>
      {showStill ? (
        <Img
          src={baseUrl + imageUrl(projectId, "scene", String(scene.index), imageVersion)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : showClip ? (
        <OffthreadVideo
          src={baseUrl + clipUrl(projectId, scene.index, clipVersion)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 80,
            textAlign: "center",
            background:
              "radial-gradient(120% 80% at 50% 25%, rgba(255,123,58,0.10), transparent 60%), #0b0f1a",
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(244,239,230,0.45)",
            }}
          >
            {useStills ? "no frame yet" : "no clip yet"}
          </span>
          <span
            style={{
              fontFamily,
              fontWeight: 800,
              fontSize: 64,
              lineHeight: 1.1,
              color: "#f4efe6",
            }}
          >
            {scene.name ?? `Scene ${scene.index + 1}`}
          </span>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// One word at a time: show only the word currently being spoken (a "pop" as
// each lands). Because the active word is whatever is sounding right now, it
// always belongs to the current scene — no cross-scene bleed possible. Words
// Claude flagged as emphasis pop in the accent colour (a touch larger).
function CaptionOverlay({
  words,
  emphasis,
}: {
  words: Word[];
  emphasis: Set<number>;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Active = the last REAL word that has started. Punctuation-only tokens (a
  // lone em dash from " — ") never become the caption — the previous word just
  // holds through that pause.
  const isReal = (s: string) => /[\p{L}\p{N}]/u.test(s);
  let idx = -1;
  for (let k = 0; k < words.length; k++) {
    if (words[k].start <= t) {
      if (isReal(words[k].text)) idx = k;
    } else break;
  }
  if (idx < 0) return null; // before the first spoken word
  const w = words[idx];

  // Drop the caption in trailing silence after the final real word.
  let lastReal = words.length - 1;
  while (lastReal >= 0 && !isReal(words[lastReal].text)) lastReal--;
  if (idx === lastReal && t > w.end + 0.5) return null;

  // Strip any stray leading/trailing em/en dashes (keep internal hyphens).
  const display = w.text.replace(/^[—–]+|[—–]+$/g, "");

  const hot = emphasis.has(idx);
  // Quick scale/opacity pop over the first ~120ms of the word.
  const appear = Math.min(1, Math.max(0, (t - w.start) / 0.12));
  const scale = (hot ? 0.9 : 0.86) + (hot ? 0.18 : 0.14) * appear;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "0 90px 380px",
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: hot ? 120 : 108,
          lineHeight: 1.1,
          color: hot ? "#ff8a4c" : "#ffffff",
          textAlign: "center",
          textShadow: "0 5px 22px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.95)",
          WebkitTextStroke: "2.5px rgba(0,0,0,0.6)",
          transform: `scale(${scale})`,
          opacity: Math.min(1, appear * 2.5),
        }}
      >
        {display}
      </span>
    </AbsoluteFill>
  );
}

export function PreviewComposition({
  scenes,
  clipIndices,
  projectId,
  clipVersion,
  audioSrc,
  captions = [],
  showCaptions = true,
  emphasis = [],
  baseUrl = "",
  imageIndices = [],
  imageVersion = 0,
  useStills = false,
}: PreviewProps) {
  const { fps, durationInFrames } = useVideoConfig();
  const has = new Set(clipIndices);
  const hasImg = new Set(imageIndices);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio src={baseUrl + audioSrc} />
      {scenes.map((s, i) => {
        // Pin each scene to its real start frame (rather than chaining with
        // <Series>) so rounding never lets the visuals drift off the audio.
        const start = Math.round(s.tStart * fps);
        const next = scenes[i + 1];
        const end = next ? Math.round(next.tStart * fps) : durationInFrames;
        const len = Math.max(1, end - start);
        return (
          <Sequence key={s.index} from={start} durationInFrames={len}>
            <SceneLayer
              scene={s}
              hasClip={has.has(s.index)}
              hasImage={hasImg.has(s.index)}
              useStills={useStills}
              projectId={projectId}
              clipVersion={clipVersion}
              imageVersion={imageVersion}
              baseUrl={baseUrl}
            />
          </Sequence>
        );
      })}
      {showCaptions && captions.length > 0 && (
        <CaptionOverlay words={captions} emphasis={new Set(emphasis)} />
      )}
    </AbsoluteFill>
  );
}
