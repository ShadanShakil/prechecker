/**
 * Detects whether an OCR token is a *dieline annotation* — a piece of
 * text that exists on the artwork file (dimensions, panel labels, part
 * codes, registration marks, language headers) but will NOT appear on
 * the printed carton.
 *
 * Annotations are excluded from spell-check display so reviewers don't
 * see "BLOCK-6076 is misspelled" warnings, and they're skipped during
 * mask-aware diff so they don't pollute the verdict.
 *
 * Patterns are intentionally conservative: when in doubt, fall through
 * to `false` (treat as printed text) so we never silently hide a real
 * spelling problem.
 */

const DIMENSION_RE = /^\d{1,4}([.,]\d+)?\s*(mm|cm|m|in|inch|inches|pt|px)$/i;
const SIZE_3D_RE = /^\d{1,4}\s*[x×X]\s*\d{1,4}\s*[x×X]\s*\d{1,4}$/;
const SIZE_2D_RE = /^\d{1,4}\s*[x×X]\s*\d{1,4}$/;
const PART_CODE_RE = /^[A-Z]{2,5}-?\d{3,8}([A-Z]{0,3})?$/;
const PANEL_LABEL_RE = /^(Lss|Wss|Hss|Lf|Wf|Hf|Sf)\d{0,2}$/i;
const LABEL_KEY_RE = /^(Size|Block|Length|Width|Height|Depth|Volume|Weight|Qty|Quantity|Item|Code|Ref|SKU|UPC|EAN|Barcode|Lot|Batch|PO|GTIN)$/i;
const FLUTE_RE = /^[A-G][\/-][A-G]$/i; // e.g. B/C, E-B
const PERCENT_RE = /^\d{1,3}\s*%$/;
const ANGLE_RE = /^\d{1,3}\s*°$/;
const VERSION_RE = /^v\d+(\.\d+)*$/i;
const COMMA_NUMBER_RE = /^\d{1,3}(,\d{3})+$/;

const ANNOTATION_KEYWORDS = new Set([
  // dieline / packaging anatomy
  "dieline",
  "die",
  "cutline",
  "fold",
  "flap",
  "panel",
  "score",
  "perforation",
  "perf",
  "registration",
  "bleed",
  "trim",
  "safety",
  "crease",
  // file / version metadata
  "artwork",
  "draft",
  "approved",
  "revision",
  "rev",
  "proof",
  "preview",
  "scale",
  // dimensional callouts
  "od",
  "id",
  "(od)",
  "(id)",
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
  "side",
  // common single-letter / glyph reads from CAD frames
  "—",
  "—h",
  "—o",
  "=o",
  "=a",
  "=r",
  "ee",
  "eee",
  "eeee",
]);

/** Strip common surrounding punctuation so e.g. "(OD)" matches "od". */
function strip(text: string): string {
  return text.replace(/^[\s.,;:()\[\]{}<>"'`!?\-_+*/\\|]+/, "")
    .replace(/[\s.,;:()\[\]{}<>"'`!?\-_+*/\\|]+$/, "")
    .trim();
}

export type AnnotationVerdict = {
  isAnnotation: boolean;
  /** Short tag explaining why we marked this — useful for debugging. */
  reason?:
    | "dimension"
    | "size-3d"
    | "size-2d"
    | "part-code"
    | "panel-label"
    | "label-key"
    | "flute"
    | "percent"
    | "angle"
    | "version"
    | "comma-number"
    | "keyword"
    | "noise";
};

/**
 * Returns whether `raw` should be treated as a dieline annotation.
 *
 * Tokens shorter than 2 chars after stripping are kept as printed text
 * (single letters can be intentional, e.g. "S" / "M" / "L" sizes), with
 * the exception of obvious noise reads like `=o` or `—H`.
 */
export function classifyAnnotation(raw: string): AnnotationVerdict {
  if (!raw) return { isAnnotation: false };
  const text = strip(raw);
  if (!text) return { isAnnotation: true, reason: "noise" };

  if (DIMENSION_RE.test(text)) return { isAnnotation: true, reason: "dimension" };
  if (SIZE_3D_RE.test(text)) return { isAnnotation: true, reason: "size-3d" };
  if (SIZE_2D_RE.test(text)) return { isAnnotation: true, reason: "size-2d" };
  if (PART_CODE_RE.test(text)) return { isAnnotation: true, reason: "part-code" };
  if (PANEL_LABEL_RE.test(text)) return { isAnnotation: true, reason: "panel-label" };
  if (LABEL_KEY_RE.test(text)) return { isAnnotation: true, reason: "label-key" };
  if (FLUTE_RE.test(text)) return { isAnnotation: true, reason: "flute" };
  if (PERCENT_RE.test(text)) return { isAnnotation: true, reason: "percent" };
  if (ANGLE_RE.test(text)) return { isAnnotation: true, reason: "angle" };
  if (VERSION_RE.test(text)) return { isAnnotation: true, reason: "version" };
  if (COMMA_NUMBER_RE.test(text)) return { isAnnotation: true, reason: "comma-number" };

  const lower = text.toLowerCase();
  if (ANNOTATION_KEYWORDS.has(lower)) return { isAnnotation: true, reason: "keyword" };

  // Short noise reads: 1-2 chars composed of obvious OCR garbage symbols.
  if (text.length <= 2 && /^[=\-—_~`'"^]+$/.test(text)) {
    return { isAnnotation: true, reason: "noise" };
  }

  return { isAnnotation: false };
}

export function isAnnotation(raw: string): boolean {
  return classifyAnnotation(raw).isAnnotation;
}
