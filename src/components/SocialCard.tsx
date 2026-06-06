"use client";

import CopyButton from "./CopyButton";
import { SparkIcon, Spinner } from "./icons";

/**
 * "Caption & hashtags" section — a one-click AI-written post caption + 5 hashtags
 * for TikTok / Reels, derived from the narration script. Copy buttons for each
 * piece plus a "Copy all" (caption + hashtags) ready to paste.
 */
export default function SocialCard({
  description,
  hashtags,
  onGenerate,
  generating,
  error,
}: {
  description?: string;
  hashtags?: string[];
  onGenerate: () => void;
  generating: boolean;
  error?: string | null;
}) {
  const tags = hashtags ?? [];
  const has = Boolean(description || tags.length);
  const tagLine = tags.map((h) => `#${h}`).join(" ");
  const copyAll = [description, tagLine].filter(Boolean).join("\n\n");

  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-2">
          <SparkIcon width={14} height={14} /> Caption &amp; hashtags
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="btn btn-ember !px-3 !py-1.5 !text-xs"
        >
          {generating ? (
            <>
              <Spinner width={13} height={13} /> Writing…
            </>
          ) : has ? (
            "Regenerate"
          ) : (
            "Generate"
          )}
        </button>
      </div>
      <p className="mt-1 text-xs text-faint">
        A short post caption + 5 hashtags for TikTok / Reels, written from your
        script.
      </p>

      {error && <p className="mt-3 text-xs text-ember-300">{error}</p>}

      {has && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-[var(--line)] bg-ink-950/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ember-300">Caption</span>
              <CopyButton text={description ?? ""} />
            </div>
            <p className="text-sm leading-relaxed text-cream/90">{description}</p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-ink-950/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-twilight-300">
                Hashtags
              </span>
              <CopyButton text={tagLine} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((h) => (
                <span key={h} className="chip text-twilight-300">
                  #{h}
                </span>
              ))}
            </div>
          </div>

          <CopyButton text={copyAll} label="Copy all" />
        </div>
      )}
    </section>
  );
}
