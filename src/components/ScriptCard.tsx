"use client";

import { countWords, estSeconds, formatTime } from "@/lib/text";
import { RefreshIcon, Spinner } from "./icons";

export default function ScriptCard({
  script,
  onChange,
  onRegenerate,
  regenerating,
  audioDuration,
  dirty,
  coreTurn,
}: {
  script: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  audioDuration?: number;
  dirty?: boolean;
  coreTurn?: string;
}) {
  const words = countWords(script);
  const seconds = audioDuration ? audioDuration : estSeconds(script);

  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Narration script</p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="btn btn-ghost !px-3 !py-1.5 !text-xs"
        >
          {regenerating ? (
            <>
              <Spinner width={14} height={14} /> Rewriting…
            </>
          ) : (
            <>
              <RefreshIcon width={14} height={14} /> Rewrite
            </>
          )}
        </button>
      </div>

      {coreTurn && (
        <p className="mt-3 border-l-2 border-ember-500/50 pl-3 font-display text-sm italic leading-relaxed text-ember-300/90">
          {coreTurn}
        </p>
      )}

      <textarea
        value={script}
        onChange={(e) => onChange(e.target.value)}
        rows={11}
        spellCheck={false}
        className="field mt-3 leading-7"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-faint">
        <span className="chip">{words} words</span>
        <span className="chip">
          {audioDuration ? "voiced " : "≈ "}
          {formatTime(seconds)}
        </span>
        {words < 150 && (
          <span className="text-ember-300/90">Under 60s — consider a richer source.</span>
        )}
        {dirty && (
          <span className="text-ember-300/90">
            Edited since voiceover — regenerate to apply.
          </span>
        )}
      </div>
    </section>
  );
}
