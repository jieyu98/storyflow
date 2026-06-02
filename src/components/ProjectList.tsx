"use client";

import Link from "next/link";
import type { Project } from "@/lib/types";
import { countWords } from "@/lib/text";
import { ArrowIcon, FilmIcon, MicIcon, TrashIcon } from "./icons";

function relativeDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ProjectList({
  projects,
  onDelete,
}: {
  projects: Project[];
  onDelete: (id: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-faint">
        No stories yet. Paste a thread above and your studio drafts will collect
        here.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((p) => {
        const sceneCount = p.scenes?.length ?? 0;
        return (
          <li
            key={p.id}
            className="surface group relative flex flex-col gap-3 p-4 transition hover:border-[var(--line-strong)]"
          >
            <Link
              href={`/studio/${p.id}`}
              className="absolute inset-0 z-0"
              aria-label={`Open ${p.title}`}
            />
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-semibold leading-tight text-cream">
                {p.title}
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(p.id);
                }}
                className="relative z-10 -m-1 rounded-lg p-1 text-faint opacity-0 transition hover:text-ember-400 group-hover:opacity-100"
                aria-label="Delete story"
              >
                <TrashIcon width={16} height={16} />
              </button>
            </div>

            <p className="line-clamp-2 text-xs leading-relaxed text-muted">
              {p.script || p.redditText}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 text-[0.68rem] text-faint">
              <span className="chip">{relativeDate(p.createdAt)}</span>
              <span className="chip">{countWords(p.script)} words</span>
              {p.hasAudio && (
                <span className="chip text-twilight-300">
                  <MicIcon width={12} height={12} /> voiced
                </span>
              )}
              {sceneCount > 0 && (
                <span className="chip text-ember-300">
                  <FilmIcon width={12} height={12} /> {sceneCount} scenes
                </span>
              )}
              <ArrowIcon
                width={16}
                height={16}
                className="ml-auto text-faint transition group-hover:translate-x-0.5 group-hover:text-ember-400"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
