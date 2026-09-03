/**
 * main.js - JohnMamaPDF v2 UI Controller
 * Orchestrates DOM events, updates the dumb puppeteer view, and signals Python via api.js
 */

import {
  apiGetInitialData,
  apiPickSpreadsheet,
  apiLoadStorageProject,
  apiUpdateTrainingMeta,
  apiUpdateParticipants,
  apiAddParticipant,
  apiRemoveParticipant,
  apiGeneratePdfs,
  apiOpenExplorer,
} from "./api.js";
import { store } from "./state.js";

// DOM Elements cache
let dom = {};

// Debounce helper
function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Notification banner
function showStatus(message, type = "success", duration = 5000) {
  if (!dom.statusMessage) return;
  dom.statusMessage.textContent = message;
  dom.statusMessage.className = `status-box show ${type}`;

  if (duration > 0) {
    setTimeout(() => {
      if (dom.statusMessage && dom.statusMessage.textContent === message) {
        dom.statusMessage.className = "status-box";
      }
    }, duration);
  }
}

// Sync Form Inputs from Store
function renderForm(training) {
  if (!training) return;
  dom.inputNazwa.value = training.nazwa_szkolenia || "";
  dom.inputNumer.value = training.numer_szkolenia || "";
  dom.inputData.value = training.data_szkolenia || "";
  dom.inputMiejsce.value = training.miejsce_szkolenia || "";
  dom.inputProwadzacy.value = training.prowadzacy || "";
  dom.inputCzasTrwania.value = training.czas_trwania || "";
  dom.inputGodziny.value = training.czas_trwania_od_do || "";
  dom.inputDataWystawienia.value = training.data_wystawienia || "";
  dom.inputTematyka.value = training.tematyka || "";
}

// Read Current Form Inputs
function readForm() {
  return {
    nazwa_szkolenia: dom.inputNazwa.value.trim(),
    numer_szkolenia: dom.inputNumer.value.trim(),
    data_szkolenia: dom.inputData.value.trim(),
    miejsce_szkolenia: dom.inputMiejsce.value.trim(),
    prowadzacy: dom.inputProwadzacy.value.trim(),
    czas_trwania: dom.inputCzasTrwania.value.trim(),
    czas_trwania_od_do: dom.inputGodziny.value.trim(),
    data_wystawienia: dom.inputDataWystawienia.value.trim(),
    tematyka: dom.inputTematyka.value.trim(),
  };
}

// Render Participants Table
function renderTable(participants) {
  dom.tableBody.innerHTML = "";
  const list = Array.isArray(participants) ? participants : [];

  list.forEach((p, index) => {
    const tr = createTableRow(p, index);
    dom.tableBody.appendChild(tr);
  });

  updateParticipantCount(list.length);
}

function updateParticipantCount(count) {
  if (dom.participantCountChip) {
    const label = count === 1 ? "1 uczestnik" : `${count} uczestników`;
    dom.participantCountChip.textContent = label;
  }
}

