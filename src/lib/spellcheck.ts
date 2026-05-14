import { suggestionsForWord, detectLanguage } from "./spellcheck-core";
import { isInCustomDict } from "./carton-dict";

export type SpellResult = {
  word: string;
  language: "en" | "ar" | "other";
  isMisspelled: boolean;
  suggestions: string[];
};

/**
 * Check a word against the English + Arabic dictionaries.
 *
 * We rely on `cspell-lib` (bundled with @cspell/dict-en_us and @cspell/dict-ar)
 * to do the heavy lifting — it handles both scripts and generates
 * edit-distance / fix-map-based suggestions.
 */
export async function checkWord(word: string): Promise<SpellResult> {
  const trimmed = word.trim();
  if (!trimmed) {
    return { word, language: "other", isMisspelled: false, suggestions: [] };
  }
  const lang = detectLanguage(trimmed);
  if (lang === "other") {
    return { word: trimmed, language: "other", isMisspelled: false, suggestions: [] };
  }
  // Custom carton dictionary trumps the generic trie. This catches brand
  // names ("amazon.ae"), country codes ("UAE"), and stock Arabic phrases
  // that ship on packaging but aren't in @cspell/dict-*.
  if (isInCustomDict(trimmed, lang)) {
    return { word: trimmed, language: lang, isMisspelled: false, suggestions: [] };
  }
  const result = await suggestionsForWord(trimmed, lang);
  return {
    word: trimmed,
    language: lang,
    isMisspelled: result.isMisspelled,
    suggestions: result.suggestions,
  };
}

export async function checkWords(words: string[]): Promise<SpellResult[]> {
  return Promise.all(words.map(checkWord));
}
