/**
 * Dual-engine OCR word voting.
 *
 * Tesseract's `eng` model is unreliable on stylised / condensed / outlined
 * carton typography — it frequently drops or inserts letters, which then
 * causes cspell to mark real words as misspelled. Running PaddleOCR in
 * parallel and comparing results lets us distinguish between:
 *
 *   a) a genuine typo on the artwork (both engines read the same bad
 *      string that fails the dictionary) — flag to reviewer, show
 *      dictionary suggestions;
 *   b) a mis-read by Tesseract (Paddle reads a valid dictionary word in
 *      the same region) — silently substitute Paddle's reading;
 *   c) ambiguous (engines disagree and neither is a dictionary word) —
 *      still flag but mark low-confidence so the reviewer can decide.
 *
 * Voting runs for the English words only. Arabic words keep Tesseract as
 * the single source of truth (see ocr-paddle.ts for why).
 */
import type { OCRWord } from "./ocr";
import type { PaddleLineDetection } from "./ocr-paddle";
import { checkWord } from "./spellcheck";
import { classifyAnnotation } from "./annotation";

export type VotedWord = {
  text: string; // final text (possibly replaced by Paddle)
  originalText: string; // Tesseract's raw read
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  language: "en" | "ar" | "other";
  isMisspelled: boolean;
  /** True if the token is a dieline annotation (dimension, code, panel label). */
  isAnnotation: boolean;
  suggestions: string[];
  /** Which engine(s) saw this word. */
  source: "tesseract" | "paddle" | "both";
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

function iou(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const inter = interW * interH;
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua > 0 ? inter / ua : 0;
}

/** Find the nearest Paddle detection that overlaps the Tesseract word's bbox. */
function nearestPaddle(
  word: OCRWord,
  paddle: PaddleLineDetection[],
): PaddleLineDetection | null {
  let best: PaddleLineDetection | null = null;
  let bestScore = 0;
  for (const p of paddle) {
    const o = iou(word.bbox, p.bbox);
    if (o > bestScore) {
      bestScore = o;
      best = p;
    }
  }
  return bestScore >= 0.2 ? best : null;
}

export async function voteWords(
  tesseractWords: OCRWord[],
  paddleWords: PaddleLineDetection[],
): Promise<VotedWord[]> {
  const out: VotedWord[] = [];
  for (const w of tesseractWords) {
    if (!w.text || w.text.length < 2) {
      out.push({
        text: w.text,
        originalText: w.text,
        confidence: w.confidence,
        bbox: w.bbox,
        language: "other",
        isMisspelled: false,
        isAnnotation: classifyAnnotation(w.text).isAnnotation,
        suggestions: [],
        source: "tesseract",
      });
      continue;
    }
    // Dieline annotations (dimensions, part codes, panel labels) get a flag
    // and skip spell-check entirely — they don't appear on the printed carton.
    const annotation = classifyAnnotation(w.text);
    if (annotation.isAnnotation) {
      out.push({
        text: w.text,
        originalText: w.text,
        confidence: w.confidence,
        bbox: w.bbox,
        language: "other",
        isMisspelled: false,
        isAnnotation: true,
        suggestions: [],
        source: "tesseract",
      });
      continue;
    }
    const tessCheck = await checkWord(w.text);
    if (tessCheck.language !== "en") {
      // Arabic or symbolic — Paddle doesn't help; return as-is.
      out.push({
        text: w.text,
        originalText: w.text,
        confidence: w.confidence,
        bbox: w.bbox,
        language: tessCheck.language,
        isMisspelled: tessCheck.isMisspelled,
        isAnnotation: false,
        suggestions: tessCheck.suggestions,
        source: "tesseract",
      });
      continue;
    }

    if (!tessCheck.isMisspelled) {
      // Tesseract + dictionary agree — we're done.
      out.push({
        text: w.text,
        originalText: w.text,
        confidence: w.confidence,
        bbox: w.bbox,
        language: "en",
        isMisspelled: false,
        isAnnotation: false,
        suggestions: [],
        source: paddleWords.length > 0 ? "both" : "tesseract",
      });
      continue;
    }

    // Tesseract flagged a miss. Ask Paddle what's in the same spot.
    const match = nearestPaddle(w, paddleWords);
    if (match) {
      const tokens = match.text.split(/\s+/).filter(Boolean);
      // Prefer the token whose normalised form is closest to Tesseract's.
      const target = norm(w.text);
      let bestTok = tokens[0] ?? match.text;
      let bestDist = Infinity;
      for (const t of tokens) {
        const d = levenshtein(norm(t), target);
        if (d < bestDist) {
          bestDist = d;
          bestTok = t;
        }
      }
      const paddleCheck = await checkWord(bestTok);
      if (!paddleCheck.isMisspelled && paddleCheck.language === "en") {
        // Paddle read a real word — Tesseract clearly miscopied. Substitute.
        out.push({
          text: bestTok,
          originalText: w.text,
          confidence: Math.max(w.confidence, match.confidence * 100),
          bbox: w.bbox,
          language: "en",
          isMisspelled: false,
          isAnnotation: false,
          suggestions: [],
          source: "paddle",
        });
        continue;
      }
      if (norm(bestTok) === norm(w.text)) {
        // Both engines see the same bad string → real typo with high confidence.
        out.push({
          text: w.text,
          originalText: w.text,
          confidence: Math.max(w.confidence, match.confidence * 100),
          bbox: w.bbox,
          language: "en",
          isMisspelled: true,
          isAnnotation: false,
          suggestions: tessCheck.suggestions,
          source: "both",
        });
        continue;
      }
    }

    // Fallback: single-engine miss, still flag but downstream consumers
    // can render it with a "low confidence" hint if they want.
    out.push({
      text: w.text,
      originalText: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
      language: "en",
      isMisspelled: true,
      isAnnotation: false,
      suggestions: tessCheck.suggestions,
      source: "tesseract",
    });
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
