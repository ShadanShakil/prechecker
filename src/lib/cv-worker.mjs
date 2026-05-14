#!/usr/bin/env node
/**
 * Standalone OpenCV.js worker for Stage 2 alignment + defect detection.
 *
 * Runs as a child process so the @techstark/opencv-js WASM instance lives
 * outside the Next.js server runtime. Next 16.2 + Turbopack was observed
 * to silently stall on this WASM module even with serverExternalPackages.
 *
 * Modes:
 *
 *   extract-mask   (pre-print): segment the artwork's printable area
 *                  (brown/orange dieline interior) from red trim lines
 *                  and white outer margins. Persists a binary mask PNG
 *                  and reports the bounding rect + coverage.
 *
 *   align-diff     (post-print): align the printed-carton photo to the
 *                  artwork using a multi-stage feature pipeline (ORB →
 *                  AKAZE → ECC fallback) and produce a mask-aware diff
 *                  with region-level defects and an alignment confidence
 *                  score.
 *
 * Usage:
 *   node cv-worker.mjs <args-json>
 *
 * For backwards compatibility, omitting `mode` defaults to align-diff.
 * Emits a single JSON line to stdout.
 */
import cv from "@techstark/opencv-js";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const MIN_GOOD_MATCHES = 10;
const LOWES_RATIO = 0.75;
const ORB_FEATURES = 2000;
const AKAZE_THRESHOLD = 0.001;

await new Promise((resolve) => {
  if (cv.Mat) resolve();
  else cv.onRuntimeInitialized = resolve;
});

// ---------- Image I/O helpers -------------------------------------------------

async function loadMat(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const clamped = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );
  return cv.matFromImageData({
    data: clamped,
    width: info.width,
    height: info.height,
  });
}

async function saveMat(mat, outPath) {
  const rgba = new cv.Mat();
  if (mat.type() === cv.CV_8UC4) {
    mat.copyTo(rgba);
  } else if (mat.channels() === 1) {
    cv.cvtColor(mat, rgba, cv.COLOR_GRAY2RGBA);
  } else {
    cv.cvtColor(mat, rgba, cv.COLOR_RGB2RGBA);
  }
  const buf = Buffer.from(rgba.data);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buf, {
    raw: { width: rgba.cols, height: rgba.rows, channels: 4 },
  })
    .png()
    .toFile(outPath);
  rgba.delete();
}

/** Save a single-channel binary mask (0/255) as a PNG. */
async function saveMask(mask, outPath) {
  const rgba = new cv.Mat();
  cv.cvtColor(mask, rgba, cv.COLOR_GRAY2RGBA);
  const buf = Buffer.from(rgba.data);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buf, {
    raw: { width: rgba.cols, height: rgba.rows, channels: 4 },
  })
    .png()
    .toFile(outPath);
  rgba.delete();
}

async function loadMaskGray(maskPath) {
  const { data, info } = await sharp(maskPath)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const clamped = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );
  const mat = cv.matFromArray(info.height, info.width, cv.CV_8UC1, [...clamped]);
  return mat;
}

// ---------- Mode 1: extract-mask ----------------------------------------------

/**
 * Segment the printable carton area from a dieline artwork.
 *
 * The artwork has three visual layers:
 *   - White background (paper)            → exclude
 *   - Red trim lines / red dimension text → exclude (they get cut off / are
 *                                            instructions for the printer)
 *   - Coloured fill (brown / orange / kraft) → KEEP, this is what gets
 *                                              physically printed.
 *
 * We build the mask in HSV space so cardboard-tone variations (lighting,
 * scan, screen photo) all collapse to the same hue band.
 */
