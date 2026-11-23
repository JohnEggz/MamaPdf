import { buildCertificateFilename } from "../../pipeline/filenames";
import type { RenderContext, TemplateDef } from "../../pipeline/types";
import type { Participant } from "../../types";
import type { SurveyData } from "./survey";
import { overallSurveyAverage } from "./survey";

function participantsOf(ctx: RenderContext): Participant[] {
  const value = ctx.datasets.uczestnicy;
  if (!Array.isArray(value)) {
    throw new Error("Brak danych uczestników — wczytaj arkusz.");
  }
  return value as Participant[];
}

function surveyOf(ctx: RenderContext): SurveyData {
  const value = ctx.datasets.ankieta;
  if (!value || typeof value !== "object" || !Array.isArray((value as SurveyData).ratings)) {
    throw new Error("Brak przetworzonej ankiety — wczytaj arkusz.");
  }
  return value as SurveyData;
}

function formatAverage(value: number | null): string {
  return value === null ? "–" : value.toFixed(1).replace(".", ",");
}

/** One PDF per participant. Repetition lives here, not in the .typ. */
export const zaswiadczenia: TemplateDef = {
  id: "zaswiadczenia",
  label: "Zaświadczenia",
  inputs: ["uczestnicy"],
  meta: ["nazwa_szkolenia", "numer_szkolenia", "data_szkolenia", "czas_trwania", "data_wystawienia", "tematyka"],
  typFile: "/zaswiadczenie.typ",
  prepare(ctx) {
    const rows = participantsOf(ctx);
    const training = JSON.stringify(ctx.meta);

    return {
      kind: "batch",
      concatFilename: "zaswiadczenia.pdf",
      items: rows.map((participant, index) => ({
        filename: buildCertificateFilename(index + 1, rows.length, participant),
        inputs: {
          training,
          participant: JSON.stringify(participant),
          number: String(index + 1),
        },
      })),
    };
  },
};

/** One PDF; the template loops over participants inside its tables. */
export const dziennik: TemplateDef = {
  id: "lista_obecnosci",
  label: "Dziennik",
  inputs: ["uczestnicy"],
  meta: [
    "nazwa_szkolenia",
    "numer_szkolenia",
    "data_szkolenia",
    "miejsce_szkolenia",
    "prowadzacy",
    "czas_trwania",
    "czas_trwania_od_do",
    "tematyka",
    "data_wystawienia",
  ],
  typFile: "/dziennik.typ",
  prepare(ctx) {
    const rows = participantsOf(ctx);
    return {
      kind: "single",
      filename: "dziennik.pdf",
      inputs: {
        training: JSON.stringify(ctx.meta),
        participants: JSON.stringify(rows),
      },
    };
  },
};

/** One PDF: processed survey summary rendered as the evaluation report. */
export const ewaluacja: TemplateDef = {
  id: "ankieta_ewaluacyjna",
  label: "Ewaluacja",
  inputs: ["ankieta"],
  meta: [
    "nazwa_szkolenia",
    "numer_szkolenia",
    "data_szkolenia",
    "miejsce_szkolenia",
    "prowadzacy",
  ],
  typFile: "/ankieta_ewaluacyjna.typ",
  prepare(ctx) {
    return {
      kind: "single",
      filename: "ewaluacja.pdf",
      inputs: {
        training: JSON.stringify(ctx.meta),
        survey: JSON.stringify(surveyOf(ctx)),
      },
    };
  },
};

/** One-page reference letter; the average comes from the evaluation ratings. */
export const referencje: TemplateDef = {
  id: "referencje",
  label: "Referencje",
  inputs: ["ankieta"],
  meta: ["nazwa_szkolenia", "miejsce_szkolenia", "prowadzacy", "data_szkolenia", "czas_trwania"],
  typFile: "/referencje.typ",
  prepare(ctx) {
    return {
      kind: "single",
      filename: "referencje.pdf",
      inputs: {
        training: JSON.stringify(ctx.meta),
        average: formatAverage(overallSurveyAverage(surveyOf(ctx))),
      },
    };
  },
};
