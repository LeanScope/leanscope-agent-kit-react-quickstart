import { useState, type FormEvent } from 'react';
import type { PendingQuestion } from '../agent-server.types';
import { answerFields, toAnswer, type AnswerField } from '../answer-fields';

export function PendingStepForm({
  question,
  busy,
  onAnswered,
}: {
  question: PendingQuestion;
  busy: boolean;
  onAnswered: (answer: Record<string, unknown>) => void;
}) {
  const fields = answerFields(question);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.initial])),
  );
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setFormError(null);
      onAnswered(toAnswer(fields, values));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  function setValue(field: AnswerField, value: unknown) {
    setValues((current) => ({ ...current, [field.key]: value }));
  }

  return (
    <section className="answer-form">
      <form onSubmit={submit}>
        {fields.map((field) => (
          <label className={`field${field.kind === 'boolean' ? ' inline' : ''}`} key={field.key}>
            {field.kind === 'boolean' ? (
              <>
                <input
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  onChange={(event) => setValue(field, event.target.checked)}
                />
                <span>{field.label}</span>
              </>
            ) : (
              <>
                <span>
                  {field.label}
                  {field.required && (
                    <>
                      {' '}
                      <abbr title="required">*</abbr>
                    </>
                  )}
                </span>
                {renderInput(field, values[field.key], setValue)}
              </>
            )}
            {field.description && <small>{field.description}</small>}
          </label>
        ))}
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  );
}

function renderInput(
  field: AnswerField,
  value: unknown,
  setValue: (field: AnswerField, value: unknown) => void,
) {
  if (field.kind === 'textarea' || field.kind === 'json') {
    return (
      <textarea
        rows={field.kind === 'json' ? 6 : 4}
        className={field.kind === 'json' ? 'mono' : undefined}
        placeholder={field.kind === 'json' ? 'JSON' : undefined}
        required={field.required}
        value={String(value ?? '')}
        onChange={(event) => setValue(field, event.target.value)}
      />
    );
  }
  if (field.kind === 'number') {
    return (
      <input
        type="number"
        required={field.required}
        value={String(value ?? '')}
        onChange={(event) => setValue(field, event.target.value)}
      />
    );
  }
  if (field.kind === 'choice') {
    const selected = field.choices.findIndex((choice) => Object.is(choice.value, value));
    return (
      <select
        required={field.required}
        value={selected < 0 ? '' : String(selected)}
        onChange={(event) => {
          const selection = event.target.value;
          const index = selection === '' ? -1 : Number(selection);
          setValue(field, Number.isInteger(index) ? (field.choices[index]?.value ?? null) : null);
        }}
      >
        <option value="" disabled>
          Choose…
        </option>
        {field.choices.map((choice, index) => (
          <option value={index} key={index}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      autoComplete="off"
      required={field.required}
      value={String(value ?? '')}
      onChange={(event) => setValue(field, event.target.value)}
    />
  );
}
