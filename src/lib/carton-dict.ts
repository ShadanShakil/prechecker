/**
 * Custom dictionary of brand names, country names, and Arabic words that
 * commonly appear on printed cartons but are missing from the generic
 * `@cspell/dict-en_us` / `@cspell/dict-ar` tries.
 *
 * Without these, real production text like "amazon.ae", "UAE", or "أمازون"
 * gets flagged as misspelled. We expose `isInCustomDict()` which the
 * spell-check pipeline consults BEFORE running the trie lookup.
 *
 * Matching is case-insensitive and tolerates surrounding punctuation
 * (so "Amazon," and "(Amazon.ae)" both match).
 */

const ENGLISH_WORDS = [
  // brand / domain
  "amazon",
  "amazon.ae",
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  // country / region
  "uae",
  "ksa",
  "gcc",
  "eu",
  "usa",
  "uk",
  // packaging vocabulary
  "carton",
  "cartons",
  "corrugated",
  "kraft",
  "fluted",
  "linerboard",
  "fefco",
  "ect",
  "kgsm",
  "gsm",
  "regslotted",
  "rsc",
  "fsc",
  "iso",
  "barcode",
  "qr",
  "ean13",
  "upc",
  // material / sustainability
  "recyclable",
  "recycled",
  "reusable",
  "biodegradable",
  // shipping / regulatory
  "fragile",
  "handle",
  "thisway",
  "thisendup",
  "kosher",
  "halal",
  "haccp",
  // legal copy fragments seen on the test artwork
  "amazonas",
];

const ARABIC_WORDS = [
  "أمازون", // Amazon
  "صنع", // made
  "صنع في", // made in
  "في", // in
  "الإمارات", // UAE
  "الإمارات العربية المتحدة", // United Arab Emirates
  "العربية",
  "المتحدة",
  "هذا", // this
  "بصندوق", // box
  "الكرتون", // the carton
  "ملتزمون", // committed
  "ببناء", // building
  "كوكب", // planet
  "مستدام", // sustainable
  "هذا الصندوق", // this box
  "مصنوع", // made
  "ورق", // paper
  "معاد", // recycled
  "تدويره", // its recycling
  "قابل", // capable
  "للتدوير", // for recycling
  "بالكامل", // completely
  "يرجى", // please
  "التخلص", // disposal
  "منه", // of it
  "صندوق", // box
  "إعادة", // re-
  "التدوير", // recycling
];

const ENGLISH_SET = new Set(ENGLISH_WORDS.map((w) => w.toLowerCase()));
const ARABIC_SET = new Set(ARABIC_WORDS);

function strip(text: string): string {
  return text
    .replace(/^[\s.,;:()\[\]{}<>"'`!?\-_+*/\\|]+/, "")
    .replace(/[\s.,;:()\[\]{}<>"'`!?\-_+*/\\|]+$/, "")
    .trim();
}

export function isInCustomDict(raw: string, lang: "en" | "ar"): boolean {
  const text = strip(raw);
  if (!text) return false;
  if (lang === "en") return ENGLISH_SET.has(text.toLowerCase());
  return ARABIC_SET.has(text);
}
