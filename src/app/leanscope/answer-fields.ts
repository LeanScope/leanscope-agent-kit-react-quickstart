import type { AnswerPropertySchema, PendingQuestion } from './agent-server.types';

export type AnswerFieldKind = 'text' | 'textarea' | 'number' | 'boolean' | 'choice' | 'json';

export interface AnswerChoice {
  value: unknown;
  label: string;
}

export interface AnswerField {
  key: string;
  label: string;
  description?: string;
  kind: AnswerFieldKind;
  required: boolean;
  choices: AnswerChoice[];
  initial: unknown;
}

export function answerFields(question: PendingQuestion): AnswerField[] {
  const properties = question.schema?.properties;
  if (!properties || Object.keys(properties).length === 0) {
    return [
      {
        key: 'message',
        label: 'Your answer',
        kind: 'text',
        required: true,
        choices: [],
        initial: question.prefill?.['message'] ?? '',
      },
    ];
  }

  const keys = question.fieldKeys.length > 0 ? question.fieldKeys : Object.keys(properties);
  return keys
    .filter((key) => properties[key])
    .map((key) => {
      const property = properties[key];
      const choices = choicesOf(property);
      const kind = choices.length > 0 ? 'choice' : kindOf(property);
      return {
        key,
        label: property.title ?? (key === 'message' ? 'Your answer' : humanize(key)),
        description: property.description,
        kind,
        required: question.required.includes(key),
        choices,
        initial: initialValue(kind, question.prefill?.[key] ?? property.default),
      };
    });
}

export function toAnswer(
  fields: AnswerField[],
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const answer: Record<string, unknown> = {};
  for (const field of fields) {
    const value = raw[field.key];
    switch (field.kind) {
      case 'boolean':
        answer[field.key] = Boolean(value);
        break;
      case 'number':
        if (value !== '' && value !== null && value !== undefined) {
          const number = Number(value);
          if (!Number.isFinite(number)) throw new Error(`"${field.label}" must be a valid number.`);
          answer[field.key] = number;
        }
        break;
      case 'json':
        if (typeof value === 'string' && value.trim()) {
          try {
            answer[field.key] = JSON.parse(value);
          } catch {
            throw new Error(`"${field.label}" is not valid JSON.`);
          }
        }
        break;
      case 'choice':
        if (value !== null && value !== undefined) answer[field.key] = value;
        break;
      default:
        if (typeof value === 'string' && value !== '') answer[field.key] = value;
    }
  }
  return answer;
}

function choicesOf(property: AnswerPropertySchema): AnswerChoice[] {
  if (Array.isArray(property.enum)) {
    return property.enum.map((value) => ({ value, label: String(value) }));
  }
  const options = property.oneOf ?? property.anyOf;
  if (
    Array.isArray(options) &&
    options.length > 0 &&
    options.every((option) => 'const' in option)
  ) {
    return options.map((option) => ({
      value: option.const,
      label: option.title ?? String(option.const),
    }));
  }
  return [];
}

function kindOf(property: AnswerPropertySchema): AnswerFieldKind {
  const types = Array.isArray(property.type) ? property.type : [property.type];
  if (types.includes('boolean')) return 'boolean';
  if (types.includes('number') || types.includes('integer')) return 'number';
  if (types.includes('string') || property.type === undefined) {
    return property.format === 'textarea' || (property.maxLength ?? 0) > 200 ? 'textarea' : 'text';
  }
  return 'json';
}

function initialValue(kind: AnswerFieldKind, value: unknown): unknown {
  if (kind === 'json') return value === undefined ? '' : JSON.stringify(value, null, 2);
  if (kind === 'boolean') return Boolean(value);
  if (kind === 'choice') return value ?? '';
  return value ?? '';
}

function humanize(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
