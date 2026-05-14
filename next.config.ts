import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages contain native modules, WASM, or Node worker scripts that
  // must not be traced/bundled by Turbopack — they have to resolve themselves
  // at runtime from node_modules.
  serverExternalPackages: [
    "tesseract.js",
    "sharp",
    "cspell-dictionary",
    "@cspell/dict-en_us",
    "@cspell/dict-ar",
    // New in PR #2 — PaddleOCR (ONNX) and OpenCV.js both rely on native
    // workers / WASM blobs that must be resolved at runtime, not bundled.
    "@gutenye/ocr-node",
    "@gutenye/ocr-common",
    "@gutenye/ocr-models",
    "onnxruntime-node",
    "@techstark/opencv-js",
  ],
};

export default nextConfig;
