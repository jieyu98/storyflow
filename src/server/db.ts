// Server-side SQLite persistence (better-sqlite3). One file at .data/storyflow.db
// holds projects (whole Project as JSON) and their voiceover mp3 (as a BLOB).
// Single connection, cached across dev hot-reloads.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "@/lib/types";

const globalForDb = globalThis as unknown as {
  __storyflowDb?: Database.Database;
};

function db(): Database.Database {
  if (globalForDb.__storyflowDb) return globalForDb.__storyflowDb;
  const dir = join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const conn = new Database(join(dir, "storyflow.db"));
  conn.pragma("journal_mode = WAL");
  conn.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      updated_at INTEGER,
      data       TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audio (
      project_id TEXT PRIMARY KEY,
      mp3        BLOB NOT NULL,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS clips (
      project_id  TEXT,
      scene_index INTEGER,
      mime        TEXT,
      video       BLOB NOT NULL,
      updated_at  INTEGER,
      PRIMARY KEY (project_id, scene_index)
    );
    CREATE TABLE IF NOT EXISTS images (
      project_id TEXT,
      scope      TEXT,           -- 'ref' (bible entity) | 'scene' (starting frame)
      key        TEXT,           -- entity id, or scene index as text
      mime       TEXT,
      data       BLOB NOT NULL,
      updated_at INTEGER,
      PRIMARY KEY (project_id, scope, key)
    );
  `);
  globalForDb.__storyflowDb = conn;
  return conn;
}

export function listProjects(): Project[] {
  const rows = db()
    .prepare("SELECT data FROM projects ORDER BY updated_at DESC")
    .all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as Project);
}

export function getProject(id: string): Project | null {
  const row = db()
    .prepare("SELECT data FROM projects WHERE id = ?")
    .get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Project) : null;
}

export function upsertProject(p: Project): void {
  db()
    .prepare(
      `INSERT INTO projects (id, title, updated_at, data)
       VALUES (@id, @title, @updated_at, @data)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         updated_at = excluded.updated_at,
         data = excluded.data`,
    )
    .run({
      id: p.id,
      title: p.title ?? "",
      updated_at: p.updatedAt ?? Date.now(),
      data: JSON.stringify(p),
    });
}

export function deleteProject(id: string): void {
  const conn = db();
  conn.prepare("DELETE FROM projects WHERE id = ?").run(id);
  conn.prepare("DELETE FROM audio WHERE project_id = ?").run(id);
  conn.prepare("DELETE FROM clips WHERE project_id = ?").run(id);
  conn.prepare("DELETE FROM images WHERE project_id = ?").run(id);
}

export function saveAudio(id: string, mp3: Buffer): void {
  db()
    .prepare(
      `INSERT INTO audio (project_id, mp3, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         mp3 = excluded.mp3,
         updated_at = excluded.updated_at`,
    )
    .run(id, mp3, Date.now());
}

export function getAudio(id: string): Buffer | null {
  const row = db()
    .prepare("SELECT mp3 FROM audio WHERE project_id = ?")
    .get(id) as { mp3: Buffer } | undefined;
  return row ? row.mp3 : null;
}

/* -------------------------------- clips ---------------------------------- */

export function saveClip(
  projectId: string,
  sceneIndex: number,
  mime: string,
  video: Buffer,
): void {
  db()
    .prepare(
      `INSERT INTO clips (project_id, scene_index, mime, video, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id, scene_index) DO UPDATE SET
         mime = excluded.mime,
         video = excluded.video,
         updated_at = excluded.updated_at`,
    )
    .run(projectId, sceneIndex, mime, video, Date.now());
}

export function getClip(
  projectId: string,
  sceneIndex: number,
): { mime: string; video: Buffer } | null {
  const row = db()
    .prepare(
      "SELECT mime, video FROM clips WHERE project_id = ? AND scene_index = ?",
    )
    .get(projectId, sceneIndex) as { mime: string; video: Buffer } | undefined;
  return row ?? null;
}

export function deleteClip(projectId: string, sceneIndex: number): void {
  db()
    .prepare("DELETE FROM clips WHERE project_id = ? AND scene_index = ?")
    .run(projectId, sceneIndex);
}

export function deleteAllClips(projectId: string): void {
  db().prepare("DELETE FROM clips WHERE project_id = ?").run(projectId);
}

export function listClipIndexes(
  projectId: string,
): { index: number; mime: string }[] {
  const rows = db()
    .prepare(
      "SELECT scene_index, mime FROM clips WHERE project_id = ? ORDER BY scene_index",
    )
    .all(projectId) as { scene_index: number; mime: string }[];
  return rows.map((r) => ({ index: r.scene_index, mime: r.mime }));
}

/* ------------------------------- images ---------------------------------- */

export function saveImage(
  projectId: string,
  scope: string,
  key: string,
  mime: string,
  data: Buffer,
): void {
  db()
    .prepare(
      `INSERT INTO images (project_id, scope, key, mime, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, scope, key) DO UPDATE SET
         mime = excluded.mime,
         data = excluded.data,
         updated_at = excluded.updated_at`,
    )
    .run(projectId, scope, key, mime, data, Date.now());
}

export function getImage(
  projectId: string,
  scope: string,
  key: string,
): { mime: string; data: Buffer } | null {
  const row = db()
    .prepare(
      "SELECT mime, data FROM images WHERE project_id = ? AND scope = ? AND key = ?",
    )
    .get(projectId, scope, key) as { mime: string; data: Buffer } | undefined;
  return row ?? null;
}

export function deleteImage(
  projectId: string,
  scope: string,
  key: string,
): void {
  db()
    .prepare(
      "DELETE FROM images WHERE project_id = ? AND scope = ? AND key = ?",
    )
    .run(projectId, scope, key);
}

export function listImageKeys(
  projectId: string,
): { scope: string; key: string }[] {
  const rows = db()
    .prepare(
      "SELECT scope, key FROM images WHERE project_id = ? ORDER BY scope, key",
    )
    .all(projectId) as { scope: string; key: string }[];
  return rows;
}
