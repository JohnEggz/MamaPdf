#let tr = json(bytes(sys.inputs.training))
#let survey = json(bytes(sys.inputs.survey))

// Keep short/orphan words (a, i, w, z, ...) glued to the next word.
#import "orphans.typ": orphan-regex, orphan-replacement
#show orphan-regex: orphan-replacement

#set page(
  paper: "a4",
  margin: (x: 2.2cm, top: 2.2cm, bottom: 1.8cm),
  background: context {
    if here().page() > 1 {
      place(top + right, dx: -2.2cm, dy: 0.9cm, image("logo.png", width: 3.2cm))
    }
  },
)
#set text(font: "DejaVu Sans", size: 10pt, lang: "pl")
#set par(leading: 0.63em)

#let brand = rgb("#3c99aa")
#let muted = rgb("#66727f")
#let pale = rgb("#eef7f8")
#let rule = rgb("#dbe5e8")

#let fmt-average(value) = if value == none {
  [–]
} else {
  str(value).replace(".", ",")
}

#let section(title) = block(above: 1.3em, below: 0.5em)[
  #text(size: 12pt, fill: brand)[#title]
]

#let meta(value) = text(size: 7.5pt, fill: muted, tracking: 0.5pt, upper(value))

// ---------------------------------- header ---------------------------------

#grid(
  columns: (1fr, auto),
  align: (left + bottom, right + bottom),
  image("logo.png", width: 5.2cm),
  text(size: 8pt, fill: muted, tracking: 0.6pt)[RAPORT EWALUACYJNY],
)

#v(0.45cm)
#line(length: 100%, stroke: 1.1pt + brand)
#v(0.55cm)

#text(size: 20pt, fill: brand)[Ewaluacja szkolenia]
#v(0.1cm)
#text(size: 9.5pt, fill: muted)[Podsumowanie odpowiedzi uczestników]

#v(0.55cm)

// ----------------------------------- meta ----------------------------------

#block(
  width: 100%,
  fill: pale,
  radius: 8pt,
  inset: (x: 14pt, y: 12pt),
)[
  // Full-width: the training title can be long and wraps badly in a column.
  #stack(
    spacing: 0.45em,
    meta("TEMAT"),
    text(size: 12.5pt)[#tr.nazwa_szkolenia],
  )

  #v(0.8em)

  #grid(
    columns: (1fr, 1fr),
    column-gutter: 1.4em,
    row-gutter: 0.7em,

    stack(
      spacing: 0.45em,
      meta("MIEJSCE"),
      text(size: 10.5pt)[#tr.miejsce_szkolenia],
    ),
    stack(
      spacing: 0.45em,
      meta("KOD SZKOLENIA"),
      text(size: 10.5pt)[#tr.numer_szkolenia],
    ),

    stack(
      spacing: 0.45em,
      meta("PROWADZĄCY"),
      text(size: 10.5pt)[#tr.prowadzacy],
    ),
    stack(
      spacing: 0.45em,
      meta("DATA"),
      text(size: 10.5pt)[#tr.data_szkolenia r.],
    ),

    stack(
      spacing: 0.45em,
      meta("LICZBA ANKIET EWALUACYJNYCH"),
      text(size: 10.5pt)[#survey.responseCount],
    ),
    [],
  )
]

// ---------------------------------- ratings --------------------------------

#section([Oceny uczestników])

#table(
  columns: (1fr, 2.2cm, 1.6cm),
  inset: (x: 7pt, y: 4pt),
  stroke: (rest: none, bottom: 0.35pt + rule),
  fill: (x, y) => if y == 0 { pale } else { none },
  table.header(
    meta("Kryterium"),
    align(center, meta("Średnia")),
    align(center, meta("Odp.")),
  ),
  ..survey.ratings
    .map(rating => (
      text(size: 9pt)[#(rating.header)],
      align(center)[#text(size: 13pt, fill: brand)[#fmt-average(rating.average)]],
      align(center)[#text(size: 9pt, fill: muted)[#rating.responses]],
    ))
    .flatten(),
)

// ------------------------------- recommendation ----------------------------

#section([Rekomendacja kursu])

#block(breakable: false)[
  #grid(
    columns: (1fr, 1fr, 1fr),
    column-gutter: 0.6em,
    ..survey.recommendation.map(entry => block(
      width: 100%,
      fill: pale,
      radius: 6pt,
      inset: (x: 8pt, y: 8pt),
      align(center)[
        #text(size: 18pt, fill: brand)[#entry.count]
        #linebreak()
        #text(size: 8.5pt, fill: muted)[#entry.label]
      ],
    )),
  )
]

// --------------------------------- comments --------------------------------

#section([Uwagi uczestników])

#let comments = survey.comments.filter(comment => comment.trim() != "")

#if comments.len() == 0 {
  text(fill: muted)[Brak uwag.]
} else {
  list(
    indent: 0.6cm,
    body-indent: 0.35cm,
    spacing: 0.35em,
    ..comments.map(comment => text(size: 9pt)[#comment]),
  )
}

// --------------------------------- interests -------------------------------

#let interest-rows = survey.interests.map(topic => (
  text(size: 9pt)[#(if topic.key == "inne" { "Inne" } else { topic.label })],
  align(center)[
    #text(size: 9pt)[
      #(if topic.key == "inne" and topic.count == 0 { "-" } else { str(topic.count) })
    ]
  ],
))

#block(breakable: false)[
  #section([Preferowane tematy kolejnych szkoleń])
  #table(
    columns: (1fr, 2.2cm),
    inset: (x: 7pt, y: 3pt),
    stroke: (rest: none, bottom: 0.35pt + rule),
    fill: (x, y) => if y == 0 { pale } else { none },
    table.header(
      meta("Tematyka"),
      align(center, meta("Ilość wyborów")),
    ),
    ..interest-rows.flatten(),
  )
]
