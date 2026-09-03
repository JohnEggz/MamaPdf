/**
 * state.js - Reactive state store for the Dumb Puppeteer frontend.
 * Purely holds the visual data model and notifies subscribers on mutation.
 */

class AppStore {
  constructor() {
    this.document = {
      training: {
        nazwa_szkolenia: "",
        numer_szkolenia: "",
        data_szkolenia: "",
        miejsce_szkolenia: "",
        prowadzacy: "",
        czas_trwania: "",
        czas_trwania_od_do: "",
        data_wystawienia: "",
        tematyka: "",
      },
      participants: [],
    };
    this.activeProjectPath = null;
    this.storageProjects = [];
    this.listeners = new Set();
  }

  setActiveProjectPath(path) {
    this.activeProjectPath = path;
    this.notify("active_project");
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(changeType) {
    for (const listener of this.listeners) {
      listener(this, changeType);
    }
  }

  setDocument(doc, currentFile = null) {
    this.document = {
      training: {
        nazwa_szkolenia: doc?.training?.nazwa_szkolenia || "",
        numer_szkolenia: doc?.training?.numer_szkolenia || "",
        data_szkolenia: doc?.training?.data_szkolenia || "",
        miejsce_szkolenia: doc?.training?.miejsce_szkolenia || "",
        prowadzacy: doc?.training?.prowadzacy || "",
        czas_trwania: doc?.training?.czas_trwania || "",
        czas_trwania_od_do: doc?.training?.czas_trwania_od_do || "",
        data_wystawienia: doc?.training?.data_wystawienia || "",
        tematyka: doc?.training?.tematyka || "",
      },
      participants: Array.isArray(doc?.participants) ? doc.participants : [],
    };
    if (currentFile !== null) {
      this.currentFile = currentFile;
    }
    this.notify("document");
  }

  setParticipants(participants, currentFile = null) {
    this.document.participants = Array.isArray(participants) ? participants : [];
    if (currentFile !== null) {
      this.currentFile = currentFile;
    }
    this.notify("participants");
  }

  addParticipant(participant = null) {
    const item = participant || {
      imie_nazwisko: "",
      data_urodzenia: "",
      miejsce_urodzenia: "",
      placowka: "",
      locked: false,
    };
    this.document.participants.push(item);
    this.notify("participants_add");
    return item;
  }

  removeParticipant(index) {
    if (index >= 0 && index < this.document.participants.length) {
      this.document.participants.splice(index, 1);
      this.notify("participants_remove");
    }
  }

  updateParticipantCell(index, field, value) {
    if (index >= 0 && index < this.document.participants.length) {
      this.document.participants[index][field] = value;
      // Do not notify all subscribers on each keystroke to preserve cursor focus
    }
  }

  updateTrainingField(field, value) {
    if (field in this.document.training) {
      this.document.training[field] = value;
    }
  }

  setStorageProjects(projects) {
    this.storageProjects = Array.isArray(projects) ? projects : [];
    this.notify("storage");
  }

  setCurrentFile(filePath) {
    this.currentFile = filePath;
    this.notify("file");
  }
}

export const store = new AppStore();
