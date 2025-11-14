/**
 * AI Image Generation API Client
 * Supports OpenAI DALL-E 3 and Grok (xAI) image generation
 */

export type APIProvider = "openai" | "grok";

export interface ImageGenerationOptions {
  prompt: string;
  provider: APIProvider;
  apiKey: string;
  size?: "1792x1024" | "1024x1792" | "1024x1024";
  quality?: "standard" | "hd";
}

export interface ImageGenerationResult {
  success: boolean;
  imageData?: Blob;  // For OpenAI (blob URLs)
  imageUrl?: string;  // For Grok (direct URLs, CORS blocked for download)
  error?: string;
}

export interface VideoGenerationOptions {
  imageUrl: string; // blob URL or data URL of the image to convert
  prompt: string; // optional prompt to guide video generation
  provider: "grok"; // currently only Grok supports image-to-video
  apiKey: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoData?: Blob;
  error?: string;
}

/**
 * Generate image using OpenAI DALL-E 3 API
 */
export async function generateWithOpenAI(
  prompt: string,
  apiKey: string,
  size: string = "1792x1024",
  quality?: "standard" | "hd"
): Promise<ImageGenerationResult> {
  const url = "https://api.openai.com/v1/images/generations";

  const payload: any = {
    model: "dall-e-3",
    prompt,
    size,
    n: 1,
  };

  // Only include quality if specified
  if (quality) {
    payload.quality = quality;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorData = await response.json();

        // Try multiple error message locations (different API formats)
        const message =
          errorData.error?.message ||      // OpenAI format
          errorData.message ||              // Common format
          errorData.error?.code ||          // Some APIs use code
          errorData.detail ||               // FastAPI format
          errorData.error ||                // Sometimes error is a string
          JSON.stringify(errorData);        // Show full object as fallback

        errorMessage += `: ${message}`;

        // Log full error for debugging
        console.error('OpenAI API Error Response:', errorData);
      } catch {
        errorMessage += `: ${response.statusText || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    const imageUrl = result.data[0].url;

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated image");
    }

    const imageData = await imageResponse.blob();

    return {
      success: true,
      imageData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate image using Grok (xAI) API
 * Note: Adjust endpoint based on actual Grok API documentation
 */
export async function generateWithGrok(
  prompt: string,
  apiKey: string
): Promise<ImageGenerationResult> {
  const url = "https://api.x.ai/v1/images/generations";

  // Grok only supports model and prompt parameters
  // size, quality, and style are NOT supported
  const payload = {
    model: "grok-2-image",
    prompt,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorData = await response.json();

        // Try multiple error message locations (different API formats)
        // Prioritize direct error string from Grok API
        const message =
          errorData.error ||                // Grok format: direct error string
          errorData.message ||              // Common format
          errorData.error?.message ||       // OpenAI nested format
          errorData.code ||                 // Error code as fallback
          errorData.detail ||               // FastAPI format
          JSON.stringify(errorData);        // Show full object as fallback

        errorMessage += `: ${message}`;

        // Log full error for debugging
        console.error('Grok API Error Response:', errorData);
        console.error('Throwing error with message:', errorMessage);
      } catch {
        errorMessage += `: ${response.statusText || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    const imageUrl = result.data[0].url;

    // Grok's CDN doesn't support CORS, so we can't download the image
    // Return the URL directly - browsers can display it in <img> tags
    // even without CORS headers (CORS only blocks JavaScript from reading data)
    console.log('Grok image URL:', imageUrl);

    return {
      success: true,
      imageUrl: imageUrl,  // Return direct URL instead of blob
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate image using specified provider
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { prompt, provider, apiKey, size = "1792x1024", quality } = options;

  switch (provider) {
    case "openai":
      return generateWithOpenAI(prompt, apiKey, size, quality);
    case "grok":
      return generateWithGrok(prompt, apiKey);
    default:
      return {
        success: false,
        error: `Unknown provider: ${provider}`,
      };
  }
}

/**
 * Convert image to video using Grok (xAI) API
 * Grok generates 6-second videos from images
 */
export async function convertImageToVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const { imageUrl, prompt, apiKey } = options;

  try {
    // First, convert the image blob URL to a base64 data URL
    const imageBlob = await fetch(imageUrl).then(r => r.blob());
    const base64Image = await blobToBase64(imageBlob);

    const url = "https://api.x.ai/v1/video/generations";

    const payload = {
      model: "grok-2-vision-video",
      image: base64Image,
      prompt: prompt || "animate this image with smooth, natural motion",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorData = await response.json();
        const message =
          errorData.error?.message ||
          errorData.message ||
          errorData.error?.code ||
          errorData.detail ||
          errorData.error ||
          JSON.stringify(errorData);

        errorMessage += `: ${message}`;
        console.error('Grok Video API Error Response:', errorData);
      } catch {
        errorMessage += `: ${response.statusText || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    const videoUrl = result.data[0].url;

    // Download the video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error("Failed to download generated video");
    }

    const videoData = await videoResponse.blob();

    return {
      success: true,
      videoData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert blob to base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Save image blob to file (browser)
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Resize and crop image to landscape format (1792x1024)
 * Uses canvas to center-crop the image to the target aspect ratio
 */
export async function resizeImageToLandscape(blob: Blob): Promise<Blob> {
  const targetWidth = 1792;
  const targetHeight = 1024;
  const targetAspect = targetWidth / targetHeight;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const sourceAspect = img.width / img.height;

      let sx = 0;
      let sy = 0;
      let sWidth = img.width;
      let sHeight = img.height;

      // Center crop to match target aspect ratio
      if (sourceAspect > targetAspect) {
        // Source is wider - crop sides
        sWidth = img.height * targetAspect;
        sx = (img.width - sWidth) / 2;
      } else {
        // Source is taller - crop top/bottom
        sHeight = img.width / targetAspect;
        sy = (img.height - sHeight) / 2;
      }

      // Draw cropped and resized image
      ctx.drawImage(
        img,
        sx, sy, sWidth, sHeight,
        0, 0, targetWidth, targetHeight
      );

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        },
        "image/jpeg",
        0.95
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Generate multiple variations of an image in parallel
 */
export async function generateVariations(
  options: ImageGenerationOptions,
  count: number = 3
): Promise<ImageGenerationResult[]> {
  const promises = Array.from({ length: count }, () => generateImage(options));
  return Promise.all(promises);
}

/**
 * Estimate cost for image generation
 */
export function estimateCost(
  sceneCount: number,
  provider: APIProvider,
  quality: "standard" | "hd" = "hd"
): number {
  const costs = {
    openai: {
      standard: 0.04,
      hd: 0.08,
    },
    grok: {
      standard: 0.07, // Grok flat rate per image
      hd: 0.07, // Grok doesn't support quality tiers
    },
  };

  return sceneCount * costs[provider][quality];
}

/**
 * Export image to the exports folder for manual upload to Grok UI
 * In a browser environment, this triggers a download with a specific filename
 */
export async function exportImageToFolder(
  imageUrl: string,
  groupId: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const timestamp = Date.now();
    const filename = `group-${groupId}-${timestamp}.jpg`;

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Trigger browser download
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    return {
      success: true,
      filename,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Detect video quality (SD or HD) from video file properties
 * Checks resolution first, falls back to file size
 */
export async function detectVideoQuality(
  file: File
): Promise<"SD" | "HD"> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);

      // Check resolution (height)
      // SD: 720p or lower, HD: 1080p or higher
      if (video.videoHeight >= 1080) {
        resolve("HD");
      } else if (video.videoHeight > 0) {
        resolve("SD");
      } else {
        // Fallback to file size if resolution unavailable
        // SD: < 50MB, HD: >= 50MB
        const sizeMB = file.size / (1024 * 1024);
        resolve(sizeMB >= 50 ? "HD" : "SD");
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback to file size on error
      const sizeMB = file.size / (1024 * 1024);
      resolve(sizeMB >= 50 ? "HD" : "SD");
    };

    video.src = url;
  });
}

/**
 * Import video file and prepare it for use in the app
 * Returns blob URL and detected quality
 */
export async function importVideo(
  file: File
): Promise<{ success: boolean; videoUrl?: string; quality?: "SD" | "HD"; error?: string }> {
  try {
    // Validate file type
    if (!file.type.startsWith("video/")) {
      throw new Error("File is not a video");
    }

    // Detect quality
    const quality = await detectVideoQuality(file);

    // Create blob URL
    const videoUrl = URL.createObjectURL(file);

    return {
      success: true,
      videoUrl,
      quality,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// TODO: Replace convertImageToVideo with Grok video API when available
// Expected endpoint: https://api.x.ai/v1/video/generations
// Expected model: grok-2-vision-video (or similar)
// This function currently uses a non-existent API endpoint
// User workflow: Generate image -> Export -> Upload to Grok UI -> Import video back
