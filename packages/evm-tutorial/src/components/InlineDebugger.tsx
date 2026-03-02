import { useEffect, useMemo, useState, useCallback } from "react";
import { EthereumjsEngine } from "@evmd/engine";
import { useDebugger } from "@evmd/ui-common";
import { BytecodeView, StackView, MemoryView } from "@evmd/ui-web";

export interface InlineDebuggerProps {
  /** The mnemonic source code to execute */
  source: string;
  /** Execution mode: "deploy" (default) or "call" */
  mode?: "deploy" | "call";
  /** Calldata for call mode (hex string) */
  calldata?: string;
  /** Show the memory panel */
  showMemory?: boolean;
}

export function InlineDebugger({ source, mode = "deploy", calldata, showMemory = false }: InlineDebuggerProps) {
  const engine = useMemo(() => new EthereumjsEngine(), []);
  const controller = useDebugger(engine, {
    initialSource: source,
    initialMode: mode,
    initialCalldata: calldata,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Auto-execute on mount
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await controller.execute();
      if (mounted) {
        setIsLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCalldataChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    controller.setCalldata(e.target.value);
  }, [controller]);

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    await controller.execute();
    setIsLoading(false);
  }, [controller]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRun();
    }
  }, [handleRun]);

  const { session } = controller;
  const totalSteps = session?.flatSteps.length ?? 0;
  const currentStep = (session?.globalStepIndex ?? 0) + 1;

  return (
    <div className="inline-debugger">
      {mode === "call" && (
        <div className="inline-debugger-calldata">
          <span className="inline-debugger-calldata-label">Calldata:</span>
          <input
            className="inline-debugger-calldata-input"
            value={controller.calldata}
            onChange={handleCalldataChange}
            onKeyDown={handleKeyDown}
            placeholder="0x..."
            spellCheck={false}
          />
          <button onClick={handleRun} className="inline-debugger-run-btn">
            Run
          </button>
        </div>
      )}
      {controller.error && (
        <div className="inline-debugger-error">{controller.error}</div>
      )}
      {isLoading && !controller.error && (
        <div className="inline-debugger-loading">Loading...</div>
      )}
      {!isLoading && !controller.error && !session && (
        <div className="inline-debugger-loading">No session</div>
      )}
      {session && !controller.error && (
        <>
          <div className="inline-debugger-controls">
        <button
          onClick={controller.jumpToStart}
          disabled={session.globalStepIndex === 0}
          title="Jump to start"
        >
          |◀
        </button>
        <button
          onClick={controller.stepBackward}
          disabled={session.globalStepIndex === 0}
          title="Step backward"
        >
          ◀
        </button>
        <span className="inline-debugger-step-counter">
          {currentStep} / {totalSteps}
        </span>
        <button
          onClick={controller.stepForward}
          disabled={session.globalStepIndex === totalSteps - 1}
          title="Step forward"
        >
          ▶
        </button>
        <button
          onClick={controller.jumpToEnd}
          disabled={session.globalStepIndex === totalSteps - 1}
          title="Jump to end"
        >
          ▶|
        </button>
      </div>
          <div className="inline-debugger-panels">
            <BytecodeView session={session} autoScroll={false} />
            <StackView session={session} />
          </div>
          {showMemory && (
            <div className="inline-debugger-memory">
              <MemoryView session={session} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
