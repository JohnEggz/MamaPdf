#let data = sys.inputs 
#let tr = json(bytes(data.training))
#let participants = json(bytes(data.participants))

// Keep short/orphan words (a, i, w, z, ...) glued to the next word.
#import "orphans.typ": orphan-regex, orphan-replacement
#show orphan-regex: orphan-replacement

#set page(paper: "a4", margin: 2cm)
#set text(font: "DejaVu Sans", size: 12pt, lang: "pl")

#let primary-color = rgb("#3c99aa")

// Helper for the blue decorative lines
#let blue-line = line(length: 100%, stroke: 1.5pt + primary-color)

// Footer image alignment: relative x/y offsets per image (tune as needed)
#let krakow-dx = 0cm
#let krakow-dy = -1cm
#let signature-dx = 0.5cm
#let signature-dy = 0cm
#let kot-dx = -0.5cm
#let kot-dy = -0.5cm

// --- GENERATION LOOP ---
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
      
      blue-line,
      v(0.5cm),
      align(center, text(22pt, fill: primary-color)[ZAŚWIADCZENIE]),
      // align(center, text(12pt, fill: primary-color)[O UKOŃCZENIU FORMY DOSKONALENIA ZAWODOWEGO]),
      v(0.5cm),
      blue-line,
      
      v(1.5cm),
      align(center)[Pan/i],
      align(center, text(20pt)[#p.imie_nazwisko]),
      
      v(1cm),
      align(center)[
        // urodzony/a: #p.data_urodzenia r., #p.miejsce_urodzenia \
        #v(1cm)
        brał/a udział w webinarze:
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
        zorganizowanym przez Niepubliczną Placówkę Doskonalenia Nauczycieli \
        Best Practice "Edukacja" we współpracy z Urzędem Miasta Krakowa \ oraz Specjalistyczną Poradnią Psychologiczno-Pedagogiczną "Krakowski~Ośrodek~Terapii"
      ],
      v(0.5cm),
    )
  ]

  // Footer Info & 3 images at the bottom (Kraków, signature, cat logo)
  place(bottom + left, dy: -0.5cm)[
    #stack(
      dir: ttb,
      spacing: 1cm,
      move(dy: 0.4cm)[
        Zaświadczenie wydano: \
        Wieliczka, #tr.data_wystawienia r.
      ],
      grid(
        columns: (1fr, 1fr, 1fr),
        align: (left, center, right),
        move(dx: krakow-dx, dy: krakow-dy, image("logo_krakow.jpg", width: 5cm)),
        move(dx: signature-dx, dy: signature-dy, image("signature_mama.png", width: 4cm)),
        move(dx: kot-dx, dy: kot-dy, image("kot-logo-1.png", width: 3cm)),
      )
    )
  ]

  // Avoid a blank page after the last participant
  if i < participants.len() - 1 {
    pagebreak()
  }
}
