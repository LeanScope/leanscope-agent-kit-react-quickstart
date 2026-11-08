import type { Step } from '../agent-server.types';

export function Transcript({ steps, pendingGuid }: { steps: Step[]; pendingGuid: string | null }) {
  const messages = steps.filter(
    (step) => step.guid !== pendingGuid && !step.pending && step.line?.trim(),
  );

  if (messages.length === 0) return <p className="empty">No messages yet.</p>;

  return (
    <div className="transcript" aria-live="polite">
      {messages.map((step) => {
        const fromUser = step.actorSymbolRef === 'human';
        return (
          <article className={`message${fromUser ? ' from-user' : ''}`} key={step.guid}>
            <header>
              {fromUser ? 'You' : step.title?.trim() || step.actorSymbolRef || 'Agent'}
            </header>
            <p>{fromUser ? answerText(step.line) : step.line}</p>
          </article>
        );
      })}
    </div>
  );
}

export function answerText(line: string): string {
  try {
    let answer: unknown = JSON.parse(line);
    let titles: Record<string, Record<string, string>> = {};
    if (isRecord(answer) && isRecord(answer['data']) && 'schema' in answer) {
      titles = choiceTitles(answer['schema']);
      answer = answer['data'];
    }
    if (isRecord(answer)) {
      const entries = Object.entries(answer).map(
        ([key, value]) => [key, titles[key]?.[String(value)] ?? value] as const,
      );
      if (entries.length === 1) {
        const [, value] = entries[0];
        return (typeof value === 'string' ? value : JSON.stringify(value)).trim();
      }
      return entries
        .map(
          ([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
        )
        .join('\n');
    }
    return typeof answer === 'string' ? answer : line;
  } catch {
    return line;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function choiceTitles(schema: unknown): Record<string, Record<string, string>> {
  const properties = isRecord(schema) && isRecord(schema['properties']) ? schema['properties'] : {};
  const titles: Record<string, Record<string, string>> = {};
  for (const [key, property] of Object.entries(properties)) {
    const options = isRecord(property) && Array.isArray(property['oneOf']) ? property['oneOf'] : [];
    for (const option of options) {
      if (isRecord(option) && 'const' in option && typeof option['title'] === 'string') {
        (titles[key] ??= {})[String(option['const'])] = option['title'];
      }
    }
  }
  return titles;
}
