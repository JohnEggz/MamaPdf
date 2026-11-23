export interface TrainingMeta {
  nazwa_szkolenia: string;
  numer_szkolenia: string;
  data_szkolenia: string;
  miejsce_szkolenia: string;
  prowadzacy: string;
  czas_trwania: string;
  czas_trwania_od_do: string;
  data_wystawienia: string;
  tematyka: string;
}

export interface Participant {
  imie_nazwisko: string;
  data_urodzenia: string;
  miejsce_urodzenia: string;
  placowka: string;
  email: string;
}

/** Flow-local dataset shape for the training flow. */
export interface SzkolenieData {
  training: TrainingMeta;
  participants: Participant[];
}