// Create single row element
function createTableRow(p, index) {
  const tr = document.createElement("tr");
  tr.dataset.index = index;

  tr.innerHTML = `
    <td class="col-idx">${index + 1}</td>
    <td>
      <input type="text" class="cell-input" data-field="imie_nazwisko" value="${escapeHtml(p.imie_nazwisko || "")}" placeholder="Jan Kowalski" />
    </td>
    <td>
      <input type="text" class="cell-input" data-field="data_urodzenia" value="${escapeHtml(p.data_urodzenia || "")}" placeholder="01.01.1990" />
    </td>
    <td>
      <input type="text" class="cell-input" data-field="miejsce_urodzenia" value="${escapeHtml(p.miejsce_urodzenia || "")}" placeholder="Kraków" />
    </td>
    <td>
      <input type="text" class="cell-input" data-field="placowka" value="${escapeHtml(p.placowka || "")}" placeholder="Szkoła Podstawowa..." />
    </td>
    <td class="col-action">
      <button type="button" class="btn-icon-only btn-delete-row" title="Usuń wiersz">✕</button>
    </td>
  `;

  return tr;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render Saved Projects List in Pane 1 with Active Project Highlight
function renderStorageProjects(projects, activePath = null) {
  if (!dom.storageDirList) return;
  dom.storageDirList.innerHTML = "";

  const list = Array.isArray(projects) ? projects : [];
  if (list.length === 0) {
    dom.storageDirList.innerHTML = '<li class="empty-state-text">Brak projektów w katalogu</li>';
    return;
  }

  const currentActive = activePath || store.activeProjectPath;

  list.forEach((proj) => {
    const li = document.createElement("li");
    const isActive = currentActive && proj.path === currentActive;
    li.className = `dir-list-item${isActive ? " active" : ""}`;
    li.dataset.path = proj.path;

    const badges = [];
    if (proj.participant_count > 0) {
      badges.push(`${proj.participant_count} os.`);
    }
    if (proj.has_cert) {
      badges.push("PDF ✓");
    }

    li.innerHTML = `
      <div class="dir-item-title" title="${escapeHtml(proj.title || proj.name)}">${escapeHtml(proj.title || proj.name)}</div>
      <div class="dir-item-meta">
        <span>${proj.modified || ""}</span>
        ${badges.length > 0 ? `<span class="dir-item-badge">${badges.join(" · ")}</span>` : ""}
      </div>
    `;

    li.addEventListener("click", async () => {
      try {
        const res = await apiLoadStorageProject(proj.path);
        if (res.success) {
          store.setDocument(res.document);
          store.setActiveProjectPath(res.active_project_path);
          renderForm(res.document.training);
          renderTable(res.document.participants);
          renderStorageProjects(store.storageProjects, res.active_project_path);
          showStatus(`Wczytano projekt: ${proj.title || proj.name}`);
        } else {
          showStatus(res.error || "Nie udało się wczytać projektu", "error");
        }
      } catch (err) {
        showStatus(`Błąd ładowania: ${err.message}`, "error");
      }
    });

    dom.storageDirList.appendChild(li);
  });
}

// Debounced backend auto-sync for participants table
const syncParticipantsToBackend = debounce(async () => {
  try {
    await apiUpdateParticipants(store.document.participants);
  } catch (err) {
    console.warn("Error auto-saving participants:", err);
  }
}, 400);

// Debounced backend auto-sync for form metadata
const syncMetaToBackend = debounce(async () => {
  try {
    const currentMeta = readForm();
    store.document.training = currentMeta;
    await apiUpdateTrainingMeta(currentMeta);
  } catch (err) {
    console.warn("Error auto-saving metadata:", err);
  }
}, 400);

// App initialization
async function init() {
  // Bind DOM refs
  dom = {
    btnPickOds: document.getElementById("btn-pick-ods"),
    storageDirList: document.getElementById("storage-dir-list"),

    inputNazwa: document.getElementById("input-nazwa"),
    inputNumer: document.getElementById("input-numer"),
    inputData: document.getElementById("input-data"),
    inputMiejsce: document.getElementById("input-miejsce"),
    inputProwadzacy: document.getElementById("input-prowadzacy"),
    inputCzasTrwania: document.getElementById("input-czas-trwania"),
    inputGodziny: document.getElementById("input-godziny"),
    inputDataWystawienia: document.getElementById("input-data-wystawienia"),
    inputTematyka: document.getElementById("input-tematyka"),

    btnGenerate: document.getElementById("btn-generate"),
    btnOpenExplorer: document.getElementById("btn-open-explorer"),
    statusMessage: document.getElementById("status-message"),

    participantCountChip: document.getElementById("participant-count-chip"),
    tableBody: document.getElementById("data-table-body"),
    btnAddRow: document.getElementById("btn-add-row"),
  };

  // Form Inputs: auto-save on typing
  const formInputs = [
    dom.inputNazwa,
    dom.inputNumer,
    dom.inputData,
    dom.inputMiejsce,
    dom.inputProwadzacy,
    dom.inputCzasTrwania,
    dom.inputGodziny,
    dom.inputDataWystawienia,
    dom.inputTematyka,
  ];

  formInputs.forEach((input) => {
    input.addEventListener("input", () => {
      syncMetaToBackend();
    });
  });

  // Table Delegation: Cell input & Row delete
  dom.tableBody.addEventListener("input", (e) => {
    const target = e.target;
    if (target.classList.contains("cell-input")) {
      const tr = target.closest("tr");
      const index = parseInt(tr.dataset.index, 10);
      const field = target.dataset.field;
      store.updateParticipantCell(index, field, target.value);
      syncParticipantsToBackend();
    }
  });

  dom.tableBody.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target.classList.contains("cell-input") && e.key === "Enter") {
      e.preventDefault();
      const tr = target.closest("tr");
      const nextTr = tr.nextElementSibling;
      if (nextTr) {
        const nextInput = nextTr.querySelector(`[data-field="${target.dataset.field}"]`);
        if (nextInput) nextInput.focus();
      } else {
        addNewParticipantRow();
      }
    }
  });

  dom.tableBody.addEventListener("click", async (e) => {
    const target = e.target;
    if (target.classList.contains("btn-delete-row")) {
      const tr = target.closest("tr");
      const index = parseInt(tr.dataset.index, 10);
      store.removeParticipant(index);
      await apiRemoveParticipant(index);
      renderTable(store.document.participants);
    }
  });

  // Button: Add Row
  dom.btnAddRow.addEventListener("click", () => {
    addNewParticipantRow();
  });

  async function addNewParticipantRow() {
    const newParticipant = store.addParticipant();
    const tr = createTableRow(newParticipant, store.document.participants.length - 1);
    dom.tableBody.appendChild(tr);
    updateParticipantCount(store.document.participants.length);

    // Focus first input in newly added row
    const firstInput = tr.querySelector('.cell-input[data-field="imie_nazwisko"]');
    if (firstInput) firstInput.focus();

    // Scroll table to bottom
    const wrapper = dom.tableBody.closest(".table-scroll-wrapper");
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;

    await apiAddParticipant(newParticipant);
  }

  // Button: Pick .ods / .xlsx -> creates new project directory
  dom.btnPickOds.addEventListener("click", async () => {
    try {
      showStatus("Otwieranie okna wyboru arkusza...", "success", 2000);
      const res = await apiPickSpreadsheet();
      if (res.cancelled) return;

      if (res.success) {
        store.setDocument(res.document);
        store.setActiveProjectPath(res.active_project_path);
        store.setStorageProjects(res.storage_projects);

        renderForm(res.document.training);
        renderTable(res.document.participants);
        renderStorageProjects(res.storage_projects, res.active_project_path);

        showStatus(`Utworzono nowy projekt: ${res.project_name} (${res.count} uczestników)`);
      } else {
        showStatus(res.error || "Nie udało się wczytać arkusza", "error");
      }
    } catch (err) {
      showStatus(`Błąd: ${err.message}`, "error");
    }
  });

  // Button: Generate PDF -> overwrites PDFs in active project directory
  dom.btnGenerate.addEventListener("click", async () => {
    try {
      const currentMeta = readForm();
      store.document.training = currentMeta;

      dom.btnGenerate.disabled = true;
      dom.btnGenerate.innerHTML = "<span>⏳</span> Kompilowanie...";
      showStatus("Kompilowanie szablonów Typst...", "success", 0);

      const res = await apiGeneratePdfs(currentMeta, store.document.participants);

      if (res.success) {
        showStatus("✓ Wygenerowano PDF i zaktualizowano projekt!");
        if (res.storage_projects) {
          store.setStorageProjects(res.storage_projects);
          renderStorageProjects(res.storage_projects, store.activeProjectPath);
        }
      } else {
        showStatus(res.error || "Wystąpił błąd podczas generowania dokumentów", "error", 8000);
      }
    } catch (err) {
      showStatus(`Błąd generowania: ${err.message}`, "error", 8000);
    } finally {
      dom.btnGenerate.disabled = false;
      dom.btnGenerate.innerHTML = "<span>⚡</span> Generuj PDF";
    }
  });

  // Button: Show in Explorer
  dom.btnOpenExplorer.addEventListener("click", async () => {
    try {
      const res = await apiOpenExplorer();
      if (!res.success) {
        showStatus("Nie udało się otworzyć menedżera plików", "error");
      }
    } catch (err) {
      showStatus(`Błąd: ${err.message}`, "error");
    }
  });

  // Fetch initial data from Python
  try {
    const initData = await apiGetInitialData();
    if (initData && initData.success) {
      if (initData.active_project_path) {
        store.setActiveProjectPath(initData.active_project_path);
      }
      if (initData.document) {
        store.setDocument(initData.document);
        renderForm(initData.document.training);
        renderTable(initData.document.participants);
      }
      if (initData.storage_projects) {
        store.setStorageProjects(initData.storage_projects);
        renderStorageProjects(initData.storage_projects, initData.active_project_path);
      }
    }
  } catch (err) {
    console.warn("Could not retrieve initial state from Eel:", err);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
