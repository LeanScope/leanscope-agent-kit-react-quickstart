import { describe, expect, it } from 'vitest';
import { answerFields, toAnswer } from './answer-fields';
import type { PendingQuestion } from './agent-server.types';

describe('answerFields', () => {
  it('creates fields from a question schema and converts entered values', () => {
    const question: PendingQuestion = {
      guid: 'question-1',
      fieldKeys: ['name', 'rating', 'accepted'],
      required: ['name'],
      schema: {
        properties: {
          name: { type: 'string', title: 'Your name' },
          rating: { type: 'integer', default: 3 },
          accepted: { type: 'boolean' },
        },
      },
    };
    const fields = answerFields(question);
    expect(fields.map(({ key, kind, required }) => [key, kind, required])).toEqual([
      ['name', 'text', true],
      ['rating', 'number', false],
      ['accepted', 'boolean', false],
    ]);
    expect(toAnswer(fields, { name: 'Ada', rating: '5', accepted: true })).toEqual({
      name: 'Ada',
      rating: 5,
      accepted: true,
    });
  });

  it('falls back to a plain-text answer and reports malformed JSON', () => {
    const fields = answerFields({ guid: 'q', fieldKeys: [], required: [] });
    expect(fields[0].key).toBe('message');
    expect(toAnswer(fields, { message: 'Hello' })).toEqual({ message: 'Hello' });

    const jsonField = answerFields({
      guid: 'q2',
      fieldKeys: ['data'],
      required: [],
      schema: { properties: { data: { type: 'object', title: 'Data' } } },
    });
    expect(() => toAnswer(jsonField, { data: '{' })).toThrow('"Data" is not valid JSON.');
  });

  it('preserves non-string choice values', () => {
    const fields = answerFields({
      guid: 'q3',
      fieldKeys: ['rating'],
      required: ['rating'],
      schema: { properties: { rating: { enum: [1, 2] } } },
    });
    expect(fields[0].choices.map((choice) => choice.value)).toEqual([1, 2]);
    expect(toAnswer(fields, { rating: 2 })).toEqual({ rating: 2 });
  });

  it('can submit an empty string when it is a valid choice', () => {
    const fields = answerFields({
      guid: 'q4',
      fieldKeys: ['choice'],
      required: ['choice'],
      schema: { properties: { choice: { enum: ['', 'other'] } } },
    });
    expect(toAnswer(fields, { choice: '' })).toEqual({ choice: '' });
  });
});
