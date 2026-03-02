import { useState, useCallback, useMemo, useRef } from "react";
import { DebugSession, assemble, disassemble } from "@evmd/core";
import type { Breakpoint, BreakpointCondition } from "@evmd/core";
import type { EvmEngine } from "@evmd/engine";
import type {
  DebuggerController,
  PanelName,
  PanelVisibility,
} from "./controller.js";

const defaultPanelVisibility: PanelVisibility = {
  stack: true,
  memory: true,
  storage: true,
  transientStorage: false,
  callStack: true,
  bytecode: true,
  returnData: true,
};

// Default addresses for execution
const DEFAULT_SENDER = "0x4f5b36c88Bf66720E9c3C07A0021587f5210635E";
const DEFAULT_CONTRACT = "0x6F98b11D0B9659Ba12BAaEcCF17F3D7128aEadc8";

export interface UseDebuggerOptions {
  initialSource?: string;
  initialMode?: "call" | "deploy";
  initialCalldata?: string;
}

export function useDebugger(engine: EvmEngine, options?: UseDebuggerOptions): DebuggerController {
  const [session, setSession] = useState<DebugSession | null>(null);
  const [, forceUpdate] = useState(0);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [visiblePanels, setVisiblePanels] = useState(defaultPanelVisibility);
  const [inputMode, setInputModeRaw] = useState<"bytecode" | "mnemonic">(
    "mnemonic"
  );
  const [executionMode, setExecutionMode] = useState<"call" | "deploy">(options?.initialMode ?? "deploy");
  const [calldata, setCalldata] = useState(options?.initialCalldata ?? "");
  const [error, setError] = useState<string | null>(null);

  // Dual-source state: each view has its own source text
  const [mnemonicSource, setMnemonicSource] = useState(options?.initialSource ?? "");
  const [bytecodeSource, setBytecodeSource] = useState("");
  // Track what the current mnemonic last assembled to, so we can detect
  // whether bytecode was edited and decide whether to restore comments.
  const lastAssembledBytecodeRef = useRef<string | null>(null);

  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const source = inputMode === "mnemonic" ? mnemonicSource : bytecodeSource;

  const setSource = useCallback(
    (s: string) => {
      if (inputMode === "mnemonic") {
        setMnemonicSource(s);
      } else {
        setBytecodeSource(s);
      }
    },
    [inputMode]
  );

  const setInputMode = useCallback(
    (newMode: "bytecode" | "mnemonic") => {
      if (newMode === inputMode) return;

      if (newMode === "bytecode") {
        // mnemonic → bytecode: try to assemble
        try {
          const result = assemble(mnemonicSource);
          setBytecodeSource(result);
          lastAssembledBytecodeRef.current = result;
          setError(null); // Clear error on success
        } catch (e) {
          // Assembly failed: show error but still switch modes
          setError(`Assembly error: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        // bytecode → mnemonic: check if bytecode was edited
        if (bytecodeSource === lastAssembledBytecodeRef.current) {
          // Bytecode unchanged: restore mnemonic with comments
          // (mnemonicSource already has the right value, do nothing)
          setError(null);
        } else {
          // Bytecode was edited: disassemble into new mnemonic
          try {
            setMnemonicSource(disassemble(bytecodeSource));
            setError(null);
          } catch (e) {
            // Disassembly failed: show error but still switch modes
            setError(`Disassembly error: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      setInputModeRaw(newMode);
    },
    [inputMode, mnemonicSource, bytecodeSource]
  );

  const execute = useCallback(async () => {
    try {
      let bytecode: string;
      if (inputMode === "mnemonic") {
        bytecode = assemble(mnemonicSource);
      } else {
        bytecode = bytecodeSource;
      }

      const trace = await engine.execute({
        bytecode,
        mode: executionMode,
        from: DEFAULT_SENDER,
        ...(executionMode === "call"
          ? {
              to: DEFAULT_CONTRACT,
              calldata: calldata || undefined,
            }
          : {}),
      });
      setSession(new DebugSession(trace));
      setError(null); // Clear error on successful execution
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [engine, inputMode, mnemonicSource, bytecodeSource, executionMode, calldata]);

  const stepForward = useCallback(() => {
    session?.stepForward();
    rerender();
  }, [session, rerender]);

  const stepBackward = useCallback(() => {
    session?.stepBackward();
    rerender();
  }, [session, rerender]);

  const stepOver = useCallback(() => {
    session?.stepOver();
    rerender();
  }, [session, rerender]);

  const stepOut = useCallback(() => {
    session?.stepOut();
    rerender();
  }, [session, rerender]);

  const jumpTo = useCallback(
    (index: number) => {
      session?.jumpTo(index);
      rerender();
    },
    [session, rerender]
  );

  const jumpToStart = useCallback(() => {
    session?.jumpToStart();
    rerender();
  }, [session, rerender]);

  const jumpToEnd = useCallback(() => {
    session?.jumpToEnd();
    rerender();
  }, [session, rerender]);

  const continueForward = useCallback(() => {
    session?.continueForward();
    rerender();
  }, [session, rerender]);

  const continueBackward = useCallback(() => {
    session?.continueBackward();
    rerender();
  }, [session, rerender]);

  const addBreakpoint = useCallback(
    (condition: BreakpointCondition) => {
      if (!session) return;
      session.addBreakpoint(condition);
      setBreakpoints(session.getBreakpoints());
    },
    [session]
  );

  const removeBreakpoint = useCallback(
    (id: string) => {
      if (!session) return;
      session.removeBreakpoint(id);
      setBreakpoints(session.getBreakpoints());
    },
    [session]
  );

  const resetState = useCallback(async () => {
    await engine.resetState();
    setSession(null);
  }, [engine]);

  const togglePanel = useCallback((panel: PanelName) => {
    setVisiblePanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    session,
    stepForward,
    stepBackward,
    stepOver,
    stepOut,
    canStepOver: session?.canStepOver() ?? false,
    canStepOut: session?.canStepOut() ?? false,
    jumpTo,
    jumpToStart,
    jumpToEnd,
    continueForward,
    continueBackward,
    addBreakpoint,
    removeBreakpoint,
    breakpoints,
    resetState,
    visiblePanels,
    togglePanel,
    inputMode,
    setInputMode,
    executionMode,
    setExecutionMode,
    source,
    setSource,
    calldata,
    setCalldata,
    execute,
    error,
    dismissError,
  };
}
