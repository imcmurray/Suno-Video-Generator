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
  const elementFadeInDuration = fps * 0.4; // 0.4 seconds per element fade in
  const fadeOutDuration = fps * 0.8; // 0.8 seconds fade out (all together)
  const staggerDelay = fps * 0.3; // 0.3 seconds between each element

  // Stagger start frames for each element
  const titleStartFrame = 0;
  const artistStartFrame = staggerDelay;
  const styleStartFrame = staggerDelay * 2;

  // Fade out timing (all elements fade out together)
  const holdEndFrame = fps * displayDuration - fadeOutDuration;

  // Global fade out (applies to all elements equally)
  const globalFadeOut = interpolate(
    frame,
    [holdEndFrame, holdEndFrame + fadeOutDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Individual element animations (staggered fade-in)
  const getTitleAnimation = () => {
    const fadeIn = interpolate(
      frame,
      [titleStartFrame, titleStartFrame + elementFadeInDuration],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const slideIn = interpolate(
      frame,
      [titleStartFrame, titleStartFrame + elementFadeInDuration],
      [-30, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { opacity: fadeIn * globalFadeOut, translateX: slideIn };
  };

  const getArtistAnimation = () => {
    const fadeIn = interpolate(
      frame,
      [artistStartFrame, artistStartFrame + elementFadeInDuration],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const slideIn = interpolate(
      frame,
      [artistStartFrame, artistStartFrame + elementFadeInDuration],
      [-30, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { opacity: fadeIn * globalFadeOut, translateX: slideIn };
  };

  const getStyleAnimation = () => {
    const fadeIn = interpolate(
      frame,
      [styleStartFrame, styleStartFrame + elementFadeInDuration],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const slideIn = interpolate(
      frame,
      [styleStartFrame, styleStartFrame + elementFadeInDuration],
      [-30, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { opacity: fadeIn * globalFadeOut, translateX: slideIn };
  };

  // Don't render if nothing to show
  if (!songTitle && !artistName) {
    return null;
  }

  const titleAnim = getTitleAnimation();
  const artistAnim = getArtistAnimation();
  const styleAnim = getStyleAnimation();

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
        }}
      >
        {/* Song Title - appears first */}
        {songTitle && (
          <div
            style={{
              fontSize: 42,
              fontWeight: "bold",
              color: "white",
              textShadow: "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
              marginBottom: 8,
              fontFamily: "system-ui, -apple-system, sans-serif",
              opacity: titleAnim.opacity,
              transform: `translateX(${titleAnim.translateX}px)`,
            }}
          >
            {songTitle}
          </div>
        )}

        {/* Artist Name - appears second */}
        {artistName && (
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.9)",
              textShadow: "2px 2px 6px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.5)",
              marginBottom: showStyle && style ? 6 : 0,
              fontFamily: "system-ui, -apple-system, sans-serif",
              opacity: artistAnim.opacity,
              transform: `translateX(${artistAnim.translateX}px)`,
            }}
          >
            {artistName}
          </div>
        )}

        {/* Style/Description - appears third */}
        {showStyle && style && (
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.7)",
              textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
              fontStyle: "italic",
              fontFamily: "system-ui, -apple-system, sans-serif",
              maxWidth: 500,
              opacity: styleAnim.opacity,
              transform: `translateX(${styleAnim.translateX}px)`,
            }}
          >
            {style}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
