import { useEffect, useState } from 'react';
import { useLeanScopeSession } from '../leanscope/LeanScopeSessionContext';
import { PendingStepForm } from '../leanscope/ui/PendingStepForm';
import { Transcript } from '../leanscope/ui/Transcript';

const STATE_LABELS = {
  idle: 'Not started',
  connecting: 'Connecting…',
  waiting: 'Waiting to start',
  working: 'Agents are working…',
  asking: 'Your turn',
  ended: 'Ended',
  error: 'Error',
} as const;

export function SessionPage() {
  const { client, ...snapshot } = useLeanScopeSession();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!client.isActive) void client.start();
    return () => client.stop();
  }, [client]);

  async function answer(value: Record<string, unknown>) {
    setSending(true);
    try {
      await client.submit(value);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="session-page">
      <header className="bar">
        <h1>Session</h1>
        <span className="state" data-state={snapshot.state} aria-live="polite">
          {STATE_LABELS[snapshot.state]}
        </span>
        {snapshot.session && (
          <a href={snapshot.session.uiUrl} target="_blank" rel="noreferrer">
            Open in LeanScope
          </a>
        )}
      </header>

      {snapshot.error && (
        <p className="error" role="alert">
          {snapshot.error}
        </p>
      )}

      <Transcript steps={snapshot.steps} pendingGuid={snapshot.pendingQuestion?.guid ?? null} />

      {snapshot.pendingQuestion && (
        <PendingStepForm
          key={snapshot.pendingQuestion.guid}
          question={snapshot.pendingQuestion}
          busy={sending}
          onAnswered={answer}
        />
      )}

      {snapshot.state === 'waiting' && (
        <button type="button" onClick={() => void client.begin()}>
          Start
        </button>
      )}

      {(snapshot.state === 'ended' || snapshot.state === 'error') && (
        <footer className="bar">
          {snapshot.endReason && <span>The session ended ({snapshot.endReason}).</span>}
          <button type="button" onClick={() => void client.start()}>
            Start again
          </button>
          <a href="/">Back</a>
        </footer>
      )}
    </div>
  );
}
