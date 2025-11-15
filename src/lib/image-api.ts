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
 * Load cross-origin image as blob using canvas method
 * Note: This may fail for images without CORS headers (canvas tainting)
 * Used only when user explicitly requests export
 */
async function loadImageAsBlob(imageUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Don't set crossOrigin - allows image to load even without CORS headers
    // Canvas extraction may fail due to tainting, but we'll try anyway

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, 'image/jpeg', 0.95);
      } catch (error) {
        // Canvas is tainted - can't extract data
        reject(new Error('Canvas tainted by cross-origin image - cannot export'));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
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

    // Return direct URL - browsers can display it in <img> tags without CORS issues
    // Export function will attempt download when user explicitly exports
    return {
      success: true,
      imageUrl: imageUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Enhance a basic prompt using AI to create rich visual descriptions
 * Can optionally include song theme context for consistency
 */
export async function enhancePromptWithAI(
  basicPrompt: string,
  provider: APIProvider,
  apiKey: string,
  themeContext?: {
    sunoStyle?: string;
    genre?: string;
    mood?: string;
  }
): Promise<string> {
  // Build theme-aware system prompt
  let systemPrompt = `You are a visual scene designer for AI image generation. Transform sparse prompts into detailed, vivid visual scene descriptions.

Your enhanced descriptions should:
- Include specific objects, settings, and composition details
- Add lighting, atmosphere, and mood descriptions
- Maintain all original style keywords and themes
- Be concise but visually rich (under 100 words)
- Focus on what can be visually depicted in a single image`;

  // Add theme context if provided
  if (themeContext) {
    systemPrompt += `\n\nIMPORTANT: This scene is part of a music video with the following theme. Ensure visual consistency:\n`;
    if (themeContext.sunoStyle) {
      systemPrompt += `- Song Style: ${themeContext.sunoStyle}\n`;
    }
    if (themeContext.genre) {
      systemPrompt += `- Genre: ${themeContext.genre}\n`;
    }
    if (themeContext.mood) {
      systemPrompt += `- Overall Mood: ${themeContext.mood}\n`;
    }
    systemPrompt += `\nMaintain this aesthetic across all scenes while adding scene-specific details.`;
  }

  systemPrompt += `\n\nReturn ONLY the enhanced visual description, no explanation or preamble.`;

  const userPrompt = `Transform this prompt into a detailed visual scene description:\n\n${basicPrompt}`;

  try {
    if (provider === "openai") {
      // Use OpenAI Chat Completions API with fast, cheap model
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        let errorMessage = `OpenAI API error (${response.status})`;
        try {
          const errorData = await response.json();
          const message = errorData.error?.message || errorData.message || JSON.stringify(errorData);
          errorMessage += `: ${message}`;

          // Provide helpful context for common errors
          if (response.status === 401) {
            errorMessage = "Invalid OpenAI API key. Please check your API key.";
          } else if (response.status === 429) {
            errorMessage = "OpenAI rate limit exceeded. Please wait and try again.";
          } else if (response.status === 500) {
            errorMessage = "OpenAI server error. Please try again later.";
          }

          console.error('OpenAI prompt enhancement failed:', errorMessage);
          console.error('Full error:', errorData);
        } catch {
          console.error('OpenAI prompt enhancement failed:', response.statusText);
        }

        // Return basic prompt as fallback (don't throw - graceful degradation)
        return basicPrompt;
      }

      const result = await response.json();
      const enhanced = result.choices[0]?.message?.content?.trim();
      return enhanced || basicPrompt;

    } else if (provider === "grok") {
      // Use Grok Chat Completions API
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Grok API error (${response.status})`;
        try {
          const errorData = await response.json();
          const message = errorData.error?.message || errorData.message || JSON.stringify(errorData);
          errorMessage += `: ${message}`;

          // Provide helpful context for common errors
          if (response.status === 401) {
            errorMessage = "Invalid Grok API key. Please check your API key.";
          } else if (response.status === 429) {
            errorMessage = "Grok rate limit exceeded. Please wait and try again.";
          } else if (response.status === 500) {
            errorMessage = "Grok server error. Please try again later.";
          }

          console.error('Grok prompt enhancement failed:', errorMessage);
          console.error('Full error:', errorData);
        } catch {
          console.error('Grok prompt enhancement failed:', response.statusText);
        }

        // Return basic prompt as fallback (don't throw - graceful degradation)
        return basicPrompt;
      }

      const result = await response.json();
      const enhanced = result.choices[0]?.message?.content?.trim();
      return enhanced || basicPrompt;
    }

    // Fallback if provider not recognized
    return basicPrompt;

  } catch (error) {
    console.error('Error enhancing prompt:', error);
    // Fallback to original prompt on error
    return basicPrompt;
  }
}

/**
 * Enhance all scene group prompts with theme-aware AI
 * Returns enhanced prompts in same order as input
 */
export async function enhanceAllPromptsWithTheme(
  basicPrompts: string[],
  provider: APIProvider,
  apiKey: string,
  themeContext?: {
    sunoStyle?: string;
    genre?: string;
    mood?: string;
  }
): Promise<string[]> {
  const enhancedPrompts: string[] = [];

  console.log(`Enhancing ${basicPrompts.length} prompts with theme context...`);

  for (let i = 0; i < basicPrompts.length; i++) {
    const basicPrompt = basicPrompts[i];
    console.log(`Enhancing prompt ${i + 1}/${basicPrompts.length}...`);

    try {
      const enhanced = await enhancePromptWithAI(basicPrompt, provider, apiKey, themeContext);
      enhancedPrompts.push(enhanced);

      // Add small delay to avoid rate limiting
      if (i < basicPrompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Failed to enhance prompt ${i + 1}, using original`);
      enhancedPrompts.push(basicPrompt);
    }
  }

  console.log(`Prompt enhancement complete: ${enhancedPrompts.length} prompts enhanced`);
  return enhancedPrompts;
}

/**
 * Generate image using specified provider
 * Note: Prompts are pre-enhanced during project creation, so we use them as-is
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { prompt, provider, apiKey, size = "1792x1024", quality } = options;

  console.log('Generating image with prompt:', prompt);

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
 * Tries multiple methods to download cross-origin images
 */
export async function exportImageToFolder(
  imageUrl: string,
  groupId: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  const timestamp = Date.now();
  const filename = `group-${groupId}-${timestamp}.jpg`;

  // Method 1: Try direct fetch (works for OpenAI, same-origin images)
  try {
    const response = await fetch(imageUrl);
    if (response.ok) {
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

      return { success: true, filename };
    }
  } catch (fetchError) {
    console.log('Direct fetch failed, trying canvas method:', fetchError);
  }

  // Method 2: Try canvas method (may fail for CORS-protected images)
  try {
    const blob = await loadImageAsBlob(imageUrl);

    // Trigger browser download
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    return { success: true, filename };
  } catch (canvasError) {
    console.log('Canvas method failed:', canvasError);
  }

  // Method 3: Open image in new tab (best fallback for CORS-protected images)
  // User can then right-click and Save As from the new tab
  window.open(imageUrl, '_blank');

  return {
    success: true,
    filename,
  };
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
