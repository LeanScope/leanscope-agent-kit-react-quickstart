import { describe, expect, it } from 'vitest';
import { SseParser } from './sse-parser';

describe('SseParser', () => {
  it('collects split frames, skips comments and ignores invalid JSON', () => {
    const parser = new SseParser();
    expect(parser.push(': heartbeat\nevent: step\ndata: {"guid":')).toEqual([]);
    expect(
      parser.push('"a"}\n\nevent: step\ndata: not-json\n\nevent: gate\ndata: {"state":"open"}\n\n'),
    ).toEqual([
      { event: 'step', data: { guid: 'a' } },
      { event: 'gate', data: { state: 'open' } },
    ]);
  });
});
