/**
 * Stage 1 mask extraction + Stage 2 alignment + region-level defect
 * detection.
 *
 * Both heavy operations run in a child Node process (see `cv-worker.mjs`)
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
  /** Primary score: pixel-diff ratio inside the printable mask. */
  diffScore: number;
  /** Same as `diffScore` — surfaced explicitly for clarity in reports. */
  maskedDiffScore: number;
  /** Pixel-diff ratio across the entire frame (debug / legacy signal). */
  globalDiffScore: number;
  diffPixels: number;
  totalPixels: number;
  /** Number of keypoint matches that passed Lowe's ratio test. */
  goodMatches: number;
  /** RANSAC inliers from the chosen homography. */
  inliers: number;
  /** Which detector won the multi-stage pipeline. */
  alignmentMethod:
    | "homography-orb"
    | "homography-akaze"
    | "ecc"
    | "fallback-resize";
  /** 0..1 trust score for the alignment. <0.35 → ALIGNMENT_UNCERTAIN. */
  alignmentConfidence: number;
  regions: DefectRegion[];
  verdict: "MATCH" | "MISMATCH" | "ALIGNMENT_UNCERTAIN";
  /** Optional human-readable reason explaining the verdict. */
  statusReason: string | null;
};

export type ExtractMaskResult = {
  width: number;
  height: number;
  /** Bounding rect of the printable carton area in artwork coords. */
  bbox: { x: number; y: number; w: number; h: number };
  /** Fraction of the canvas covered by the printable area. */
  coverage: number;
  method: "hsv-component" | "adaptive-contour" | "fallback-full";
};

const WORKER = path.join(process.cwd(), "src", "lib", "cv-worker.mjs");

function runWorker<T>(args: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER, JSON.stringify(args)], {
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
        resolve(JSON.parse(out) as T);
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

/**
 * Extract the printable-area mask from a normalised artwork (PNG).
 *
 * The artwork is expected to be a dieline-style image with red trim lines
 * surrounding the printable carton fill. Returns a binary mask written to
 * `maskOutPath` (white = printable, black = excluded), plus the bounding
 * rect + coverage of the printable area.
 */
export function extractDielineMask(opts: {
  artworkPath: string;
  maskOutPath: string;
}): Promise<ExtractMaskResult> {
  return runWorker<ExtractMaskResult>({ ...opts, mode: "extract-mask" });
}

/**
 * Align `printPath` to `artworkPath` and produce:
 *  - `alignedOutPath`: the print warped into artwork coordinates (PNG).
 *  - `diffOutPath`: the artwork with coloured defect boxes drawn on top (PNG).
 *  - a list of defect regions ordered by bbox size with severity scores.
 *
 * If `maskPath` is supplied (path to a binary PNG produced by
 * `extractDielineMask`), the diff and contour extraction are restricted
 * to that printable area — pixels outside the mask are ignored.
 */
export function alignAndDiff(opts: {
  artworkPath: string;
  printPath: string;
  alignedOutPath: string;
  diffOutPath: string;
  mismatchThreshold: number;
  /** Optional binary mask path; if set, diff is restricted to white pixels. */
  maskPath?: string | null;
}): Promise<AlignDiffResult> {
  return runWorker<AlignDiffResult>({ ...opts, mode: "align-diff" });
}
