import type { EvmEngine } from "@evmd/engine";
import { useDebugger } from "@evmd/ui-common";
import { BytecodeInput } from "./components/BytecodeInput.js";
import { ExecutionControls } from "./components/ExecutionControls.js";
import { StackView } from "./components/StackView.js";
import { MemoryView } from "./components/MemoryView.js";
import { StorageView } from "./components/StorageView.js";
import { BytecodeView } from "./components/BytecodeView.js";
import { CallStackView } from "./components/CallStackView.js";

export function EvmDebugger({ engine }: { engine: EvmEngine }) {
  const controller = useDebugger(engine);

  return (
    <div className="evmd">
      <BytecodeInput controller={controller} />
      <ExecutionControls controller={controller} />
      {controller.session && (
        <div className="evmd-panels">
          {controller.visiblePanels.bytecode && (
            <BytecodeView session={controller.session} />
          )}
          {controller.visiblePanels.stack && (
            <StackView session={controller.session} />
          )}
          {controller.visiblePanels.memory && (
            <MemoryView session={controller.session} />
          )}
          {controller.visiblePanels.storage && (
            <StorageView session={controller.session} />
          )}
          {controller.visiblePanels.callStack && (
            <CallStackView session={controller.session} />
          )}
        </div>
      )}
    </div>
  );
}
