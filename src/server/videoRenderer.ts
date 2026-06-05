// Background video render. Runs in the Node server (started on demand from the
// render route). Gathers inputProps from the DB, then spawns the standalone
// Remotion render script as a CHILD PROCESS (so @remotion/renderer never loads
// inside Next), streaming its "PROGRESS" lines into the renders table. One
// render at a time (busy lock). Wrapped so a throw can never crash the server.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  failRender,
  finishRender,
  getProject,
  listClipIndexes,
  setRenderProgress,
} from "./db";
import { wordsFromAlignment } from "@/lib/alignment";

const g = globalThis as unknown as { __videoRenderer?: { busy: boolean } };

export function isRendering(): boolean {
  return Boolean(g.__videoRenderer?.busy);
}

/** Kick off a render in the background. Returns immediately; no-op if busy. */
export function startRenderJob(projectId: string): void {
  if (!g.__videoRenderer) g.__videoRenderer = { busy: false };
  if (g.__videoRenderer.busy) return;
  g.__videoRenderer.busy = true;
  void run(projectId).finally(() => {
    g.__videoRenderer!.busy = false;
  });
}

async function run(projectId: string): Promise<void> {
  let tmpDir: string | null = null;
  try {
    const project = getProject(projectId);
    if (!project || !project.scenes?.length) {
      failRender(projectId, "Project has no scenes to render.");
      return;
    }
    const words = project.alignment ? wordsFromAlignment(project.alignment) : [];
    const inputProps = {
      scenes: project.scenes,
      clipIndices: listClipIndexes(projectId).map((c) => c.index),
      projectId,
      clipVersion: Date.now(),
      audioSrc: `/api/projects/${projectId}/audio?v=${project.updatedAt}`,
      captions: words,
      showCaptions: project.renderCaptions ?? true,
      emphasis: project.captionEmphasis ?? [],
      baseUrl: process.env.RENDER_BASE_URL ?? "http://localhost:3000",
    };

    tmpDir = mkdtempSync(path.join(os.tmpdir(), "storyflow-render-"));
    const inJson = path.join(tmpDir, "input.json");
    const outMp4 = path.join(tmpDir, "out.mp4");
    writeFileSync(inJson, JSON.stringify(inputProps));

    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "render-remotion.mjs",
    );

    const result = await new Promise<{ code: number; stderr: string }>(
      (resolve) => {
        const child = spawn(
          process.execPath,
          [scriptPath, inJson, outMp4],
          { cwd: process.cwd(), env: process.env },
        );
        let stderr = "";
        let buf = "";
        child.stdout.on("data", (d) => {
          buf += d.toString();
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const m = line.match(/^PROGRESS\s+([\d.]+)/);
            if (m) setRenderProgress(projectId, Number(m[1]));
          }
        });
        child.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        child.on("error", (e) => resolve({ code: 1, stderr: stderr + String(e) }));
        child.on("close", (c) => resolve({ code: c ?? 1, stderr }));
      },
    );

    if (result.code === 0) {
      finishRender(projectId, readFileSync(outMp4));
    } else {
      const last =
        result.stderr.trim().split("\n").filter(Boolean).pop() ??
        "Render failed.";
      failRender(projectId, last.slice(0, 500));
    }
  } catch (e) {
    failRender(projectId, e instanceof Error ? e.message : "Render failed.");
  } finally {
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}
