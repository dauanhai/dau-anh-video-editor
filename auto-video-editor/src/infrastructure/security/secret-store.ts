import { safeStorage } from "electron";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
export class SecretStore {
  constructor(private root: string) {}
  private path(key: string) {
    if (!/^[a-z0-9_-]+$/i.test(key)) throw new Error("INVALID_SECRET_KEY");
    return join(this.root, key + ".enc");
  }
  async set(key: string, value: string) {
    if (
      !safeStorage.isEncryptionAvailable() ||
      safeStorage.getSelectedStorageBackend?.() === "basic_text"
    )
      throw new Error("SECURE_STORAGE_UNAVAILABLE");
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(key), safeStorage.encryptString(value), {
      mode: 0o600,
    });
  }
  async get(key: string) {
    try {
      return safeStorage.decryptString(await readFile(this.path(key)));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await unlink(this.path(key)).catch(() => {});
  }
}
