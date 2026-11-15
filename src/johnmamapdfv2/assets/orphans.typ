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
// with a non-breaking space, so the word stays glued to the next one. It also
// lets you place non-breaking spaces manually with `~` (see below).
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
// MANUAL NON-BREAKING SPACES
// ---------------------------------------------------------------------------
//
// The automatic rule only covers the words in `orphan-words`. To force a
// non-breaking space anywhere:
//
//   * In markup, use Typst's native `~`:      [Anna~Kowalska]
//   * In data (JSON strings / spreadsheet cells), write `~`, which the same
//     show rule converts:                    "Anna~Kowalska"
//   * In code, use the helpers below:         #glue("Anna", "Kowalska")
//
// Note: a literal `~` used as "approximately" (e.g. "~5") is also converted.
// Change `nb-marker` below if that collides with your data.
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

// Manual marker that becomes a non-breaking space in data (JSON / cells).
// In static markup Typst already treats `~` natively as a non-breaking space.
#let nb-marker = "~"

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

// Matches either a listed word followed by a single space, or the manual
// marker. The `\b` start anchor and the required trailing space make the word
// alternative whole-word: "i" does not match "iść".
#let orphan-regex = regex(
  "(?:\\b(?:" + orphan-words.map(_re-escape).join("|") + ") |"
  + _re-escape(nb-marker) + ")"
)

// Replaces a matched orphan word or the manual marker with a non-breaking
// space. Works both as a `#show` transform (content) and as a `str.replace`
// callback (match).
#let orphan-replacement = it => {
  if it.text == nb-marker { nbsp } else { it.text.trim() + nbsp }
}

// Apply orphan handling to a block of content only (does not leak outside).
#let fix-orphans(body) = {
  show orphan-regex: orphan-replacement
  body
}

// Apply orphan handling to a plain string.
#let fix-orphans-str(s) = s.replace(orphan-regex, orphan-replacement)

// --- manual helpers --------------------------------------------------------

// Join variadic items with non-breaking spaces: #glue("Anna", "Kowalska")
#let glue(..parts) = parts.pos().join(nbsp)

// Join an array of items with non-breaking spaces: #nbsp-join(("Anna", "Kowalska"))
#let nbsp-join(parts) = parts.join(nbsp)
