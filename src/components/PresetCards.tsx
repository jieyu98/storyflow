"use client";

import { CheckIcon } from "./icons";

export type PresetOption = { id: string; name: string; sub: string };

export default function PresetCards({
  options,
  value,
  onChange,
}: {
  options: PresetOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`group relative flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
              active
                ? "border-ember-500/60 bg-ember-500/10"
                : "border-[var(--line)] bg-white/[0.02] hover:border-[var(--line-strong)]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                active
                  ? "border-ember-400 bg-ember-500 text-[#25150a]"
                  : "border-[var(--line-strong)] text-transparent"
              }`}
            >
              <CheckIcon width={13} height={13} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-cream">
                {opt.name}
              </span>
              <span className="block text-xs text-muted">{opt.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