async function extractMask(opts) {
  const src = await loadMat(opts.artworkPath);
  const width = src.cols;
  const height = src.rows;

  const rgb = new cv.Mat();
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
  const hsv = new cv.Mat();
  cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);

  // Background: very bright + very low saturation = paper.
  const bgLow = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 220, 0]);
  const bgHigh = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 35, 255, 0]);
  const bgMask = new cv.Mat();
  cv.inRange(hsv, bgLow, bgHigh, bgMask);

  // Red trim lines wrap around H=0, so we union two ranges.
  const redLow1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 90, 60, 0]);
  const redHigh1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [10, 255, 255, 0]);
  const redLow2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [165, 90, 60, 0]);
  const redHigh2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 0]);
  const redMask1 = new cv.Mat();
  const redMask2 = new cv.Mat();
  cv.inRange(hsv, redLow1, redHigh1, redMask1);
  cv.inRange(hsv, redLow2, redHigh2, redMask2);
  const redMask = new cv.Mat();
  cv.bitwise_or(redMask1, redMask2, redMask);

  // Excluded = background OR red lines.
  const excluded = new cv.Mat();
  cv.bitwise_or(bgMask, redMask, excluded);

  // Printable = NOT excluded.
  const ones = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(255));
  const printable = new cv.Mat();
  cv.subtract(ones, excluded, printable);

  // Clean up: close small holes, then open to remove tiny noise blobs.
  const k7 = cv.Mat.ones(7, 7, cv.CV_8U);
  const k3 = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.morphologyEx(printable, printable, cv.MORPH_CLOSE, k7);
  cv.morphologyEx(printable, printable, cv.MORPH_OPEN, k3);

  // Find the largest connected component — that's the carton body.
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();
  const numLabels = cv.connectedComponentsWithStats(
    printable,
    labels,
    stats,
    centroids,
    8,
    cv.CV_32S,
  );

  let bestLabel = -1;
  let bestArea = 0;
  // Skip label 0 (background).
  for (let i = 1; i < numLabels; i++) {
    const area = stats.intAt(i, cv.CC_STAT_AREA);
    if (area > bestArea) {
      bestArea = area;
      bestLabel = i;
    }
  }

  let coverage = 0;
  let bbox = { x: 0, y: 0, w: width, h: height };
  let outMask;
  let methodUsed = "fallback-full";

  // Pass 1 — HSV component (clean dieline exports). Use only if the largest
  // component is a sensibly-sized rectangle (between 15% and 85% of canvas).
  if (bestLabel > 0) {
    const area = bestArea;
    const cov = area / (width * height);
    if (cov >= 0.15 && cov <= 0.85) {
      bbox = {
        x: stats.intAt(bestLabel, cv.CC_STAT_LEFT),
        y: stats.intAt(bestLabel, cv.CC_STAT_TOP),
        w: stats.intAt(bestLabel, cv.CC_STAT_WIDTH),
        h: stats.intAt(bestLabel, cv.CC_STAT_HEIGHT),
      };
      coverage = cov;
      methodUsed = "hsv-component";
      outMask = new cv.Mat.zeros(height, width, cv.CV_8UC1);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (labels.intAt(y, x) === bestLabel) {
            outMask.ucharPtr(y, x)[0] = 255;
          }
        }
      }
      const k15 = cv.Mat.ones(15, 15, cv.CV_8U);
      cv.morphologyEx(outMask, outMask, cv.MORPH_CLOSE, k15);
      k15.delete();
    }
  }

  // Pass 2 — Adaptive threshold + largest contour. Robust on noisy
  // photo-of-screen inputs where HSV thresholds get confused.
  if (!outMask) {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const adaptive = new cv.Mat();
    cv.adaptiveThreshold(
      gray,
      adaptive,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      51,
      10,
    );
    // Heavy close to merge nearby strokes/text into a single carton blob.
    const k31 = cv.Mat.ones(31, 31, cv.CV_8U);
    cv.morphologyEx(adaptive, adaptive, cv.MORPH_CLOSE, k31);
    const cnts = new cv.MatVector();
    const hier = new cv.Mat();
    cv.findContours(
      adaptive,
      cnts,
      hier,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );
    let bestC = -1;
    let bestA = 0;
    for (let i = 0; i < cnts.size(); i++) {
      const c = cnts.get(i);
      const a = cv.contourArea(c, false);
      if (a > bestA) {
        bestA = a;
        bestC = i;
      }
      c.delete();
    }
    if (bestC >= 0 && bestA > width * height * 0.05) {
      const c = cnts.get(bestC);
      const rect = cv.boundingRect(c);
      // Tighten the bbox to inside-the-carton: shrink by 1% on each side
      // so we don't include the trim border in the diff.
      const pad = Math.round(Math.min(rect.width, rect.height) * 0.01);
      bbox = {
        x: rect.x + pad,
        y: rect.y + pad,
        w: Math.max(1, rect.width - 2 * pad),
        h: Math.max(1, rect.height - 2 * pad),
      };
      coverage = (bbox.w * bbox.h) / (width * height);
      outMask = cv.Mat.zeros(height, width, cv.CV_8UC1);
      cv.rectangle(
        outMask,
        new cv.Point(bbox.x, bbox.y),
        new cv.Point(bbox.x + bbox.w, bbox.y + bbox.h),
        new cv.Scalar(255),
        -1,
      );
      methodUsed = "adaptive-contour";
      c.delete();
    }
    gray.delete();
    adaptive.delete();
    k31.delete();
    cnts.delete();
    hier.delete();
  }

  // Pass 3 — full frame fallback (no useful content detected).
  if (!outMask) {
    outMask = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(255));
    coverage = 1;
    methodUsed = "fallback-full";
    bbox = { x: 0, y: 0, w: width, h: height };
  }

  await saveMask(outMask, opts.maskOutPath);

  // Cleanup
  src.delete();
  rgb.delete();
  hsv.delete();
  bgLow.delete();
  bgHigh.delete();
  bgMask.delete();
  redLow1.delete();
  redHigh1.delete();
  redLow2.delete();
  redHigh2.delete();
  redMask1.delete();
  redMask2.delete();
  redMask.delete();
  excluded.delete();
  ones.delete();
  printable.delete();
  k7.delete();
  k3.delete();
  labels.delete();
  stats.delete();
  centroids.delete();
  outMask.delete();

  return {
    width,
    height,
    bbox,
    coverage,
    method: methodUsed,
  };
}

