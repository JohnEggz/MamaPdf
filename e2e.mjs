import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer-core";
import { cleanFixtures, writeFixtures } from "./test/fixtures.mjs";

const root = import.meta.dirname;
const URL = process.env.E2E_URL ?? "http://localhost:4173/";
// Inputs are generated at run time; the repository holds no spreadsheets.
const fixtures = writeFixtures();
process.on("exit", () => cleanFixtures());

const server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => process.stdout.write("[vite] " + d));

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error("vite preview did not start");
}

function assert(cond, message) {
  if (!cond) throw new Error("ASSERT FAILED: " + message);
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

function chromePath() {
  const found = CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
  if (!found) {
    throw new Error("No Chromium found; set CHROME_PATH to a Chrome/Chromium binary");
  }
  return found;
}

async function loadDataset(page, datasetId, filePath) {
  // Let the project tree settle after a project/flow switch; React may replace
  // the leaf while the picker is closing.
  await sleep(200);

  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 15_000 }),
    page.click(`[data-testid="dataset-${datasetId}"]`),
  ]);
  await chooser.accept([filePath]);
}

async function setValue(page, selector, value) {
  const handle = await page.$(selector);
  assert(handle, `missing ${selector}`);
  await handle.click({ clickCount: 3 });
  await handle.type(value);
}

