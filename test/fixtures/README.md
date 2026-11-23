# Test fixtures

**Everything in this directory is synthetic.** No file here may contain data from
a real training, a real participant, or a real spreadsheet export.

These files exist only to feed the parsers and the e2e suite. They are never
served: `public/` is what gets published, and anything placed there ends up in
`dist/` and on the live site.

| File | Used by | Notes |
|---|---|---|
| `ankieta.ods` | `e2e.mjs` (participants) | 3 invented participants (`John Doe`, `Robert Sigma`, `Mike Hawk`), legacy ODS layout incl. the RODO block and one junk e-mail cell |
| `ankieta_temp.xlsx` | `e2e.mjs` (survey) | 32 responses, aggregates only, no comments from real people |
| `webinar-kot.csv` | `e2e.mjs` (webinar-kot flow) | 34 rows shaped like a Zoom export: host + presenter without names, 32 listeners, one uppercase name, double spaces, hyphenated surname, `Login` with a `_1` suffix, a `mobile` device row, ratings and rating comments. All addresses are `@example.*` |
| `data_gen.json` | `smoke.mjs` | training + participant payload for Typst compilation |
| `survey_gen.json` | `smoke.mjs` | processed survey payload for the Referencje template |

Rules:

- Keep addresses on `@example.com`, `@example.org`, or `@example.edu.pl`.
- Keep invented names; `npm run check:privacy` rejects names from the original
  Zoom export by hash, and any non-`@example.*` address.
- Keep the row counts the e2e suite asserts (34 webinar rows, 3 participants,
  32 survey responses) when editing these files.
