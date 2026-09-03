from typing import TypedDict

class TrainingMeta(TypedDict):
    nazwa_szkolenia: str
    numer_szkolenia: str
    data_szkolenia: str
    miejsce_szkolenia: str
    prowadzacy: str
    czas_trwania: str
    czas_trwania_od_do: str
    data_wystawienia: str
    tematyka: str

class Participant(TypedDict):
    imie_nazwisko: str
    data_urodzenia: str
    miejsce_urodzenia: str
    placowka: str
    locked: bool

class TrainingDocument(TypedDict):
    training: TrainingMeta
    participants: list[Participant]
    # last_gen_training: TrainingMeta | None
    # last_gen_participants: list[Participant] | None
