import { webinarKot } from "./webinar-kot/flow";
import { wydarzenie } from "./wydarzenie/flow";
import type { Flow } from "./types";

export const flows: Flow[] = [wydarzenie, webinarKot];

export function getFlow(id: string | null | undefined): Flow | null {
  return flows.find((flow) => flow.id === id) ?? null;
}
