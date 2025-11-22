import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Loop, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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

// Helper to get Ken Burns animation configuration based on preset
const getKenBurnsConfig = (preset?: string) => {
  switch (preset) {
    case 'static':
      return { startScale: 1, endScale: 1, translateX: 0, translateY: 0 };
    case 'zoom-in':
      return { startScale: 1, endScale: 1.15, translateX: 0, translateY: 0 };
    case 'zoom-out':
      return { startScale: 1.15, endScale: 1, translateX: 0, translateY: 0 };
    case 'pan-left':
      return { startScale: 1, endScale: 1.05, translateX: 0, translateY: -80 };
    case 'pan-right':
      return { startScale: 1, endScale: 1.05, translateX: 0, translateY: 80 };
    case 'pan-up':
      return { startScale: 1, endScale: 1.05, translateX: -60, translateY: 0 };
    case 'pan-down':
      return { startScale: 1, endScale: 1.05, translateX: 60, translateY: 0 };
    default:
      // Default to zoom-in for backwards compatibility
      return { startScale: 1, endScale: 1.15, translateX: 0, translateY: 0 };
  }
};

// Helper to validate media paths and prevent invalid URL loading
const isValidMediaPath = (path: string | undefined): boolean => {
  // Check for undefined, null, empty
  if (!path || path.trim() === '') return false;

  // Check for literal invalid strings
  if (path === 'undefined' || path === 'null') return false;

  // Check minimum length (blob URLs are long)
  if (path.length < 5) return false;

  // For blob URLs, validate format
  if (path.startsWith('blob:')) {
    try {
      const url = new URL(path);
      return url.protocol === 'blob:';
    } catch {
      return false;
    }
  }

  // For http URLs, validate format
  if (path.startsWith('http')) {
    try {
      new URL(path);
      return true;
    } catch {
      return false;
    }
  }

  // Default to true for other paths (file paths, etc.)
  return true;
};

