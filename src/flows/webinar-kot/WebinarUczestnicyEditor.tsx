import type { DatasetEditorProps } from "../types";
import type { WebinarParticipant } from "./participants";

const COLUMNS: { key: keyof WebinarParticipant; label: string }[] = [
  { key: "imie_nazwisko", label: "Imię i nazwisko" },
  { key: "login", label: "Login" },
  { key: "email", label: "E-mail" },
];

const EMPTY: WebinarParticipant = {
  imie_nazwisko: "",
  login: "",
  email: "",
};

export function WebinarUczestnicyEditor({
  value,
  onChange,
}: DatasetEditorProps<WebinarParticipant[]>) {
  const update = (index: number, key: keyof WebinarParticipant, next: string) => {
    onChange(
      value.map((participant, i) =>
        i === index ? { ...participant, [key]: next } : participant,
      ),
    );
  };

  return (
    <div className="dataset-editor">
      <div className="editor-toolbar">
        <span>{value.length} uczestników</span>
        <button
          type="button"
          className="button ghost"
          onClick={() => onChange([...value, { ...EMPTY }])}
        >
          + Dodaj osobę
        </button>
      </div>

      <div className="table-scroll">
        <table className="table-editor">
          <thead>
            <tr>
              <th>#</th>
              {COLUMNS.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {value.map((participant, index) => (
              <tr key={index} data-testid="participant-row">
                <td className="row-index">{index + 1}</td>
                {COLUMNS.map((column) => (
                  <td key={column.key}>
                    <input
                      value={participant[column.key]}
                      data-field={column.key}
                      onChange={(event) => update(index, column.key, event.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="row-remove"
                    title="Usuń"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {value.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="empty-row">
                  Brak uczestników — dodaj osobę lub wczytaj inny plik.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
