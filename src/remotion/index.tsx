import React from "react";
import { Composition, registerRoot } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { VideoCompositionProps } from "../types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MusicVideo"
        component={VideoComposition}
        durationInFrames={300 * 30} // Default 300 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [],
          audioPath: null,
        } as VideoCompositionProps}
        calculateMetadata={({ props }) => {
          // Calculate actual duration from scenes
          const lastScene = props.scenes[props.scenes.length - 1];
          const durationInSeconds = lastScene?.end || 300;
          const durationInFrames = Math.floor(durationInSeconds * 30);

          return {
            durationInFrames,
            fps: 30,
            width: 1920,
            height: 1080,
          };
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
