/**
 * Blob URL Manager
 *
 * Centralized management for blob URLs to prevent "Invalid URI" errors
 * by tracking and properly cleaning up blob URLs throughout their lifecycle.
 */

interface BlobURLRecord {
  url: string;
  groupId?: string;
  versionLabel?: string;
  createdAt: number;
}

class BlobURLManager {
  private registry: Map<string, BlobURLRecord> = new Map();

  /**
   * Creates a blob URL and registers it for tracking
   */
  createBlobURL(blob: Blob, metadata?: { groupId?: string; versionLabel?: string }): string {
    const url = URL.createObjectURL(blob);

    this.registry.set(url, {
      url,
      groupId: metadata?.groupId,
      versionLabel: metadata?.versionLabel,
      createdAt: Date.now(),
    });

    return url;
  }

  /**
   * Revokes a specific blob URL and removes it from the registry
   */
  revokeBlobURL(url: string): void {
    if (this.registry.has(url)) {
      URL.revokeObjectURL(url);
      this.registry.delete(url);
    }
  }

  /**
   * Revokes all blob URLs associated with a specific group
   */
  revokeGroupBlobURLs(groupId: string): void {
    const urlsToRevoke: string[] = [];

    this.registry.forEach((record) => {
      if (record.groupId === groupId) {
        urlsToRevoke.push(record.url);
      }
    });

    urlsToRevoke.forEach((url) => this.revokeBlobURL(url));
  }

  /**
   * Revokes a specific version's blob URL within a group
   */
  revokeVersionBlobURL(groupId: string, versionLabel: string): void {
    const urlsToRevoke: string[] = [];

    this.registry.forEach((record) => {
      if (record.groupId === groupId && record.versionLabel === versionLabel) {
        urlsToRevoke.push(record.url);
      }
    });

    urlsToRevoke.forEach((url) => this.revokeBlobURL(url));
  }

  /**
   * Revokes all tracked blob URLs (use when clearing project or unmounting)
   */
  revokeAllBlobURLs(): void {
    this.registry.forEach((record) => {
      URL.revokeObjectURL(record.url);
    });
    this.registry.clear();
  }

  /**
   * Checks if a blob URL is valid and still tracked
   */
  isValidBlobURL(url: string): boolean {
    if (!url || !url.startsWith('blob:')) {
      return false;
    }

    return this.registry.has(url);
  }

  /**
   * Gets all blob URLs for a specific group
   */
  getGroupBlobURLs(groupId: string): string[] {
    const urls: string[] = [];

    this.registry.forEach((record) => {
      if (record.groupId === groupId) {
        urls.push(record.url);
      }
    });

    return urls;
  }

  /**
   * Gets registry statistics (useful for debugging)
   */
  getStats() {
    return {
      totalURLs: this.registry.size,
      urls: Array.from(this.registry.values()),
    };
  }

  /**
   * Cleans up old blob URLs (older than specified age in milliseconds)
   */
  cleanupOldURLs(maxAge: number = 3600000): void { // Default 1 hour
    const now = Date.now();
    const urlsToRevoke: string[] = [];

    this.registry.forEach((record) => {
      if (now - record.createdAt > maxAge) {
        urlsToRevoke.push(record.url);
      }
    });

    urlsToRevoke.forEach((url) => this.revokeBlobURL(url));
  }
}

// Export singleton instance
export const blobManager = new BlobURLManager();

// Convenience functions
export const createBlobURL = (blob: Blob, metadata?: { groupId?: string; versionLabel?: string }) =>
  blobManager.createBlobURL(blob, metadata);

export const revokeBlobURL = (url: string) => blobManager.revokeBlobURL(url);

export const revokeGroupBlobURLs = (groupId: string) => blobManager.revokeGroupBlobURLs(groupId);

export const revokeVersionBlobURL = (groupId: string, versionLabel: string) =>
  blobManager.revokeVersionBlobURL(groupId, versionLabel);

export const revokeAllBlobURLs = () => blobManager.revokeAllBlobURLs();

export const isValidBlobURL = (url: string) => blobManager.isValidBlobURL(url);

// HMR (Hot Module Replacement) State Preservation
// Preserves the blob registry across development file changes
// This prevents the registry from being cleared when Vite reloads this module
// @ts-expect-error - Vite HMR API is available in development but not typed in ImportMeta
if (import.meta.hot) {
  // @ts-expect-error
  const hot = import.meta.hot;

  // Restore registry from previous HMR state if it exists
  if (hot.data.blobRegistry) {
    console.log('[BlobManager] Restoring registry from HMR data:', hot.data.blobRegistry.size, 'URLs');
    (blobManager as any).registry = hot.data.blobRegistry;
  }

  // Save registry before this module is replaced
  hot.dispose((data: any) => {
    console.log('[BlobManager] Saving registry to HMR data:', (blobManager as any).registry.size, 'URLs');
    data.blobRegistry = (blobManager as any).registry;
  });
}
