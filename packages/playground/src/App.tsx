import { useMemo } from "react";
import { EvmDebugger } from "@evmd/ui-web";
import { EthereumjsEngine } from "@evmd/engine";
import "./styles.css";

const EXAMPLE_SOURCE = `\
// Deploy a minimal contract and call it

PUSH11 0x625f5ff35f526003601df3
PUSH0
MSTORE

PUSH1 11
PUSH1 21
PUSH0
CREATE

PUSH1 1
PUSH1 32
PUSH0
PUSH0
PUSH0
DUP6
GAS
CALL

STOP
`;

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const bytecode = params.get("bytecode");
  const mode = params.get("mode");
  const calldata = params.get("calldata");
  if (!bytecode) return null;
  return {
    initialSource: bytecode,
    initialInputMode: "bytecode" as const,
    initialMode: (mode === "call" || mode === "deploy") ? mode : "deploy" as const,
    initialCalldata: calldata ?? undefined,
  };
}

const URL_PARAMS = getUrlParams();

export function App() {
  const engine = useMemo(() => new EthereumjsEngine(), []);
  const initial = URL_PARAMS ?? { initialSource: EXAMPLE_SOURCE };

  return (
    <div className="app">
      <h1>EVM Debugger</h1>
      <EvmDebugger engine={engine} {...initial} />
    </div>
  );
}
