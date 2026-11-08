import { environment } from '../environment';
import { missingConfig } from '../leanscope/leanscope.config';

export function HomePage() {
  const config = environment.leanscope;
  const missing = missingConfig(config);

  return (
    <>
      <h1>Your LeanScope MVP starts here</h1>
      <p>
        This app runs a LeanScope choreo through the Agent Server and shows the conversation. Ask
        your coding agent to build your MVP screens around it.
      </p>

      {missing.length === 0 ? (
        <section>
          <p>
            Choreo: <code>{config.choreoScenarioGuid}</code>
          </p>
          <a className="button" href="/session">
            Start session
          </a>
        </section>
      ) : (
        <section className="setup" aria-labelledby="setup-title">
          <h2 id="setup-title">Finish the setup</h2>
          <p>Still missing:</p>
          <ul>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            Don't know your choreo's guid? Ask your coding agent:{' '}
            <em>"Show me the choreos in my LeanScope repository."</em>
          </p>
        </section>
      )}
    </>
  );
}
