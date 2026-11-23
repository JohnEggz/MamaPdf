#let data = sys.inputs
#let tr = json(bytes(data.training))
#let participants = json(bytes(data.participants))

// Keep short/orphan words (a, i, w, z, ...) glued to the next word.
#import "orphans.typ": orphan-regex, orphan-replacement
#show orphan-regex: orphan-replacement

#set page(
  paper: "a4",
  margin: (x: 2.2cm, top: 2.2cm, bottom: 1.8cm),
  background: context {
    if here().page() > 1 {
      place(top + right, dx: -2.2cm, dy: 0.6cm, image("logo.png", width: 3.2cm))
    }
  },
)
#set text(font: "DejaVu Sans", size: 10pt, lang: "pl")
#set par(leading: 0.63em)

#let brand = rgb("#3c99aa")
#let muted = rgb("#66727f")
#let pale = rgb("#eef7f8")
#let rule = rgb("#dbe5e8")

#let section(title) = block(above: 1.3em, below: 0.5em)[
  #text(size: 12pt, fill: brand)[#title]
]

#let meta(value) = text(size: 7.5pt, fill: muted, tracking: 0.5pt, upper(value))

#let left-rows = (x, y) => if y == 0 { center + horizon } else { left + horizon }

// Pale header row with small-caps labels and hairline row rules.
#let data-table(columns, header, rows, align-cells: left-rows) = table(
  columns: columns,
  inset: (x: 7pt, y: 5pt),
  stroke: (rest: none, bottom: 0.35pt + rule),
  fill: (x, y) => if y == 0 { pale } else { none },
  align: align-cells,
  table.header(..header.map(label => align(center, meta(label)))),
  ..rows,
)

// --- PAGE 1: COVER ---

