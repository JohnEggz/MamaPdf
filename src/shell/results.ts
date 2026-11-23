import type { Artifact } from "../pipeline/render";
import type { TemplateDef } from "../pipeline/types";

export interface TemplateResult {
  template: TemplateDef;
  artifacts: Artifact[];
  /** Merged PDF for batch plans. */
  concatenated?: Artifact;
  error?: string;
}

export interface TreeNode {
  kind: "folder" | "file";
  name: string;
  children?: TreeNode[];
  artifact?: Artifact;
  error?: string;
}

function fileNode(artifact: Artifact): TreeNode {
  return { kind: "file", name: artifact.filename, artifact };
}

/**
 * One tree for the UI and the zip:
 * <project>/
 *   <template>/
 *     merged.pdf            (batch only, when >1 item)
 *     pojedyncze/
 *       <item>.pdf          (batch items)
 *     <single>.pdf          (single plans)
 */
export function buildResultTree(projectName: string, results: TemplateResult[]): TreeNode {
  const children: TreeNode[] = [];

  for (const result of results) {
    const folder: TreeNode = {
      kind: "folder",
      name: result.template.label,
      children: [],
      error: result.error,
    };

    if (result.error) {
      children.push(folder);
      continue;
    }

    if (result.concatenated) {
      folder.children!.push(fileNode(result.concatenated));
      folder.children!.push({
        kind: "folder",
        name: "pojedyncze",
        children: result.artifacts.map(fileNode),
      });
    } else {
      folder.children!.push(...result.artifacts.map(fileNode));
    }

    children.push(folder);
  }

  return { kind: "folder", name: projectName, children };
}

export function countFiles(node: TreeNode): number {
  if (node.kind === "file") return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
}
