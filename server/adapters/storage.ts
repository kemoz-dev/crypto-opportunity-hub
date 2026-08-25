import { storageGet, storageGetSignedUrl, storagePut } from "../storage";

export type StorageUploadResult = { key: string; url: string };

export interface StorageAdapter {
  put(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<StorageUploadResult>;
  get(key: string): Promise<{ key: string; url: string }>;
  createDownloadUrl(key: string): Promise<string>;
  createUploadUrl(_input: { key: string; contentType: string; expiresInSeconds: number }): Promise<never>;
  deleteObject(_key: string): Promise<never>;
  objectExists(_key: string): Promise<never>;
}

class ManusStorageAdapter implements StorageAdapter {
  put(key: string, data: Buffer | Uint8Array | string, contentType?: string) {
    return storagePut(key, data, contentType);
  }

  get(key: string) {
    return storageGet(key);
  }

  createDownloadUrl(key: string) {
    return storageGetSignedUrl(key);
  }

  async createUploadUrl(): Promise<never> {
    throw new Error("Direct upload URL creation is not available through the active storage provider.");
  }

  async deleteObject(): Promise<never> {
    throw new Error("Object deletion is not available through the active storage provider.");
  }

  async objectExists(): Promise<never> {
    throw new Error("Object existence checks are not available through the active storage provider.");
  }
}

const activeStorageAdapter: StorageAdapter = new ManusStorageAdapter();

export function getStorageAdapter(): StorageAdapter {
  return activeStorageAdapter;
}
