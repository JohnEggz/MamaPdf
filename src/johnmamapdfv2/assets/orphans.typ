// ============================================================================
// orphans.typ -- prevent "orphan" words at line ends
// ============================================================================
//
// A one-letter word (e.g. Polish "a", "i", "o", "u", "w", "z") or a short word
// must not be left alone at the end of a line. Typst can keep words together
// with a non-breaking space (U+00A0 / `~`), but text that comes from data
// (JSON, spreadsheets, ...) cannot use `~`.
//
// This module replaces the space after every word listed in `orphan-words`
// with a non-breaking space, so the word stays glued to the next one.
//
// It is fully self-contained: copy this file next to any Typst template and
// import it. There are no external dependencies.
//
// ---------------------------------------------------------------------------
// USAGE
// ---------------------------------------------------------------------------
//
// Whole document (recommended) -- add these two lines near the top of the
// template, before any content:
//
//   #import "orphans.typ": orphan-regex, orphan-replacement
//   #show orphan-regex: orphan-replacement
//
// A single piece of content or a single string:
//
//   #import "orphans.typ": fix-orphans, fix-orphans-str
//   #fix-orphans[Pani Anna brala udzial w webinarze.]
//   #fix-orphans-str("Pani Anna brala udzial w webinarze.")
//
// ---------------------------------------------------------------------------
// EXTENDING THE WORD LIST
// ---------------------------------------------------------------------------
//
// Just add or remove entries in `orphan-words` below. Words are matched as
// whole words, so "i" will not affect "iść". Order does not matter.
// ============================================================================

// Non-breaking space.
#let nbsp = "\u{00a0}"

// Words that must never stand alone at the end of a line.
#let orphan-words = (
  // Polish one-letter words
  "a", "i", "o", "u", "w", "z",
  // Common short Polish words
  "że", "by", "na", "do", "od", "po", "za", "ze", "we", "ku", "lub", "niż",
  // Abbreviations
  "r.", "nr", "np.", "itd.", "itp.",
)

// --- internals -------------------------------------------------------------

// Characters that are special in a regex and must be escaped.
#let _re-escape-chars = (
  "\\", ".", "^", "$", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|", "-",
)

// Escape a literal word so it can be embedded safely in a regex.
#let _re-escape(word) = {
  let out = word
  for c in _re-escape-chars {
    out = out.replace(c, "\\" + c)
  }
  out
}

// Matches a listed word followed by a single space. The `\b` start anchor and
// the required trailing space make this whole-word: "i" does not match "iść".
#let orphan-regex = regex(
  "\\b(?:" + orphan-words.map(_re-escape).join("|") + ") "
)

// Replaces the matched trailing space with a non-breaking space. Works both as
// a `#show` transform (content) and as a `str.replace` callback (match).
#let orphan-replacement = it => it.text.trim() + nbsp

// Apply orphan handling to a block of content only (does not leak outside).
#let fix-orphans(body) = {
  show orphan-regex: orphan-replacement
  body
}

// Apply orphan handling to a plain string.
#let fix-orphans-str(s) = s.replace(orphan-regex, orphan-replacement)
