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
  imageData?: Blob;
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
        const message =
          errorData.error?.message ||      // OpenAI format
          errorData.message ||              // Common format
          errorData.error?.code ||          // Some APIs use code
          errorData.detail ||               // FastAPI format
          errorData.error ||                // Sometimes error is a string
          JSON.stringify(errorData);        // Show full object as fallback

        errorMessage += `: ${message}`;

        // Log full error for debugging
        console.error('Grok API Error Response:', errorData);
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

    // Resize to landscape format (1792x1024) for video
    const resizedImageData = await resizeImageToLandscape(imageData);

    return {
      success: true,
      imageData: resizedImageData,
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
