import NetInfo from "@react-native-community/netinfo";
import { runSync } from "./engine";

let started = false;

export function startNetworkWatcher(): void {
  if (started) return;
  started = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      // Fire and forget; the engine serializes itself.
      runSync("netinfo");
    }
  });

  // Belt and braces: retry every 30s regardless.
  setInterval(() => {
    runSync("interval");
  }, 30_000);
}
