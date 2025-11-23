import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SongInfoOverlayProps } from "../types";

export const SongInfoOverlay: React.FC<SongInfoOverlayProps> = ({
  songTitle,
  artistName,
  showStyle,
  style,
  displayDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timing configuration
  const fadeInDuration = fps * 0.5; // 0.5 seconds fade in
  const fadeOutDuration = fps * 0.8; // 0.8 seconds fade out
  const holdEndFrame = fps * displayDuration - fadeOutDuration;

  // Calculate opacity: fade in, hold, fade out
  const opacity = interpolate(
    frame,
    [0, fadeInDuration, holdEndFrame, holdEndFrame + fadeOutDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Slight slide-in animation from left
  const translateX = interpolate(
    frame,
    [0, fadeInDuration],
    [-20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Don't render if nothing to show
  if (!songTitle && !artistName) {
    return null;
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          opacity,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {/* Song Title */}
        {songTitle && (
          <div
            style={{
              fontSize: 42,
              fontWeight: "bold",
              color: "white",
              textShadow: "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
              marginBottom: 8,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {songTitle}
          </div>
        )}

        {/* Artist Name */}
        {artistName && (
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.9)",
              textShadow: "2px 2px 6px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.5)",
              marginBottom: showStyle && style ? 6 : 0,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {artistName}
          </div>
        )}

        {/* Style (optional) */}
        {showStyle && style && (
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.7)",
              textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
              fontStyle: "italic",
              fontFamily: "system-ui, -apple-system, sans-serif",
              maxWidth: 500,
            }}
          >
            {style}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
