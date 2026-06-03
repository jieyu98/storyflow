"use client";

import { useRef, useState } from "react";
import { clipUrl, deleteClip, saveClip } from "@/lib/storage";
import { FilmIcon, Spinner, TrashIcon } from "./icons";

export default function ClipDrop({
  projectId,
  sceneIndex,
  hasClip,
  version,
  onChange,
}: {
  projectId: string;
  sceneIndex: number;
  hasClip: boolean;
  version: number;
  onChange: (index: number, hasClip: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("video/")) return;
    setBusy(true);
    try {
      await saveClip(projectId, sceneIndex, file);
      onChange(sceneIndex, true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteClip(projectId, sceneIndex);
      onChange(sceneIndex, false);
    } finally {
      setBusy(false);
    }
  }

  if (hasClip) {
    return (
      <div className="relative mt-3 overflow-hidden rounded-xl border border-[var(--line)] bg-ink-950/50">
        <video
          src={clipUrl(projectId, sceneIndex, version)}
          className="max-h-56 w-full bg-black object-contain"
          controls
          muted
          playsInline
          preload="metadata"
        />
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="absolute right-1.5 top-1.5 rounded-lg bg-ink-950/80 p-1.5 text-faint backdrop-blur transition hover:text-ember-400"
          aria-label="Remove clip"
        >
          {busy ? (
            <Spinner width={14} height={14} />
          ) : (
            <TrashIcon width={14} height={14} />
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-xs transition ${
        drag
          ? "border-ember-500 bg-ember-500/10 text-ember-300"
          : "border-[var(--line-strong)] text-faint hover:border-ember-500/50 hover:text-cream"
      }`}
    >
      {busy ? (
        <>
          <Spinner width={14} height={14} /> Uploading…
        </>
      ) : (
        <>
          <FilmIcon width={14} height={14} /> Drop your clip here or click to
          upload
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
