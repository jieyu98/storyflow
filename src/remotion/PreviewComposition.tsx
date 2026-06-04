// The 9:16 preview as a Remotion composition. It is rendered ONLY by the
// in-browser <Player> (src/components/PreviewPlayer.tsx) — StoryFlow never
// exports video, so this is a player, not a renderer. The composition sequences
// each scene's uploaded clip under the voiceover by the scene's real timing,
// shows a placeholder for scenes with no clip yet, and overlays `onScreenText`
// (which the old preview silently dropped). Sizes are in 1080×1920 canvas space;
// the Player scales them down to the small stage.

import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import { clipUrl } from "@/lib/storage";
import type { Scene } from "@/lib/types";

export type PreviewProps = {
  scenes: Scene[];
  /** Indices of scenes that have an uploaded clip (Set isn't serializable as inputProps). */
  clipIndices: number[];
  projectId: string;
  clipVersion: number;
  audioSrc: string;
};

function SceneLayer({
  scene,
  hasClip,
  projectId,
  clipVersion,
}: {
  scene: Scene;
  hasClip: boolean;
  projectId: string;
  clipVersion: number;
}) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#070a12" }}>
      {hasClip ? (
        <OffthreadVideo
          src={clipUrl(projectId, scene.index, clipVersion)}
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
              fontFamily: "var(--font-sans)",
              fontSize: 30,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(244,239,230,0.45)",
            }}
          >
            no clip yet
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 64,
              lineHeight: 1.1,
              color: "#f4efe6",
            }}
          >
            {scene.name ?? `Scene ${scene.index + 1}`}
          </span>
        </AbsoluteFill>
      )}

      {scene.onScreenText && scene.onScreenText.trim() ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 80px 180px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 800,
              fontSize: 60,
              lineHeight: 1.12,
              color: "#ffffff",
              textAlign: "center",
              padding: "28px 44px",
              borderRadius: 28,
              background: "rgba(7,10,18,0.55)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.8)",
            }}
          >
            {scene.onScreenText.trim()}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

export function PreviewComposition({
  scenes,
  clipIndices,
  projectId,
  clipVersion,
  audioSrc,
}: PreviewProps) {
  const { fps, durationInFrames } = useVideoConfig();
  const has = new Set(clipIndices);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio src={audioSrc} />
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
              projectId={projectId}
              clipVersion={clipVersion}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
