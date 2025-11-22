/**
 * Media Utilities - Helper functions for analyzing media files
 */

import { isValidBlobURL } from './blob-manager';

export type MediaOrientation = 'portrait' | 'landscape' | 'square';

// Track logged messages to prevent console spam
const loggedMessages = new Set<string>();

function logOnce(key: string, logFn: () => void) {
  if (!loggedMessages.has(key)) {
    loggedMessages.add(key);
    logFn();
  }
}

/**
 * Detect the orientation of an image or video file
 * @param mediaPath - Blob URL or file path to the media
 * @param mediaType - Type of media ('image' or 'video')
 * @returns Promise resolving to the orientation
 */
export async function detectMediaOrientation(
  mediaPath: string,
  mediaType: 'image' | 'video'
): Promise<MediaOrientation> {
  // Validate path before attempting to load
  if (!mediaPath ||
      mediaPath.trim() === '' ||
      mediaPath === 'undefined' ||
      mediaPath === 'null' ||
      mediaPath.length < 5) {
    logOnce('invalid-empty-path', () => {
      console.log('[detectMediaOrientation] ❌ Invalid or empty media path');
    });
    return Promise.reject(new Error('Invalid or empty media path'));
  }

  // Additional validation for blob URLs - check both format AND registry
  if (mediaPath.startsWith('blob:')) {
    // Check if blob URL is registered in blob manager
    if (!isValidBlobURL(mediaPath)) {
      logOnce(`unregistered-blob-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] ❌ Rejecting unregistered blob URL:', mediaPath.substring(0, 50));
      });
      return Promise.reject(new Error('Blob URL is not registered or has been revoked'));
    }

    try {
      const url = new URL(mediaPath);
      if (url.protocol !== 'blob:') {
        logOnce(`invalid-protocol-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ❌ Invalid blob protocol:', mediaPath.substring(0, 50));
        });
        return Promise.reject(new Error('Invalid blob URL protocol'));
      }
    } catch (err) {
      logOnce(`malformed-blob-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] ❌ Malformed blob URL:', mediaPath.substring(0, 50));
      });
      return Promise.reject(new Error('Malformed blob URL'));
    }

    logOnce(`valid-blob-${mediaPath}`, () => {
      console.log('[detectMediaOrientation] ✅ Valid blob URL, proceeding with detection');
    });
  }

  logOnce(`detection-start-${mediaPath}`, () => {
    console.log('[detectMediaOrientation] 🔍 Starting detection for:', {
      mediaType,
      pathPreview: mediaPath.substring(0, 50)
    });
  });

  return new Promise((resolve, reject) => {
    // Declare variables at the top for timeout cleanup
    let video: HTMLVideoElement | null = null;
    let img: HTMLImageElement | null = null;

    // Set 5-second timeout to prevent hanging on invalid URLs
    const timeoutId = setTimeout(() => {
      logOnce(`timeout-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] ⏱️ TIMEOUT: 5 seconds elapsed, cleaning up');
      });
      if (mediaType === 'video' && video) {
        video.removeAttribute('src');
        video.load();
        video.remove();
        logOnce(`timeout-video-cleanup-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ⏱️ Timeout cleanup: video element removed');
        });
      } else if (img) {
        img.removeAttribute('src');
        logOnce(`timeout-img-cleanup-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ⏱️ Timeout cleanup: image element cleared');
        });
      }
      reject(new Error('Media load timeout after 5 seconds'));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    if (mediaType === 'video') {
      // Create video element to get dimensions
      video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      logOnce(`video-element-created-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] 📹 Created temporary video element');
      });

      // Track all video events to understand browser behavior
      video.onloadstart = () => {
        logOnce(`video-loadstart-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 🌐 Browser started loading video');
        });
      };

      video.onprogress = () => {
        logOnce(`video-progress-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 📶 Video loading progress');
        });
      };

      video.onsuspend = () => {
        logOnce(`video-suspend-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ⏸️ Video loading suspended by browser');
        });
      };

      video.onabort = () => {
        logOnce(`video-abort-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 🛑 Video loading aborted');
        });
      };

      video.onloadedmetadata = () => {
        logOnce(`video-metadata-loaded-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ✅ Video metadata loaded successfully');
        });
        cleanup();
        const width = video!.videoWidth;
        const height = video!.videoHeight;
        logOnce(`video-dimensions-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 📐 Video dimensions:', { width, height });
        });

        // Clean up - use removeAttribute to prevent browser errors
        logOnce(`video-cleanup-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 🧹 Cleaning up video element...');
        });
        video!.removeAttribute('src');
        video!.load(); // Reset the media element
        video!.remove();
        logOnce(`video-cleanup-complete-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ✅ Video element cleanup complete');
        });

        if (width === height) {
          resolve('square');
        } else if (height > width) {
          resolve('portrait');
        } else {
          resolve('landscape');
        }
      };

      video.onerror = (e) => {
        logOnce(`video-error-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ❌ Video error event fired for:', mediaPath.substring(0, 50));
        });
        cleanup();
        // Clean up - use removeAttribute to prevent browser errors
        video!.removeAttribute('src');
        video!.load(); // Reset the media element
        video!.remove();
        reject(new Error('Failed to load video metadata'));
      };

      // Final validation before setting src
      if (!mediaPath || mediaPath.trim() === '') {
        logOnce('video-src-empty', () => {
          console.error('[detectMediaOrientation] ❌ CRITICAL: Attempted to set empty video src');
        });
        cleanup();
        video.remove();
        reject(new Error('Cannot set empty video src'));
        return;
      }

      logOnce(`video-src-set-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] 🎬 Setting video src to:', mediaPath.substring(0, 50));
      });
      video.src = mediaPath;
      logOnce(`video-waiting-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] ⏳ Waiting for metadata to load...');
      });
    } else {
      // Create image element to get dimensions
      img = new Image();
      logOnce(`image-element-created-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] 🖼️ Created temporary image element');
      });

      img.onload = () => {
        logOnce(`image-loaded-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ✅ Image loaded successfully');
        });
        cleanup();
        const width = img!.naturalWidth;
        const height = img!.naturalHeight;
        logOnce(`image-dimensions-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 📐 Image dimensions:', { width, height });
        });

        // Clean up - use removeAttribute to prevent browser errors
        logOnce(`image-cleanup-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] 🧹 Cleaning up image element...');
        });
        img!.removeAttribute('src');
        logOnce(`image-cleanup-complete-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ✅ Image element cleanup complete');
        });

        if (width === height) {
          resolve('square');
        } else if (height > width) {
          resolve('portrait');
        } else {
          resolve('landscape');
        }
      };

      img.onerror = (e) => {
        logOnce(`image-error-${mediaPath}`, () => {
          console.log('[detectMediaOrientation] ❌ Image error event fired for:', mediaPath.substring(0, 50));
        });
        cleanup();
        // Clean up - use removeAttribute to prevent browser errors
        img!.removeAttribute('src');
        reject(new Error('Failed to load image'));
      };

      // Final validation before setting src
      if (!mediaPath || mediaPath.trim() === '') {
        logOnce('image-src-empty', () => {
          console.error('[detectMediaOrientation] ❌ CRITICAL: Attempted to set empty image src');
        });
        cleanup();
        reject(new Error('Cannot set empty image src'));
        return;
      }

      logOnce(`image-src-set-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] 🎬 Setting image src to:', mediaPath.substring(0, 50));
      });
      img.src = mediaPath;
      logOnce(`image-waiting-${mediaPath}`, () => {
        console.log('[detectMediaOrientation] ⏳ Waiting for image to load...');
      });
    }
  });
}

