import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { getFlow, flows } from "./flows";
import type { Flow, MetaField } from "./flows/types";
import { sanitizeFilenameComponent } from "./pipeline/filenames";
import { executePlan, initRenderer } from "./pipeline/render";
import type { TemplateDef } from "./pipeline/types";
import {
  createProject,
  deleteProject,
  getLastProjectId,
  listProjects,
  requestPersistence,
  setLastProjectId,
  storageEstimate,
  updateProject,
  type Project,
} from "./shell/projectStore";
import {
  buildResultTree,
  countFiles,
  type TemplateResult,
  type TreeNode,
} from "./shell/results";
import { buildZipFromTree } from "./shell/zip";

type Selection = { type: "root" } | { type: "dataset"; id: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function missingRequirements(project: Project, flow: Flow, template: TemplateDef): string[] {
  const missing: string[] = [];

  for (const id of template.inputs) {
    const label = flow.datasets.find((dataset) => dataset.id === id)?.label ?? id;
    const value = project.datasets[id];
    if (value === undefined) missing.push(label);
    else if (Array.isArray(value) && value.length === 0) missing.push(`${label} (puste)`);
  }

  for (const key of template.meta) {
    const field = flow.metaFields.find((meta) => meta.key === key);
    if (!field) missing.push(key);
    else if (!String(project.meta[key] ?? "").trim()) missing.push(field.label);
  }

  return missing;
}

function disposeResults(results: TemplateResult[]) {
  for (const group of results) {
    for (const artifact of group.artifacts) URL.revokeObjectURL(artifact.url);
    if (group.concatenated) URL.revokeObjectURL(group.concatenated.url);
  }
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ type: "root" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [results, setResults] = useState<TemplateResult[]>([]);
  const [zip, setZip] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ładowanie…");
  const [error, setError] = useState<string | null>(null);
  const [storageLabel, setStorageLabel] = useState("");

  const activeRef = useRef<Project | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingDataset = useRef<string | null>(null);
  const resultsRef = useRef<TemplateResult[]>([]);
  const zipRef = useRef<{ url: string } | null>(null);

  const activeProject = projects.find((project) => project.id === activeId) ?? null;
  const flow = activeProject ? getFlow(activeProject.flowId) : null;

  activeRef.current = activeProject;
  resultsRef.current = results;
  zipRef.current = zip;

  /* --------------------------------- boot --------------------------------- */

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await initRenderer();
        await requestPersistence();

        const list = await listProjects();
        if (cancelled) return;

        setProjects(list);
        const lastId = await getLastProjectId();
        const initial = list.find((project) => project.id === lastId) ?? list[0] ?? null;

        if (initial) {
          setActiveId(initial.id);
          setSelection({ type: "root" });
          setStatus(`Projekt: ${initial.name}`);
        } else {
          setStatus("Brak projektów — utwórz nowy.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const estimate = await storageEstimate();
      if (!cancelled && estimate) {
        setStorageLabel(`${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  useEffect(() => {
    const handler = () => flushSave();
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      disposeResults(resultsRef.current);
      if (zipRef.current) URL.revokeObjectURL(zipRef.current.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------- persistence ---------------------------- */

  function clearResults() {
    disposeResults(resultsRef.current);
    resultsRef.current = [];
    setResults([]);

    if (zipRef.current) {
      URL.revokeObjectURL(zipRef.current.url);
      zipRef.current = null;
    }
    setZip(null);
  }

  function flushSave() {
    window.clearTimeout(saveTimer.current);
    const project = activeRef.current;
    if (project) void updateProject(project);
  }

  function patchActive(patch: Partial<Project>) {
    const current = activeRef.current;
    if (!current) return;

    const next: Project = { ...current, ...patch, updatedAt: Date.now() };
    activeRef.current = next;
    setProjects((prev) => prev.map((project) => (project.id === next.id ? next : project)));
    clearResults();

    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void updateProject(next);
    }, 350);
  }

  function setDataset(id: string, value: unknown) {
    const project = activeRef.current;
    if (!project) return;
    patchActive({ datasets: { ...project.datasets, [id]: value } });
  }

  function setMeta(key: string, value: string) {
    const project = activeRef.current;
    if (!project) return;
    patchActive({ meta: { ...project.meta, [key]: value } });
  }

  function toggleTemplate(id: string, checked: boolean) {
    const project = activeRef.current;
    if (!project) return;
    const selectedTemplates = checked
      ? [...new Set([...project.selectedTemplates, id])]
      : project.selectedTemplates.filter((templateId) => templateId !== id);
    patchActive({ selectedTemplates });
  }

  /* -------------------------------- projects ------------------------------ */

  function selectProject(id: string) {
    if (id === activeId) {
      setSelection({ type: "root" });
      return;
    }
    flushSave();
    setActiveId(id);
    setSelection({ type: "root" });
    clearResults();
    void setLastProjectId(id);
  }

  async function handleCreate(selectedFlow: Flow) {
    flushSave();
    const name = `${selectedFlow.name} — ${new Date().toLocaleDateString("pl-PL")}`;
    const project = await createProject(selectedFlow.id, name);

    activeRef.current = project;
    setProjects((prev) => [project, ...prev]);
    setActiveId(project.id);
    setSelection({ type: "root" });
    setPickerOpen(false);
    clearResults();
    setStatus(`Utworzono projekt: ${project.name}`);
  }

  async function handleRename(project: Project) {
    const name = window.prompt("Nazwa projektu", project.name)?.trim();
    if (!name || name === project.name) return;

    const next = { ...project, name, updatedAt: Date.now() };
    await updateProject(next);
    setProjects((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    if (activeId === project.id) activeRef.current = next;
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Usunąć projekt „${project.name}”?`)) return;

    await deleteProject(project.id);
    const remaining = projects.filter((item) => item.id !== project.id);
    setProjects(remaining);

    if (activeId === project.id) {
      const next = remaining[0] ?? null;
      activeRef.current = next;
      setActiveId(next?.id ?? null);
      setSelection({ type: "root" });
      clearResults();
      if (next) await setLastProjectId(next.id);
    }
  }

  /* -------------------------------- datasets ------------------------------ */

  function requestFile(datasetId: string) {
    const input = fileInputRef.current;
    if (!input) return;
    const definition = flow?.datasets.find((dataset) => dataset.id === datasetId);
    input.accept = definition?.accept ?? "";
    pendingDataset.current = datasetId;
    input.click();
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const datasetId = pendingDataset.current;
    pendingDataset.current = null;
    event.target.value = "";

    if (!file || !datasetId || !flow) return;
    const definition = flow.datasets.find((dataset) => dataset.id === datasetId);
    if (!definition) return;

    setBusy(true);
    setError(null);
    try {
      const value = await definition.load(file);
      setDataset(datasetId, value);
      setSelection({ type: "dataset", id: datasetId });
      setStatus(`Wczytano ${file.name} → ${definition.label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------- generation ----------------------------- */

  async function generate() {
    if (!flow || !activeProject) return;

    const selected = flow.templates.filter((template) =>
      activeProject.selectedTemplates.includes(template.id),
    );
    const ready = selected.filter(
      (template) => missingRequirements(activeProject, flow, template).length === 0,
    );
    if (ready.length === 0) {
      setStatus("Brak gotowych szablonów do wygenerowania.");
      return;
    }

    clearResults();
    setBusy(true);
    setError(null);
    const started = performance.now();
    const groups: TemplateResult[] = [];
    // Templates expect every flow meta key to exist, even when empty.
    const meta = Object.fromEntries(
      flow.metaFields.map((field) => [field.key, activeProject.meta[field.key] ?? ""]),
    );

    try {
      for (const template of ready) {
        try {
          const plan = template.prepare({
            datasets: activeProject.datasets,
            meta,
          });
          const result = await executePlan(template.typFile, plan);
          groups.push({
            template,
            artifacts: result.artifacts,
            concatenated: result.concatenated,
          });
        } catch (err) {
          groups.push({
            template,
            artifacts: [],
            error: err instanceof Error ? err.message : String(err),
          });
        }
        setResults([...groups]);
      }

      resultsRef.current = groups;
      const tree = buildResultTree(activeProject.name, groups);
      const total = countFiles(tree);

      if (total > 0) {
        const blob = buildZipFromTree(tree);
        const url = URL.createObjectURL(blob);
        const name = `${sanitizeFilenameComponent(activeProject.name || "wyniki") || "wyniki"}.zip`;
        const entry = { url, name };
        zipRef.current = entry;
        setZip(entry);
      }

      setStatus(`Wygenerowano ${total} plik(ów) w ${((performance.now() - started) / 1000).toFixed(1)} s.`);
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------- view -------------------------------- */

  const selectedTemplates = flow && activeProject
    ? flow.templates.filter((template) => activeProject.selectedTemplates.includes(template.id))
    : [];
  const readyTemplates = flow && activeProject
    ? selectedTemplates.filter(
        (template) => missingRequirements(activeProject, flow, template).length === 0,
      )
    : [];
  const resultTree =
    results.length > 0 && activeProject
      ? buildResultTree(activeProject.name, results)
      : null;

  return (
    <div className="app">
      <header>
        <div>
          <h1>MamaPdf</h1>
          <p>Projekty → zbiory danych → szablony → PDF</p>
        </div>
        <div className="header-status" data-testid="status">
          {busy ? "Pracuję…" : status}
        </div>
      </header>

      <input ref={fileInputRef} type="file" hidden onChange={onFileChange} />

      <div className="panes">
        <aside className="pane left">
          <div className="pane-header">
            <h2>Projekty</h2>
            <button
              type="button"
              className="button primary"
              data-testid="new-project"
              onClick={() => setPickerOpen(true)}
            >
              + Nowy
            </button>
          </div>

          <div className="tree">
            {projects.length === 0 && <p className="hint">Brak projektów. Utwórz pierwszy.</p>}

            {projects.map((project) => {
              const projectFlow = getFlow(project.flowId);
              const isActive = project.id === activeId;

              return (
                <div key={project.id} className={`tree-project ${isActive ? "active" : ""}`}>
                  <div className="tree-row">
                    <button
                      type="button"
                      className="tree-label"
                      data-testid={isActive ? "active-project" : undefined}
                      onClick={() => selectProject(project.id)}
                    >
                      <span className="caret">{isActive ? "▾" : "▸"}</span>
                      <span className="project-name" title={project.name}>
                        {project.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon"
                      title="Zmień nazwę"
                      onClick={() => void handleRename(project)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon danger"
                      title="Usuń"
                      onClick={() => void handleDelete(project)}
                    >
                      ×
                    </button>
                  </div>

                  {isActive && projectFlow && (
                    <div className="tree-children">
                      {projectFlow.datasets.map((definition) => {
                        const loaded = project.datasets[definition.id] !== undefined;
                        const isSelected =
                          selection.type === "dataset" && selection.id === definition.id;

                        return (
                          <button
                            key={definition.id}
                            type="button"
                            className={`tree-leaf ${isSelected ? "selected" : ""} ${loaded ? "loaded" : ""}`}
                            data-testid={`dataset-${definition.id}`}
                            onClick={() =>
                              loaded
                                ? setSelection({ type: "dataset", id: definition.id })
                                : requestFile(definition.id)
                            }
                          >
                            <span className="dot" />
                            <span className="leaf-label">{definition.label}</span>
                            <span className="leaf-status">
                              {loaded
                                ? definition.summarize?.(project.datasets[definition.id]) ?? "wczytany"
                                : "wczytaj"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="storage-label">{storageLabel || "\u00a0"}</p>
        </aside>

        <section className="pane center">
          {!activeProject || !flow ? (
            <EmptyState
              title="Brak aktywnego projektu"
              body="Utwórz projekt, aby zacząć."
              action={
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setPickerOpen(true)}
                >
                  + Nowy projekt
                </button>
              }
            />
          ) : selection.type === "root" ? (
            <RootEditor project={activeProject} flow={flow} onMeta={setMeta} />
          ) : (
            <DatasetView
              project={activeProject}
              flow={flow}
              datasetId={selection.id}
              onDataset={(value) => setDataset(selection.id, value)}
              onRequestFile={() => requestFile(selection.id)}
            />
          )}
        </section>

        <aside className="pane right">
          <div className="pane-header">
            <h2>Szablony</h2>
          </div>

          {!activeProject || !flow ? (
            <p className="hint pad">Wybierz projekt.</p>
          ) : (
            <>
              <div className="template-list">
                {flow.templates.map((template) => {
                  const checked = activeProject.selectedTemplates.includes(template.id);
                  const missing = missingRequirements(activeProject, flow, template);

                  return (
                    <label
                      key={template.id}
                      className={`template-row ${checked ? "checked" : ""} ${missing.length > 0 ? "not-ready" : ""}`}
                    >
                      <input
                        type="checkbox"
                        data-testid={`template-${template.id}`}
                        checked={checked}
                        onChange={(event) => toggleTemplate(template.id, event.target.checked)}
                      />
                      <span className="template-body">
                        <span className="template-name">{template.label}</span>
                        <span className="template-meta">
                          {template.inputs
                            .map(
                              (id) => flow.datasets.find((dataset) => dataset.id === id)?.label ?? id,
                            )
                            .join(" + ")}
                        </span>
                        {missing.length > 0 && (
                          <span className="template-missing">brakuje: {missing.join(", ")}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                className="button primary full generate"
                data-testid="generate"
                disabled={busy || readyTemplates.length === 0}
                onClick={() => void generate()}
              >
                Generuj PDF{readyTemplates.length > 0 ? ` (${readyTemplates.length})` : ""}
              </button>

              <Results tree={resultTree} />

              {zip && (
                <a
                  className="button ghost full zip-download"
                  data-testid="download-zip"
                  href={zip.url}
                  download={zip.name}
                >
                  Pobierz wszystko (.zip)
                </a>
              )}
            </>
          )}
        </aside>
      </div>

      {pickerOpen && (
        <div className="modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Wybierz przepływ</h2>
            <div className="flow-list">
              {flows.map((flowOption) => (
                <button
                  key={flowOption.id}
                  type="button"
                  className="flow-option"
                  data-testid={`flow-${flowOption.id}`}
                  onClick={() => void handleCreate(flowOption)}
                >
                  <strong>{flowOption.name}</strong>
                  <span>{flowOption.description}</span>
                  <small>
                    {flowOption.datasets.length} zbiory · {flowOption.templates.length} szablony
                  </small>
                </button>
              ))}
            </div>
            <button type="button" className="button ghost" onClick={() => setPickerOpen(false)}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- components ------------------------------- */

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

function RootEditor({
  project,
  flow,
  onMeta,
}: {
  project: Project;
  flow: Flow;
  onMeta: (key: string, value: string) => void;
}) {
  const selected = flow.templates.filter((template) =>
    project.selectedTemplates.includes(template.id),
  );
  const visibleKeys = new Set(selected.flatMap((template) => template.meta));
  const fields = flow.metaFields.filter((field) => visibleKeys.has(field.key));

  return (
    <div className="editor">
      <div className="editor-header">
        <div>
          <h2>{project.name}</h2>
          <p className="muted">{flow.name} · pola wymagane przez wybrane szablony</p>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="hint" data-testid="root-hint">
          Wybierz szablony po prawej stronie, aby zobaczyć pola danych.
        </p>
      ) : (
        <div className="meta-form">
          {fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={project.meta[field.key]}
              onChange={(value) => onMeta(field.key, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: MetaField;
  value: unknown;
  onChange: (value: string) => void;
}) {
  const current = value == null ? "" : String(value);
  const testId = `meta-${field.key}`;

  return (
    <label className="field">
      <span>
        {field.label}
        <em> *</em>
      </span>

      {field.type === "textarea" ? (
        <textarea
          rows={3}
          value={current}
          data-testid={testId}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          value={current}
          data-testid={testId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : "text"}
          value={current}
          data-testid={testId}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function DatasetView({
  project,
  flow,
  datasetId,
  onDataset,
  onRequestFile,
}: {
  project: Project;
  flow: Flow;
  datasetId: string;
  onDataset: (value: unknown) => void;
  onRequestFile: () => void;
}) {
  const definition = flow.datasets.find((dataset) => dataset.id === datasetId);
  if (!definition) return null;

  const value = project.datasets[datasetId];

  if (value === undefined) {
    return (
      <div className="editor">
        <div className="editor-header">
          <h2>{definition.label}</h2>
        </div>
        <EmptyState
          title="Brak danych"
          body="Ten zbiór nie ma jeszcze wczytanego arkusza."
          action={
            <button
              type="button"
              className="button primary"
              data-testid={`load-${definition.id}`}
              onClick={onRequestFile}
            >
              Wczytaj plik
            </button>
          }
        />
      </div>
    );
  }

  const Editor = definition.Editor;

  return (
    <div className="editor">
      <div className="editor-header">
        <div>
          <h2>
            {definition.label} {definition.readOnly && <span className="badge">tylko podgląd</span>}
          </h2>
          <p className="muted">{definition.summarize?.(value) ?? ""}</p>
        </div>
        <button
          type="button"
          className="button ghost"
          onClick={() => {
            if (window.confirm("Wczytanie nowego pliku zastąpi obecne dane tego zbioru. Kontynuować?")) {
              onRequestFile();
            }
          }}
        >
          Wymień plik
        </button>
      </div>

      <Editor value={value} onChange={onDataset} readOnly={definition.readOnly} />
    </div>
  );
}

function Results({ tree }: { tree: TreeNode | null }) {
  if (!tree) return null;

  return (
    <div className="results" data-testid="results">
      <ResultNodeView node={tree} depth={0} />
    </div>
  );
}

function ResultNodeView({ node, depth }: { node: TreeNode; depth: number }) {
  const childCount = node.children?.length ?? 0;
  const [open, setOpen] = useState(depth < 2 || childCount <= 12);

  if (node.kind === "file") {
    return (
      <div className="result-file" data-node="file" data-name={node.name}>
        {node.artifact ? (
          <a
            className="file-name"
            href={node.artifact.url}
            target="_blank"
            rel="noopener noreferrer"
            title={node.name}
            data-role="open"
          >
            {node.name}
          </a>
        ) : (
          <span title={node.name}>{node.name}</span>
        )}
        {node.artifact && (
          <a
            className="button ghost"
            href={node.artifact.url}
            download={node.name}
            data-role="download"
          >
            Pobierz
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="result-folder" data-node="folder" data-name={node.name}>
      <button
        type="button"
        className="folder-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="folder-caret">{open ? "▾" : "▸"}</span>
        <span className="folder-name" title={node.name}>
          {node.name}
        </span>
        <span className="folder-count">{countFiles(node)}</span>
      </button>

      {open && (
        <div className="folder-children">
          {node.error && <p className="error">{node.error}</p>}
          {node.children?.map((child, index) => (
            <ResultNodeView
              key={`${child.kind}-${child.name}-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
