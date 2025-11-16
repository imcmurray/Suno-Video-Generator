import React from "react";
import { AbsoluteFill, Img, Video, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneGroupProps, SceneGroup as SceneGroupType } from "../types";

// Helper to determine media type from MediaVersions array (works with blob URLs)
const getMediaType = (sceneGroup: SceneGroupType): 'image' | 'video' => {
  if (!sceneGroup.imagePath) return 'image';

  // Check MediaVersions array for the media type
  const version = sceneGroup.mediaVersions?.find(v => v.path === sceneGroup.imagePath);
  if (version) {
    return version.type;
  }

  // Fallback: check file extension for backwards compatibility
  if (/\.(mp4|mov|webm)$/i.test(sceneGroup.imagePath)) {
    return 'video';
  }

  return 'image';
};

export const SceneGroup: React.FC<SceneGroupProps> = ({
  sceneGroup,
  lyricLines,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  // Ken Burns effect: slow zoom from 100% to 110% over the scene duration
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
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

  // Check if the media is a video file using MediaVersions metadata
  const isVideo = getMediaType(sceneGroup) === 'video';

  // Calculate current time and find active lyric line
  const currentTime = sceneGroup.start + (frame / fps);
  const activeLyricLine = lyricLines.find(
    (line) => currentTime >= line.start && currentTime < line.end
  );

  // Determine if video should loop (if group duration > 6s)
  const shouldLoop = sceneGroup.duration > 6;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {sceneGroup.imagePath ? (
        <>
          {/* Render Video or Image */}
          {isVideo ? (
            <Video
              src={sceneGroup.imagePath}
              loop={shouldLoop}
              muted={true} // Mute video audio - only play song audio
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale}) translateX(${translateX}px)`,
              }}
            />
          ) : (
            <Img
              src={sceneGroup.imagePath}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale}) translateX(${translateX}px)`,
              }}
            />
          )}

          {/* Lyric text overlay (karaoke style) - skip for instrumental groups */}
          {activeLyricLine && !sceneGroup.isInstrumental && (
            <div
              style={{
                position: "absolute",
                bottom: "10%",
                left: 0,
                right: 0,
                textAlign: "center",
                color: "white",
                fontSize: "48px",
                fontWeight: "bold",
                textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                padding: "20px",
                animation: "fadeIn 0.3s ease-in-out",
              }}
            >
              {activeLyricLine.lyricCleaned}
            </div>
          )}
        </>
      ) : (
        // Placeholder for groups without media yet
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
            Scene Group {sceneGroup.id}
          </div>
          <div style={{ fontSize: "18px", marginBottom: "10px", opacity: 0.8 }}>
            {sceneGroup.combinedLyrics}
          </div>
          <div
            style={{
              fontSize: "14px",
              opacity: 0.5,
              maxWidth: "80%",
              marginTop: "20px",
            }}
          >
            {sceneGroup.prompt}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
