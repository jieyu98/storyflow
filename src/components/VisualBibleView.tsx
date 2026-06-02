"use client";

import { useState } from "react";
import type { VisualBible } from "@/lib/types";
import { ChevronDownIcon } from "./icons";

export default function VisualBibleView({ bible }: { bible: VisualBible }) {
  const [open, setOpen] = useState(false);
  const count = bible.characters.length + bible.locations.length;
  if (count === 0) return null;

  return (
    <section className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="eyebrow">Visual bible</span>
          <span className="mt-0.5 block text-xs text-faint">
            {bible.characters.length} characters · {bible.locations.length}{" "}
            locations — kept consistent across every frame
          </span>
        </span>
        <ChevronDownIcon
          width={18}
          height={18}
          className={`shrink-0 text-faint transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-[var(--line)] px-5 py-5 sm:grid-cols-2">
          <BibleColumn title="Characters" items={bible.characters} />
          <BibleColumn title="Locations" items={bible.locations} />
        </div>
      )}
    </section>
  );
}

function BibleColumn({
  title,
  items,
}: {
  title: string;
  items: { id: string; name: string; visualDescription: string }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-twilight-300">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-faint">None</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-cream">
                  {it.name}
                </span>
                <span className="font-mono text-[0.62rem] text-faint">
                  {it.id}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {it.visualDescription}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
