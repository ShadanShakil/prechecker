import fs from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage adapter for the MVP.
 *
 * All files are stored under `STORAGE_ROOT` (default: ./storage) with a
 * predictable layout:
 *
 *   storage/
 *   ├── artwork/{artworkId}/original.{ext}
 *   ├── artwork/{artworkId}/normalized.png
 *   ├── artwork/{artworkId}/ocr.json
 *   └── prints/{printJobId}/(original|aligned|diff).{ext}
 *
 * Swappable later by replacing this module with an S3/MinIO adapter that
 * preserves the same interface.
 */
export function storageRoot(): string {
  const root = process.env.STORAGE_ROOT ?? "./storage";
  return path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
}

export function artworkDir(artworkId: string): string {
  return path.join(storageRoot(), "artwork", artworkId);
}

export function printDir(printId: string): string {
  return path.join(storageRoot(), "prints", printId);
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

export async function writeBytes(absPath: string, bytes: Uint8Array | Buffer): Promise<void> {
  await ensureDir(path.dirname(absPath));
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  await fs.writeFile(absPath, buf);
}

export async function readBytes(absPath: string): Promise<Buffer> {
  return fs.readFile(absPath);
}

/**
 * Convert an absolute on-disk path to a relative path the app can
 * serve via /api/storage/... route.
 */
export function toRelative(absPath: string): string {
  const rel = path.relative(storageRoot(), absPath);
  return rel.split(path.sep).join("/");
}

export function toPublicUrl(absPath: string): string {
  return `/api/storage/${toRelative(absPath)}`;
}

const SAFE_EXT = /^[a-zA-Z0-9]{1,6}$/;

export function safeExt(filename: string, fallback = "bin"): string {
  const ext = path.extname(filename).replace(/^\./, "").toLowerCase();
  return SAFE_EXT.test(ext) ? ext : fallback;
}

export function resolveFromStorage(relative: string): string {
  const abs = path.resolve(storageRoot(), relative);
  const root = storageRoot();
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Path traversal detected");
  }
  return abs;
}
