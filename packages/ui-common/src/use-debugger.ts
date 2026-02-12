import { useState, useCallback } from "react";
import { DebugSession } from "@evmd/core";
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
  const [inputMode, setInputMode] = useState<"hex" | "mnemonic">("mnemonic");
  const [source, setSource] = useState("");

  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const execute = useCallback(async () => {
    const bytecode = source; // TODO: assemble if mnemonic mode
    const trace = await engine.execute({ bytecode, mode: "call" });
    setSession(new DebugSession(trace));
  }, [engine, source]);

  const wrap = useCallback(
    (fn: () => void) => {
      return () => {
        fn();
        rerender();
      };
    },
    [rerender]
  );

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
      const bp = session.addBreakpoint(condition);
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
