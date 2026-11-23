import * as XLSX from "xlsx";

export interface WebinarParticipant {
  imie_nazwisko: string;
  login: string;
  email: string;
}

// Header aliases, normalized to lowercase + trimmed.
const FIRST = ["imię", "imie"];
const LAST = ["nazwisko"];
const LOGIN = ["login"];
const EMAIL = ["e-mail", "email", "adres email"];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase();
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

/** UTF-8 first; fall back to Windows-1250 for legacy spreadsheet exports. */
function decode(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1250").decode(buffer);
  } catch {
    return utf8;
  }
}

function sortKey(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return [parts[1], [parts[0], ...parts.slice(2)].join(" ")];
  }
  return [name, ""];
}

/**
 * Reads a Zoom participants CSV: Imię, Nazwisko, Login, E-mail.
 * Name = "Imię Nazwisko", falling back to Login, then E-mail.
 */
export async function loadWebinarParticipants(file: File): Promise<WebinarParticipant[]> {
  const wb = XLSX.read(decode(await file.arrayBuffer()), { type: "string" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Plik nie zawiera arkusza.");

  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  if (grid.length === 0) return [];

  const header = (grid[0] as unknown[]).map(normalizeHeader);
  const find = (keys: string[]) => header.findIndex((value) => keys.includes(value));

  const colFirst = find(FIRST);
  const colLast = find(LAST);
  const colLogin = find(LOGIN);
  const colEmail = find(EMAIL);

  if ([colFirst, colLast, colLogin, colEmail].every((index) => index === -1)) {
    throw new Error(
      "Nie rozpoznano kolumn. Oczekiwane: Imię, Nazwisko, Login, E-mail.",
    );
  }

  const participants: WebinarParticipant[] = [];
  for (const row of grid.slice(1)) {
    const first = cell(row, colFirst);
    const last = cell(row, colLast);
    const login = cell(row, colLogin);
    const email = cell(row, colEmail);
    const name = `${first} ${last}`.trim() || login || email;
    if (!name) continue;
    participants.push({ imie_nazwisko: name, login, email });
  }

  participants.sort((a, b) => {
    const [aSurname, aRest] = sortKey(a.imie_nazwisko);
    const [bSurname, bRest] = sortKey(b.imie_nazwisko);
    return aSurname.localeCompare(bSurname, "pl") || aRest.localeCompare(bRest, "pl");
  });

  return participants;
}
