"use client";

import { useEffect, useRef, useState } from "react";
import { clipUrl } from "@/lib/storage";
import { formatTime } from "@/lib/text";
import type { Scene } from "@/lib/types";
import { PauseIcon, PlayIcon } from "./icons";

export default function PreviewPlayer({
  audioSrc,
  scenes,
  projectId,
  clips,
  clipVersion,
  duration,
  seekReq,
}: {
  audioSrc: string;
  scenes: Scene[];
  projectId: string;
  clips: Set<number>;
  clipVersion: number;
  duration?: number;
  seekReq?: { t: number; n: number } | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadedKey = useRef<string>("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(
    duration ?? (scenes.length ? scenes[scenes.length - 1].tSpokenEnd : 0),
  );
  const [idx, setIdx] = useState(0);

  function sceneAt(t: number): number {
    let i = 0;
    for (let k = 0; k < scenes.length; k++) {
      if (scenes[k].tStart <= t + 1e-3) i = k;
      else break;
    }
    return i;
  }

  // Load the right clip into the <video> for the current scene + seek its offset.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sc = scenes[idx];
    if (sc && clips.has(sc.index)) {
      const key = `${sc.index}:${clipVersion}`;
      const offset = Math.max(0, (audioRef.current?.currentTime ?? 0) - sc.tStart);
      const seekIn = () => {
        try {
          v.currentTime = Math.min(offset, v.duration || offset);
        } catch {
          /* not seekable yet */
        }
        if (playing) void v.play().catch(() => {});
      };
      if (loadedKey.current !== key) {
        loadedKey.current = key;
        v.src = clipUrl(projectId, sc.index, clipVersion);
        v.onloadedmetadata = seekIn;
      } else {
        seekIn();
      }
    } else {
      loadedKey.current = "";
      v.removeAttribute("src");
      try {
        v.load();
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, clipVersion]);

  // External "jump to this scene" requests (the ▶ Preview button on a card).
  useEffect(() => {
    if (!seekReq) return;
    const a = audioRef.current;
    if (!a) return;
    const t = Math.max(0, Math.min(seekReq.t, dur || seekReq.t));
    a.currentTime = t;
    setTime(t);
    setIdx(sceneAt(t));
    void a.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekReq]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else void a.play();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * dur;
    a.currentTime = t;
    setTime(t);
    const ni = sceneAt(t);
    setIdx(ni);
    const v = videoRef.current;
    const sc = scenes[ni];
    if (v && sc && clips.has(sc.index)) {
      try {
        v.currentTime = Math.max(0, t - sc.tStart);
      } catch {
        /* ignore */
      }
    }
  }

  const cur = scenes[idx];
  const hasClipNow = Boolean(cur && clips.has(cur.index));
  const pct = dur ? (time / dur) * 100 : 0;
  const uploaded = scenes.filter((s) => clips.has(s.index)).length;

  return (
    <div>
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          const v = videoRef.current;
          if (v && v.getAttribute("src")) void v.play().catch(() => {});
        }}
        onPause={() => {
          setPlaying(false);
          videoRef.current?.pause();
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          const ni = sceneAt(t);
          if (ni !== idx) setIdx(ni);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDur(d);
        }}
        onEnded={() => {
          setPlaying(false);
          videoRef.current?.pause();
        }}
      />

      {/* 9:16 stage */}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl border border-[var(--line)] bg-black shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="auto"
          style={{ display: hasClipNow ? "block" : "none" }}
        />
        {!hasClipNow && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-[0.65rem] uppercase tracking-wider text-faint">
              no clip yet
            </span>
            <span className="font-display text-sm text-cream">
              {cur?.name ?? `Scene ${idx + 1}`}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2 chip !py-1 !text-[0.6rem]">
          {idx + 1}/{scenes.length}
        </div>
      </div>

      {/* controls */}
      <div className="mx-auto mt-3 flex max-w-[320px] items-center gap-3">
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
        <div className="min-w-0 flex-1">
          <div
            onClick={seek}
            className="relative h-2 cursor-pointer rounded-full bg-white/8"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember-500 to-ember-400"
              style={{ width: `${pct}%` }}
            />
            {dur > 0 &&
              scenes.slice(1).map((s) => (
                <span
                  key={s.index}
                  className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-cream/25"
                  style={{ left: `${(s.tStart / dur) * 100}%` }}
                />
              ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-faint">
            <span>{formatTime(time)}</span>
            <span className={uploaded === scenes.length ? "text-mint-400" : ""}>
              {uploaded}/{scenes.length} clips
            </span>
            <span>{formatTime(dur)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
