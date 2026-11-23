/**
 * Synthetic test input, generated on demand.
 *
 * No spreadsheet is stored in this repository. Every file the tests need is
 * built here from invented names, written to `test/.tmp/` (gitignored) and
 * deleted when the run ends, so the repository never holds participant-shaped
 * data of any kind.
 *
 * Keep the row counts the e2e suite asserts: 3 participants, 32 survey
 * responses, 34 webinar rows. All addresses stay on `@example.*`.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export const TMP_DIR = path.join(import.meta.dirname, ".tmp");

const SURVEY_HEADERS = [
  "Sygnatura czasowa",
  "Tematyka szkolenia dostosowana została do zgłoszonych potrzeb (1 - najniższa ocena, 5 najwyższa ocena):",
  "Czas trwania zajęć dostosowany był do potrzeb uczestników (1 - najniższa ocena, 5 najwyższa ocena):",
  "Na ile ocenia Pan/Pani przygotowanie merytoryczne trenera / edukatora (1 - najniższa ocena, 5 najwyższa ocena):",
  "Na ile trener zrealizował cele szkolenia (1 - najniższa ocena, 5 najwyższa ocena): ",
  "Jak ocenia Pan / Pani sposób prowadzenia zajęć przez trenera / edukatora (1 - najniższa ocena, 5 najwyższa ocena): ",
  "Na ile trener / edukator odpowiadał na potrzeby zgłaszane przez uczestników   (1 - najniższa ocena, 5 najwyższa ocena): ",
  "Dodatkowe uwagi dla trenera/ edukatora lub placówki",
  "Czy polecił/a by Pan/Pani kurs innym?",
  "Jakie inne szkolenia byłyby interesujące dla Pana/ Pani w przyszłości - można zaznaczyć kilka odpowiedzi:",
  "Miejsce pracy",
];

const SURVEY_COMMENTS = [
  "Wszystko w porządku, dziękuję.",
  "Przydałoby się więcej przykładów z życia.",
  "Bardzo dobrze poprowadzone zajęcia.",
  "Za mało czasu na pytania.",
  "Materiały są czytelne i pomocne.",
  "Chętnie wezmę udział w kolejnej edycji.",
  "Tempo było w porządku.",
  "Dziękuję za wskazówki do pracy z klasą.",
];

const WEBINAR_HEADER =
  "Login;E-mail;Starts at;Ends at;Rating;Rating comment;Role;Device;Adres email;Imię;Nazwisko";

const WEBINAR_SPECIALS = [
  { login: "ŻANETA  ĆWICZENIOWSKA", device: "web", rating: "", comment: "" },
  { login: "Łukasz Próbny-Rzeka", device: "web", rating: "5", comment: "" },
  { login: "marek.probny_1", device: "web", rating: "", comment: "" },
  { login: "Anna  Wzorcowa", device: "mobile", rating: "", comment: "" },
  { login: "Piotr Demonstracyjny", device: "web", rating: "5", comment: "Bardzo dobre szkolenie" },
  { login: "Ewa  Przykładowa", device: "web", rating: "", comment: "" },
];

/** 32 survey rows whose aggregates the e2e suite asserts. */
function surveyRows() {
  return Array.from({ length: 32 }, (_, index) => {
    const timestamp = `3/3/2026 17:${String(index).padStart(2, "0")}:00`;
    const ratings = [
      index < 13 ? 5 : 4, // 141 / 32 -> 4.4
      index < 19 ? 5 : 4, // 147 / 32 -> 4.6
      index < 22 ? 5 : 4, // 150 / 32 -> 4.7
      index < 19 ? 5 : 4, // 147 / 32 -> 4.6
      index < 22 ? 5 : 4, // 150 / 32 -> 4.7
      index < 19 ? 5 : 4, // 147 / 32 -> 4.6
    ];
    const comment = index < SURVEY_COMMENTS.length ? SURVEY_COMMENTS[index] : "";
    const recommendation = index < 23 ? "Tak" : index < 30 ? "Nie wiem" : "Nie";
    const interests =
      index < 13
        ? "Prawo oświatowe"
        : index < 20
          ? "TIK w pracy nauczyciela"
          : "";
    const workplace = index % 2 === 0 ? "Szkoła Podstawowa nr 1" : "Przedszkole nr 2";

    return [timestamp, ...ratings, comment, recommendation, interests, workplace];
  });
}

function participantsRows() {
  return [
    ["Sygnatura czasowa", "Imię i nazwisko", "Data urodzenia", "Miejsce urodzenia", "Placówka", "Adres email"],
    ["3/3/2026 17:36:56", "Jan Przykładowy", "07.04.1981", "Radom", "Szkoła Podstawowa nr 1", "jan.przykladowy@example.com"],
    ["3/3/2026 17:37:03", "Anna Testowa", "14.06.1998", "Kraków", "Przedszkole nr 2", "Potwierdzam oświadczenie"],
    ["3/3/2026 17:37:04", "Piotr Wzorcowy", "20.11.1964", "Wieliczka", "Szkoła Podstawowa nr 3", "piotr.wzorcowy@example.org"],
  ];
}

