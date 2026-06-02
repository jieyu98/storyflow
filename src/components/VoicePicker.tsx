"use client";

import { useEffect, useRef, useState } from "react";
import { TTS_MODELS, type TtsModelId, type VoiceOption } from "@/lib/types";
import { ChevronDownIcon, PauseIcon, PlayIcon } from "./icons";

export default function VoicePicker({
  voiceId,
  onVoiceChange,
  model,
  onModelChange,
}: {
  voiceId?: string;
  onVoiceChange: (voiceId: string, voiceName: string) => void;
  model: TtsModelId;
  onModelChange: (model: TtsModelId) => void;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/voices");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load voices.");
        if (cancelled) return;
        const list: VoiceOption[] = data.voices ?? [];
        setVoices(list);
        if (!voiceId && list.length > 0) {
          onVoiceChange(list[0].voice_id, list[0].name);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load voices.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = voices.find((v) => v.voice_id === voiceId);

  function togglePreview() {
    const url = selected?.preview_url;
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (previewing) {
      a.pause();
      setPreviewing(false);
      return;
    }
    a.src = url;
    void a.play();
    setPreviewing(true);
    a.onended = () => setPreviewing(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-2">Voice</p>
        {error ? (
          <p className="rounded-xl border border-ember-600/40 bg-ember-600/10 px-3 py-2 text-xs text-ember-300">
            {error}
          </p>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={voiceId ?? ""}
                disabled={loading}
                onChange={(e) => {
                  const v = voices.find((x) => x.voice_id === e.target.value);
                  onVoiceChange(e.target.value, v?.name ?? "");
                }}
                className="field !py-3 w-full appearance-none pr-10 text-sm"
              >
                {loading && <option>Loading voices…</option>}
                {!loading && voices.length === 0 && (
                  <option>No voices in your account</option>
                )}
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                    {v.labels?.accent ? ` · ${v.labels.accent}` : ""}
                    {v.labels?.gender ? ` · ${v.labels.gender}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDownIcon
                width={16}
                height={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
              />
            </div>
            <button
              type="button"
              onClick={togglePreview}
              disabled={!selected?.preview_url}
              className="btn btn-ghost !px-3"
              aria-label="Preview voice"
              title={selected?.preview_url ? "Preview" : "No preview available"}
            >
              {previewing ? (
                <PauseIcon width={16} height={16} />
              ) : (
                <PlayIcon width={16} height={16} />
              )}
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">Model</p>
        <div className="grid grid-cols-2 gap-2">
          {TTS_MODELS.map((m) => {
            const active = m.id === model;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModelChange(m.id)}
                title={m.blurb}
                className={`btn !px-3 !py-2 !text-xs ${
                  active ? "btn-ember" : "btn-ghost opacity-80"
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
