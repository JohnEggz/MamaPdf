export interface SurveyRating {
  key: string;
  /** Original question header from the spreadsheet. */
  header: string;
  /** Short label used by the editor and, later, templates. */
  label: string;
  average: number | null;
  /** Number of valid numeric answers. */
  responses: number;
}

export interface SurveyCount {
  key: string;
  label: string;
  count: number;
}

export interface SurveyExtraColumn {
  header: string;
  values: { value: string; count: number }[];
}

/**
 * Processed survey data. This is what gets persisted in the project — never the
 * raw sheet rows. Aggregation rules are ported from the legacy Python parser
 * (`spreadsheet_parser.py`).
 */
export interface SurveyData {
  responseCount: number;
  ratings: SurveyRating[];
  recommendation: SurveyCount[];
  interests: SurveyCount[];
  comments: string[];
  extraColumns: SurveyExtraColumn[];
}

const TIMESTAMP_HEADER = "Sygnatura czasowa";

const RATINGS = [
  {
    key: "tematyka",
    label: "Tematyka dostosowana do potrzeb",
    header:
      "Tematyka szkolenia dostosowana została do zgłoszonych potrzeb (1 - najniższa ocena, 5 najwyższa ocena):",
  },
  {
    key: "czas_trwania",
    label: "Czas trwania dostosowany do potrzeb",
    header:
      "Czas trwania zajęć dostosowany był do potrzeb uczestników (1 - najniższa ocena, 5 najwyższa ocena):",
  },
  {
    key: "przygotowanie",
    label: "Przygotowanie merytoryczne trenera",
    header:
      "Na ile ocenia Pan/Pani przygotowanie merytoryczne trenera / edukatora (1 - najniższa ocena, 5 najwyższa ocena):",
  },
  {
    key: "cele",
    label: "Realizacja celów szkolenia",
    header:
      "Na ile trener zrealizował cele szkolenia (1 - najniższa ocena, 5 najwyższa ocena): ",
  },
  {
    key: "prowadzenie",
    label: "Sposób prowadzenia zajęć",
    header:
      "Jak ocenia Pan / Pani sposób prowadzenia zajęć przez trenera / edukatora (1 - najniższa ocena, 5 najwyższa ocena): ",
  },
  {
    key: "potrzeby",
    label: "Odpowiadanie na potrzeby uczestników",
    header:
      "Na ile trener / edukator odpowiadał na potrzeby zgłaszane przez uczestników   (1 - najniższa ocena, 5 najwyższa ocena): ",
  },
] as const;

const COMMENTS_HEADER = "Dodatkowe uwagi dla trenera/ edukatora lub placówki";
const RECOMMENDATION_HEADER = "Czy polecił/a by Pan/Pani kurs innym?";
const INTERESTS_HEADER =
  "Jakie inne szkolenia byłyby interesujące dla Pana/ Pani w przyszłości - można zaznaczyć kilka odpowiedzi:";

const RECOMMENDATION_OPTIONS = [
  { key: "tak", label: "Tak", value: "Tak" },
  { key: "nie_wiem", label: "Nie wiem", value: "Nie wiem" },
  { key: "nie", label: "Nie", value: "Nie" },
] as const;

const INTEREST_TOPICS = [
  {
    key: "spe_autyzm",
    label:
      "Wsparcie dziecka o SPE: spektrum autyzmu, afazja, niepełnosprawność intelektualna",
  },
  {
    key: "spe_dysleksja",
    label: "Wsparcie dziecka o SPE: dysleksja, dysgrafia, dysortografia, dyskalkulia",
  },
  {
    key: "spe_emocje",
    label:
      "Wsparcie dziecka z problemami emocjonalnymi: depresja, zaburzenia lękowe, doświadczenia postraumatyczne, uzależnienia od urządzeń ekranowych",
  },
  {
    key: "spe_zachowanie",
    label:
      "Wsparcie dziecka z trudnościami w zachowaniu: bunt, agresja, przemoc rówieśnicza",
  },
  {
    key: "zagrozenia",
    label:
      "Zagrożenia dla rozwoju współczesnego dziecka/ nastolatka: używki, uzależnienia behawioralne",
  },
  { key: "pamiec", label: "Wspomaganie pamięci i koncentracji uczniów" },
  { key: "tik", label: "TIK w pracy nauczyciela" },
  { key: "bezpieczenstwo", label: "Bezpieczeństwo w sieci uczniów i nauczycieli" },
  { key: "prawo", label: "Prawo oświatowe" },
  {
    key: "stres",
    label:
      "Stres w pracy, wzmacnianie odporności psychicznej i dobrostanu nauczycieli",
  },
  {
    key: "kultura",
    label:
      "Praca z klasą zróżnicowaną kulturowo (uczeń z zagranicy z zespole klasowym)",
  },
  { key: "zroznicowanie", label: "Praca z klasą zróżnicowaną edukacyjnie" },
  {
    key: "trudna",
    label:
      'Praca z klasą "trudną" (konflikty, kłopoty z dyscypliną, brak aktywności, słaba motywacja)',
  },
  { key: "wychowawcze", label: "Ciekawe lekcje wychowawcze" },
  {
    key: "rodzice",
    label: 'Współpraca z rodzicami (w tym z "wymagającym" rodzicem)',
  },
] as const;

const INNE_KEY = "inne";
const INNE_LABEL = "Inne / nieprzypisane";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace("\ufeff", "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hasValue(value: unknown): boolean {
  return cellText(value) !== "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function valuesInColumn(rows: readonly (readonly unknown[])[], column: number): unknown[] {
  return rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

function roundAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(mean * 10) / 10;
}

