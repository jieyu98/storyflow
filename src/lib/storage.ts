// Client-side data access. Projects + voiceover now live in a server-side
// SQLite DB (see src/server/db.ts) reached through /api/projects. This module
// is the thin async client, plus a one-time migration of any projects left in
// the old browser localStorage / IndexedDB.

import type { ClipBatch, Project } from "./types";

const hasWindow = typeof window !== "undefined";

export async function listProjects(): Promise<Project[]> {
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) return [];
    return (await res.json()).projects ?? [];
  } catch {
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return null;
    return (await res.json()).project ?? null;
  } catch {
    return null;
  }
}

export async function upsertProject(project: Project): Promise<void> {
  await fetch(`/api/projects/${project.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: "DELETE" });
}

export function newProjectId(): string {
  if (hasWindow && "randomUUID" in crypto) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/* --------------------------------- usage --------------------------------- */

export type UsageSummary = {
  totalUsd: number;
  calls: number;
  byOperation: Record<string, { usd: number; calls: number }>;
  byModel: Record<string, { usd: number; calls: number }>;
};

const EMPTY_USAGE: UsageSummary = {
  totalUsd: 0,
  calls: 0,
  byOperation: {},
  byModel: {},
};

/** Spend summary; pass a projectId to scope it to one project. */
export async function getUsage(projectId?: string): Promise<UsageSummary> {
  try {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await fetch(`/api/usage${qs}`);
    if (!res.ok) return EMPTY_USAGE;
    return (await res.json()) as UsageSummary;
  } catch {
    return EMPTY_USAGE;
  }
}

/* --------------------------------- audio --------------------------------- */

export async function saveAudio(
  id: string,
  bytes: Uint8Array | ArrayBuffer | Blob,
): Promise<void> {
  await fetch(`/api/projects/${id}/audio`, {
    method: "PUT",
    headers: { "content-type": "audio/mpeg" },
    body: bytes as unknown as BodyInit,
  });
}

/** URL the <audio> element / download link points at; bump `version` to bust cache. */
export function audioUrl(id: string, version?: number): string {
  return `/api/projects/${id}/audio${version ? `?v=${version}` : ""}`;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ----------------------------- scene clips ------------------------------- */

export type ClipInfo = { index: number; mime: string };

export async function listClips(projectId: string): Promise<ClipInfo[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/clips`);
    if (!res.ok) return [];
    return (await res.json()).clips ?? [];
  } catch {
    return [];
  }
}

export async function saveClip(
  projectId: string,
  sceneIndex: number,
  file: File,
): Promise<void> {
  await fetch(`/api/projects/${projectId}/clips/${sceneIndex}`, {
    method: "PUT",
    headers: { "content-type": file.type || "video/mp4" },
    body: file,
  });
}

export async function deleteClip(
  projectId: string,
  sceneIndex: number,
): Promise<void> {
  await fetch(`/api/projects/${projectId}/clips/${sceneIndex}`, {
    method: "DELETE",
  });
}

export async function deleteAllClips(projectId: string): Promise<void> {
  await fetch(`/api/projects/${projectId}/clips`, { method: "DELETE" });
}

/**
 * Generate this scene's clip with Grok (image-to-video), animating the scene's
 * generated starting frame. Long-running (async on xAI's side); resolves once
 * the mp4 is downloaded and stored as the clip. Throws with the server message.
 */
export async function generateClip(
  projectId: string,
  sceneIndex: number,
  args: { prompt: string; duration?: number; aspectRatio?: string },
): Promise<void> {
  const res = await fetch(
    `/api/projects/${projectId}/clips/${sceneIndex}/generate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Clip generation failed.");
  }
}

export function clipUrl(
  projectId: string,
  sceneIndex: number,
  version?: number,
): string {
  return `/api/projects/${projectId}/clips/${sceneIndex}${version ? `?v=${version}` : ""}`;
}

/* --------------------------- clip batch (Grok) --------------------------- */

export type ClipBatchSceneInput = {
  index: number;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
};

/** Submit selected scenes as one async Grok batch. Throws with server message. */
export async function submitClipBatch(
  projectId: string,
  scenes: ClipBatchSceneInput[],
): Promise<{ clipBatch: ClipBatch; skipped: number[] }> {
  const res = await fetch(`/api/projects/${projectId}/clips/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenes }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Could not submit the clip batch.");
  }
  return res.json();
}

