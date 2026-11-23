import * as XLSX from "xlsx";
import { summarizeSurvey, type SurveyData } from "../survey";

/** Reads the first sheet and returns processed survey data — never raw rows. */
export async function loadSurvey(file: File): Promise<SurveyData> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Arkusz nie zawiera żadnych stron.");

  const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  return summarizeSurvey(grid);
}
