// Client-side persistence. Project metadata lives in localStorage; the larger
// voiceover mp3 blob lives in IndexedDB (keyed by project id) to dodge the
// ~5 MB localStorage quota. All functions are no-ops / safe during SSR.

import type { Project } from "./types";

const PROJECTS_KEY = "storyflow.projects.v1";
const DB_NAME = "storyflow";
const DB_VERSION = 1;
const AUDIO_STORE = "audio";

const hasWindow = typeof window !== "undefined";

/* ----------------------------- Project metadata ---------------------------- */

export function listProjects(): Project[] {
  if (!hasWindow) return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getProject(id: string): Project | null {
  return listProjects().find((p) => p.id === id) ?? null;
}

export function upsertProject(project: Project): void {
  if (!hasWindow) return;
  const projects = listProjects().filter((p) => p.id !== project.id);
  projects.push(project);
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function deleteProject(id: string): void {
  if (!hasWindow) return;
  const projects = listProjects().filter((p) => p.id !== id);
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  void deleteAudio(id);
}

export function newProjectId(): string {
  if (hasWindow && "randomUUID" in crypto) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/* ------------------------------- Audio (IDB) ------------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasWindow || !("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAudio(id: string): Promise<Blob | null> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const req = tx.objectStore(AUDIO_STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteAudio(id: string): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Decode a base64 mp3 (from /api/tts) into a Blob for IndexedDB + playback. */
export function base64ToMp3Blob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "audio/mpeg" });
}