/** Current batch status (the server-side poller keeps it fresh). */
export async function getClipBatch(projectId: string): Promise<ClipBatch | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/clips/batch`);
    if (!res.ok) return null;
    return (await res.json()).clipBatch ?? null;
  } catch {
    return null;
  }
}

export async function cancelClipBatch(
  projectId: string,
): Promise<ClipBatch | null> {
  const res = await fetch(`/api/projects/${projectId}/clips/batch`, {
    method: "DELETE",
  });
  if (!res.ok) return null;
  return (await res.json()).clipBatch ?? null;
}

/* -------------------------- generated images ----------------------------- */

export type ImageScope = "ref" | "scene";

/** Existing generated-image keys for a project, as `${scope}:${key}` strings. */
export async function listImages(projectId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/images`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      images?: { scope: string; key: string }[];
    };
    return (data.images ?? []).map((i) => `${i.scope}:${i.key}`);
  } catch {
    return [];
  }
}

/** Generate (and store) an image via Nano Banana. Throws with the server message. */
export async function generateImage(
  projectId: string,
  args: {
    scope: ImageScope;
    key: string;
    prompt: string;
    referenceKeys?: string[];
    aspectRatio?: string;
    flex?: boolean;
    imageModelId?: string;
  },
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/images/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Image generation failed.");
  }
}

export async function deleteImage(
  projectId: string,
  scope: ImageScope,
  key: string,
): Promise<void> {
  await fetch(
    `/api/projects/${projectId}/images/${scope}/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );
}

/** Delete every generated image for a project under one scope ("ref" | "scene"). */
export async function deleteAllImages(
  projectId: string,
  scope: ImageScope,
): Promise<void> {
  await fetch(`/api/projects/${projectId}/images?scope=${scope}`, {
    method: "DELETE",
  });
}

/* ----------------------- image versions (history) ------------------------ */

export type ImageVersion = { id: number; updatedAt: number; active: boolean };

/** All stored versions for one image, newest first (the active one is master). */
export async function listImageVersions(
  projectId: string,
  scope: ImageScope,
  key: string,
): Promise<ImageVersion[]> {
  try {
    const res = await fetch(
      `/api/projects/${projectId}/images/${scope}/${encodeURIComponent(key)}/versions`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { versions?: ImageVersion[] };
    return data.versions ?? [];
  } catch {
    return [];
  }
}

/** Promote a stored version to master (active). */
export async function setMasterImage(
  projectId: string,
  scope: ImageScope,
  key: string,
  id: number,
): Promise<void> {
  const res = await fetch(
    `/api/projects/${projectId}/images/${scope}/${encodeURIComponent(key)}/versions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to set master image.");
  }
}

/** Delete a single stored version (not the whole image). */
export async function deleteImageVersion(
  projectId: string,
  scope: ImageScope,
  key: string,
  id: number,
): Promise<void> {
  await fetch(
    `/api/projects/${projectId}/images/${scope}/${encodeURIComponent(key)}?id=${id}`,
    { method: "DELETE" },
  );
}

export function imageUrl(
  projectId: string,
  scope: ImageScope,
  key: string,
  version?: number,
  id?: number,
): string {
  const params = new URLSearchParams();
  if (id != null) params.set("id", String(id)); // a specific version's bytes
  if (version) params.set("v", String(version)); // cache-bust nonce
  const qs = params.toString();
  return `/api/projects/${projectId}/images/${scope}/${encodeURIComponent(key)}${
    qs ? `?${qs}` : ""
  }`;
}

/* ----------------------- one-time legacy migration ----------------------- */

const LEGACY_KEY = "storyflow.projects.v1";

/** Move any projects still in browser localStorage/IndexedDB into SQLite. */
export async function migrateLegacy(): Promise<number> {
  if (!hasWindow) return 0;
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return 0;
  let moved = 0;
  try {
    const projects = JSON.parse(raw) as Project[];
    for (const p of projects) {
      await upsertProject(p);
      const blob = await legacyAudio(p.id);
      if (blob) await saveAudio(p.id, blob);
      moved++;
    }
  } catch {
    // leave the key in place if anything failed mid-way
    return moved;
  }
  window.localStorage.removeItem(LEGACY_KEY);
  return moved;
}

/** Read one mp3 from the old IndexedDB store ("storyflow" → "audio"). */
function legacyAudio(id: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) return resolve(null);
    const req = window.indexedDB.open("storyflow", 1);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const dbi = req.result;
      if (!dbi.objectStoreNames.contains("audio")) {
        dbi.close();
        return resolve(null);
      }
      const tx = dbi.transaction("audio", "readonly");
      const get = tx.objectStore("audio").get(id);
      get.onsuccess = () => {
        resolve((get.result as Blob) ?? null);
        dbi.close();
      };
      get.onerror = () => {
        resolve(null);
        dbi.close();
      };
    };
    // If the old DB never existed, onupgradeneeded creates an empty one — fine.
    req.onupgradeneeded = () => {
      /* no-op */
    };
  });
}