export const SceneGroup: React.FC<SceneGroupProps> = ({
  sceneGroup,
  lyricLines,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Debug: Log display settings on first frame
  if (frame === 0) {
    console.log(`[SceneGroup] ${sceneGroup.id.substring(0, 8)} display settings:`, {
      displayMode: sceneGroup.displayMode,
      kenBurnsPreset: sceneGroup.kenBurnsPreset,
      coverVerticalPosition: sceneGroup.coverVerticalPosition,
    });
  }

  // Log when this component renders (only on frame 0 to avoid spam)
  if (frame === 0) {
    console.log('[SceneGroup] 🎬 Rendering group:', {
      groupId: sceneGroup.id.substring(0, 8),
      displayMode: sceneGroup.displayMode,
      imagePath: sceneGroup.imagePath?.substring(0, 50),
      hasValidPath: isValidMediaPath(sceneGroup.imagePath),
      mediaType: getMediaType(sceneGroup),
    });
  }

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

  // Ken Burns effect: configurable animation based on preset
  const kenBurnsConfig = getKenBurnsConfig(sceneGroup.kenBurnsPreset);
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    [kenBurnsConfig.startScale, kenBurnsConfig.endScale],
    { extrapolateRight: "clamp" }
  );

  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    [0, kenBurnsConfig.translateX],
    { extrapolateRight: "clamp" }
  );

  const translateY = interpolate(
    frame,
    [0, durationInFrames],
    [0, kenBurnsConfig.translateY],
    { extrapolateRight: "clamp" }
  );

  // Check if the media is a video file using MediaVersions metadata
  const isVideo = getMediaType(sceneGroup) === 'video';

  // Get the active media version for video metadata
  const activeVersion = isVideo && sceneGroup.activeMediaId && sceneGroup.mediaVersions
    ? sceneGroup.mediaVersions.find(v => v.id === sceneGroup.activeMediaId)
    : null;

  // Calculate playback rate based on video FPS (normalize to composition FPS of 30)
  let playbackRate = 1;
  if (activeVersion?.fps) {
    playbackRate = activeVersion.fps / fps; // fps is composition FPS (30)
    if (frame === 0) {
      console.log(`[SceneGroup] 🎬 Applying playbackRate: ${playbackRate.toFixed(2)} (video: ${activeVersion.fps}fps / composition: ${fps}fps)`);
    }
  }

  // Get actual video duration from MediaVersion, or default to 6 seconds
  const videoDurationSeconds = activeVersion?.duration || 6;
  const videoLoopDuration = Math.ceil(videoDurationSeconds * fps);

  // Determine if video should loop (if group duration > actual video duration)
  const shouldLoop = sceneGroup.duration > videoDurationSeconds;

  if (frame === 0 && isVideo) {
    console.log(`[SceneGroup] 🎬 Video loop config:`, {
      videoDuration: videoDurationSeconds,
      videoLoopDuration,
      groupDuration: sceneGroup.duration,
      shouldLoop,
    });
  }

  // Calculate current time and find active lyric line
  const currentTime = sceneGroup.start + (frame / fps);
  const activeLyricLine = lyricLines.find(
    (line) => currentTime >= line.start && currentTime < line.end
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
      {isValidMediaPath(sceneGroup.imagePath) ? (
        <>
          {/* Render Video or Image with display mode */}
          {sceneGroup.displayMode === 'contain-blur' ? (
            <>
              {frame === 0 && console.log('[SceneGroup] 📺 Creating 2 media elements for contain-blur mode')}
              {/* Blurred background layer */}
              {isVideo ? (
                shouldLoop ? (
                  <Loop durationInFrames={videoLoopDuration}>
                    <OffthreadVideo
                      src={sceneGroup.imagePath}
                      muted={true}
                      playbackRate={playbackRate}
                      delayRenderTimeoutInMilliseconds={60000}
                      style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "blur(40px)",
                        opacity: 0.6,
                        transform: `scale(1.2)`,
                      }}
                      onError={() => frame === 0 && console.log('[SceneGroup] ❌ Video error (blurred background)')}
                    />
                  </Loop>
                ) : (
                  <OffthreadVideo
                    src={sceneGroup.imagePath}
                    muted={true}
                    playbackRate={playbackRate}
                    delayRenderTimeoutInMilliseconds={60000}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: "blur(40px)",
                      opacity: 0.6,
                      transform: `scale(1.2)`,
                    }}
                    onError={() => frame === 0 && console.log('[SceneGroup] ❌ Video error (blurred background)')}
                  />
                )
              ) : (
                <Img
                  src={sceneGroup.imagePath}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "blur(40px)",
                    opacity: 0.6,
                    transform: `scale(1.2)`, // Prevent blur edge artifacts
                  }}
                  onError={() => frame === 0 && console.log('[SceneGroup] ❌ Image error (blurred background)')}
                />
              )}

              {/* Main content layer (contained) */}
              {isVideo ? (
                shouldLoop ? (
                  <Loop durationInFrames={videoLoopDuration}>
                    <OffthreadVideo
                      src={sceneGroup.imagePath}
                      muted={true}
                      playbackRate={playbackRate}
                      delayRenderTimeoutInMilliseconds={60000}
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                      }}
                      onError={() => frame === 0 && console.log('[SceneGroup] ❌ Video error (main content)')}
                    />
                  </Loop>
                ) : (
                  <OffthreadVideo
                    src={sceneGroup.imagePath}
                    muted={true}
                    playbackRate={playbackRate}
                    delayRenderTimeoutInMilliseconds={60000}
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                    }}
                    onError={() => frame === 0 && console.log('[SceneGroup] ❌ Video error (main content)')}
                  />
                )
              ) : (
                <Img
                  src={sceneGroup.imagePath}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                  }}
                  onError={() => frame === 0 && console.log('[SceneGroup] ❌ Image error (main content)')}
                />
              )}
            </>
          ) : (
            /* Cover or Contain mode (single layer) */
            <>
              {isVideo ? (
                shouldLoop ? (
                  <Loop durationInFrames={videoLoopDuration}>
                    <OffthreadVideo
                      src={sceneGroup.imagePath}
                      muted={true}
                      playbackRate={playbackRate}
                      delayRenderTimeoutInMilliseconds={60000}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: sceneGroup.displayMode === 'contain' ? 'contain' : 'cover',
                        objectPosition: sceneGroup.displayMode === 'cover'
                          ? `center ${sceneGroup.coverVerticalPosition ?? 50}%`
                          : 'center',
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                      }}
                    />
                  </Loop>
                ) : (
                  <OffthreadVideo
                    src={sceneGroup.imagePath}
                    muted={true}
                    playbackRate={playbackRate}
                    delayRenderTimeoutInMilliseconds={60000}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: sceneGroup.displayMode === 'contain' ? 'contain' : 'cover',
                      objectPosition: sceneGroup.displayMode === 'cover'
                        ? `center ${sceneGroup.coverVerticalPosition ?? 50}%`
                        : 'center',
                      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                    }}
                  />
                )
              ) : (
                <Img
                  src={sceneGroup.imagePath}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: sceneGroup.displayMode === 'contain' ? 'contain' : 'cover',
                    objectPosition: sceneGroup.displayMode === 'cover'
                      ? `center ${sceneGroup.coverVerticalPosition ?? 50}%`
                      : 'center',
                    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                  }}
                />
              )}
            </>
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
