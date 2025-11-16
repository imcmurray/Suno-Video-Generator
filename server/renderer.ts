import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { renderQueue, RenderJobInput } from "./render-queue";

let cachedBundleLocation: string | null = null;

/**
 * Bundle the Remotion project once on server startup
 * Cache the bundle location for all subsequent renders
 */
export async function initializeBundle(): Promise<void> {
  if (cachedBundleLocation) {
    console.log("Bundle already initialized:", cachedBundleLocation);
    return;
  }

  console.log("Bundling Remotion project...");

  const bundleLocation = await bundle({
    entryPoint: path.join(__dirname, "../src/remotion/index.tsx"),
    webpackOverride: (config) => config,
  });

  cachedBundleLocation = bundleLocation;
  console.log("✓ Remotion project bundled successfully:", bundleLocation);
}

/**
 * Render a video using Remotion
 */
export async function renderVideo(
  jobId: string,
  input: RenderJobInput
): Promise<string> {
  if (!cachedBundleLocation) {
    throw new Error("Bundle not initialized. Call initializeBundle() first.");
  }

  try {
    renderQueue.markJobAsRendering(jobId);

    // Select the composition
    const compositionId = "MusicVideo";
    const composition = await selectComposition({
      serveUrl: cachedBundleLocation,
      id: compositionId,
      inputProps: {
        scenes: input.scenes,
        audioPath: input.audioPath,
        sceneGroups: input.sceneGroups,
        lyricLines: input.lyricLines,
        useGrouping: input.useGrouping,
      },
    });

    console.log(`Rendering composition "${compositionId}" for job ${jobId}`);
    console.log(`Duration: ${composition.durationInFrames} frames at ${composition.fps}fps`);

    // Output path (MOV format required for PCM lossless audio)
    const outputPath = path.join(__dirname, "outputs", `${jobId}.mov`);

    // Render the video
    await renderMedia({
      composition,
      serveUrl: cachedBundleLocation,
      codec: "h264",
      crf: null, // Explicitly disable CRF to use constant bitrate
      videoBitrate: "8M", // 8 Mbps constant bitrate for high quality
      colorSpace: "bt709", // BT.709 color space for proper YouTube encoding
      audioCodec: "pcm-16", // Lossless 16-bit PCM audio for YouTube
      outputLocation: outputPath,
      inputProps: {
        scenes: input.scenes,
        audioPath: input.audioPath,
        sceneGroups: input.sceneGroups,
        lyricLines: input.lyricLines,
        useGrouping: input.useGrouping,
      },
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        const progressPercent = progress * 100;
        renderQueue.updateJobProgress(jobId, progressPercent);

        if (renderedFrames % 30 === 0 || progress === 1) {
          console.log(
            `Job ${jobId}: ${progressPercent.toFixed(1)}% - Rendered ${renderedFrames}/${composition.durationInFrames} frames, Encoded ${encodedFrames}`
          );
        }
      },
    });

    renderQueue.markJobAsCompleted(jobId, outputPath);
    console.log(`✓ Video rendered successfully (MOV + PCM lossless): ${outputPath}`);

    // Clean up temporary audio file
    const tempFilePath = input.metadata?._tempAudioFilePath;
    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`Cleaned up temp audio file: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        console.error(`Failed to clean up temp audio file:`, cleanupError);
      }
    }

    return outputPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderQueue.markJobAsFailed(jobId, errorMessage);

    // Clean up temporary audio file even on error
    const tempFilePath = input.metadata?._tempAudioFilePath;
    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`Cleaned up temp audio file after error: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        console.error(`Failed to clean up temp audio file:`, cleanupError);
      }
    }

    throw error;
  }
}

/**
 * Process the render queue
 * Continuously checks for pending jobs and renders them one at a time
 */
export async function processRenderQueue(): Promise<void> {
  // Check every 2 seconds for new jobs
  setInterval(async () => {
    if (renderQueue.isRendering()) {
      return; // Already rendering a job
    }

    const nextJobId = renderQueue.getNextPendingJob();
    if (!nextJobId) {
      return; // No pending jobs
    }

    const job = renderQueue.getJob(nextJobId);
    if (!job || !job.input) {
      console.error(`Job ${nextJobId} has no input data`);
      renderQueue.markJobAsFailed(nextJobId, "No input data provided");
      return;
    }

    console.log(`Processing next job from queue: ${nextJobId}`);

    try {
      await renderVideo(nextJobId, job.input);
    } catch (error) {
      console.error(`Failed to render job ${nextJobId}:`, error);
    }
  }, 2000);
}
