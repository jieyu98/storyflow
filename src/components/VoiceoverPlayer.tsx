"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/text";
import type { Scene } from "@/lib/types";
import { DownloadIcon, PauseIcon, PlayIcon } from "./icons";

export default function VoiceoverPlayer({
  src,
  duration,
  scenes,
  title,
}: {
  src: string;
  duration?: number;
  scenes: Scene[];
  title: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(duration ?? 0);

  useEffect(() => {
    if (duration) setDur(duration);
  }, [duration]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) a.pause();
    else void a.play();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = Math.max(0, Math.min(1, ratio)) * dur;
    setTime(a.currentTime);
  }

  const pct = dur ? (time / dur) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDur(d);
        }}
        onEnded={() => setPlaying(false)}
      />

      <button
        type="button"
        onClick={toggle}
        className="btn btn-ember flex !h-11 !w-11 shrink-0 items-center justify-center !rounded-full !p-0"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <PauseIcon width={18} height={18} />
        ) : (
          <PlayIcon width={18} height={18} className="ml-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={seek}
          className="group relative h-2.5 cursor-pointer rounded-full bg-white/8"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember-500 to-ember-400"
            style={{ width: `${pct}%` }}
          />
          {/* scene boundary ticks */}
          {dur > 0 &&
            scenes.slice(1).map((s) => (
              <span
                key={s.index}
                className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-cream/30"
                style={{ left: `${(s.tStart / dur) * 100}%` }}
              />
            ))}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ember-300 bg-ink-900 shadow-[0_0_12px_rgba(255,123,58,0.7)]"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[0.68rem] text-faint">
          <span>{formatTime(time)}</span>
          <span>{formatTime(dur)}</span>
        </div>
      </div>

      <a
        href={src}
        download={`${title.replace(/[^\w-]+/g, "_") || "voiceover"}.mp3`}
        className="btn btn-ghost shrink-0 !px-3"
        aria-label="Download mp3"
        title="Download mp3"
      >
        <DownloadIcon width={16} height={16} />
      </a>
    </div>
  );
}
