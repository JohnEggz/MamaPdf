# Tests

No spreadsheet is stored in this repository.

`fixtures.mjs` builds every input the tests need — participants (ODS), survey
(XLSX), the Zoom CSV and the payloads for `smoke.mjs` — from invented names and
`@example.*` addresses. The files are written to `test/.tmp/` when a test starts
and deleted when it ends; the directory is gitignored.

Why: the real exports contain participant names, private e-mail addresses and
birth dates. Keeping even a sanitized copy around invites accidents, so the
repository holds code only. `npm run check:privacy` fails if a data file (`.csv`,
`.xlsx`, `.ods`, `.docx`, `.json` …) appears under `test/`, and if any
non-`@example.*` address, PESEL-like number or known real name appears anywhere.

Notes for editing `fixtures.mjs`:

- Keep the counts the e2e suite asserts: 34 webinar rows, 3 participants,
  32 survey responses with the documented aggregates.
- Keep the awkward cases: host/presenter rows without names, uppercase names,
  double spaces, hyphenated surnames, a `_1` login suffix, a `mobile` device
  row, blank `Adres email` cells, ratings and rating comments.
- Never point a test at a real file from `confidential/` or a download folder.
