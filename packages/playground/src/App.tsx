import { useMemo } from "react";
import { EvmDebugger } from "@evmd/ui-web";
import { EthereumjsEngine } from "@evmd/engine";
import "./styles.css";

export function App() {
  const engine = useMemo(() => new EthereumjsEngine(), []);

  return (
    <div className="app">
      <h1>EVM Debugger</h1>
      <EvmDebugger engine={engine} />
    </div>
  );
}
