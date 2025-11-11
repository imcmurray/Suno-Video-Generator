import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { VideoCompositionProps } from "../types";
import { Scene } from "./Scene";

export const VideoComposition = ({ scenes, audioPath }: VideoCompositionProps) => {
  const { fps } = useVideoConfig();

  // Convert seconds to frames
  const secondsToFrames = (seconds: number) => Math.floor(seconds * fps);

  // Transition duration for crossfades (0.5 seconds)
  const transitionDurationSeconds = 0.5;
  const transitionDurationFrames = secondsToFrames(transitionDurationSeconds);

  // Debug audio
  console.log("VideoComposition audioPath:", audioPath ? `${audioPath.substring(0, 50)}...` : "MISSING");

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Audio track */}
      {audioPath && (
        <>
          <Audio src={audioPath} volume={1.0} />
          {console.log("✓ Audio component rendered with volume 1.0")}
        </>
      )}
      {!audioPath && console.error("✗ No audioPath provided to VideoComposition")}

      {/* Render each scene as a sequence with overlap for crossfade transitions */}
      {scenes.map((scene, index) => {
        const isFirstScene = index === 0;
        const isLastScene = index === scenes.length - 1;

        // Calculate start frame with overlap (start earlier except for first scene)
        const startFrame = isFirstScene
          ? secondsToFrames(scene.start)
          : secondsToFrames(scene.start - transitionDurationSeconds);

        // Calculate duration with extended transitions
        let durationInFrames = secondsToFrames(scene.duration);

        // Extend duration at the start (overlap with previous scene)
        if (!isFirstScene) {
          durationInFrames += transitionDurationFrames;
        }

        // Extend duration at the end (overlap with next scene)
        if (!isLastScene) {
          durationInFrames += transitionDurationFrames;
        }

        return (
          <Sequence
            key={scene.sequence}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <Scene
              scene={scene}
              startFrame={startFrame}
              durationInFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
