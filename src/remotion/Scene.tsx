import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { SceneProps } from "../types";

export const Scene: React.FC<SceneProps> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();

  // Crossfade transition duration (0.5 seconds at 30fps)
  const transitionDuration = 15;

  // Fade in at the start
  const fadeIn = interpolate(
    frame,
    [0, transitionDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Fade out at the end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - transitionDuration, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Combine fade in and fade out
  const opacity = Math.min(fadeIn, fadeOut);

  // Ken Burns effect: slow zoom from 100% to 115% over the scene duration
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  // Subtle pan: move from center to slightly right
  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    [0, -50], // negative moves image right (pan left)
    {
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {scene.imagePath ? (
        <Img
          src={scene.imagePath}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale}) translateX(${translateX}px)`,
          }}
        />
      ) : (
        // Placeholder for scenes without images yet
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#1a1a1a",
            color: "white",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "20px" }}>
            Scene {scene.sequence}
          </div>
          <div style={{ fontSize: "18px", marginBottom: "10px", opacity: 0.8 }}>
            {scene.lyric}
          </div>
          <div
            style={{
              fontSize: "14px",
              opacity: 0.5,
              maxWidth: "80%",
              marginTop: "20px",
            }}
          >
            {scene.prompt}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
