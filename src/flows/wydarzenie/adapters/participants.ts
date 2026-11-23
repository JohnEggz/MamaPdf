import * as XLSX from "xlsx";
import type { Participant } from "../../../types";

function cell(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

/**
 * Spike adapter for a Google-Forms signup sheet:
 * timestamp, name, birth date, birth place, workplace, email, ...
 * Real flows will declare their own column mapping.
 */
function parseParticipants(data: ArrayBuffer): Participant[] {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Arkusz nie zawiera żadnych stron.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
  });

  const asEmail = (value: string) => (value.includes("@") ? value : "");

  return rows
    .slice(1)
    .map((row) => ({
      imie_nazwisko: cell(row, 1),
      data_urodzenia: cell(row, 2),
      miejsce_urodzenia: cell(row, 3),
      placowka: cell(row, 4),
      email: asEmail(cell(row, 5)),
    }))
    .filter((participant) => participant.imie_nazwisko);
}

export async function loadParticipants(file: File): Promise<Participant[]> {
  return parseParticipants(await file.arrayBuffer());
}
