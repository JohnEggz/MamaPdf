import { useEffect, useRef, useState } from "react";
import type { DatasetEditorProps } from "../types";
import type { SurveyData } from "./survey";

function isSurveyData(value: unknown): value is SurveyData {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SurveyData>;
  return (
    typeof candidate.responseCount === "number" &&
    Array.isArray(candidate.ratings) &&
    Array.isArray(candidate.recommendation) &&
    Array.isArray(candidate.interests) &&
    Array.isArray(candidate.comments) &&
    Array.isArray(candidate.extraColumns)
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  integer = false,
  testId,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  integer?: boolean;
  testId: string;
  label: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value === null ? "" : String(value));
  }, [value]);

  const parse = (text: string): number | null => {
    const normalized = text.replace(",", ".").trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;

    const clamped = Math.min(max, Math.max(min, parsed));
    return integer ? Math.trunc(clamped) : clamped;
  };

  return (
    <input
      className="survey-number"
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      aria-label={label}
      data-testid={testId}
      value={draft}
      onFocus={(event) => {
        focused.current = true;
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = parse(event.target.value);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        focused.current = false;
        const parsed = parse(draft);
        const next = parsed ?? (integer ? 0 : null);
        setDraft(next === null ? "" : String(next));
        onChange(next);
      }}
    />
  );
}

export function AnkietaEditor({ value, onChange }: DatasetEditorProps<SurveyData>) {
  if (!isSurveyData(value)) {
    return (
      <div className="dataset-editor">
        <p className="hint">
          Ten projekt zawiera ankietę w starym formacie (surowy podgląd). Użyj
          „Wymień plik”, aby przetworzyć arkusz ponownie.
        </p>
      </div>
    );
  }

  const setRating = (key: string, average: number | null) => {
    onChange({
      ...value,
      ratings: value.ratings.map((rating) =>
        rating.key === key ? { ...rating, average } : rating,
      ),
    });
  };

  const setCount = (
    group: "recommendation" | "interests",
    key: string,
    count: number,
  ) => {
    onChange({
      ...value,
      [group]: value[group].map((entry) =>
        entry.key === key ? { ...entry, count } : entry,
      ),
    });
  };

  const updateComment = (index: number, comment: string) => {
    onChange({
      ...value,
      comments: value.comments.map((entry, i) => (i === index ? comment : entry)),
    });
  };

  const addComment = () => {
    onChange({ ...value, comments: [...value.comments, ""] });
  };

  const removeComment = (index: number) => {
    onChange({
      ...value,
      comments: value.comments.filter((_, i) => i !== index),
    });
  };

  const setExtraCount = (columnIndex: number, valueIndex: number, count: number) => {
    onChange({
      ...value,
      extraColumns: value.extraColumns.map((column, i) =>
        i === columnIndex
          ? {
              ...column,
              values: column.values.map((entry, j) =>
                j === valueIndex ? { ...entry, count } : entry,
              ),
            }
          : column,
      ),
    });
  };

  return (
    <div className="dataset-editor survey-editor" data-testid="survey-editor">
      <div className="editor-toolbar">
        <span data-testid="survey-response-count">{value.responseCount} odpowiedzi</span>
        <span className="muted">Dane przetworzone z arkusza — edytuj wartości lub uwagi.</span>
      </div>

      <section className="survey-section">
        <h3>Oceny</h3>
        <p className="hint">Średnia odpowiedzi w skali 1–5.</p>
        <div className="table-scroll survey-table-scroll">
          <table className="table-editor survey-table">
            <thead>
              <tr>
                <th>Kryterium</th>
                <th>Średnia</th>
                <th>Odpowiedzi</th>
              </tr>
            </thead>
            <tbody>
              {value.ratings.map((rating) => (
                <tr key={rating.key} data-testid="survey-rating-row">
                  <td title={rating.header}>{rating.label}</td>
                  <td>
                    <NumberField
                      value={rating.average}
                      onChange={(average) => setRating(rating.key, average)}
                      min={0}
                      max={5}
                      testId={`survey-rating-${rating.key}`}
                      label={rating.label}
                    />
                  </td>
                  <td className="survey-response-count-cell">{rating.responses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="survey-section">
        <h3>Rekomendacja kursu</h3>
        <p className="hint">Czy polecił/a by Pan/Pani kurs innym?</p>
        <div className="survey-count-grid">
          {value.recommendation.map((entry) => (
            <label key={entry.key} className="survey-count-field">
              <span>{entry.label}</span>
              <NumberField
                value={entry.count}
                onChange={(count) => setCount("recommendation", entry.key, count ?? 0)}
                min={0}
                max={9999}
                integer
                testId={`survey-recommendation-${entry.key}`}
                label={`Liczba odpowiedzi: ${entry.label}`}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="survey-section">
        <h3>Preferowane tematy kolejnych szkoleń</h3>
        <p className="hint">Liczba wskazań poszczególnych tematów.</p>
        <div className="table-scroll survey-table-scroll">
          <table className="table-editor survey-table">
            <thead>
              <tr>
                <th>Temat</th>
                <th>Wskazania</th>
              </tr>
            </thead>
            <tbody>
              {value.interests.map((entry) => (
                <tr key={entry.key} data-testid="survey-interest-row">
                  <td>{entry.label}</td>
                  <td>
                    <NumberField
                      value={entry.count}
                      onChange={(count) => setCount("interests", entry.key, count ?? 0)}
                      min={0}
                      max={9999}
                      integer
                      testId={`survey-interest-${entry.key}`}
                      label={`Liczba wskazań: ${entry.label}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="survey-section">
        <div className="survey-section-head">
          <h3>Uwagi</h3>
          <button
            type="button"
            className="button ghost"
            data-testid="survey-add-comment"
            onClick={addComment}
          >
            + Dodaj uwagę
          </button>
        </div>
        {value.comments.length === 0 && <p className="hint">Brak uwag.</p>}
        <div className="survey-comments">
          {value.comments.map((comment, index) => (
            <div className="survey-comment" key={index}>
              <textarea
                value={comment}
                data-testid="survey-comment"
                rows={2}
                placeholder="Uwaga uczestnika…"
                onChange={(event) => updateComment(index, event.target.value)}
              />
              <button
                type="button"
                className="row-remove"
                title="Usuń uwagę"
                onClick={() => removeComment(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {value.extraColumns.length > 0 && (
        <section className="survey-section">
          <h3>Pozostałe kolumny</h3>
          <p className="hint">
            Kolumny spoza standardowej ankiety, zliczone według wartości.
          </p>
          {value.extraColumns.map((column, columnIndex) => (
            <div className="survey-extra" key={`${column.header}-${columnIndex}`}>
              <h4 title={column.header}>{column.header}</h4>
              <div className="table-scroll survey-table-scroll">
                <table className="table-editor survey-table">
                  <thead>
                    <tr>
                      <th>Wartość</th>
                      <th>Liczba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {column.values.map((entry, valueIndex) => (
                      <tr key={`${entry.value}-${valueIndex}`}>
                        <td>{entry.value}</td>
                        <td>
                          <NumberField
                            value={entry.count}
                            onChange={(count) =>
                              setExtraCount(columnIndex, valueIndex, count ?? 0)
                            }
                            min={0}
                            max={9999}
                            integer
                            testId={`survey-extra-${columnIndex}-${valueIndex}`}
                            label={`Liczba wystąpień: ${entry.value}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
