# MamaPdf

Narzędzie do generowania dokumentów szkoleniowych — zaświadczeń, dzienników
(list obecności), ankiet ewaluacyjnych i referencji — bezpośrednio w przeglądarce.

Strona jest w pełni statyczna: nie ma backendu, nie ma wysyłania plików na
serwer. Wczytany arkusz, dane uczestników i wygenerowane PDF-y zostają na
komputerze użytkownika (pamięć przeglądarki / IndexedDB i pliki do pobrania).

**Adres:** https://johneggz.github.io/MamaPdf/

## Jak to działa

```
Arkusz (.csv / .xlsx / .ods)
  → parser przepływu (load)
  → edytor danych w środkowym panelu
  → Template.prepare()  → plan renderowania
  → Typst (WebAssembly) → PDF-y + scalony PDF
  → drzewo wyników + ZIP
```

Cała kompilacja Typsta działa w WebAssembly; przy pierwszym uruchomieniu
przeglądarka pobiera ok. 10 MB skompresowanego silnika, dlatego start może
chwilę potrwać.

## Przepływy

| Przepływ | Dane wejściowe | Dokumenty |
|---|---|---|
| Wydarzenie szkoleniowe | arkusz uczestników + ankieta ewaluacyjna | Zaświadczenia, Dziennik, Ewaluacja, Referencje |
| Webinar KOT | CSV z Zoom-a | Zaświadczenia (KOT) |

## Praca lokalna

Wymagany Node.js 22+.

```bash
npm ci
npm run dev            # http://localhost:5173
npm run build          # tsc --noEmit + vite build
npm run smoke          # kompiluje każdy szablon Typst w Node
npm run e2e            # build + test end-to-end w Chromium
npm run check:privacy  # blokada danych osobowych w repo i w dist/
npm run bench          # porównanie batch vs single
```

`npm run e2e` wymaga zainstalowanego Chromium (domyślnie `/usr/bin/chromium`,
ścieżkę można nadpisać przez `CHROME_PATH`).

## Wdrożenie

Hosting: GitHub Pages, gałąź `main`, źródło **GitHub Actions**
(`.github/workflows/deploy.yml`). Aplikacja działa pod podścieżką
`/MamaPdf/`, więc build jest wykonywany z `VITE_BASE=/MamaPdf/`.

Przed wdrożeniem warto sprawdzić wariant podścieżki lokalnie:

```bash
npm run e2e:base
```

## Prywatność

- W repozytorium **nie ma** żadnych arkuszy ani danych uczestników. Pliki
  testowe są generowane przez `test/fixtures.mjs` do `test/.tmp/` (poza gitem)
  w trakcie testów i usuwane po ich zakończeniu; w repo jest tylko kod.
- Arkusze **nigdy** nie mogą trafić do `public/` — wszystko z `public/` jest
  kopiowane do zbudowanej strony.
- `npm run check:privacy` (uruchamiany w CI i przed wdrożeniem) blokuje m.in.
  adresy e-mail inne niż `@example.*`, numery PESEL, numery telefonów oraz
  nazwiska z pierwotnego eksportu Zoom-a.
- Strona jest oznaczona `noindex, nofollow`; nie jest zgłaszana do wyszukiwarek.
- Pliki `public/assets/signature_mama.png` i `stamp.png` są publiczne — to
  elementy dokumentów, więc każdy, kto zna adres strony, może je pobrać.
  Dlatego miejsce wdrożenia nie jest nigdzie linkowane publicznie.

## Struktura

```
src/
  App.tsx                 powłoka: drzewo projektów, edytor, szablony/wyniki
  flows/                  konkretne przepływy (wydarzenie, webinar-kot)
  pipeline/               render Typst, nazwy plików, typy planu
  shell/                  IndexedDB, drzewo wyników, ZIP
public/assets/            szablony .typ, fonty, obrazy (kopiowane na stronę)
test/fixtures.mjs         generator wymyślonych danych testowych do test/.tmp/
scripts/check-privacy.mjs kontrola danych osobowych
```

Zasady rozwoju i kontrakty opisuje `AGENTS.md`.
