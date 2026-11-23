const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

/** Sanitizes one path component for Linux/Windows. Mirrors the Python helper. */
export function sanitizeFilenameComponent(text: string): string {
  let cleaned = String(text).replace(INVALID_FILENAME_CHARS, "_");
  cleaned = cleaned.replace(/\s+/g, "_");
  cleaned = cleaned.replace(/^[ ._]+|[ ._]+$/g, "");
  if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) cleaned = `_${cleaned}`;
  return cleaned;
}

/**
 * `<NN>_<First>_<Rest of name>_<email>.pdf`, mirroring the old Python builder.
 * Ordinal width is at least two digits.
 */
export function buildCertificateFilename(
  index: number,
  total: number,
  participant: { imie_nazwisko?: string; email?: string },
): string {
  const width = Math.max(2, String(total).length);
  const parts: string[] = [String(index).padStart(width, "0")];

  const nameParts = String(participant.imie_nazwisko ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (nameParts.length > 0) {
    parts.push(nameParts[0]);
    if (nameParts.length > 1) parts.push(nameParts.slice(1).join(" "));
  }

  const email = String(participant.email ?? "").trim();
  if (email) parts.push(email);

  const stem = parts
    .map(sanitizeFilenameComponent)
    .filter(Boolean)
    .join("_");
  return `${stem}.pdf`;
}
