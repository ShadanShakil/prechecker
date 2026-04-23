#!/usr/bin/env node
/**
 * Standalone OpenCV.js worker for Stage 2 alignment + defect detection.
 *
 * Runs as a child process so the @techstark/opencv-js WASM instance lives
 * outside the Next.js server runtime. Next 16.2 + Turbopack was observed
 * to silently stall on this WASM module even with serverExternalPackages.
 *
 * Usage:
 *   node cv-worker.mjs <args-json>
 *
 * args-json = {
 *   artworkPath, printPath, alignedOutPath, diffOutPath, mismatchThreshold
 * }
 * Emits a single JSON line to stdout with the AlignDiffResult shape.
 */
import cv from "@techstark/opencv-js";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const MIN_GOOD_MATCHES = 10;
const LOWES_RATIO = 0.75;
const ORB_FEATURES = 2000;

await new Promise((resolve) => {
  if (cv.Mat) resolve();
  else cv.onRuntimeInitialized = resolve;
});

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

async function alignAndDiff(opts) {
  const artMat = await loadMat(opts.artworkPath);
  const printMat = await loadMat(opts.printPath);

  const artGray = new cv.Mat();
  const printGray = new cv.Mat();
  cv.cvtColor(artMat, artGray, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(printMat, printGray, cv.COLOR_RGBA2GRAY);

  const orb = new cv.ORB(ORB_FEATURES);
  const kp1 = new cv.KeyPointVector();
  const kp2 = new cv.KeyPointVector();
  const des1 = new cv.Mat();
  const des2 = new cv.Mat();
  orb.detectAndCompute(artGray, new cv.Mat(), kp1, des1);
  orb.detectAndCompute(printGray, new cv.Mat(), kp2, des2);

  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const knn = new cv.DMatchVectorVector();
  let goodMatches = 0;
  const goodSrc = [];
  const goodDst = [];
  if (des1.rows >= 2 && des2.rows >= 2) {
    matcher.knnMatch(des1, des2, knn, 2);
    for (let i = 0; i < knn.size(); i++) {
      const pair = knn.get(i);
      if (pair.size() < 2) {
        pair.delete();
        continue;
      }
      const m = pair.get(0);
      const n = pair.get(1);
      if (m.distance < LOWES_RATIO * n.distance) {
        const p1 = kp1.get(m.queryIdx).pt;
        const p2 = kp2.get(m.trainIdx).pt;
        goodSrc.push(p2.x, p2.y);
        goodDst.push(p1.x, p1.y);
        goodMatches++;
      }
      pair.delete();
    }
  }

  const width = artMat.cols;
  const height = artMat.rows;

  let alignedRgba;
  let alignmentMethod = "homography";
  if (goodMatches >= MIN_GOOD_MATCHES) {
    const srcPts = cv.matFromArray(goodMatches, 1, cv.CV_32FC2, goodSrc);
    const dstPts = cv.matFromArray(goodMatches, 1, cv.CV_32FC2, goodDst);
    const H = cv.findHomography(srcPts, dstPts, cv.RANSAC, 3);
    if (H.empty()) {
      alignmentMethod = "fallback-resize";
    }
    alignedRgba = new cv.Mat();
    if (alignmentMethod === "homography") {
      cv.warpPerspective(
        printMat,
        alignedRgba,
        H,
        new cv.Size(width, height),
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255),
      );
    }
    srcPts.delete();
    dstPts.delete();
    H.delete();
  } else {
    alignmentMethod = "fallback-resize";
    alignedRgba = new cv.Mat();
  }

  if (alignmentMethod === "fallback-resize") {
    const aspect = printMat.cols / printMat.rows;
    const targetAspect = width / height;
    let newW = width;
    let newH = height;
    if (aspect > targetAspect) {
      newH = Math.round(width / aspect);
    } else {
      newW = Math.round(height * aspect);
    }
    const resized = new cv.Mat();
    cv.resize(printMat, resized, new cv.Size(newW, newH), 0, 0, cv.INTER_AREA);
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
    alignedRgba.delete();
    alignedRgba = canvas;
  }

  await saveMat(alignedRgba, opts.alignedOutPath);

  const alignedGray = new cv.Mat();
  cv.cvtColor(alignedRgba, alignedGray, cv.COLOR_RGBA2GRAY);
  const diff = new cv.Mat();
  cv.absdiff(artGray, alignedGray, diff);

  const binary = new cv.Mat();
  cv.threshold(diff, binary, 25, 255, cv.THRESH_BINARY);

  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);
  cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);

  const diffPixels = cv.countNonZero(binary);
  const totalPixels = width * height;
  const diffScore = totalPixels > 0 ? diffPixels / totalPixels : 0;

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    binary,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const MIN_AREA = Math.max(25, Math.round(totalPixels * 0.00002));
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
      rectArea > totalPixels * 0.05
        ? "large"
        : rectArea > totalPixels * 0.005
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

  artMat.delete();
  printMat.delete();
  artGray.delete();
  printGray.delete();
  orb.delete();
  kp1.delete();
  kp2.delete();
  des1.delete();
  des2.delete();
  matcher.delete();
  knn.delete();
  alignedRgba.delete();
  alignedGray.delete();
  diff.delete();
  binary.delete();
  kernel.delete();
  contours.delete();
  hierarchy.delete();
  overlay.delete();

  const verdict = diffScore > opts.mismatchThreshold ? "MISMATCH" : "MATCH";
  return {
    width,
    height,
    diffScore,
    diffPixels,
    totalPixels,
    goodMatches,
    alignmentMethod,
    regions: capped,
    verdict,
  };
}

const argsJson = process.argv[2];
if (!argsJson) {
  console.error("cv-worker: missing args JSON");
  process.exit(2);
}
const opts = JSON.parse(argsJson);
try {
  const result = await alignAndDiff(opts);
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error("cv-worker error:", err);
  process.exit(1);
}
