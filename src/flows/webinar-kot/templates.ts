import { buildCertificateFilename } from "../../pipeline/filenames";
import type { TemplateDef } from "../../pipeline/types";
import type { WebinarParticipant } from "./participants";

export const zaswiadczenieKot: TemplateDef = {
  id: "zaswiadczenie_kot",
  label: "Zaświadczenia (KOT)",
  inputs: ["uczestnicy"],
  meta: ["nazwa_szkolenia", "data_szkolenia", "czas_trwania", "data_wystawienia"],
  typFile: "/zaswiadczenie_kot.typ",
  prepare(ctx) {
    const rows = ctx.datasets.uczestnicy as WebinarParticipant[] | undefined;
    if (!Array.isArray(rows)) {
      throw new Error("Brak danych uczestników — wczytaj plik CSV.");
    }

    const training = JSON.stringify(ctx.meta);
    return {
      kind: "batch",
      concatFilename: "zaswiadczenia_kot.pdf",
      items: rows.map((participant, index) => ({
        filename: buildCertificateFilename(index + 1, rows.length, participant),
        inputs: {
          training,
          participant: JSON.stringify(participant),
        },
      })),
    };
  },
};
