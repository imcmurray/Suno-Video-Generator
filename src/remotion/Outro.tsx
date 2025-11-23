import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Loop, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { OutroProps, OutroMediaItem } from "../types";

// Calculate grid dimensions based on number of items
// Dynamically scales to fit any number of items while maintaining reasonable cell sizes
const getGridDimensions = (count: number): { cols: number; rows: number } => {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };
  if (count <= 16) return { cols: 4, rows: 4 };
  if (count <= 20) return { cols: 5, rows: 4 };
  if (count <= 25) return { cols: 5, rows: 5 };
  if (count <= 30) return { cols: 6, rows: 5 };
  if (count <= 36) return { cols: 6, rows: 6 };
  if (count <= 42) return { cols: 7, rows: 6 };
  if (count <= 49) return { cols: 7, rows: 7 };
  if (count <= 56) return { cols: 8, rows: 7 };
  if (count <= 64) return { cols: 8, rows: 8 };

  // For very large counts, calculate dynamically
  const cols = Math.ceil(Math.sqrt(count * (16 / 9))); // Account for 16:9 aspect ratio
  const rows = Math.ceil(count / cols);
  return { cols, rows };
};

// Individual grid item component - handles its own animation and looping
interface GridItemProps {
  item: OutroMediaItem;
  cellSize: number;
  cellLeft: number;
  cellTop: number;
  fps: number;
  videoLoopDuration: number;
  itemDuration: number;
}

