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
};

export function useDebugger(engine: EvmEngine): DebuggerController {
  const [session, setSession] = useState<DebugSession | null>(null);
  const [, forceUpdate] = useState(0);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [visiblePanels, setVisiblePanels] = useState(defaultPanelVisibility);
  const [inputMode, setInputModeRaw] = useState<"bytecode" | "mnemonic">(
    "mnemonic"
  );

  // Dual-source state: each view has its own source text
  const [mnemonicSource, setMnemonicSource] = useState("");
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
        } catch {
          // Assembly failed: keep old bytecodeSource as-is
        }
      } else {
        // bytecode → mnemonic: check if bytecode was edited
        if (bytecodeSource === lastAssembledBytecodeRef.current) {
          // Bytecode unchanged: restore mnemonic with comments
          // (mnemonicSource already has the right value, do nothing)
        } else {
          // Bytecode was edited: disassemble into new mnemonic
          try {
            setMnemonicSource(disassemble(bytecodeSource));
          } catch {
            // Disassembly failed: keep old mnemonicSource as-is
          }
        }
      }

      setInputModeRaw(newMode);
    },
    [inputMode, mnemonicSource, bytecodeSource]
  );

  const execute = useCallback(async () => {
    let bytecode: string;
    if (inputMode === "mnemonic") {
      bytecode = assemble(mnemonicSource);
    } else {
      bytecode = bytecodeSource;
    }
    const trace = await engine.execute({ bytecode, mode: "call" });
    setSession(new DebugSession(trace));
  }, [engine, inputMode, mnemonicSource, bytecodeSource]);

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

  return {
    session,
    stepForward,
    stepBackward,
    stepOver,
    stepOut,
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
    source,
    setSource,
    execute,
  };
}
