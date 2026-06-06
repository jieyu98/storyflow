// Next.js startup hook. Starts the background batch pollers (Grok clips, Gemini
// images) when the Node server boots so any batch left "open" (e.g. across a
// dev-server restart) keeps draining without needing a tab open. Node runtime only.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensurePoller } = await import("./server/clipBatchPoller");
  ensurePoller();
  const { ensureImageBatchPoller } = await import(
    "./server/imageBatchPoller"
  );
  ensureImageBatchPoller();
  // A render isn't resumable across a restart — mark any left mid-render errored.
  const { resetStaleRenders } = await import("./server/db");
  resetStaleRenders();
}
