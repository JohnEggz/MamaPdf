import type { ComponentType } from "react";
import type { TemplateDef } from "../pipeline/types";

export type MetaFieldType = "text" | "textarea" | "date" | "number" | "select";

export interface MetaField {
  key: string;
  label: string;
  type: MetaFieldType;
  options?: string[];
  placeholder?: string;
}

export interface DatasetEditorProps<T = unknown> {
  value: T;
  onChange(value: T): void;
  readOnly?: boolean;
}

export interface DatasetDef<T = unknown> {
  id: string;
  label: string;
  /** File input accept string. */
  accept: string;
  load(file: File): Promise<T>;
  Editor: ComponentType<DatasetEditorProps<T>>;
  readOnly?: boolean;
  /** Short status shown in the tree, e.g. "3 osoby". */
  summarize?(value: T): string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  metaFields: MetaField[];
  // Datasets are heterogeneous by design; the shell treats them as opaque.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datasets: DatasetDef<any>[];
  templates: TemplateDef[];
}
