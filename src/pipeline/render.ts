import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/contrib/snippet";
import { PDFDocument } from "pdf-lib";
import compilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import type { RenderPlan, TypstInputs } from "./types";

/** Every file the templates may reference, shadowed at "/". */
const ASSETS = [
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
] as const;

/** Deploy base path, e.g. "/mamapdf/" on GitHub Pages project sites. */
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;

let initPromise: Promise<void> | null = null;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export function initRenderer(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      $typst.setCompilerInitOptions({ getModule: () => compilerWasmUrl });
      $typst.use(TypstSnippet.disableDefaultFontAssets());
      $typst.use(TypstSnippet.preloadFontFromUrl(ASSET_BASE + "DejaVuSans.ttf"));
      $typst.use(TypstSnippet.preloadFontFromUrl(ASSET_BASE + "DejaVuSans-Bold.ttf"));

      await Promise.all(
        ASSETS.map(async (name) => {
          await $typst.mapShadow("/" + name, await fetchBytes(ASSET_BASE + name));
        }),
      );
    })();
  }
  return initPromise;
}

async function renderOne(typFile: string, inputs: TypstInputs): Promise<Uint8Array> {
  const pdf = await $typst.pdf({ mainFilePath: typFile, root: "/", inputs });
  if (!pdf) throw new Error("Typst compiler returned no PDF");
  return new Uint8Array(pdf);
}

export interface Artifact {
  filename: string;
  bytes: Uint8Array;
  blob: Blob;
  url: string;
}

export interface RenderResult {
  artifacts: Artifact[];
  /** Merged PDF for batch plans (all items concatenated in order). */
  concatenated?: Artifact;
  ms: number;
  totalBytes: number;
}

function toArtifact(filename: string, bytes: Uint8Array): Artifact {
  // Copy into a fresh ArrayBuffer-backed view so Blob accepts it.
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  return { filename, bytes: copy, blob, url: URL.createObjectURL(blob) };
}

async function concatenatePdfs(artifacts: Artifact[], filename: string): Promise<Artifact> {
  const merged = await PDFDocument.create();

  for (const artifact of artifacts) {
    const source = await PDFDocument.load(artifact.bytes);
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }

  const bytes = await merged.save();
  return toArtifact(filename, new Uint8Array(bytes));
}

/**
 * Runs a RenderPlan: one compile per PDF. The template itself never loops over
 * people; repetition lives in the plan. Batch plans also get one merged PDF.
 */
export async function executePlan(typFile: string, plan: RenderPlan): Promise<RenderResult> {
  await initRenderer();

  const started = performance.now();
  const artifacts: Artifact[] = [];

  if (plan.kind === "single") {
    artifacts.push(toArtifact(plan.filename, await renderOne(typFile, plan.inputs)));
  } else {
    for (const item of plan.items) {
      artifacts.push(toArtifact(item.filename, await renderOne(typFile, item.inputs)));
    }
  }

  let concatenated: Artifact | undefined;
  if (plan.kind === "batch" && artifacts.length > 1) {
    const base = typFile.split("/").pop()?.replace(/\.typ$/i, "") || "dokument";
    concatenated = await concatenatePdfs(artifacts, plan.concatFilename ?? `${base}.pdf`);
  }

  return {
    artifacts,
    concatenated,
    ms: performance.now() - started,
    totalBytes:
      artifacts.reduce((sum, artifact) => sum + artifact.bytes.byteLength, 0) +
      (concatenated?.bytes.byteLength ?? 0),
  };
}
