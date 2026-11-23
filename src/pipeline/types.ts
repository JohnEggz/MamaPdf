/** Values passed to Typst as `sys.inputs`. Typst only accepts strings. */
export type TypstInputs = Record<string, string>;

/**
 * What a template's `prepare` returns.
 * - `single` -> exactly one PDF.
 * - `batch`  -> one PDF per item (the shell loops; the .typ never does).
 */
export type RenderPlan =
  | { kind: "single"; filename: string; inputs: TypstInputs }
  | {
      kind: "batch";
      items: { filename: string; inputs: TypstInputs }[];
      /** Name for the merged PDF of all items. Defaults to the .typ basename. */
      concatFilename?: string;
    };

/** Everything a template may read. Datasets are flow-local and opaque here. */
export interface RenderContext {
  datasets: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface TemplateDef {
  id: string;
  label: string;
  /** Dataset ids this template reads. */
  inputs: string[];
  /** Project meta keys this template reads. */
  meta: string[];
  /** Shadow path of the .typ file, e.g. "/zaswiadczenie_kot.typ". */
  typFile: string;
  prepare(ctx: RenderContext): RenderPlan;
}