/**
 * Overall evaluation score: weighted mean of the rating averages by their
 * response counts, falling back to a simple mean when counts are unavailable.
 */
export function overallSurveyAverage(survey: SurveyData): number | null {
  let weighted = 0;
  let weight = 0;

  for (const rating of survey.ratings) {
    if (rating.average === null || rating.responses <= 0) continue;
    weighted += rating.average * rating.responses;
    weight += rating.responses;
  }

  if (weight > 0) return Math.round((weighted / weight) * 10) / 10;

  const values = survey.ratings
    .map((rating) => rating.average)
    .filter((value): value is number => value !== null);
  return roundAverage(values);
}

/**
 * Ports `analyze_survey_grid` from the legacy Python app:
 * first sheet, header row first, then per-column aggregation.
 */
export function summarizeSurvey(grid: readonly (readonly unknown[])[]): SurveyData {
  if (grid.length === 0) {
    throw new Error("Arkusz nie zawiera żadnych danych.");
  }

  const headerRow = grid[0] ?? [];
  const columns = new Map<string, number>();

  for (let index = 0; index < headerRow.length; index += 1) {
    const key = normalizeHeader(headerRow[index]);
    if (key && !columns.has(key)) columns.set(key, index);
  }

  const requiredHeaders = [
    ...RATINGS.map((rating) => rating.header),
    COMMENTS_HEADER,
    RECOMMENDATION_HEADER,
    INTERESTS_HEADER,
  ];
  const missing = requiredHeaders.find((header) => !columns.has(normalizeHeader(header)));
  if (missing) {
    throw new Error(`Nieprawidłowy format pliku. Brakująca kolumna: '${missing.trim()}'`);
  }

  const timestampKey = normalizeHeader(TIMESTAMP_HEADER);
  const answerColumns = [...columns.entries()]
    .filter(([key]) => key !== timestampKey)
    .map(([, column]) => column);
  const rows = grid
    .slice(1)
    .filter((row) => answerColumns.some((column) => hasValue(row[column])));

  const ratings: SurveyRating[] = RATINGS.map((rating) => {
    const column = columns.get(normalizeHeader(rating.header));
    const numericValues =
      column === undefined
        ? []
        : valuesInColumn(rows, column)
            .map(toNumber)
            .filter((value): value is number => value !== null);

    return {
      key: rating.key,
      header: rating.header.trim(),
      label: rating.label,
      average: roundAverage(numericValues),
      responses: numericValues.length,
    };
  });

  const commentsColumn = columns.get(normalizeHeader(COMMENTS_HEADER));
  const comments =
    commentsColumn === undefined
      ? []
      : valuesInColumn(rows, commentsColumn)
          .map((value) => String(value).replace(/\r\n?/g, "\n").trim())
          .filter((value) => value !== "");

  const recommendationColumn = columns.get(normalizeHeader(RECOMMENDATION_HEADER));
  const recommendationCounts = new Map<string, number>(
    RECOMMENDATION_OPTIONS.map((option) => [option.value, 0]),
  );
  if (recommendationColumn !== undefined) {
    for (const value of valuesInColumn(rows, recommendationColumn)) {
      const text = String(value).trim();
      if (recommendationCounts.has(text)) {
        recommendationCounts.set(text, (recommendationCounts.get(text) ?? 0) + 1);
      }
    }
  }
  const recommendation: SurveyCount[] = RECOMMENDATION_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    count: recommendationCounts.get(option.value) ?? 0,
  }));

  const interestsColumn = columns.get(normalizeHeader(INTERESTS_HEADER));
  const interestCounts = new Map<string, number>(
    INTEREST_TOPICS.map((topic) => [topic.key, 0]),
  );
  let inneCount = 0;
  if (interestsColumn !== undefined) {
    for (const value of valuesInColumn(rows, interestsColumn)) {
      const text = String(value);
      let matched = false;
      for (const topic of INTEREST_TOPICS) {
        if (text.includes(topic.label)) {
          interestCounts.set(topic.key, (interestCounts.get(topic.key) ?? 0) + 1);
          matched = true;
        }
      }
      if (!matched) inneCount += 1;
    }
  }
  const interests: SurveyCount[] = [
    ...INTEREST_TOPICS.map((topic) => ({
      key: topic.key,
      label: topic.label,
      count: interestCounts.get(topic.key) ?? 0,
    })),
    { key: INNE_KEY, label: INNE_LABEL, count: inneCount },
  ];

  const specialKeys = new Set([
    timestampKey,
    ...RATINGS.map((rating) => normalizeHeader(rating.header)),
    normalizeHeader(COMMENTS_HEADER),
    normalizeHeader(RECOMMENDATION_HEADER),
    normalizeHeader(INTERESTS_HEADER),
  ]);

  const extraColumns: SurveyExtraColumn[] = [];
  for (const [key, column] of columns) {
    if (specialKeys.has(key)) continue;

    const counts = new Map<string, number>();
    for (const value of valuesInColumn(rows, column)) {
      const text = cellText(value);
      if (!text) continue;
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }

    extraColumns.push({
      header: cellText(headerRow[column]) || key,
      values: [...counts.entries()].map(([value, count]) => ({ value, count })),
    });
  }

  return {
    responseCount: rows.length,
    ratings,
    recommendation,
    interests,
    comments,
    extraColumns,
  };
}
