import React from "react";
import { Composition } from "remotion";
import { VideoComposition } from "./remotion/VideoComposition";
import { VideoCompositionProps } from "./types";

export const RemotionRoot: React.FC = () => {
  const defaultProps: VideoCompositionProps = {
    scenes: [],
    audioPath: "",
  };

  return (
    <>
      <Composition
        id="MusicVideo"
        component={VideoComposition as any}
        durationInFrames={3000} // 100 seconds at 30fps - will be dynamic
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
    </>
  );
};
