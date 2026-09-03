/**
 * api.js - Thin frontend wrapper around Eel WebSocket bridge.
 * JS remains the dumb puppeteer, triggering Python backend functions.
 */

// Helper to wait until eel is loaded in window
async function getEel() {
  if (window.eel) return window.eel;
  let attempts = 0;
  while (!window.eel && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    attempts++;
  }
  if (!window.eel) {
    throw new Error("Eel bridge is not available.");
  }
  return window.eel;
}

export async function apiGetInitialData() {
  const eel = await getEel();
  return await eel.api_get_initial_data()();
}

export async function apiPickSpreadsheet() {
  const eel = await getEel();
  return await eel.api_pick_spreadsheet()();
}

export async function apiPickJson() {
  const eel = await getEel();
  return await eel.api_pick_json()();
}

export async function apiSaveJson(targetPath = null) {
  const eel = await getEel();
  return await eel.api_save_json(targetPath)();
}

export async function apiLoadStorageProject(pathStr) {
  const eel = await getEel();
  return await eel.api_load_storage_project(pathStr)();
}

export async function apiGetStorageList() {
  const eel = await getEel();
  return await eel.api_get_storage_list()();
}

export async function apiUpdateTrainingMeta(meta) {
  const eel = await getEel();
  return await eel.api_update_training_meta(meta)();
}

export async function apiUpdateParticipants(participants) {
  const eel = await getEel();
  return await eel.api_update_participants(participants)();
}

export async function apiAddParticipant(participant = null) {
  const eel = await getEel();
  return await eel.api_add_participant(participant)();
}

export async function apiRemoveParticipant(index) {
  const eel = await getEel();
  return await eel.api_remove_participant(index)();
}

export async function apiGeneratePdfs(meta = null, participants = null) {
  const eel = await getEel();
  return await eel.api_generate_pdfs(meta, participants)();
}

export async function apiOpenExplorer(targetPath = null) {
  const eel = await getEel();
  return await eel.api_open_explorer(targetPath)();
}

export async function apiParseSurvey() {
  const eel = await getEel();
  return await eel.api_parse_survey()();
}