#block(width: 100%, height: 100%)[
  #grid(
    columns: (1fr, auto),
    align: (left + bottom, right + bottom),
    image("logo.png", width: 5.2cm),
    text(size: 8pt, fill: muted, tracking: 0.6pt)[DOKUMENTACJA SZKOLENIA],
  )

  #v(0.45cm)
  #line(length: 100%, stroke: 1.1pt + brand)

  #v(1fr)

  #text(size: 20pt, fill: brand)[Dziennik zajęć]
  #v(0.1cm)
  #text(size: 9.5pt, fill: muted)[Plan, program, lista uczestników i sprawozdanie]

  #v(0.9cm)

  #block(width: 100%, fill: pale, radius: 8pt, inset: (x: 14pt, y: 12pt))[
    // Full-width: the training title can be long and wraps badly in a column.
    #stack(
      spacing: 0.45em,
      meta("Temat szkolenia"),
      text(size: 12.5pt)[#tr.nazwa_szkolenia],
    )

    #v(0.8em)

    #grid(
      columns: (1fr, 1fr),
      column-gutter: 1.4em,
      row-gutter: 0.9em,

      stack(
        spacing: 0.45em,
        meta("Kod szkolenia"),
        text(size: 10.5pt)[#tr.numer_szkolenia],
      ),
      stack(
        spacing: 0.45em,
        meta("Liczba uczestników"),
        text(size: 10.5pt)[#participants.len()],
      ),

      stack(
        spacing: 0.45em,
        meta("Miejsce szkolenia"),
        text(size: 10.5pt)[#tr.miejsce_szkolenia],
      ),
      stack(
        spacing: 0.45em,
        meta("Prowadzący"),
        text(size: 10.5pt)[#tr.prowadzacy],
      ),

      stack(
        spacing: 0.45em,
        meta("Data szkolenia"),
        text(size: 10.5pt)[#tr.data_szkolenia r.],
      ),
      [],
    )
  ]

  #v(1fr)

  #block(width: 100%)[
    #line(length: 100%, stroke: 0.5pt + rule)
    #v(0.35cm)
    #text(size: 8pt, fill: muted)[Wieliczka, #tr.data_wystawienia r.]
  ]
]

#pagebreak()

// --- PAGE 2: PLAN & PROGRAM ---

#section([Plan szkolenia])

#data-table(
  (1fr, 2.9cm, 3.2cm),
  ("Tematyka", "Liczba godz.", "Podpis"),
  (
    eval(tr.tematyka, mode: "markup"),
    align(center)[#tr.czas_trwania],
    [],
  ),
  align-cells: (x, y) => if y == 0 or x > 0 { center + horizon } else { left + horizon },
)

#v(1.2em)

#section([Program szkolenia])

#data-table(
  (auto, 1fr, auto, auto, auto),
  ("Data", "Tematyka", "Czas", "Godz.", "Podpis"),
  (
    align(center)[#tr.data_szkolenia r.],
    eval(tr.tematyka, mode: "markup"),
    align(center)[#tr.czas_trwania_od_do],
    align(center)[#tr.czas_trwania],
    [],
  ),
)

#pagebreak()

// --- PAGE 3: LISTA UCZESTNIKÓW ---

#section([Lista uczestników])

#data-table(
  (auto, 1fr, 2.9cm, 1fr, 1.1fr),
  ("Lp.", "Imię i nazwisko", "Data ur.", "Miejsce ur.", "Placówka"),
  participants
    .enumerate()
    .map(((i, p)) => (
      align(center)[#text(fill: muted)[#str(i + 1)]],
      p.imie_nazwisko,
      p.data_urodzenia + " r.",
      p.miejsce_urodzenia,
      if p.placowka == "" { tr.miejsce_szkolenia } else { p.placowka },
    ))
    .flatten(),
  align-cells: (x, y) => if y == 0 or x == 0 { center + horizon } else { left + horizon },
)

#pagebreak()

// --- PAGE 4: ZAŚWIADCZENIA ---

#section([Wydane zaświadczenia])

#data-table(
  (auto, 1fr, 1.2fr),
  ("Lp.", "Imię i nazwisko", "Numer zaświadczenia"),
  participants
    .enumerate()
    .map(((i, p)) => (
      align(center)[#text(fill: muted)[#str(i + 1)]],
      p.imie_nazwisko,
      [#tr.numer_szkolenia/#(i + 1)],
    ))
    .flatten(),
  align-cells: (x, y) => if y == 0 or x == 0 { center + horizon } else { left + horizon },
)

#pagebreak()

// --- PAGE 5: SPRAWOZDANIE ---

#section([Organizacja i sprawozdanie])

#block(width: 100%, fill: pale, radius: 8pt, inset: (x: 14pt, y: 12pt))[
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 1.4em,
    row-gutter: 0.9em,
    stack(
      spacing: 0.45em,
      meta("Instytucja"),
      text(size: 10.5pt)[MNODN "Best Practice Edukacja"],
    ),
    stack(
      spacing: 0.45em,
      meta("Opiekun"),
      text(size: 10.5pt)[Małgorzata Cużytek],
    ),
  )
]

#section([Szczegóły kursu])

#table(
  columns: (1fr, 1fr, auto, auto, auto, auto, auto),
  inset: (x: 7pt, y: 5pt),
  stroke: (rest: none, bottom: 0.35pt + rule),
  fill: (x, y) => if y <= 1 { pale } else { none },
  align: center + horizon,

  table.cell(colspan: 2)[#meta("Czas trwania")],
  table.cell(colspan: 2)[#meta("Liczba")],
  table.cell(rowspan: 2)[#meta("Uczestnicy")],
  table.cell(rowspan: 2)[#meta("Zaświadczenia")],
  table.cell(rowspan: 2)[#meta("Uwagi")],

  [#text(size: 8pt, fill: muted)[od]],
  [#text(size: 8pt, fill: muted)[do]],
  [#text(size: 8pt, fill: muted)[dni]],
  [#text(size: 8pt, fill: muted)[godz.]],

  tr.data_szkolenia + " r.",
  tr.data_szkolenia + " r.",
  [1],
  tr.czas_trwania,
  str(participants.len()),
  str(participants.len()),
  [-],
)

#v(2.2cm)

#grid(
  columns: (1fr, auto),
  align: (left + bottom, right + bottom),
  text(size: 9pt, fill: muted)[Wieliczka, #tr.data_wystawienia r.],
  block(width: 6cm)[
    #align(center)[
      #v(1cm)
      #line(length: 100%, stroke: 0.5pt + muted)
      #v(0.15cm)
      #text(size: 8pt, fill: muted)[Podpis osoby upoważnionej]
    ]
  ],
)
