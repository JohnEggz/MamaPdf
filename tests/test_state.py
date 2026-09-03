from johnmamapdfv2.state import AppState, create_empty_document


def test_empty_document() -> None:
    doc = create_empty_document()
    assert "training" in doc
    assert "participants" in doc
    assert doc["participants"] == []
    assert "nazwa_szkolenia" in doc["training"]
    assert "tematyka" in doc["training"]


def test_app_state_mutations() -> None:
    app_state = AppState()
    assert app_state.get_document()["participants"] == []

    # Add participant
    p = app_state.add_participant({"imie_nazwisko": "Anna Nowak", "data_urodzenia": "10.10.1990", "miejsce_urodzenia": "Warszawa", "placowka": "Szkoła", "locked": False})
    assert len(app_state.get_document()["participants"]) == 1
    assert p["imie_nazwisko"] == "Anna Nowak"

    # Update metadata
    app_state.update_training_meta({"nazwa_szkolenia": "Test Szkolenie", "numer_szkolenia": "123"})
    meta = app_state.get_document()["training"]
    assert meta["nazwa_szkolenia"] == "Test Szkolenie"
    assert meta["numer_szkolenia"] == "123"

    # Cell update
    assert app_state.update_participant_cell(0, "imie_nazwisko", "Anna Kowalska")
    assert app_state.get_document()["participants"][0]["imie_nazwisko"] == "Anna Kowalska"

    # Remove participant
    assert app_state.remove_participant(0)
    assert len(app_state.get_document()["participants"]) == 0
    assert not app_state.remove_participant(0)
