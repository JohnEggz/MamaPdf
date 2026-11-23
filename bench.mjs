import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/contrib/snippet";

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
  "orphans.typ",
  "logo.png",
  "stamp.png",
  "logo_krakow.jpg",
  "signature_mama.png",
  "kot-logo-1.png",
]) {
  await $typst.mapShadow("/" + f, fs.readFileSync(asset(f)));
}

const doc = JSON.parse(fs.readFileSync(path.join(dir, "test/fixtures/data_gen.json"), "utf8"));
const one = doc.participants[0];
const N = 100;
const training = JSON.stringify(doc.training);

// A) batch: one compile per participant (the certificate path).
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const pdf = await $typst.pdf({
    mainFilePath: "/zaswiadczenie.typ",
    root: "/",
    inputs: {
      training,
      participant: JSON.stringify({ ...one, imie_nazwisko: `Osoba ${i}` }),
      number: String(i + 1),
    },
  });
  if (!pdf) throw new Error("no pdf");
}
const batchMs = performance.now() - t0;
console.log(
  `batch: ${N} individual compiles = ${batchMs.toFixed(0)} ms (${(batchMs / N).toFixed(1)} ms each)`,
);

// B) single: one compile, N participants inside the attendance-list tables.
const participants = Array.from({ length: N }, (_, i) => ({ ...one, imie_nazwisko: `Osoba ${i}` }));
const t1 = performance.now();
const list = await $typst.pdf({
  mainFilePath: "/dziennik.typ",
  root: "/",
  inputs: { training, participants: JSON.stringify(participants) },
});
const singleMs = performance.now() - t1;
if (!list) throw new Error("no pdf");
console.log(
  `single: 1 compile with ${N} rows = ${singleMs.toFixed(0)} ms, ${(list.byteLength / 1024).toFixed(0)} KB`,
);
