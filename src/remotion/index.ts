// Remotion bundle entry point. Bundled by scripts/render-remotion.mjs (outside
// Next) and used as the render serveUrl. Never imported by Next code.

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
