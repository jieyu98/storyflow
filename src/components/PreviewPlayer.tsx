"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/text";
import type { Scene, Word } from "@/lib/types";
import { PreviewComposition, type PreviewProps } from "@/remotion/PreviewComposition";
import { PauseIcon, PlayIcon } from "./icons";

// The voiceover is the master clock, so the visuals are sampled at audio rate.
// 30fps is plenty for previewing uploaded clips and keeps seeking snappy.
const FPS = 30;
const COMPOSITION_WIDTH = 1080;
const COMPOSITION_HEIGHT = 1920;

export default function PreviewPlayer({
  audioSrc,
  scenes,
  projectId,
  clips,
  clipVersion,
  images,
  imageVersion,
  duration,
  seekReq,
  captions,
  showCaptions = true,
  emphasis,
}: {
  audioSrc: string;
  scenes: Scene[];
  projectId: string;
  clips: Set<number>;
  clipVersion: number;
  /** All generated-image keys as `${scope}:${key}` (we use the `scene:` ones). */
  images: Set<string>;
  imageVersion: number;
  duration?: number;
  seekReq?: { t: number; n: number } | null;
  captions?: Word[];
  showCaptions?: boolean;
  emphasis?: number[];
}) {
  const playerRef = useRef<PlayerRef>(null);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  // Preview using the still starting frames instead of the clips.
  const [useStills, setUseStills] = useState(false);

  // Scene indices that have a generated starting-frame still.
  const imageIndices = useMemo(
    () => scenes.filter((s) => images.has(`scene:${s.index}`)).map((s) => s.index),
    [scenes, images],
  );

  const durSec =
    duration ?? (scenes.length ? scenes[scenes.length - 1].tSpokenEnd : 0);
  const totalFrames = Math.max(1, Math.round(durSec * FPS));

  // Remotion's <Player> is browser-only; don't mount it during SSR.
  useEffect(() => setMounted(true), []);

  const inputProps = useMemo<PreviewProps>(
    () => ({
      scenes,
      clipIndices: Array.from(clips),
      imageIndices,
      projectId,
      clipVersion,
      imageVersion,
      useStills,
      audioSrc,
      captions: captions ?? [],
      showCaptions,
      emphasis: emphasis ?? [],
      baseUrl: "", // relative URLs resolve against the page origin in the Player
    }),
    [
      scenes,
      clips,
      imageIndices,
      projectId,
      clipVersion,
      imageVersion,
      useStills,
      audioSrc,
      captions,
      showCaptions,
      emphasis,
    ],
  );

  function sceneAt(t: number): number {
    let i = 0;
    for (let k = 0; k < scenes.length; k++) {
      if (scenes[k].tStart <= t + 1e-3) i = k;
      else break;
    }
    return i;
  }

  // Mirror the player's clock into local state so the custom controls update.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, [mounted]);

  // External "jump to this scene" requests (the ▶ Preview button on a card).
  useEffect(() => {
    if (!seekReq) return;
    const p = playerRef.current;
    if (!p) return;
    const f = Math.max(0, Math.min(Math.round(seekReq.t * FPS), totalFrames - 1));
    p.seekTo(f);
    p.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekReq]);

  function toggle() {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else p.play();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const p = playerRef.current;
    if (!p || !totalFrames) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    p.seekTo(Math.round(ratio * (totalFrames - 1)));
  }

  const time = frame / FPS;
  const dur = totalFrames / FPS;
  const idx = sceneAt(time);
  const pct = totalFrames ? (frame / totalFrames) * 100 : 0;
  const uploaded = scenes.filter((s) => clips.has(s.index)).length;
  const shown = useStills ? imageIndices.length : uploaded;

  return (
    <div>
      {/* 9:16 stage */}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl border border-[var(--line)] bg-black shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        {mounted && (
          <Player
            ref={playerRef}
            component={PreviewComposition}
            inputProps={inputProps}
            durationInFrames={totalFrames}
            fps={FPS}
            compositionWidth={COMPOSITION_WIDTH}
            compositionHeight={COMPOSITION_HEIGHT}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
          />
        )}
        <div className="absolute left-2 top-2 chip !py-1 !text-[0.6rem]">
          {idx + 1}/{scenes.length}
        </div>
      </div>

      {/* full-width scene timeline */}
      <div
        onClick={seek}
        className="relative mt-4 w-full cursor-pointer select-none overflow-hidden rounded-xl border border-[var(--line)] bg-ink-900/60"
      >
        <div className="flex h-14">
          {scenes.map((s, i) => {
            const next = scenes[i + 1];
            const segEnd = next ? next.tStart : dur;
            const w = dur ? ((segEnd - s.tStart) / dur) * 100 : 0;
            const has = clips.has(s.index);
            const active = i === idx;
            return (
              <div
                key={s.index}
                title={s.name ?? `Scene ${i + 1}`}
                style={{ width: `${w}%` }}
                className={`relative flex min-w-0 flex-col justify-between overflow-hidden border-l border-[var(--line)] px-2 py-1.5 transition-colors first:border-l-0 ${
                  active ? "bg-ember-500/15" : ""
                }`}
              >
                <span
                  className={`font-mono text-[0.6rem] leading-none ${
                    active ? "text-ember-300" : "text-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`truncate text-[0.62rem] leading-tight ${
                    active ? "text-cream" : "text-faint/80"
                  }`}
                >
                  {s.name ?? ""}
                </span>
                <span
                  className={`mt-0.5 h-1 w-full rounded-full ${
                    has ? "bg-mint-400/70" : "bg-white/10"
                  }`}
                />
              </div>
            );
          })}
        </div>
        {/* played tint + playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-ember-500/10"
          style={{ width: `${pct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-ember-400 shadow-[0_0_8px_rgba(255,184,119,0.85)]"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* control bar */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="btn btn-ember flex !h-10 !w-10 shrink-0 items-center justify-center !rounded-full !p-0"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <PauseIcon width={16} height={16} />
          ) : (
            <PlayIcon width={16} height={16} className="ml-0.5" />
          )}
        </button>
        <span className="font-mono text-[0.7rem] text-faint">
          {formatTime(time)}{" "}
          <span className="text-faint/50">/ {formatTime(dur)}</span>
        </span>
        <div className="flex-1" />
        {/* Clips vs stills preview toggle */}
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-ink-900/60 p-0.5">
          {(
            [
              ["clips", "Clips"],
              ["stills", "Stills"],
            ] as const
          ).map(([val, label]) => {
            const on = (val === "stills") === useStills;
            return (
              <button
                key={val}
                type="button"
                onClick={() => setUseStills(val === "stills")}
                className={`rounded-md px-2.5 py-1 text-[0.62rem] font-medium transition ${
                  on ? "bg-ember-500 text-[#25150a]" : "text-faint hover:text-cream"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span
          className={`font-mono text-[0.65rem] ${
            shown === scenes.length ? "text-mint-400" : "text-faint"
          }`}
        >
          {shown}/{scenes.length} {useStills ? "frames" : "clips"}
        </span>
      </div>
    </div>
  );
}
