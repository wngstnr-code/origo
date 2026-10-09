import { Suspense, lazy } from "react";
import { Landing } from "./landing/Landing";
import { usePath } from "./router";

// The app carries the hashing code, viem and (later) passkeys, so the landing never downloads it.
const AppRoot = lazy(() => import("./app/AppRoot"));

function App() {
  const path = usePath();
  if (path === "/app" || path.startsWith("/app/")) {
    return (
      <Suspense fallback={null}>
        <AppRoot path={path} />
      </Suspense>
    );
  }
  return <Landing />;
}

export default App;
