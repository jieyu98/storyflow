// Next.js startup hook. Starts the Grok clip-batch background poller when the
// Node server boots so any batch left "open" (e.g. across a dev-server restart)
// keeps draining without needing a tab open. Node runtime only.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensurePoller } = await import("./server/clipBatchPoller");
  ensurePoller();
}
