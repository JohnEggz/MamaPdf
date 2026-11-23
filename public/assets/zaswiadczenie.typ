#let tr = json(bytes(sys.inputs.training))
#let p = json(bytes(sys.inputs.participant))
#let number = sys.inputs.number

// Keep short/orphan words (a, i, w, z, ...) glued to the next word.
#import "orphans.typ": orphan-regex, orphan-replacement
#show orphan-regex: orphan-replacement

#set page(paper: "a4", margin: 2cm)
#set text(font: "DejaVu Sans", size: 12pt, lang: "pl")

#let primary-color = rgb("#3c99aa")

// Helper for the blue decorative lines
#let blue-line = line(length: 100%, stroke: 1.5pt + primary-color)

// --- PAGE 1: FRONT ---

// Absolute elements (Logo, Stamp, ID)
#place(top + left, image("logo.png", width: 6.2cm), dx: -0.5cm, dy: 0cm)
#place(top + right, image("stamp.png", width: 7.5cm), dx: 0.5cm, dy: 0.4cm)

// Main Content Stack
#move(dy: 4.5cm)[
  #stack(
    dir: ttb,
    spacing: 1.2em,

    [#(tr.numer_szkolenia + "/" + number)],
    v(0.5cm),

    blue-line,
    v(0.5cm),
    align(center, text(22pt, fill: primary-color)[ZAŚWIADCZENIE]),
    align(center, text(12pt, fill: primary-color)[O UKOŃCZENIU FORMY DOSKONALENIA ZAWODOWEGO]),
    v(0.5cm),
    blue-line,

    v(1.5cm),
    align(center)[Pan/i],
    align(center, text(20pt)[#p.imie_nazwisko]),

    v(1cm),
    align(center)[
      urodzony/a: #p.data_urodzenia r., #p.miejsce_urodzenia \
      #v(1cm)
      ukończył/a szkolenie:
    ],

    align(center, text(18pt)[„#tr.nazwa_szkolenia”]),

    v(2cm),
    grid(
      columns: (1fr, 1fr),
      align: center,
      [w dniu: #tr.data_szkolenia r.],
      [w wymiarze: #tr.czas_trwania]
    ),

    v(1cm),
    align(center)[
      zorganizowane przez Niepubliczną Placówkę Doskonalenia Nauczycieli \
      Best Practice "Edukacja" w Wieliczce
    ],
  )
]

// Footer Info
#place(bottom + left, dy: -1cm)[
  Zaświadczenie wydano:
  #v(0.1cm)
  Wieliczka, #tr.data_wystawienia r.
]

// Signature, bottom center
#place(bottom + center, dy: -0.5cm, image("signature_mama.png", width: 4cm))

#pagebreak()

// --- PAGE 2: BACK (Plan szkolenia) ---

// Re-place logo for branding on back
#align(right, image("logo.png", width: 4cm))

#v(4cm)
#table(
  columns: (1fr),
  inset: 10pt,
  align: horizon,
  fill: luma(250),
  [*Program szkolenia:*],
  [#eval(tr.tematyka, mode: "markup")]
)