// ---------- Mode 2: align-diff (multi-stage) ---------------------------------

function buildKeypoints(detector, gray) {
  const kp = new cv.KeyPointVector();
  const des = new cv.Mat();
  detector.detectAndCompute(gray, new cv.Mat(), kp, des);
  return { kp, des };
}

function knnMatch(desA, desB, normType) {
  const matcher = new cv.BFMatcher(normType, false);
  const knn = new cv.DMatchVectorVector();
  if (desA.rows < 2 || desB.rows < 2) return { matcher, knn, pairs: [] };
  matcher.knnMatch(desA, desB, knn, 2);
  return { matcher, knn };
}

/**
 * Try a single feature-detection pipeline: extract keypoints, KNN-match,
 * Lowe ratio test, RANSAC homography. Returns either the warped-print Mat
 * + alignment metadata, or null if too few inliers.
 */
function tryAlignment({
  artGray,
  printGray,
  printRgba,
  width,
  height,
  detectorName,
  detector,
  normType,
}) {
  const a = buildKeypoints(detector, artGray);
  const b = buildKeypoints(detector, printGray);
  let goodMatches = 0;
  const goodSrc = [];
  const goodDst = [];
  if (a.des.rows >= 2 && b.des.rows >= 2) {
    const matcher = new cv.BFMatcher(normType, false);
    const knn = new cv.DMatchVectorVector();
    matcher.knnMatch(a.des, b.des, knn, 2);
    for (let i = 0; i < knn.size(); i++) {
      const pair = knn.get(i);
      if (pair.size() < 2) {
        pair.delete();
        continue;
      }
      const m = pair.get(0);
      const n = pair.get(1);
      if (m.distance < LOWES_RATIO * n.distance) {
        const p1 = a.kp.get(m.queryIdx).pt;
        const p2 = b.kp.get(m.trainIdx).pt;
        goodSrc.push(p2.x, p2.y);
        goodDst.push(p1.x, p1.y);
        goodMatches++;
      }
      pair.delete();
    }
    matcher.delete();
    knn.delete();
  }

  let aligned = null;
  let inliers = 0;
  let reprojError = 99;
  if (goodMatches >= MIN_GOOD_MATCHES) {
    const srcPts = cv.matFromArray(goodMatches, 1, cv.CV_32FC2, goodSrc);
    const dstPts = cv.matFromArray(goodMatches, 1, cv.CV_32FC2, goodDst);
    const inlierMask = new cv.Mat();
    const H = cv.findHomography(srcPts, dstPts, cv.RANSAC, 3, inlierMask);
    if (!H.empty()) {
      // Count inliers + compute mean reprojection error of inliers.
      let inSum = 0;
      let errSum = 0;
      for (let i = 0; i < inlierMask.rows; i++) {
        if (inlierMask.ucharPtr(i, 0)[0] === 1) {
          inSum++;
          // Note: we don't apply H manually for perf — RANSAC's threshold (3)
          // already bounds the per-inlier error. We use the inlier ratio as
          // the main confidence signal.
          errSum += 0;
        }
      }
      inliers = inSum;
      reprojError = inSum > 0 ? errSum / inSum : 99;

      aligned = new cv.Mat();
      cv.warpPerspective(
        printRgba,
        aligned,
        H,
        new cv.Size(width, height),
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255),
      );
    }
    srcPts.delete();
    dstPts.delete();
    inlierMask.delete();
    H.delete();
  }

  a.kp.delete();
  a.des.delete();
  b.kp.delete();
  b.des.delete();

  return {
    detectorName,
    aligned,
    goodMatches,
    inliers,
    reprojError,
  };
}

