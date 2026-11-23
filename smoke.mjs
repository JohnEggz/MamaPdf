import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/contrib/snippet";
import { SMOKE_PARTICIPANTS, SMOKE_SURVEY, SMOKE_TRAINING } from "./test/fixtures.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const asset = (f) => path.join(dir, "public/assets", f);

$typst.setCompilerInitOptions({
  getModule: () =>
    fs.readFileSync(
      path.join(dir, "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm"),
    ),
});
$typst.use(TypstSnippet.disableDefaultFontAssets());
$typst.use(TypstSnippet.preloadFontData(fs.readFileSync(asset("DejaVuSans.ttf"))));
$typst.use(TypstSnippet.preloadFontData(fs.readFileSync(asset("DejaVuSans-Bold.ttf"))));

for (const f of [
  "zaswiadczenie.typ",
  "zaswiadczenie_kot.typ",
  "dziennik.typ",
  "ankieta_ewaluacyjna.typ",
  "referencje.typ",
  "orphans.typ",
  "logo.png",
  "stamp.png",
  "logo_krakow.jpg",
  "signature_mama.png",
  "kot-logo-1.png",
]) {
  await $typst.mapShadow("/" + f, fs.readFileSync(asset(f)));
}

const training = JSON.stringify(SMOKE_TRAINING);
const participant = JSON.stringify(SMOKE_PARTICIPANTS[0]);
const survey = JSON.stringify(SMOKE_SURVEY);
const evaluationTraining = JSON.stringify({
  ...SMOKE_TRAINING,
  nazwa_szkolenia: "Szkolenie Przykładowe z Ewaluacją",
  numer_szkolenia: "SZRP/25/8/UM",
});

// Active certificate template: front + program back, numbered per participant.
const cert = await $typst.pdf({
  mainFilePath: "/zaswiadczenie.typ",
  root: "/",
  inputs: { training, participant, number: "1" },
});
if (!cert) throw new Error("zaswiadczenie.typ returned no pdf");
fs.writeFileSync(path.join(dir, "smoke-cert.pdf"), cert);

// Alternate certificate template (kept around, not used by the flow).
const kot = await $typst.pdf({
  mainFilePath: "/zaswiadczenie_kot.typ",
  root: "/",
  inputs: { training, participant },
});
if (!kot) throw new Error("zaswiadczenie_kot.typ returned no pdf");
fs.writeFileSync(path.join(dir, "smoke-kot.pdf"), kot);

// Single-document attendance list: loops over participants internally.
const list = await $typst.pdf({
  mainFilePath: "/dziennik.typ",
  root: "/",
  inputs: {
    training,
    participants: JSON.stringify(SMOKE_PARTICIPANTS),
  },
});
if (!list) throw new Error("dziennik.typ returned no pdf");
fs.writeFileSync(path.join(dir, "smoke-list.pdf"), list);

// Single-document survey evaluation report.
const evaluation = await $typst.pdf({
  mainFilePath: "/ankieta_ewaluacyjna.typ",
  root: "/",
  inputs: { training: evaluationTraining, survey },
});
if (!evaluation) throw new Error("ankieta_ewaluacyjna.typ returned no pdf");
fs.writeFileSync(path.join(dir, "smoke-evaluation.pdf"), evaluation);

// One-page reference letter using the evaluation average.
const references = await $typst.pdf({
  mainFilePath: "/referencje.typ",
  root: "/",
  inputs: { training: evaluationTraining, average: "4,6" },
});
if (!references) throw new Error("referencje.typ returned no pdf");
fs.writeFileSync(path.join(dir, "smoke-referencje.pdf"), references);

console.log(
  "OK cert bytes:",
  cert.length,
  "kot bytes:",
  kot.length,
  "list bytes:",
  list.length,
  "evaluation bytes:",
  evaluation.length,
  "references bytes:",
  references.length,
);
