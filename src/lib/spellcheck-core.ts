/**
 * Spell-check core. Loads the English (@cspell/dict-en_us) and Arabic
 * (@cspell/dict-ar) trie dictionaries directly via cspell-dictionary, then
 * exposes a minimal `suggestionsForWord` surface.
 *
 * We avoid cspell-lib's higher-level config machinery (which scans disk /
 * pulls in default settings) so that startup is fast and fully offline.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createSpellingDictionaryFromTrieFile, type SpellingDictionary } from "cspell-dictionary";

export type SupportedLang = "en" | "ar";

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_REGEX = /[A-Za-z]/;

export function detectLanguage(word: string): SupportedLang | "other" {
  if (ARABIC_REGEX.test(word)) return "ar";
  if (LATIN_REGEX.test(word)) return "en";
  return "other";
}

// Resolve trie paths at runtime from the installed node_modules. We walk
// upward from `process.cwd()` to handle both local dev and Next.js's
// standalone build where cwd is a nested `.next/standalone` directory.
// We do NOT use `require.resolve` here because Turbopack replaces it with a
// module-ID lookup that returns an integer instead of a file path.
function findNodeModulesFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "node_modules", relative);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Unable to locate ${relative} from ${process.cwd()}`);
}

function enTriePath(): string {
  return findNodeModulesFile("@cspell/dict-en_us/en_US.trie.gz");
}
function arTriePath(): string {
  return findNodeModulesFile("@cspell/dict-ar/ar.trie.gz");
}

function loadTrieDict(absPath: string, name: string): SpellingDictionary {
  const gz = fs.readFileSync(absPath);
  const raw = absPath.endsWith(".gz") ? zlib.gunzipSync(gz) : gz;
  return createSpellingDictionaryFromTrieFile(new Uint8Array(raw), name, absPath, {
    caseSensitive: false,
    repMap: [],
  });
}

let enDict: SpellingDictionary | null = null;
let arDict: SpellingDictionary | null = null;

function getDict(lang: SupportedLang): SpellingDictionary {
  if (lang === "en") {
    enDict ??= loadTrieDict(enTriePath(), "en_US");
    return enDict;
  }
  arDict ??= loadTrieDict(arTriePath(), "ar");
  return arDict;
}

export async function suggestionsForWord(
  word: string,
  lang: SupportedLang,
): Promise<{ isMisspelled: boolean; suggestions: string[] }> {
  let dict: SpellingDictionary;
  try {
    dict = getDict(lang);
  } catch (err) {
    console.error("[spellcheck] Failed to load dictionary for", lang, err);
    return { isMisspelled: false, suggestions: [] };
  }
  const w = word.trim();
  if (!w) return { isMisspelled: false, suggestions: [] };
  const has = dict.has(w) || dict.has(w.toLowerCase());
  if (has) return { isMisspelled: false, suggestions: [] };
  const raw = dict.suggest(w, { numSuggestions: 5, includeTies: false });
  const suggestions = raw
    .map((s) => s.word)
    .filter((s) => s && s !== w)
    .slice(0, 5);
  return { isMisspelled: true, suggestions };
}