function webinarRows() {
  const rows = [
    "Centrum Edukacji Przykładowej;host@example.com;10.11.2026 10:00;10.11.2026 10:01;;;host;web;;;",
    "Anna Prowadząca;prowadzaca@example.com;10.11.2026 09:25;10.11.2026 11:47;;;presenter;web;;;",
  ];

  for (let index = 0; index < 32; index += 1) {
    const special = WEBINAR_SPECIALS[index];
    const login = special?.login ?? `Uczestnik ${String(index + 1).padStart(2, "0")}`;
    const isPerson = !login.startsWith("Uczestnik");
    const [first = "", ...rest] = isPerson ? login.replace(/\s+/g, " ").trim().split(" ") : [];
    const last = rest.join(" ");
    const email = `uczestnik${String(index + 1).padStart(2, "0")}@example.com`;
    const start = `10.11.2026 10:${String(index % 60).padStart(2, "0")}`;
    const end = "10.11.2026 11:47";
    const rating = special?.rating ?? "";
    const comment = special?.comment ?? "";
    const device = special?.device ?? "web";
    const adresEmail = isPerson ? email : "";
    const imie = isPerson ? first : "";
    const nazwisko = isPerson ? last : "";

    rows.push(
      [login, email, start, end, rating, comment, "listener", device, adresEmail, imie, nazwisko].join(";"),
    );
  }

  return [WEBINAR_HEADER, ...rows].join("\n");
}

function writeSheet(file, rows, bookType) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Formularz");
  writeFileSync(file, XLSX.write(book, { type: "buffer", bookType }));
}

/**
 * Writes the generated inputs and returns their paths:
 * `{ participants, survey, webinar }`.
 */
export function writeFixtures(dir = TMP_DIR) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const participants = path.join(dir, "uczestnicy.ods");
  const survey = path.join(dir, "ankieta.xlsx");
  const webinar = path.join(dir, "webinar-kot.csv");

  writeSheet(participants, participantsRows(), "ods");
  writeSheet(survey, [SURVEY_HEADERS, ...surveyRows()], "xlsx");
  writeFileSync(webinar, webinarRows() + "\n", "utf8");

  return { participants, survey, webinar };
}

export function cleanFixtures(dir = TMP_DIR) {
  rmSync(dir, { recursive: true, force: true });
}

/** Payloads for `smoke.mjs` — the same shapes the app passes to Typst. */
export const SMOKE_TRAINING = {
  nazwa_szkolenia: "Szkolenie Przykładowe",
  numer_szkolenia: "NR/202X",
  data_szkolenia: "29.08.2026",
  miejsce_szkolenia: "Szkoła Podstawowa nr 1",
  prowadzacy: "Anna Prowadząca",
  czas_trwania: "8 godz",
  czas_trwania_od_do: "09:00 - 16:00",
  data_wystawienia: "29.08.2026",
  tematyka: "1. Wprowadzenie",
};

export const SMOKE_PARTICIPANTS = [
  {
    imie_nazwisko: "Jan Przykładowy",
    data_urodzenia: "30.09.1974",
    miejsce_urodzenia: "Radom",
    placowka: "Szkoła Podstawowa nr 1",
    email: "jan.przykladowy@example.com",
  },
  {
    imie_nazwisko: "Anna Testowa",
    data_urodzenia: "14.06.1998",
    miejsce_urodzenia: "Kraków",
    placowka: "Przedszkole nr 2",
    email: "",
  },
  {
    imie_nazwisko: "Piotr Wzorcowy",
    data_urodzenia: "20.11.1964",
    miejsce_urodzenia: "Wieliczka",
    placowka: "Szkoła Podstawowa nr 3",
    email: "piotr.wzorcowy@example.org",
  },
];

export const SMOKE_SURVEY = {
  responseCount: 32,
  ratings: [
    { key: "tematyka", header: "Tematyka", label: "Tematyka dostosowana do potrzeb", average: 4.4, responses: 32 },
    { key: "czas_trwania", header: "Czas trwania", label: "Czas trwania dostosowany do potrzeb", average: 4.6, responses: 32 },
    { key: "przygotowanie", header: "Przygotowanie", label: "Przygotowanie merytoryczne trenera", average: 4.7, responses: 32 },
    { key: "cele", header: "Cele", label: "Realizacja celów szkolenia", average: 4.6, responses: 32 },
    { key: "prowadzenie", header: "Prowadzenie", label: "Sposób prowadzenia zajęć", average: 4.7, responses: 32 },
    { key: "potrzeby", header: "Potrzeby", label: "Odpowiadanie na potrzeby uczestników", average: 4.6, responses: 32 },
  ],
  recommendation: [
    { key: "tak", label: "Tak", count: 23 },
    { key: "nie_wiem", label: "Nie wiem", count: 7 },
    { key: "nie", label: "Nie", count: 2 },
  ],
  interests: [
    { key: "prawo", label: "Prawo oświatowe", count: 13 },
    { key: "tik", label: "TIK w pracy nauczyciela", count: 7 },
    { key: "inne", label: "Inne / nieprzypisane", count: 0 },
  ],
  comments: ["Wszystko w porządku, dziękuję."],
  extraColumns: [],
};
