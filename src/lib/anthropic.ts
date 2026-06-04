import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, serverEnv } from "@/server/env";
import { SCENE_SYSTEM, SCENE_TOOL, STORY_TOOL } from "./prompts";
import { numberedWords, type SceneBeat } from "./scenes";
import type { VisualBible, Word } from "./types";

function client(): Anthropic {
  return new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
}

function extractToolInput(
  message: Anthropic.Message,
  toolName: string,
): Record<string, unknown> {
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === toolName,
  );
  if (!block) {
    throw new Error(`Claude did not return ${toolName} output.`);
  }
  return block.input as Record<string, unknown>;
}

export type StoryResult = {
  title: string;
  coreTurn?: string;
  script: string;
  visualBible: VisualBible;
};

export async function generateStory(
  redditText: string,
  system: string,
): Promise<StoryResult> {
  const message = await client().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [STORY_TOOL as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: STORY_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Adapt the following text into a narration script and visual bible:\n\n${redditText}`,
      },
    ],
  });
  return extractToolInput(message, STORY_TOOL.name) as unknown as StoryResult;
}

function serializeBible(bible: VisualBible): string {
  const chars =
    bible.characters
      .map((c) => `- [${c.id}] ${c.name}: ${c.visualDescription}`)
      .join("\n") || "(none)";
  const locs =
    bible.locations
      .map((l) => `- [${l.id}] ${l.name}: ${l.visualDescription}`)
      .join("\n") || "(none)";
  return `Characters:\n${chars}\n\nLocations:\n${locs}`;
}

export async function generateSceneBeats(
  words: Word[],
  bible: VisualBible,
  maxSeconds: number,
  opts: { title?: string; coreTurn?: string; system?: string } = {},
): Promise<SceneBeat[]> {
  const userContent = `Hard maximum clip length: ${maxSeconds} seconds. Choose each beat's length yourself from its content and pacing — keep most beats short, and only approach this maximum when a beat genuinely needs a long, sustained hold.

STORY
Title: ${opts.title?.trim() || "(untitled)"}
Core turn / register: ${opts.coreTurn?.trim() || "(plain retelling)"}

VISUAL BIBLE
${serializeBible(bible)}

NARRATION (numbered words; each tagged with the second it ends)
${numberedWords(words)}`;

  const message = await client().messages.create({
    model: ANTHROPIC_MODEL,
    // Many short beats × two prompts each — needs plenty of headroom or the
    // tool JSON truncates (stop_reason: max_tokens) and parses to nothing.
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: opts.system ?? SCENE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SCENE_TOOL as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: SCENE_TOOL.name },
    messages: [{ role: "user", content: userContent }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "The scene plan was too long and got cut off. Try a shorter script or a larger max clip length (fewer beats).",
    );
  }

  const input = extractToolInput(message, SCENE_TOOL.name) as unknown as {
    scenes?: SceneBeat[];
  };
  return input.scenes ?? [];
}
