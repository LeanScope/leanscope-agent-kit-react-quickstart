import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { LeanScopeSession } from './leanscope-session';

const SessionContext = createContext<LeanScopeSession | null>(null);

export function LeanScopeSessionProvider({
  session,
  children,
}: {
  session: LeanScopeSession;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useLeanScopeSession() {
  const session = useContext(SessionContext);
  if (!session)
    throw new Error('useLeanScopeSession must be used within LeanScopeSessionProvider.');
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return { client: session, ...snapshot };
}
