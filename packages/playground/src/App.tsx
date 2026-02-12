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

export function App() {
  const engine = useMemo(() => new EthereumjsEngine(), []);

  return (
    <div className="app">
      <h1>EVM Debugger</h1>
      <EvmDebugger engine={engine} initialSource={EXAMPLE_SOURCE} />
    </div>
  );
}
