/**
 * Stage 2 alignment + region-level defect detection.
 *
 * The heavy lifting runs in a child Node process (see `cv-worker.mjs`)
 * that imports `@techstark/opencv-js` directly. Hosting the WASM instance
 * in a subprocess sidesteps a silent stall observed when Next.js 16.2's
 * server runtime + Turbopack loads the opencv-js module — and keeps the
 * main server process responsive to concurrent requests.
 */
import { spawn } from "node:child_process";
import path from "node:path";

export type DefectRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fraction of differing pixels inside the region, 0..1. */
  severity: number;
  /** Rough classification based on bbox size relative to the image. */
  kind: "small" | "medium" | "large";
};

export type AlignDiffResult = {
  width: number;
  height: number;
  diffScore: number;
  diffPixels: number;
  totalPixels: number;
  /** Number of keypoint matches that passed Lowe's ratio test. */
  goodMatches: number;
  /** If alignment failed (too few matches), we fall back to contain-fit resize. */
  alignmentMethod: "homography" | "fallback-resize";
  regions: DefectRegion[];
  verdict: "MATCH" | "MISMATCH";
};

const WORKER = path.join(process.cwd(), "src", "lib", "cv-worker.mjs");

/**
 * Align `printPath` to `artworkPath` and produce:
 *  - `alignedOutPath`: the print warped into artwork coordinates (PNG).
 *  - `diffOutPath`: the artwork with coloured defect boxes drawn on top (PNG).
 *  - a list of defect regions ordered by bbox size with severity scores.
 */
export function alignAndDiff(opts: {
  artworkPath: string;
  printPath: string;
  alignedOutPath: string;
  diffOutPath: string;
  mismatchThreshold: number;
}): Promise<AlignDiffResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER, JSON.stringify(opts)], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`cv-worker exited with ${code}: ${err}`));
        return;
      }
      try {
        resolve(JSON.parse(out) as AlignDiffResult);
      } catch (e) {
        reject(
          new Error(
            `cv-worker produced non-JSON output: ${(e as Error).message}\n${out}`,
          ),
        );
      }
    });
  });
}
