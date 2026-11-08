import { useMemo } from 'react';
import { HomePage } from './pages/HomePage';
import { SessionPage } from './pages/SessionPage';
import { LeanScopeSessionProvider } from './leanscope/LeanScopeSessionContext';
import { environment } from './environment';
import { LeanScopeSession } from './leanscope/leanscope-session';

export function App() {
  const session = useMemo(() => new LeanScopeSession(environment.leanscope), []);
  const isSession = window.location.pathname.replace(/\/+$/, '') === '/session';

  return (
    <LeanScopeSessionProvider session={session}>
      <header className="top">
        <a className="brand" href="/">
          LeanScope MVP
        </a>
      </header>
      <main>{isSession ? <SessionPage /> : <HomePage />}</main>
    </LeanScopeSessionProvider>
  );
}
