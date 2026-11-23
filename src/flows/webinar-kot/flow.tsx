import type { Flow } from "../types";
import { WebinarUczestnicyEditor } from "./WebinarUczestnicyEditor";
import { loadWebinarParticipants, type WebinarParticipant } from "./participants";
import { zaswiadczenieKot } from "./templates";

export const webinarKot: Flow = {
  id: "webinar-kot",
  name: "Webinar KOT",
  description: "CSV z Zoom (Imię, Nazwisko, Login, E-mail) → zaświadczenia KOT.",
  metaFields: [
    { key: "nazwa_szkolenia", label: "Nazwa szkolenia", type: "text" },
    {
      key: "data_szkolenia",
      label: "Data szkolenia",
      type: "date",
      placeholder: "dd.mm.rrrr",
    },
    { key: "czas_trwania", label: "Czas trwania", type: "text" },
    {
      key: "data_wystawienia",
      label: "Data wystawienia",
      type: "date",
      placeholder: "dd.mm.rrrr",
    },
  ],
  datasets: [
    {
      id: "uczestnicy",
      label: "Uczestnicy",
      accept: ".csv",
      load: loadWebinarParticipants,
      Editor: WebinarUczestnicyEditor,
      summarize: (value: WebinarParticipant[]) => `${value.length} os.`,
    },
  ],
  templates: [zaswiadczenieKot],
};
