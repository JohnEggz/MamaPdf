import type { Participant } from "../../types";
import type { Flow } from "../types";
import { AnkietaEditor } from "./AnkietaEditor";
import { UczestnicyEditor } from "./UczestnicyEditor";
import { loadParticipants } from "./adapters/participants";
import { loadSurvey } from "./adapters/survey";
import type { SurveyData } from "./survey";
import { dziennik, ewaluacja, referencje, zaswiadczenia } from "./templates";

export const wydarzenie: Flow = {
  id: "wydarzenie",
  name: "Wydarzenie szkoleniowe",
  description: "Uczestnicy + ewaluacja → zaświadczenia, dziennik i kolejne dokumenty.",
  metaFields: [
    { key: "nazwa_szkolenia", label: "Nazwa szkolenia", type: "text" },
    { key: "numer_szkolenia", label: "Numer szkolenia", type: "text" },
    {
      key: "data_szkolenia",
      label: "Data szkolenia",
      type: "date",
      placeholder: "dd.mm.rrrr",
    },
    { key: "miejsce_szkolenia", label: "Miejsce szkolenia", type: "text" },
    { key: "prowadzacy", label: "Prowadzący", type: "text" },
    { key: "czas_trwania", label: "Czas trwania", type: "text" },
    { key: "czas_trwania_od_do", label: "Czas od–do", type: "text" },
    {
      key: "data_wystawienia",
      label: "Data wystawienia",
      type: "date",
      placeholder: "dd.mm.rrrr",
    },
    { key: "tematyka", label: "Tematyka", type: "textarea" },
  ],
  datasets: [
    {
      id: "uczestnicy",
      label: "Uczestnicy",
      accept: ".ods,.xlsx,.xls,.csv",
      load: loadParticipants,
      Editor: UczestnicyEditor,
      summarize: (value: Participant[]) => `${value.length} os.`,
    },
    {
      id: "ankieta",
      label: "Ewaluacja",
      accept: ".ods,.xlsx,.xls",
      load: loadSurvey,
      Editor: AnkietaEditor,
      summarize: (value: SurveyData) => {
        const count = value.responseCount;
        return typeof count === "number" ? `${count} odp.` : "wczytaj ponownie";
      },
    },
  ],
  templates: [zaswiadczenia, dziennik, ewaluacja, referencje],
};
