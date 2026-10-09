import { HASH_VERSION, PRODUCTION_RP_ID } from "@origo/sdk";

function App() {
  return (
    <main>
      <h1>Origo</h1>
      <p>Photo provenance that survives re-encoding, on Monad.</p>
      <p>
        Hash version {HASH_VERSION} · passkey domain {PRODUCTION_RP_ID}
      </p>
    </main>
  );
}

export default App;
