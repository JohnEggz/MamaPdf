#!/usr/bin/env node
/**
 * Privacy guard for the static build.
 *
 * The app is published as a public GitHub Pages site, so the repository and the
 * built `dist/` must never contain participant data. This script fails when:
 *
 *  - fixtures live under `public/` (they would be copied into `dist/` verbatim),
 *  - a fixture is present in `dist/`,
 *  - a non-placeholder e-mail address appears anywhere in source or build,
 *  - a PESEL-like number or phone number appears in data/template files,
 *  - a real participant name from the original Zoom export appears (matched by
 *    SHA-256 prefix, so the denylist itself holds no personal data).
 *
 * Spreadsheet/Word fixtures are scanned too (unzipped in memory), because that
 * is the most likely place for participant data to sneak back in.
 *
 * Regenerate the hash lists from a private spreadsheet with:
 *   node scripts/check-privacy.mjs --hash "Imię Nazwisko"
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

const root = path.dirname(import.meta.dirname);

/** Full names (first + last, lowercased) seen in the real Zoom export. */
const REAL_FULL_NAMES = new Set([
  "02de4ebb1e27590d", "063937dc8d37d4b4", "1109e46799d41d28", "1fa5a5d158027293",
  "267800c01d63de98", "2f8bac4b396dd90b", "3342e1b608737cde", "40a0923c59d53e37",
  "4134ad882902f952", "563696f40cc385fc", "57fb0d9572c731a4", "784529ab6811b825",
  "7d8304289f5abfd5", "7e39bc682d0074d8", "85e18419873a0bd8", "956cd93c28c2a415",
  "990afa1ad1a2606f", "99d0c7f3577bbe78", "9e29a380c6d336f8", "c0939108e01badd2",
  "c2eb1351d198d440", "c48955ec58af7d56", "cc8ee69564a84935", "cca073ff64719b6b",
  "cef00d1acae1d325", "d2159d804fa50fda", "d80e098ab841baff", "dd5838cd7c12a73d",
  "dd74793defa544b0", "ddc09d2211675b49", "e6fb09c445ea0895", "e94a6d1bdd962ac0",
  "f375d74ec81f792f",
]);

/** Distinctive surnames (6+ letters, lowercased) from the same export. */
const REAL_SURNAMES = new Set([
  "1a69243bcf742a7d", "31b2c17a29c7240e", "47a0200cc06aa1cb", "495a26af2b473e66",
  "5a8cd87cf674ed49", "5f6d058b5fc8fd4f", "61bded9178b20a61", "637a2fee95398268",
  "6686e657f6d6c97e", "768776599e8929db", "7c90d4aaa54d3bd0", "7d449090e8a57141",
  "8bd3d9f11741c32f", "927b69f13dd1ec57", "976132ca7a251310", "a3a70a2c1ad1c355",
  "b1bf374ee370eae5", "c4072b8be74cac91", "cc3ab02a8c23be72", "da4c069481c03c50",
  "e0396517497121c3", "e31fd3b37b1570b2", "f13514e23ad567df", "f62976aca3ffa5c2",
  "f8fb501ea9eb75bd", "f9cf398ccc057ec0", "fb67e5a7cc0ab172",
]);

/**
 * Public letterhead: the trainer/opiekun name and the company phone number are
 * printed on every generated document, so they are deliberately not secret.
 */
const PUBLIC_LETTERHEAD = [/małgorzata\s+cużytek/giu, /\b609\s*056\s*055\b/g];

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".csv", ".md",
  ".html", ".css", ".typ", ".yml", ".yaml", ".txt",
]);
const ARCHIVE_EXT = new Set([".xlsx", ".xlsm", ".ods", ".docx"]);
/** Extensions where a bare 11-digit number is plausible participant data. */
const NUMERIC_EXT = new Set([".csv", ".json", ".md", ".txt", ".typ", ".html", ".yml", ".yaml"]);

const SKIP_DIRS = new Set(["node_modules", ".git", ".private", "dist"]);
// The scanner itself holds the public letterhead allowlist and name hashes.
const SKIP_FILES = new Set(["package-lock.json", "check-privacy.mjs"]);

