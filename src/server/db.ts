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