async function pdfsFor(page, linkSelector) {
  const raw = await page.evaluate(async (selector) => {
    const links = [...document.querySelectorAll(selector)];
    return Promise.all(
      links.map(async (link) => {
        const href = link.getAttribute("href");
        const bytes = new Uint8Array(await (await fetch(href)).arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return {
          name: link.getAttribute("download"),
          size: bytes.byteLength,
          magic: String.fromCharCode(...bytes.subarray(0, 5)),
          base64: btoa(binary),
        };
      }),
    );
  }, linkSelector);

  // Page counts for pdf-lib output (e.g. the merged PDF) are not visible as
  // plain "/Type /Page" strings, so ask pdf-lib itself.
  return Promise.all(
    raw.map(async (item) => {
      const doc = await PDFDocument.load(Buffer.from(item.base64, "base64"));
      return {
        name: item.name,
        size: item.size,
        magic: item.magic,
        pages: doc.getPageCount(),
      };
    }),
  );
}

let browser;
try {
  await waitForServer();

  browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.waitForSelector('[data-testid="new-project"]');
  console.log("BOOT:", await page.$eval('[data-testid="status"]', (el) => el.textContent));

  // 1. New project via the flow picker.
  await page.click('[data-testid="new-project"]');
  await page.waitForSelector('[data-testid="flow-wydarzenie"]');
  await page.click('[data-testid="flow-wydarzenie"]');
  await page.waitForSelector('[data-testid="dataset-uczestnicy"]');
  await page.waitForSelector('[data-testid="dataset-ankieta"]');
  console.log("PROJECT CREATED:", await page.$eval('[data-testid="active-project"]', (el) => el.textContent?.trim()));

  // 2. Load participants.
  await loadDataset(page, "uczestnicy", fixtures.participants);
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="participant-row"]').length === 3,
    { timeout: 30_000 },
  );
  console.log(
    "UCZESTNICY:",
    await page.$eval('[data-testid="dataset-uczestnicy"] .leaf-status', (el) => el.textContent),
  );

  // 3. Load survey: the center pane shows processed data, not raw rows.
  await loadDataset(page, "ankieta", fixtures.survey);
  await page.waitForSelector('[data-testid="survey-editor"]', { timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dataset-ankieta"] .leaf-status')?.textContent?.includes("odp."),
    { timeout: 30_000 },
  );

  const survey = await page.evaluate(() => {
    const value = (testId) =>
      document.querySelector(`[data-testid="${testId}"]`)?.value ?? null;
    return {
      count: document.querySelector('[data-testid="survey-response-count"]')?.textContent,
      ratings: [
        "tematyka",
        "czas_trwania",
        "przygotowanie",
        "cele",
        "prowadzenie",
        "potrzeby",
      ].map((key) => value(`survey-rating-${key}`)),
      recommendation: {
        tak: value("survey-recommendation-tak"),
        nieWiem: value("survey-recommendation-nie_wiem"),
        nie: value("survey-recommendation-nie"),
      },
      prawo: value("survey-interest-prawo"),
      inne: value("survey-interest-inne"),
    };
  });

  console.log("ANKIETA:", JSON.stringify(survey));
  assert((survey.count ?? "").startsWith("32"), `expected 32 responses, got ${survey.count}`);
  assert(
    JSON.stringify(survey.ratings) ===
      JSON.stringify(["4.4", "4.6", "4.7", "4.6", "4.7", "4.6"]),
    `unexpected rating averages: ${JSON.stringify(survey.ratings)}`,
  );
  assert(
    JSON.stringify(survey.recommendation) ===
      JSON.stringify({ tak: "23", nieWiem: "7", nie: "2" }),
    `unexpected recommendation counts: ${JSON.stringify(survey.recommendation)}`,
  );
  assert(survey.prawo === "13", `expected 13 Prawo oświatowe, got ${survey.prawo}`);
  assert(survey.inne === "0", `expected 0 inne, got ${survey.inne}`);

  // 3b. Edit processed values; they must survive reload.
  await setValue(page, '[data-testid="survey-rating-tematyka"]', "4.9");
  await page.click('[data-testid="survey-add-comment"]');
  const commentInputs = await page.$$('[data-testid="survey-comment"]');
  await commentInputs[commentInputs.length - 1].type("Dodatkowa uwaga testowa");

  // 4. Root editor: nothing until templates are selected.
  await page.click('[data-testid="active-project"]');
  await page.waitForSelector('[data-testid="root-hint"]');
  console.log("ROOT HINT OK");

  // 5. Select all templates -> meta fields appear.
  await page.click('[data-testid="template-zaswiadczenia"]');
  await page.click('[data-testid="template-lista_obecnosci"]');
  await page.click('[data-testid="template-ankieta_ewaluacyjna"]');
  await page.click('[data-testid="template-referencje"]');
  await page.waitForSelector('[data-testid="meta-nazwa_szkolenia"]');

  await setValue(page, '[data-testid="meta-nazwa_szkolenia"]', "Szkolenie Testowe");
  await setValue(page, '[data-testid="meta-numer_szkolenia"]', "NR/9");
  await setValue(page, '[data-testid="meta-data_szkolenia"]', "12.05.2026");
  await setValue(page, '[data-testid="meta-miejsce_szkolenia"]', "Wieliczka");
  await setValue(page, '[data-testid="meta-prowadzacy"]', "Jan Kowalski");
  await setValue(page, '[data-testid="meta-czas_trwania"]', "8 godz");
  await setValue(page, '[data-testid="meta-czas_trwania_od_do"]', "09:00 - 16:00");
  await setValue(page, '[data-testid="meta-data_wystawienia"]', "12.05.2026");
  await setValue(page, '[data-testid="meta-tematyka"]', "1. Wprowadzenie");

  // 6. Generate.
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="generate"]')?.hasAttribute("disabled"),
    { timeout: 10_000 },
  );
  await page.click('[data-testid="generate"]');
  await page.waitForSelector('[data-testid="results"]', { timeout: 90_000 });
  await page.waitForSelector('[data-name="Dziennik"]', { timeout: 90_000 });
  await page.waitForSelector('[data-name="Ewaluacja"]', { timeout: 90_000 });
  await page.waitForSelector('[data-name="Referencje"]', { timeout: 90_000 });
  await page.waitForSelector('a[download="zaswiadczenia.pdf"]', { timeout: 90_000 });
  await page.waitForSelector('a[download="dziennik.pdf"]', { timeout: 90_000 });
  await page.waitForSelector('a[download="ewaluacja.pdf"]', { timeout: 90_000 });
  await page.waitForSelector('a[download="referencje.pdf"]', { timeout: 90_000 });

  const concatPdfs = await pdfsFor(page, 'a[download="zaswiadczenia.pdf"]');
  const individualPdfs = await pdfsFor(
    page,
    '[data-name="Zaświadczenia"] [data-name="pojedyncze"] a[download]',
  );
  const listPdfs = await pdfsFor(page, 'a[download="dziennik.pdf"]');
  const evaluationPdfs = await pdfsFor(page, 'a[download="ewaluacja.pdf"]');
  const referencePdfs = await pdfsFor(page, 'a[download="referencje.pdf"]');

  console.log("MERGED:", JSON.stringify(concatPdfs.map(({ name, pages }) => ({ name, pages }))));
  console.log(
    "INDIVIDUAL:",
    JSON.stringify(individualPdfs.map(({ name, pages }) => ({ name, pages }))),
  );
  console.log("LIST:", JSON.stringify(listPdfs.map(({ name, pages }) => ({ name, pages }))));
  console.log(
    "EVALUATION:",
    JSON.stringify(evaluationPdfs.map(({ name, pages }) => ({ name, pages }))),
  );
  console.log(
    "REFERENCES:",
    JSON.stringify(referencePdfs.map(({ name, pages }) => ({ name, pages }))),
  );

  assert(concatPdfs.length === 1, `expected one merged certificate, got ${concatPdfs.length}`);
  assert(concatPdfs[0].magic === "%PDF-", "merged certificate is not a PDF");
  assert(concatPdfs[0].pages === 6, `merged certificate should be 6 pages, got ${concatPdfs[0].pages}`);

  assert(individualPdfs.length === 3, `expected 3 individual certificates, got ${individualPdfs.length}`);
  for (const pdf of individualPdfs) {
    assert(pdf.magic === "%PDF-", `not a PDF: ${pdf.name}`);
    assert(pdf.pages === 2, `zaświadczenie should be 2 pages: ${pdf.name}`);
    assert(/^\d{2}_.+\.pdf$/.test(pdf.name ?? ""), `unexpected zaświadczenie name: ${pdf.name}`);
  }

  assert(listPdfs.length === 1, `expected 1 attendance list, got ${listPdfs.length}`);
  assert(listPdfs[0].name === "dziennik.pdf", "unexpected list filename");
  assert(listPdfs[0].pages >= 5, `attendance list should be multi-page, got ${listPdfs[0].pages}`);

  assert(evaluationPdfs.length === 1, `expected 1 survey report, got ${evaluationPdfs.length}`);
  assert(evaluationPdfs[0].magic === "%PDF-", "survey report is not a PDF");
  assert(
    evaluationPdfs[0].pages === 2,
    `survey report should be 2 pages, got ${evaluationPdfs[0].pages}`,
  );

  assert(referencePdfs.length === 1, `expected 1 reference letter, got ${referencePdfs.length}`);
  assert(referencePdfs[0].magic === "%PDF-", "reference letter is not a PDF");
  assert(
    referencePdfs[0].pages === 1,
    `reference letter should be 1 page, got ${referencePdfs[0].pages}`,
  );

  const openAttrs = await page.$eval(
    '[data-name="Zaświadczenia"] [data-node="file"] a[data-role="open"]',
    (el) => ({ target: el.getAttribute("target"), href: el.getAttribute("href") ?? "" }),
  );
  assert(openAttrs.target === "_blank", "file name should open in a new tab");
  assert(openAttrs.href.startsWith("blob:"), "file name should link to the PDF blob");

  // 6b. Zip download preserves the tree.
  await page.waitForSelector('[data-testid="download-zip"]');
  const zip = await page.evaluate(async () => {
    const link = document.querySelector('[data-testid="download-zip"]');
    const bytes = new Uint8Array(await (await fetch(link.getAttribute("href"))).arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);
    return {
      name: link.getAttribute("download"),
      size: bytes.byteLength,
      magic: String.fromCharCode(...bytes.subarray(0, 2)),
      hasMerged: text.includes("zaswiadczenia.pdf"),
      hasIndividual: text.includes("pojedyncze/01_"),
      hasList: text.includes("dziennik.pdf"),
      hasEvaluation: text.includes("ewaluacja.pdf"),
      hasReferences: text.includes("referencje.pdf"),
    };
  });
  console.log("ZIP:", JSON.stringify(zip));
  assert(zip.magic === "PK", "zip magic missing");
  assert((zip.name ?? "").endsWith(".zip"), "zip filename should end with .zip");
  assert(
    zip.hasMerged && zip.hasIndividual && zip.hasList && zip.hasEvaluation && zip.hasReferences,
    "zip is missing expected entries",
  );

  // 7. Toggle off templates that require `prowadzacy`: the field disappears;
  // toggle them on again: the value persists.
  await page.click('[data-testid="template-lista_obecnosci"]');
  await page.click('[data-testid="template-ankieta_ewaluacyjna"]');
  await page.click('[data-testid="template-referencje"]');
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="meta-prowadzacy"]'),
    { timeout: 5_000 },
  );
  console.log("HIDDEN UNUSED FIELD OK");

  await page.click('[data-testid="template-lista_obecnosci"]');
  await page.click('[data-testid="template-ankieta_ewaluacyjna"]');
  await page.click('[data-testid="template-referencje"]');
  await page.waitForSelector('[data-testid="meta-prowadzacy"]');
  const persistedProwadzacy = await page.$eval(
    '[data-testid="meta-prowadzacy"]',
    (el) => el.value,
  );
  assert(
    persistedProwadzacy === "Jan Kowalski",
    `hidden meta value was not preserved: "${persistedProwadzacy}"`,
  );

  // 8. Reload: everything must come back.
  await sleep(700);
  await page.reload({ waitUntil: "networkidle0", timeout: 60_000 });
  await page.waitForSelector('[data-testid="active-project"]');
  await page.waitForSelector('[data-testid="meta-nazwa_szkolenia"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dataset-uczestnicy"] .leaf-status')?.textContent?.includes("os."),
    { timeout: 30_000 },
  );

  const restoredName = await page.$eval('[data-testid="meta-nazwa_szkolenia"]', (el) => el.value);
  const restoredNumer = await page.$eval('[data-testid="meta-numer_szkolenia"]', (el) => el.value);
  const restoredProwadzacy = await page.$eval(
    '[data-testid="meta-prowadzacy"]',
    (el) => el.value,
  );
  const restoredTemplates = await page.$$eval('.template-row input:checked', (els) => els.length);

  console.log(
    "AFTER RELOAD name:",
    restoredName,
    "numer:",
    restoredNumer,
    "prowadzacy:",
    restoredProwadzacy,
    "templates:",
    restoredTemplates,
  );
  assert(restoredName === "Szkolenie Testowe", "training name did not survive reload");
  assert(restoredNumer === "NR/9", "meta value did not survive reload");
  assert(restoredProwadzacy === "Jan Kowalski", "prowadzacy did not survive reload");
  assert(restoredTemplates === 4, "template selection did not survive reload");

  await page.click('[data-testid="dataset-ankieta"]');
  await page.waitForSelector('[data-testid="survey-editor"]');
  const restoredSurvey = await page.evaluate(() => ({
    rating: document.querySelector('[data-testid="survey-rating-tematyka"]')?.value ?? null,
    comments: [...document.querySelectorAll('[data-testid="survey-comment"]')].map(
      (element) => element.value,
    ),
  }));
  console.log(
    "SURVEY AFTER RELOAD:",
    JSON.stringify({ rating: restoredSurvey.rating, comments: restoredSurvey.comments.length }),
  );
  assert(
    restoredSurvey.rating === "4.9",
    `survey edit did not survive reload: ${restoredSurvey.rating}`,
  );
  assert(
    restoredSurvey.comments.includes("Dodatkowa uwaga testowa"),
    "survey comment did not survive reload",
  );

  // 9. IndexedDB stays plain JSON.
  const db = await page.evaluate(async () => {
    const database = await new Promise((res, rej) => {
      const request = indexedDB.open("mamapdf");
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
    const records = await new Promise((res, rej) => {
      const tx = database.transaction("projects");
      const request = tx.objectStore("projects").getAll();
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });

    let hasBinary = false;
    const walk = (value) => {
      if (!value || typeof value !== "object") return;
      if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        hasBinary = true;
        return;
      }
      for (const key of Object.keys(value)) walk(value[key]);
    };
    records.forEach(walk);

    const survey = records[0]?.datasets?.ankieta ?? null;
    return {
      count: records.length,
      jsonBytes: new TextEncoder().encode(JSON.stringify(records)).length,
      hasBinary,
      datasetKeys: Object.keys(records[0]?.datasets ?? {}).sort(),
      participantCount: records[0]?.datasets?.uczestnicy?.length ?? 0,
      surveyRatings: survey?.ratings?.length ?? 0,
      surveyHasRawRows: survey ? "rows" in survey || "columns" in survey : false,
      metaKeys: Object.keys(records[0]?.meta ?? {}).sort(),
      selected: records[0]?.selectedTemplates ?? [],
    };
  });

  console.log("DB:", JSON.stringify(db));
  assert(db.count === 1, "expected one project");
  assert(!db.hasBinary, "stored data must be plain JSON");
  assert(
    JSON.stringify(db.datasetKeys) === JSON.stringify(["ankieta", "uczestnicy"]),
    "unexpected dataset keys",
  );
  assert(db.participantCount === 3, "expected 3 persisted participants");
  assert(db.surveyRatings === 6, `expected 6 persisted survey ratings, got ${db.surveyRatings}`);
  assert(!db.surveyHasRawRows, "survey must not persist raw rows or columns");
  assert(db.selected.length === 4, "expected 4 selected templates");

  await page.screenshot({ path: path.join(root, "e2e.png"), fullPage: true });

  // 10. Second flow: Webinar KOT from the Zoom CSV.
  await page.click('[data-testid="new-project"]');
  await page.waitForSelector('[data-testid="flow-webinar-kot"]');
  await page.click('[data-testid="flow-webinar-kot"]');
  await page.waitForSelector('[data-testid="dataset-uczestnicy"]');

  await loadDataset(page, "uczestnicy", fixtures.webinar);
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="participant-row"]').length === 34,
    { timeout: 30_000 },
  );
  console.log(
    "WEBINAR:",
    await page.$eval('[data-testid="dataset-uczestnicy"] .leaf-status', (el) => el.textContent),
  );

  await page.click('[data-testid="active-project"]');
  await page.click('[data-testid="template-zaswiadczenie_kot"]');
  await page.waitForSelector('[data-testid="meta-nazwa_szkolenia"]');

  await setValue(page, '[data-testid="meta-nazwa_szkolenia"]', "Webinar KOT — wtorek rano");
  await setValue(page, '[data-testid="meta-data_szkolenia"]', "10.11.2026");
  await setValue(page, '[data-testid="meta-czas_trwania"]', "2 godz");
  await setValue(page, '[data-testid="meta-data_wystawienia"]', "10.11.2026");

  await page.waitForFunction(
    () => !document.querySelector('[data-testid="generate"]')?.hasAttribute("disabled"),
    { timeout: 10_000 },
  );
  await page.click('[data-testid="generate"]');
  await page.waitForSelector('[data-testid="results"]', { timeout: 120_000 });
  await page.waitForSelector('a[download="zaswiadczenia_kot.pdf"]', { timeout: 120_000 });

  const kotMerged = await pdfsFor(page, 'a[download="zaswiadczenia_kot.pdf"]');
  console.log("KOT MERGED:", JSON.stringify(kotMerged.map(({ name, pages }) => ({ name, pages }))));
  assert(kotMerged.length === 1, `expected one merged KOT pdf, got ${kotMerged.length}`);
  assert(kotMerged[0].magic === "%PDF-", "merged KOT pdf is not a PDF");
  assert(kotMerged[0].pages === 34, `merged KOT pdf should be 34 pages, got ${kotMerged[0].pages}`);

  // The individuals folder is collapsed by default (34 files).
  await page.click(
    '[data-name="Zaświadczenia (KOT)"] [data-name="pojedyncze"] .folder-toggle',
  );
  await page.waitForSelector(
    '[data-name="Zaświadczenia (KOT)"] [data-name="pojedyncze"] a[download]',
    { timeout: 10_000 },
  );

  const kotIndividual = await pdfsFor(
    page,
    '[data-name="Zaświadczenia (KOT)"] [data-name="pojedyncze"] a[download]',
  );
  console.log("KOT count:", kotIndividual.length, "first:", JSON.stringify(kotIndividual[0]));
  assert(kotIndividual.length === 34, `expected 34 KOT certificates, got ${kotIndividual.length}`);
  for (const pdf of kotIndividual) {
    assert(pdf.magic === "%PDF-", `not a PDF: ${pdf.name}`);
    assert(pdf.pages === 1, `KOT certificate should be 1 page: ${pdf.name}`);
    assert(/^\d{2}_.+\.pdf$/.test(pdf.name ?? ""), `unexpected KOT filename: ${pdf.name}`);
  }

  await page.waitForSelector('[data-testid="download-zip"]');
  const kotZip = await page.evaluate(async () => {
    const link = document.querySelector('[data-testid="download-zip"]');
    const bytes = new Uint8Array(await (await fetch(link.getAttribute("href"))).arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);
    return {
      name: link.getAttribute("download"),
      size: bytes.byteLength,
      magic: String.fromCharCode(...bytes.subarray(0, 2)),
      hasMerged: text.includes("zaswiadczenia_kot.pdf"),
      hasIndividual: text.includes("pojedyncze/01_"),
    };
  });
  console.log("KOT ZIP:", JSON.stringify(kotZip));
  assert(kotZip.magic === "PK", "KOT zip magic missing");
  assert((kotZip.name ?? "").endsWith(".zip"), "KOT zip filename should end with .zip");
  assert(kotZip.hasMerged && kotZip.hasIndividual, "KOT zip is missing expected entries");

  await page.screenshot({ path: path.join(root, "e2e-webinar.png"), fullPage: true });

  if (errors.length) {
    console.log("PAGE ERRORS:\n" + errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("E2E OK");
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