const GridItem: React.FC<GridItemProps> = ({
  item,
  cellSize,
  cellLeft,
  cellTop,
  fps,
  videoLoopDuration,
  itemDuration,
}) => {
  const frame = useCurrentFrame(); // Local frame within this Sequence (starts at 0)
  const itemFadeDuration = fps * 0.5; // 0.5 second fade

  const itemOpacity = interpolate(
    frame,
    [0, itemFadeDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const itemScale = interpolate(itemOpacity, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: cellLeft,
        top: cellTop,
        width: cellSize,
        height: cellSize,
        borderRadius: 8,
        overflow: "hidden",
        opacity: itemOpacity,
        transform: `scale(${itemScale})`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {item.type === 'video' ? (
        <Loop durationInFrames={videoLoopDuration}>
          <OffthreadVideo
            src={item.path}
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </Loop>
      ) : (
        <Img
          src={item.path}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
};

export const Outro: React.FC<OutroProps> = ({
  mediaItems,
  duration,
  appName,
  githubUrl,
  aiCredits,
  githubQrImage,
  bitcoinQrImage,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = Math.floor(duration * fps);

  // Timing configuration (in seconds)
  const fadeInDuration = 1;
  const rippleStartTime = 0.5;
  const rippleEndTime = 5;
  const brandingFadeInStart = 5;
  const brandingFadeInEnd = 6;
  const qrFadeInStart = duration - 5; // QR codes appear in last 5 seconds
  const qrFadeInEnd = duration - 4;
  const fadeOutStart = duration - 1;

  // Convert to frames
  const fadeInFrames = fadeInDuration * fps;
  const rippleStartFrame = rippleStartTime * fps;
  const rippleEndFrame = rippleEndTime * fps;
  const brandingFadeInStartFrame = brandingFadeInStart * fps;
  const brandingFadeInEndFrame = brandingFadeInEnd * fps;
  const qrFadeInStartFrame = qrFadeInStart * fps;
  const qrFadeInEndFrame = qrFadeInEnd * fps;
  const fadeOutStartFrame = fadeOutStart * fps;

  // Overall fade in (0-1s)
  const overallFadeIn = interpolate(
    frame,
    [0, fadeInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Overall fade out (last 1s)
  const overallFadeOut = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Combined overall opacity
  const overallOpacity = Math.min(overallFadeIn, overallFadeOut);

  // Grid setup - uses all items, grid scales dynamically
  const { cols, rows } = getGridDimensions(mediaItems.length);
  const displayItems = mediaItems; // Show ALL items, no limit

  // Calculate ripple stagger - items appear based on their diagonal position
  const getItemStartFrame = (index: number): number => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const diagonalIndex = row + col; // Top-left (0,0) = 0, bottom-right = max
    const maxDiagonal = (rows - 1) + (cols - 1);

    // Calculate when this item should start appearing
    const rippleDuration = rippleEndFrame - rippleStartFrame;
    return Math.floor(rippleStartFrame + (diagonalIndex / maxDiagonal) * rippleDuration * 0.8);
  };

  // Video loop duration (6 seconds at 30fps = 180 frames)
  const videoLoopDuration = 180;

  // Branding opacity
  const brandingOpacity = interpolate(
    frame,
    [brandingFadeInStartFrame, brandingFadeInEndFrame],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // QR codes opacity (last 5 seconds)
  const qrOpacity = interpolate(
    frame,
    [qrFadeInStartFrame, qrFadeInEndFrame],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Calculate cell size
  const padding = 60;
  const gap = 16;
  const availableWidth = 1920 - (padding * 2);
  const availableHeight = 1080 - (padding * 2) - 200; // Reserve space for branding
  const cellWidth = (availableWidth - (gap * (cols - 1))) / cols;
  const cellHeight = (availableHeight - (gap * (rows - 1))) / rows;
  const cellSize = Math.min(cellWidth, cellHeight);

  // Center the grid
  const gridWidth = cellSize * cols + gap * (cols - 1);
  const gridHeight = cellSize * rows + gap * (rows - 1);
  const gridLeft = (1920 - gridWidth) / 2;
  const gridTop = 80; // Top padding for grid

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "black",
        opacity: overallOpacity,
      }}
    >
      {/* Video/Image Grid - Each item in its own Sequence for staggered playback */}
      {displayItems.map((item, index) => {
        const itemStartFrame = getItemStartFrame(index);
        const row = Math.floor(index / cols);
        const col = index % cols;

        // Calculate position for this cell
        const cellLeft = gridLeft + col * (cellSize + gap);
        const cellTop = gridTop + row * (cellSize + gap);

        // Calculate how long this item will be visible
        const itemDuration = durationInFrames - itemStartFrame;

        return (
          <Sequence key={index} from={itemStartFrame} durationInFrames={itemDuration} layout="none">
            <GridItem
              item={item}
              cellSize={cellSize}
              cellLeft={cellLeft}
              cellTop={cellTop}
              fps={fps}
              videoLoopDuration={videoLoopDuration}
              itemDuration={itemDuration}
            />
          </Sequence>
        );
      })}

      {/* Branding Section */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: brandingOpacity,
        }}
      >
        {/* AI Credits - customizable */}
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          {aiCredits}
        </div>

        {/* App Name */}
        <div
          style={{
            fontSize: 42,
            fontWeight: "bold",
            color: "white",
            marginBottom: 12,
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          {appName}
        </div>

        {/* GitHub URL */}
        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.8)",
            fontFamily: "monospace",
          }}
        >
          {githubUrl}
        </div>
      </div>

      {/* QR Codes Section - appears in last 5 seconds */}
      {(githubQrImage || bitcoinQrImage) && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            padding: "0 120px",
            opacity: qrOpacity,
          }}
        >
          {/* GitHub QR Code - Left */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: githubQrImage ? 1 : 0,
            }}
          >
            {githubQrImage && (
              <Img
                src={githubQrImage}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 8,
                  backgroundColor: "white",
                  padding: 8,
                }}
              />
            )}
          </div>

          {/* Bitcoin QR Code - Right */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: bitcoinQrImage ? 1 : 0,
            }}
          >
            {bitcoinQrImage && (
              <Img
                src={bitcoinQrImage}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 8,
                  backgroundColor: "white",
                  padding: 8,
                }}
              />
            )}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