/**
 * Calculate aspect ratio from dimensions
 * @param width - Media width in pixels
 * @param height - Media height in pixels
 * @returns Aspect ratio as a decimal (e.g., 1.78 for 16:9)
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Suggest display mode based on media orientation
 * @param orientation - The media orientation
 * @returns Suggested display mode
 */
export function suggestDisplayMode(orientation: MediaOrientation): 'cover' | 'contain-blur' {
  if (orientation === 'portrait') {
    return 'contain-blur'; // Portrait media looks better with blur background
  }
  return 'cover'; // Landscape and square media can fill the frame
}

/**
 * Detect the frame rate (FPS) of a video file
 * @param videoPath - Blob URL or file path to the video
 * @returns Promise resolving to the FPS, or null if detection fails
 */
export async function detectVideoFPS(videoPath: string): Promise<number | null> {
  if (!videoPath || videoPath.trim() === '') {
    console.warn('[detectVideoFPS] Invalid video path');
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      video.removeAttribute('src');
      video.load();
      video.remove();
      console.warn('[detectVideoFPS] Timeout detecting FPS for:', videoPath.substring(0, 50));
      resolve(null);
    }, 5000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);

      // Try to get FPS from various sources
      let fps: number | null = null;

      // Method 1: Try to read from video element properties (not always available)
      const videoElement = video as any;
      if (videoElement.mozFrameRate) {
        fps = videoElement.mozFrameRate;
      } else if (videoElement.webkitFrameRate) {
        fps = videoElement.webkitFrameRate;
      }

      // Method 2: Default to common frame rates if not detected
      // Most video generation APIs use 24, 30, or 60 fps
      if (!fps) {
        console.warn('[detectVideoFPS] Could not detect FPS, defaulting to 30fps for:', videoPath.substring(0, 50));
        fps = 30; // Default assumption
      }

      console.log('[detectVideoFPS] Detected FPS:', fps, 'for:', videoPath.substring(0, 50));

      video.removeAttribute('src');
      video.load();
      video.remove();

      resolve(fps);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      video.remove();
      console.warn('[detectVideoFPS] Error loading video for FPS detection:', videoPath.substring(0, 50));
      resolve(null);
    };

    video.src = videoPath;
  });
}

/**
 * Detect the duration of a video file in seconds
 * @param videoPath - Blob URL or file path to the video
 * @returns Promise resolving to the duration in seconds, or null if detection fails
 */
export async function detectVideoDuration(videoPath: string): Promise<number | null> {
  if (!videoPath || videoPath.trim() === '') {
    console.warn('[detectVideoDuration] Invalid video path');
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      video.removeAttribute('src');
      video.load();
      video.remove();
      console.warn('[detectVideoDuration] Timeout detecting duration for:', videoPath.substring(0, 50));
      resolve(null);
    }, 5000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);

      const duration = video.duration;
      console.log('[detectVideoDuration] Detected duration:', duration, 'seconds for:', videoPath.substring(0, 50));

      video.removeAttribute('src');
      video.load();
      video.remove();

      // Check for valid duration (not NaN, Infinity, or 0)
      if (duration && isFinite(duration) && duration > 0) {
        resolve(duration);
      } else {
        console.warn('[detectVideoDuration] Invalid duration value:', duration);
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      video.remove();
      console.warn('[detectVideoDuration] Error loading video for duration detection:', videoPath.substring(0, 50));
      resolve(null);
    };

    video.src = videoPath;
  });
}
