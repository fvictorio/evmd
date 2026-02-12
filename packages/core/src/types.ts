/** A complete execution trace. */
export interface Trace {
  /** The root call frame (the initial transaction). */
  root: Frame;
  /** Metadata about the execution. */
  metadata: TraceMetadata;
}

export interface TraceMetadata {
  /** Whether this was a deployment (initcode) or a regular call. */
  mode: "deploy" | "call";
  /** If mode is "deploy" and execution succeeded, the address of the deployed contract. */
  deployedAddress?: string;
  /** Whether the execution as a whole succeeded or reverted. */
  success: boolean;
  /** The return data of the root frame. */
  returnData: string;
  /** Total gas used. */
  gasUsed: bigint;
}

/** A single call frame (one per execution context). */
export interface Frame {
  /** Unique ID for this frame within the trace. */
  id: string;
  /** The type of call that created this frame. */
  type:
    | "CALL"
    | "STATICCALL"
    | "DELEGATECALL"
    | "CALLCODE"
    | "CREATE"
    | "CREATE2"
    | "ROOT";
  /** Address of the code being executed. */
  codeAddress: string;
  /** The bytecode being executed in this frame. */
  code: string;
  /** The input data (calldata for calls, initcode for creates). */
  input: string;
  /** The value sent with the call (in wei). */
  value: bigint;
  /** The caller address. */
  caller: string;
  /** Gas provided to this frame. */
  gas: bigint;
  /** Ordered list of execution steps in this frame. */
  steps: Step[];
  /** Child frames created by CALL/CREATE opcodes during execution. */
  children: ChildFrame[];
  /** The result of this frame. */
  result: FrameResult;
}

export interface ChildFrame {
  /** The child frame. */
  frame: Frame;
  /** The index in the parent's `steps` array where this child was created. */
  stepIndex: number;
}

export interface FrameResult {
  /** How the frame exited. */
  exitReason: FrameExitReason;
  returnData: string;
  gasUsed: bigint;
  /** For CREATE/CREATE2, the address of the deployed contract (if successful). */
  deployedAddress?: string;
}

/** How a frame's execution ended. */
export type FrameExitReason =
  | "success"
  | "revert"
  | "invalid"
  | "outOfGas"
  | "stackUnderflow"
  | "stackOverflow"
  | "invalidJump"
  | "writeProtection";

/** A single execution step within a frame. */
export interface Step {
  /** Program counter. */
  pc: number;
  /** The opcode number (0x00-0xFF). */
  opcode: number;
  /** The opcode mnemonic (e.g., "PUSH1", "MSTORE", "CALL"). */
  mnemonic: string;
  /** Gas remaining before this step. */
  gasRemaining: bigint;
  /** Gas cost of this opcode. */
  gasCost: bigint;
  /** The full stack BEFORE this opcode executes. Top of stack is index 0. */
  stack: string[];
  /** Memory state. */
  memory: MemoryState;
  /** Storage changes caused by this step (if any). */
  storageChanges: StorageChange[];
  /** Transient storage changes caused by this step (if any). */
  transientStorageChanges: StorageChange[];
  /** The depth of this step (for indentation in the UI, starts at 0 for root). */
  depth: number;
  /** Accumulated storage state (all touched slots) up to and including this step. */
  storage?: Record<string, string>;
}

export interface MemoryState {
  /** Memory contents BEFORE expansion (the "real" current memory). */
  current: string;
  /** If the opcode triggers memory expansion, the new total size in bytes
   *  AFTER expansion. Null if no expansion occurs. */
  expandedSize: number | null;
}

export interface StorageChange {
  /** The storage slot. */
  slot: string;
  /** Value before this step. */
  before: string;
  /** Value after this step. */
  after: string;
}

export interface OpcodeInfo {
  /** Opcode number. */
  code: number;
  /** Mnemonic name. */
  mnemonic: string;
  /** Names of the stack inputs, top of stack first. */
  inputNames: string[];
  /** Names of the outputs pushed to the stack. */
  outputNames: string[];
  /** Number of immediate bytes following the opcode. */
  immediateBytes: number;
}

export interface FlatStep {
  /** Reference to the frame this step belongs to. */
  frame: Frame;
  /** Index of this step within its frame (-1 for frame end). */
  stepIndex: number;
  /** The call stack at this step (from root to current frame, inclusive). */
  callStack: Frame[];
  /** True if this is a virtual "frame end" step showing the return. */
  isFrameEnd?: boolean;
}

export interface BreakpointCondition {
  /** Break when PC reaches this value (within any frame). */
  pc?: number;
  /** Break when this opcode is about to execute. */
  opcode?: number;
  /** Break when a specific storage slot is written to. */
  storageSlot?: string;
  /** Break at a specific global step index (useful for "run to cursor"). */
  globalStepIndex?: number;
}

export interface Breakpoint {
  id: string;
  condition: BreakpointCondition;
}
