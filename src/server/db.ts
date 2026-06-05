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

// Guard so schema setup + migrations run once per module evaluation. On a dev
// hot-reload this module is re-evaluated (resetting the flag) while the cached
// connection persists, so any newly-added migration still applies live without
// needing a server restart.
let schemaReady = false;

function db(): Database.Database {
  if (globalForDb.__storyflowDb) {
    ensureSchema(globalForDb.__storyflowDb);
    return globalForDb.__storyflowDb;
  }
  const dir = join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const conn = new Database(join(dir, "storyflow.db"));
  conn.pragma("journal_mode = WAL");
  globalForDb.__storyflowDb = conn;
  ensureSchema(conn);
  return conn;
}

function ensureSchema(conn: Database.Database): void {
  if (schemaReady) return;
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
    -- Versioned: many rows per (project_id, scope, key); exactly one is active
    -- (the "master"). Regenerating adds a new active row and demotes the rest;
    -- older versions are kept so the user can promote one back.
    CREATE TABLE IF NOT EXISTS images (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      scope      TEXT,           -- 'ref' (bible entity) | 'scene' (starting frame)
      key        TEXT,           -- entity id, or scene index as text
      mime       TEXT,
      data       BLOB NOT NULL,
      updated_at INTEGER,
      active     INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_images_key ON images (project_id, scope, key);
    -- One row per billed API call. project_id is nullable (the first story call
    -- happens before the project is persisted). Rows survive project deletion so
    -- the global spend total stays accurate.
    CREATE TABLE IF NOT EXISTS usage (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at         INTEGER NOT NULL,
      project_id         TEXT,
      provider           TEXT NOT NULL,   -- 'anthropic' | 'elevenlabs' | 'gemini' | 'grok'
      model              TEXT NOT NULL,
      operation          TEXT NOT NULL,   -- 'story' | 'scenes' | …
      input_tokens       INTEGER NOT NULL DEFAULT 0,
      output_tokens      INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
      cost_usd           REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_usage_project ON usage (project_id);
  `);
  migrateImagesToVersioned(conn);
  schemaReady = true;
}

// Upgrade an old single-row-per-key `images` table (composite PK, no id/active
// columns) to the versioned layout. Idempotent: a no-op once `active` exists.
function migrateImagesToVersioned(conn: Database.Database): void {
  const cols = conn
    .prepare("PRAGMA table_info(images)")
    .all() as { name: string }[];
  if (cols.some((c) => c.name === "active")) return; // already migrated

  conn.transaction(() => {
    conn.exec(`
      ALTER TABLE images RENAME TO images_legacy;
      CREATE TABLE images (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
        scope      TEXT,
        key        TEXT,
        mime       TEXT,
        data       BLOB NOT NULL,
        updated_at INTEGER,
        active     INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO images (project_id, scope, key, mime, data, updated_at, active)
        SELECT project_id, scope, key, mime, data, updated_at, 1 FROM images_legacy;
      DROP TABLE images_legacy;
      CREATE INDEX IF NOT EXISTS idx_images_key ON images (project_id, scope, key);
    `);
  })();
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

/** Store a newly generated image as the active version, demoting prior ones. */
export function saveImage(
  projectId: string,
  scope: string,
  key: string,
  mime: string,
  data: Buffer,
): number {
  const conn = db();
  return conn.transaction(() => {
    conn
      .prepare(
        "UPDATE images SET active = 0 WHERE project_id = ? AND scope = ? AND key = ?",
      )
      .run(projectId, scope, key);
    const info = conn
      .prepare(
        `INSERT INTO images (project_id, scope, key, mime, data, updated_at, active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(projectId, scope, key, mime, data, Date.now());
    return Number(info.lastInsertRowid);
  })();
}

/** The active ("master") version for a key. */
export function getImage(
  projectId: string,
  scope: string,
  key: string,
): { mime: string; data: Buffer } | null {
  const row = db()
    .prepare(
      `SELECT mime, data FROM images
       WHERE project_id = ? AND scope = ? AND key = ?
       ORDER BY active DESC, updated_at DESC, id DESC LIMIT 1`,
    )
    .get(projectId, scope, key) as { mime: string; data: Buffer } | undefined;
  return row ?? null;
}

/** A specific version by id (used to serve history thumbnails). */
export function getImageVersion(
  projectId: string,
  id: number,
): { mime: string; data: Buffer } | null {
  const row = db()
    .prepare("SELECT mime, data FROM images WHERE project_id = ? AND id = ?")
    .get(projectId, id) as { mime: string; data: Buffer } | undefined;
  return row ?? null;
}

/** All versions for a key, newest first, flagging the active one. */
export function listImageVersions(
  projectId: string,
  scope: string,
  key: string,
): { id: number; updatedAt: number; active: boolean }[] {
  const rows = db()
    .prepare(
      `SELECT id, updated_at, active FROM images
       WHERE project_id = ? AND scope = ? AND key = ?
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(projectId, scope, key) as {
    id: number;
    updated_at: number;
    active: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    active: r.active === 1,
  }));
}

/** Promote one version to master (active), demoting the others for its key. */
export function setActiveImage(
  projectId: string,
  scope: string,
  key: string,
  id: number,
): void {
  const conn = db();
  conn.transaction(() => {
    conn
      .prepare(
        "UPDATE images SET active = 0 WHERE project_id = ? AND scope = ? AND key = ?",
      )
      .run(projectId, scope, key);
    conn
      .prepare(
        "UPDATE images SET active = 1 WHERE project_id = ? AND scope = ? AND key = ? AND id = ?",
      )
      .run(projectId, scope, key, id);
  })();
}

/** Delete a single version. If it was the master, promote the newest remaining. */
export function deleteImageVersion(
  projectId: string,
  scope: string,
  key: string,
  id: number,
): void {
  const conn = db();
  conn.transaction(() => {
    conn
      .prepare("DELETE FROM images WHERE project_id = ? AND id = ?")
      .run(projectId, id);
    const hasActive = conn
      .prepare(
        "SELECT 1 FROM images WHERE project_id = ? AND scope = ? AND key = ? AND active = 1 LIMIT 1",
      )
      .get(projectId, scope, key);
    if (!hasActive) {
      conn
        .prepare(
          `UPDATE images SET active = 1
           WHERE id = (
             SELECT id FROM images
             WHERE project_id = ? AND scope = ? AND key = ?
             ORDER BY updated_at DESC, id DESC LIMIT 1
           )`,
        )
        .run(projectId, scope, key);
    }
  })();
}

/** Delete every version for a key (the "Remove" action / scene re-cut). */
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

/** Delete every image for a project under one scope (e.g. all "scene" frames). */
export function deleteImagesByScope(projectId: string, scope: string): void {
  db()
    .prepare("DELETE FROM images WHERE project_id = ? AND scope = ?")
    .run(projectId, scope);
}

export function listImageKeys(
  projectId: string,
): { scope: string; key: string }[] {
  const rows = db()
    .prepare(
      "SELECT DISTINCT scope, key FROM images WHERE project_id = ? ORDER BY scope, key",
    )
    .all(projectId) as { scope: string; key: string }[];
  return rows;
}

/* -------------------------------- usage ---------------------------------- */

export type UsageEntry = {
  projectId?: string | null;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

export function recordUsage(e: UsageEntry): void {
  db()
    .prepare(
      `INSERT INTO usage (
         created_at, project_id, provider, model, operation,
         input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost_usd
       ) VALUES (
         @created_at, @project_id, @provider, @model, @operation,
         @input_tokens, @output_tokens, @cache_write_tokens, @cache_read_tokens, @cost_usd
       )`,
    )
    .run({
      created_at: Date.now(),
      project_id: e.projectId ?? null,
      provider: e.provider,
      model: e.model,
      operation: e.operation,
      input_tokens: e.inputTokens,
      output_tokens: e.outputTokens,
      cache_write_tokens: e.cacheWriteTokens,
      cache_read_tokens: e.cacheReadTokens,
      cost_usd: e.costUsd,
    });
}

export type UsageSummary = {
  totalUsd: number;
  calls: number;
  byOperation: Record<string, { usd: number; calls: number }>;
  byModel: Record<string, { usd: number; calls: number }>;
};

/** Aggregate spend; pass a projectId to scope it to one project. */
export function usageSummary(projectId?: string): UsageSummary {
  const where = projectId ? "WHERE project_id = ?" : "";
  const params = projectId ? [projectId] : [];
  const conn = db();

  const total = conn
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS usd, COUNT(*) AS calls FROM usage ${where}`,
    )
    .get(...params) as { usd: number; calls: number };

  const group = (col: "operation" | "model") => {
    const rows = conn
      .prepare(
        `SELECT ${col} AS k, SUM(cost_usd) AS usd, COUNT(*) AS calls
           FROM usage ${where} GROUP BY ${col}`,
      )
      .all(...params) as { k: string; usd: number; calls: number }[];
    return Object.fromEntries(
      rows.map((r) => [r.k, { usd: r.usd, calls: r.calls }]),
    );
  };

  return {
    totalUsd: total.usd,
    calls: total.calls,
    byOperation: group("operation"),
    byModel: group("model"),
  };
}
