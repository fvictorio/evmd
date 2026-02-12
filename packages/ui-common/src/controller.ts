import type { DebugSession, Breakpoint, BreakpointCondition } from "@evmd/core";

export type PanelName =
  | "stack"
  | "memory"
  | "storage"
  | "transientStorage"
  | "callStack"
  | "bytecode"
  | "returnData";

export interface PanelVisibility {
  stack: boolean;
  memory: boolean;
  storage: boolean;
  transientStorage: boolean;
  callStack: boolean;
  bytecode: boolean;
  returnData: boolean;
}

export interface DebuggerController {
  session: DebugSession | null;

  stepForward(): void;
  stepBackward(): void;
  stepOver(): void;
  stepOut(): void;
  jumpTo(index: number): void;
  jumpToStart(): void;
  jumpToEnd(): void;
  continueForward(): void;
  continueBackward(): void;

  addBreakpoint(condition: BreakpointCondition): void;
  removeBreakpoint(id: string): void;
  breakpoints: Breakpoint[];

  resetState(): Promise<void>;

  visiblePanels: PanelVisibility;
  togglePanel(panel: PanelName): void;

  inputMode: "bytecode" | "mnemonic";
  setInputMode(mode: "bytecode" | "mnemonic"): void;

  source: string;
  setSource(source: string): void;

  execute(): Promise<void>;
}
