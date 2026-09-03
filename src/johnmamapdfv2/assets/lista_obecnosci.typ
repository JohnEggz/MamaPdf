#let data = sys.inputs 
#let tr = json(bytes(data.training))
#let participants = json(bytes(data.participants))

#set page(
  paper: "a4",
  header: context {
    if here().page() > 1 {
      stack(
        dir: ttb,      // top to bottom
        spacing: 2.4cm,  // the gap
        [],            // an empty element to start the stack
        align(right, image("logo.png", width: 3cm))
      )
    }
  }
)

#set text(font: "DejaVu Sans", size: 10pt, lang: "pl")
#set table(inset: 7pt, stroke: 0.5pt + gray)
#show table.cell.where(y: 0): set text(weight: "bold")

// 1. Helper to turn "\n" strings into native numbered lists
// #let format-list(txt) = {
//   let lines = txt.split("\n").filter(it => it.trim() != "")
//   // We strip the "1. " from your string to let Typst handle numbering/indentation
//   enum(..lines.map(l => l.replace(regex("^\d+\.\s*"), "")))
// }

// --- PAGE 1: COVER ---
#block(width: 100%, height: 100%)[
  #align(right, image("logo.png", width: 6cm))
  
  #align(center + horizon)[
    #text(26pt, weight: "bold")[Dziennik zajęć]
    #v(1cm)
    #text(18pt)[Tytuł: #tr.nazwa_szkolenia]
    // #text(18pt, style: "italic")[Tytuł: #lorem(20)]
    #v(0.5cm)
    #text(14pt)[KOD: #tr.numer_szkolenia]
  ]

  #align(bottom + left)[
    #grid(
      columns: (auto, 1fr),
      column-gutter: 1em,
      row-gutter: 1.2em,
      [**Data:**], [#tr.data_szkolenia r.],
      [**Miejsce:**], [#tr.miejsce_szkolenia],
      [**Prowadzący:**], [#tr.prowadzacy],
    )
    #v(1.5cm)
  ]
]

#pagebreak()

// --- PAGE 2: PLAN & PROGRAM ---
== Plan szkolenia
#table(
  // 2. Using 'auto' for everything except the content column
  columns: (1fr, auto, auto),
  align: horizon,
  [Tematyka], [Liczba godz.], [Podpis],
  eval(tr.tematyka, mode: "markup"), 
  tr.czas_trwania, 
  []
)

#v(2em)

== Program szkolenia
#table(
  columns: (auto, 1fr, auto, auto, auto),
  align: horizon,
  [Data], [Tematyka], [Czas], [Godz.], [Podpis],
  tr.data_szkolenia + " r.", 
  eval(tr.tematyka, mode: "markup"), 
  tr.czas_trwania_od_do, 
  tr.czas_trwania, 
  []
)

#pagebreak()

// --- PAGE 3: LISTA UCZESTNIKÓW ---
== Lista uczestników
#table(
  columns: (auto, 1fr, auto, auto, 1fr),
  fill: (x, y) => if y == 0 { luma(248) },
  align: (x, y) => {
    if y == 0 { return center + horizon }
    if x == 0 { return center + horizon }
    return left + horizon
  },
  
  [Lp.], [Imię i nazwisko], [Data ur.], [Miejsce ur.], [Placówka],
  ..participants.enumerate().map(((i, p)) => (
    str(i + 1),
    p.imie_nazwisko,
    p.data_urodzenia + " r.",
    p.miejsce_urodzenia,
    if p.placowka == "" { tr.miejsce_szkolenia } else { p.placowka }
  )).flatten()
)

#pagebreak()

// --- PAGE 4: ZAŚWIADCZENIA ---
== Wydane zaświadczenia
#table(
  columns: (auto, 1fr, 1.2fr),
  fill: (x, y) => if y == 0 { luma(248) },
  align: (x, y) => {
    if y == 0 { return center + horizon }
    if x == 0 { return center + horizon }
    return left + horizon
  },
  [Lp.], [Imię i Nazwisko], [Numer Zaświadczenia],
  ..participants.enumerate().map(((i, p)) => (
    str(i + 1),
    p.imie_nazwisko,
    [#tr.numer_szkolenia/#(i + 1)]
  )).flatten()
)

#pagebreak()

// --- PAGE 5: SPRAWOZDANIE ---
== ORGANIZACJA I SPRAWOZDANIE

#v(1cm)

#table(
  columns: (auto, 1fr),
  stroke: none,      // Makes it look like a grid
  inset: (y: 0.3em), // Controls the vertical spacing between "rows"
  column-gutter: 1em,
  [*Instytucja:*], [MNODN "Best Practice Edukacja"],
  [*Opiekun:*], [Małgorzata Cużytek]
)

#v(2em)
=== Szczegóły kursu

#table(
  columns: (auto, auto, auto, auto, auto, auto, auto),
  align: center + horizon,
  
  table.cell(colspan: 2)[Czas trwania],
  table.cell(colspan: 2)[Liczba],
  table.cell(rowspan: 2)[Uczestnicy],
  table.cell(rowspan: 2)[Zaświadczenia],
  table.cell(rowspan: 2)[Uwagi],
  
  [od], [do], [dni], [godz.],
  
  tr.data_szkolenia + " r.", tr.data_szkolenia + " r.", [1], tr.czas_trwania,
  str(participants.len()), str(participants.len()), [-]
)

#v(5cm)
#align(left)[
  Wieliczka, #tr.data_wystawienia  r.\
  #v(3em)
  #box(
    width: 4cm,
    stroke: (top: 0.5pt),
  )[
    #v(0.5em)
    #set text(8pt)
    #align(center)[Podpis osoby upoważnionej]
  ]
]
