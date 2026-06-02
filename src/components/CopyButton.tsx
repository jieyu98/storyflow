"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

export default function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`btn ${copied ? "btn-ember" : "btn-ghost"} !px-3 !py-1.5 !text-xs ${className}`}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <>
          <CheckIcon width={14} height={14} /> Copied
        </>
      ) : (
        <>
          <CopyIcon width={14} height={14} /> {label}
        </>
      )}
    </button>
  );
}
