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
  ],
};

export default nextConfig;
