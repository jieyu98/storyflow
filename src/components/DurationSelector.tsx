"use client";

import { ALL_DURATIONS, type Duration } from "@/lib/types";

export default function DurationSelector({
  allowed,
  onChange,
}: {
  allowed: Duration[];
  onChange: (next: Duration[]) => void;
}) {
  function toggle(d: Duration) {
    const has = allowed.includes(d);
    const raw = has ? allowed.filter((x) => x !== d) : [...allowed, d];
    if (raw.length === 0) return; // always keep at least one
    onChange(ALL_DURATIONS.filter((x) => raw.includes(x)));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_DURATIONS.map((d) => {
        const active = allowed.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            aria-pressed={active}
            className={`btn !px-4 !py-2 font-mono ${
              active ? "btn-ember" : "btn-ghost opacity-70"
            }`}
          >
            {d}s
          </button>
        );
      })}
    </div>
  );
}
