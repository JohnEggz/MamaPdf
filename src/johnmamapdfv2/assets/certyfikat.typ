#let data = sys.inputs 
#let tr = json(bytes(data.training))
#let participants = json(bytes(data.participants))

#set page(paper: "a4", margin: 2cm)
#set text(font: "DejaVu Sans", size: 12pt, lang: "pl")

#let primary-color = rgb("#3c99aa")

// Helper for the blue decorative lines
#let blue-line = line(length: 100%, stroke: 1.5pt + primary-color)

// Helper to format the Tematyka list on Page 2
// #let format-list(txt) = {
//   let lines = txt.split("\n").filter(it => it.trim() != "")
//   enum(..lines.map(l => l.replace(regex("^\d+\.\s*"), "")))
// }

#for (i, p) in participants.enumerate() {
  // --- PAGE 1: FRONT ---
  
  // Absolute elements (Logo, Stamp, ID)
  place(top + left, image("logo.png", width: 6.2cm), dx: -0.5cm, dy: 0cm)
  place(top + right, image("stamp.png", width: 7.5cm), dx: 0.5cm, dy: 0.4cm)
  
  // Main Content Stack
  move(dy: 4.5cm)[
    #stack(
      dir: ttb,
      spacing: 1.2em,
      
      [#tr.numer_szkolenia/#(i + 1)],
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
        // [miejsce: #(if p.placowka == "" { tr.miejsce_szkolenia } else { p.placowka })],
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
  place(bottom + left, dy: -1cm)[
    Zaświadczenie wydano:
    #v(0.1cm)
    Wieliczka, #tr.data_wystawienia r.
  ]

  pagebreak()

  // --- PAGE 2: BACK (Plan szkolenia) ---
  
  // Re-place logo for branding on back
  align(right, image("logo.png", width: 4cm))
  
  v(4cm)
  // [== Program Szkolenia:]
  // v(0.5cm)
  //
  table(
    columns: (1fr),
    inset: 10pt,
    align: horizon,
    fill: luma(250),
    [*Program szkolenia:*],
    // format-list(tr.tematyka)
    [#eval(tr.tematyka, mode: "markup")]
  )

  // Avoid a blank page after the last participant
  if i < participants.len() - 1 {
    pagebreak()
  }
}
