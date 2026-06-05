// Remotion Root: registers the shared composition so the renderer
// (scripts/render-remotion.mjs) can select + render it. The Player doesn't use
// this — it mounts <PreviewComposition> directly. Duration is derived from the
// scenes (last tSpokenEnd) exactly like PreviewPlayer, so export length ==
// preview length.

import { Composition } from "remotion";
import { PreviewComposition, type PreviewProps } from "./PreviewComposition";

const FPS = 30;

const DEFAULT_PROPS: PreviewProps = {
  scenes: [],
  clipIndices: [],
  projectId: "",
  clipVersion: 0,
  audioSrc: "",
  captions: [],
  showCaptions: true,
  baseUrl: "",
};

export const RemotionRoot = () => (
  <Composition
    id="storyflow"
    component={PreviewComposition}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={1}
    defaultProps={DEFAULT_PROPS}
    calculateMetadata={({ props }) => {
      const scenes = props.scenes ?? [];
      const lastEnd = scenes.length ? scenes[scenes.length - 1].tSpokenEnd : 0;
      return {
        durationInFrames: Math.max(1, Math.round(lastEnd * FPS)),
      };
    }}
  />
);
