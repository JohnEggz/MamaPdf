import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface Project {
  id: string;
  flowId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Only imported datasets are present. Values are flow-local JSON. */
  datasets: Record<string, unknown>;
  /** Project-level fields declared by the flow's meta registry. */
  meta: Record<string, unknown>;
  selectedTemplates: string[];
}

interface MamaDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { "by-updated": number };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "mamapdf";
const DB_VERSION = 2;
const LAST_PROJECT = "lastProjectId";

let dbPromise: Promise<IDBPDatabase<MamaDB>> | null = null;

function db(): Promise<IDBPDatabase<MamaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MamaDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 2) {
          for (const name of ["projects", "meta"] as const) {
            if (database.objectStoreNames.contains(name)) database.deleteObjectStore(name);
          }
        }

        const projects = database.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("by-updated", "updatedAt");
        database.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAllFromIndex("projects", "by-updated");
  return all.reverse();
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await db()).get("projects", id);
}

export async function createProject(flowId: string, name: string): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: crypto.randomUUID(),
    flowId,
    name,
    createdAt: now,
    updatedAt: now,
    datasets: {},
    meta: {},
    selectedTemplates: [],
  };
  await (await db()).put("projects", project);
  await setLastProjectId(project.id);
  return project;
}

export async function updateProject(project: Project): Promise<void> {
  await (await db()).put("projects", project);
}

export async function deleteProject(id: string): Promise<void> {
  const database = await db();
  await database.delete("projects", id);
  if ((await getLastProjectId()) === id) {
    await database.delete("meta", LAST_PROJECT);
  }
}

export async function getLastProjectId(): Promise<string | null> {
  return ((await (await db()).get("meta", LAST_PROJECT)) as string | undefined) ?? null;
}

export async function setLastProjectId(id: string): Promise<void> {
  await (await db()).put("meta", id, LAST_PROJECT);
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
