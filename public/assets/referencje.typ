#let tr = json(bytes(sys.inputs.training))
#let average = sys.inputs.average

// Keep short/orphan words (a, i, w, z, ...) glued to the next word.
#import "orphans.typ": orphan-regex, orphan-replacement
#show orphan-regex: orphan-replacement

#set page(
  paper: "a4",
  margin: (x: 2.2cm, top: 1.8cm, bottom: 1.8cm),
)
#set text(font: "DejaVu Sans", size: 11pt, lang: "pl", hyphenate: false)
#set par(leading: 0.8em)

#let brand = rgb("#3c99aa")
#let muted = rgb("#66727f")

#let emph-var(value) = text(fill: black, weight: "bold")[#value]

// --------------------------------- letterhead -------------------------------

#grid(
  columns: (1fr, auto),
  align: (left + top, right + top),
  stack(
    spacing: 0.2em,
    image("logo.png", width: 5.2cm),
    text(size: 8pt, fill: muted, tracking: 0.4pt)[OŚRODEK DOSKONALENIA NAUCZYCIELI],
  ),
  align(right, text(size: 8.5pt, fill: muted)[
    Best Practice Sp. z o.o. \
    Gołkowice 498 \
    30-698 Wieliczka \
    tel. 609 056 055 \
    www.bestpractice.edu.pl
  ]),
)

#v(0.55cm)
#line(length: 100%, stroke: 0.8pt + brand)
#v(1.3cm)

// ---------------------------------- title -----------------------------------

#align(center)[
  #text(size: 18pt, fill: brand, tracking: 2pt)[REFERENCJE]
]

#v(1.2cm)

// ---------------------------------- body ------------------------------------

#set par(justify: true, leading: 0.8em)

Oświadczam, iż szkolenie: „#emph-var(tr.nazwa_szkolenia)”, którego odbiorcą
byli nauczyciele placówki oświatowej: #emph-var(tr.miejsce_szkolenia), a które
poprowadził trener: #emph-var(tr.prowadzacy), zostało przeprowadzone przez
Niepubliczną Placówkę Doskonalenia Nauczycieli Best Practice Edukacja
w terminie #emph-var(tr.data_szkolenia + " r.") w wymiarze
#emph-var(tr.czas_trwania).

#v(0.6em)

Szkolenie zostało zrealizowane należycie, zgodnie z ustalonym programem.
Średnia ocena z ewaluacji uczestników szkolenia wyniosła
#emph-var(average) (w skali 1–5).

// -------------------------------- signature ---------------------------------

#v(4.2cm)

#align(right)[
  #line(length: 6cm, stroke: 0.5pt + muted)
  #v(0.15cm)
  #text(size: 8pt, fill: muted)[podpis i pieczątka dyrektora placówki]
]
