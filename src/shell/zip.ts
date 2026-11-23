import { zipSync } from "fflate";
import { sanitizeFilenameComponent } from "../pipeline/filenames";
import type { TreeNode } from "./results";

function uniquePath(files: Record<string, Uint8Array>, path: string): string {
  if (!files[path]) return path;

  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;

  let counter = 2;
  let candidate = path;
  while (files[candidate]) {
    candidate = `${dir}${counter++}_${file}`;
  }
  return candidate;
}

/** Zips the same tree the UI shows, preserving folders. */
export function buildZipFromTree(root: TreeNode): Blob {
  const files: Record<string, Uint8Array> = {};

  const walk = (node: TreeNode, path: string) => {
    const name = sanitizeFilenameComponent(node.name) || "element";

    if (node.kind === "file") {
      if (!node.artifact) return;
      const target = uniquePath(files, path ? `${path}/${name}` : name);
      files[target] = node.artifact.bytes;
      return;
    }

    const next = path ? `${path}/${name}` : name;
    for (const child of node.children ?? []) walk(child, next);
  };

  walk(root, "");

  const zipped = zipSync(files, { level: 6 });
  return new Blob([new Uint8Array(zipped)], { type: "application/zip" });
}