const PLACEHOLDER_EMAIL = /@example\.(?:com|org|edu\.pl)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// PESEL: YYMMDDxxxxx with a real encoded month/day; not inside a decimal.
const PESEL = /(?<![\d.])\d{2}(?:0[1-9]|1[0-2]|2[1-9]|3[0-2])(?:0[1-9]|[12]\d|3[01])\d{5}(?![\d.])/;
const PHONE = /(?:\+48[\s-]?)?\b\d{3}[\s-]\d{3}[\s-]\d{3}\b/;

const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);

if (process.argv[2] === "--hash") {
  for (const value of process.argv.slice(3)) {
    console.log(`${hash(value.toLowerCase())}\t${value}`);
  }
  process.exit(0);
}

const violations = [];

function relative(file) {
  return path.relative(root, file) || ".";
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
      continue;
    }
    if (SKIP_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXT.has(ext) && !ARCHIVE_EXT.has(ext)) continue;
    yield full;
  }
}

function inspectText(text, where, options) {
  const ext = path.extname(where).toLowerCase();
  const numericRules = options.numericRules && (options.archive || NUMERIC_EXT.has(ext));

  text.split(/\r?\n/).forEach((raw, index) => {
    let line = raw;
    for (const pattern of PUBLIC_LETTERHEAD) line = line.replace(pattern, " ");

    for (const email of line.match(EMAIL) ?? []) {
      if (options.allowPlaceholders && PLACEHOLDER_EMAIL.test(email)) continue;
      violations.push(`${where}:${index + 1} e-mail address leaked: ${email}`);
    }
    if (numericRules && PESEL.test(line)) {
      violations.push(`${where}:${index + 1} PESEL-like 11-digit number`);
    }
    if (numericRules && PHONE.test(line)) {
      violations.push(`${where}:${index + 1} phone-number-like value`);
    }

    const tokens = line.toLowerCase().match(/\p{L}+/gu) ?? [];
    const names = [
      ...tokens,
      ...tokens.slice(1).map((token, i) => `${tokens[i]} ${token}`),
    ];
    for (const candidate of names) {
      const digest = hash(candidate);
      if (REAL_FULL_NAMES.has(digest) || REAL_SURNAMES.has(digest)) {
        violations.push(`${where}:${index + 1} real participant name (hash ${digest})`);
      }
    }
  });
}

function inspectArchive(file, where, options) {
  let entries;
  try {
    entries = unzipSync(new Uint8Array(readFileSync(file)));
  } catch {
    violations.push(`${where} is not a readable archive`);
    return;
  }
  for (const [name, bytes] of Object.entries(entries)) {
    if (!/\.(xml|rels|csv|txt)$/i.test(name)) continue;
    const text = new TextDecoder("utf-8").decode(bytes);
    inspectText(text, `${where}!${name}`, { ...options, archive: true });
  }
}

function inspect(file, options) {
  const where = relative(file);
  if (ARCHIVE_EXT.has(path.extname(where).toLowerCase())) {
    inspectArchive(file, where, options);
    return;
  }
  inspectText(readFileSync(file, "utf8"), where, options);
}

if (existsSync(path.join(root, "public/fixtures"))) {
  violations.push("public/fixtures exists — fixtures must live in test/fixtures");
}

if (existsSync(path.join(root, "dist"))) {
  const dist = path.join(root, "dist");
  if (existsSync(path.join(dist, "fixtures"))) {
    violations.push("dist/fixtures exists — test fixtures leaked into the build");
  }
  for (const file of walk(dist)) {
    inspect(file, { allowPlaceholders: false, numericRules: false });
  }
}

for (const file of walk(root)) {
  const where = relative(file);
  inspect(file, {
    allowPlaceholders: where.startsWith("test/fixtures/"),
    numericRules: true,
  });
}

if (violations.length > 0) {
  console.error(
    "Privacy check failed:\n" + violations.map((violation) => `  - ${violation}`).join("\n"),
  );
  process.exit(1);
}

console.log("Privacy check OK — no participant data or non-placeholder e-mail addresses.");