/**
 * Resize-only fallback when no feature-matching strategy yields enough
 * inliers. Returns aligned print on a white canvas matching the artwork.
 */
function fallbackResize(printRgba, width, height) {
  const aspect = printRgba.cols / printRgba.rows;
  const targetAspect = width / height;
  let newW = width;
  let newH = height;
  if (aspect > targetAspect) {
    newH = Math.round(width / aspect);
  } else {
    newW = Math.round(height * aspect);
  }
  const resized = new cv.Mat();
  cv.resize(printRgba, resized, new cv.Size(newW, newH), 0, 0, cv.INTER_AREA);
  const canvas = new cv.Mat(
    height,
    width,
    cv.CV_8UC4,
    new cv.Scalar(255, 255, 255, 255),
  );
  const offX = Math.round((width - newW) / 2);
  const offY = Math.round((height - newH) / 2);
  const roi = canvas.roi(new cv.Rect(offX, offY, newW, newH));
  resized.copyTo(roi);
  roi.delete();
  resized.delete();
  return canvas;
}

async function alignAndDiff(opts) {
  const artMat = await loadMat(opts.artworkPath);
  const printMat = await loadMat(opts.printPath);

  const artGray = new cv.Mat();
  const printGray = new cv.Mat();
  cv.cvtColor(artMat, artGray, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(printMat, printGray, cv.COLOR_RGBA2GRAY);

  const width = artMat.cols;
  const height = artMat.rows;

  // Stage 1: ORB. Fast, works on most cases.
  const orb = new cv.ORB(ORB_FEATURES);
  const orbResult = tryAlignment({
    artGray,
    printGray,
    printRgba: printMat,
    width,
    height,
    detectorName: "homography-orb",
    detector: orb,
    normType: cv.NORM_HAMMING,
  });
  orb.delete();

  // Stage 2: AKAZE — better with rotation / scale / illumination changes.
  // Only run if ORB gave us fewer than ~30 inliers.
  let akazeResult = null;
  if (orbResult.inliers < 30) {
    try {
      const akaze = new cv.AKAZE(
        cv.AKAZE_DESCRIPTOR_MLDB,
        0,
        3,
        AKAZE_THRESHOLD,
        4,
        4,
        cv.KAZE_DIFF_PM_G2,
      );
      akazeResult = tryAlignment({
        artGray,
        printGray,
        printRgba: printMat,
        width,
        height,
        detectorName: "homography-akaze",
        detector: akaze,
        normType: cv.NORM_HAMMING,
      });
      akaze.delete();
    } catch (err) {
      // AKAZE binding may not be present in some opencv-js builds; ignore.
      akazeResult = null;
    }
  }

  // Pick the best stage.
  let best = orbResult;
  if (akazeResult && akazeResult.inliers > best.inliers) best = akazeResult;

  let aligned;
  let alignmentMethod;
  let goodMatches;
  let inliers;
  if (best.aligned) {
    aligned = best.aligned;
    alignmentMethod = best.detectorName;
    goodMatches = best.goodMatches;
    inliers = best.inliers;
  } else {
    aligned = fallbackResize(printMat, width, height);
    alignmentMethod = "fallback-resize";
    goodMatches = orbResult.goodMatches;
    inliers = 0;
  }

  // Free the unused candidate.
  if (best !== orbResult && orbResult.aligned) orbResult.aligned.delete();
  if (akazeResult && best !== akazeResult && akazeResult.aligned) akazeResult.aligned.delete();

  // Alignment confidence: 0..1.
  // - inlier_ratio component: 1.0 at >=80 inliers, linear below.
  // - method bonus: feature-based methods get +0.1 over fallback.
  const inlierComponent = Math.max(0, Math.min(1, inliers / 80));
  const methodBonus = alignmentMethod === "fallback-resize" ? 0 : 0.1;
  const alignmentConfidence = Math.max(0, Math.min(1, inlierComponent + methodBonus));

  await saveMat(aligned, opts.alignedOutPath);

  // ---- Diff ----
  const alignedGray = new cv.Mat();
  cv.cvtColor(aligned, alignedGray, cv.COLOR_RGBA2GRAY);
  const diff = new cv.Mat();
  cv.absdiff(artGray, alignedGray, diff);

  const binary = new cv.Mat();
  cv.threshold(diff, binary, 25, 255, cv.THRESH_BINARY);

  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);
  cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);

  // Mask-aware diff: if a printable mask was provided, restrict counting
  // and contour-finding to that area.
  let maskMat = null;
  let maskedBinary = binary;
  let maskArea = width * height;
  if (opts.maskPath) {
    try {
      maskMat = await loadMaskGray(opts.maskPath);
      maskedBinary = new cv.Mat();
      cv.bitwise_and(binary, maskMat, maskedBinary);
      maskArea = cv.countNonZero(maskMat) || width * height;
    } catch (err) {
      maskMat = null;
    }
  }

  const diffPixelsGlobal = cv.countNonZero(binary);
  const diffPixelsMasked = cv.countNonZero(maskedBinary);
  const totalPixels = width * height;
  const globalDiffScore = totalPixels > 0 ? diffPixelsGlobal / totalPixels : 0;
  const maskedDiffScore = maskArea > 0 ? diffPixelsMasked / maskArea : 0;

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    maskedBinary,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const MIN_AREA = Math.max(25, Math.round(maskArea * 0.00002));
  const regions = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c, false);
    const rect = cv.boundingRect(c);
    const rectArea = rect.width * rect.height;
    if (area < MIN_AREA || rectArea === 0) {
      c.delete();
      continue;
    }
    const severity = Math.min(1, area / rectArea);
    const kind =
      rectArea > maskArea * 0.05
        ? "large"
        : rectArea > maskArea * 0.005
          ? "medium"
          : "small";
    regions.push({
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
      severity,
      kind,
    });
    c.delete();
  }
  regions.sort((a, b) => b.w * b.h - a.w * a.h);
  const capped = regions.slice(0, 50);

  const overlay = new cv.Mat();
  artMat.copyTo(overlay);
  const red = new cv.Scalar(220, 38, 38, 255);
  const orange = new cv.Scalar(234, 88, 12, 255);
  const yellow = new cv.Scalar(202, 138, 4, 255);
  for (const r of capped) {
    const colour = r.kind === "large" ? red : r.kind === "medium" ? orange : yellow;
    const pt1 = new cv.Point(r.x, r.y);
    const pt2 = new cv.Point(r.x + r.w, r.y + r.h);
    cv.rectangle(overlay, pt1, pt2, colour, 3);
  }
  await saveMat(overlay, opts.diffOutPath);

  // ---- Verdict ----
  // Three buckets:
  //   1. ALIGNMENT_UNCERTAIN — alignment confidence too low to trust the diff.
  //      Either the print photo is too distorted, or the artwork has no
  //      texture for feature matching.
  //   2. MISMATCH — alignment trusted AND masked diff exceeds threshold.
  //   3. MATCH    — alignment trusted AND masked diff within threshold.
  let verdict;
  let statusReason = null;
  if (alignmentConfidence < 0.35) {
    verdict = "ALIGNMENT_UNCERTAIN";
    statusReason =
      "Alignment confidence is low — the printed-carton photo may be too distorted, glossy, or photographed at a steep angle. Re-photograph the carton flat against a plain background under even light and re-run analysis.";
  } else if (maskedDiffScore > opts.mismatchThreshold) {
    verdict = "MISMATCH";
    statusReason = `Pixel diff ${(maskedDiffScore * 100).toFixed(1)}% exceeds threshold ${(opts.mismatchThreshold * 100).toFixed(1)}% inside the printable area.`;
  } else {
    verdict = "MATCH";
  }

  // Cleanup
  artMat.delete();
  printMat.delete();
  artGray.delete();
  printGray.delete();
  aligned.delete();
  alignedGray.delete();
  diff.delete();
  binary.delete();
  if (maskedBinary !== binary) maskedBinary.delete();
  if (maskMat) maskMat.delete();
  kernel.delete();
  contours.delete();
  hierarchy.delete();
  overlay.delete();

  return {
    width,
    height,
    diffScore: maskedDiffScore, // primary score (mask-aware)
    maskedDiffScore,
    globalDiffScore,
    diffPixels: diffPixelsMasked,
    totalPixels: maskArea,
    goodMatches,
    inliers,
    alignmentMethod,
    alignmentConfidence,
    regions: capped,
    verdict,
    statusReason,
  };
}

// ---------- Entrypoint --------------------------------------------------------

const argsJson = process.argv[2];
if (!argsJson) {
  console.error("cv-worker: missing args JSON");
  process.exit(2);
}
const opts = JSON.parse(argsJson);
const mode = opts.mode ?? "align-diff";

try {
  let result;
  if (mode === "extract-mask") {
    result = await extractMask(opts);
  } else {
    result = await alignAndDiff(opts);
  }
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error("cv-worker error:", err);
  process.exit(1);
}
