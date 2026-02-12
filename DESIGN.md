# EVM Debugger — Design Document

## 1. Overview

This project is a **JavaScript/TypeScript EVM debugger** with a clean separation between a well-tested core and context-dependent UIs. The debugger captures a full execution trace and then allows the user to navigate it — stepping forward, backward, inspecting call frames, setting breakpoints, and viewing EVM state (stack, memory, storage, etc.).

There are two target UIs:

- **Terminal UI** (for integration into [evm-puzzles](https://github.com/fvictorio/evm-puzzles), a CLI-based EVM challenge game) — built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs).
- **Web UI** (for an EVM tutorial site with inline interactive debugger instances) — built with React.

A VS Code extension is a possible future target but is out of scope for now.

### Design principles

- **Simple things should be simple, complex things should be possible.** Running a bytecode snippet and stepping through it should require minimal setup. Deploying a contract and then calling it in a follow-up transaction should be possible but doesn't need to be a one-click flow.
- **Trace-first architecture.** Execution runs to completion first, producing a structured trace. All navigation, breakpoints, and state inspection happen over this immutable trace. This cleanly separates the execution engine from the debugger UI.
- **Engine abstraction.** All EVM execution is behind well-defined interfaces. The initial implementation uses `@ethereumjs/evm` and related packages, but the abstraction should make it feasible to swap in a different engine (e.g., REVM compiled to WASM) later.
- **Testability.** The core must be thoroughly tested with readable integration-style tests. It should be easy to write a test like "run this bytecode and assert that at step N the stack is X and storage slot Y is Z."

---

## 2. Architecture

The project is a monorepo with the following packages:

```
packages/
  core/          # Trace types, debugger navigation logic, assembler
  engine/        # EVM abstraction interface + ethereumjs implementation
  ui-common/     # Shared React components and hooks (consumed by both UIs)
  ui-web/        # Web (React) debugger UI
  ui-terminal/   # Terminal (Ink) debugger UI
```

### Dependency graph

```
ui-web ──────┐
              ├──▶ ui-common ──▶ core
ui-terminal ─┘                    ▲
                                  │
                               engine
```

- `core` has no dependency on `engine`. It consumes traces (plain data).
- `engine` implements the EVM abstraction and produces traces that conform to the types defined in `core`.
- `ui-common` contains shared hooks and logic (e.g., `useDebugger`) that operate on the core's `DebugSession` API.
- `ui-web` and `ui-terminal` are thin rendering layers.

### Package manager and tooling

- Use **pnpm workspaces** for the monorepo.
- Use **TypeScript** throughout (strict mode).
- Use **vitest** for testing.
- Use **tsup** or similar for building packages.

---

## 3. Core package (`packages/core`)

This is the heart of the project. It contains:

### 3.1 Trace types

A **trace** is the complete record of an EVM execution. It is a tree structure:

```typescript
/** A complete execution trace. */
interface Trace {
  /** The root call frame (the initial transaction). */
  root: Frame;
  /** Metadata about the execution. */
  metadata: TraceMetadata;
}

interface TraceMetadata {
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
interface Frame {
  /** Unique ID for this frame within the trace. */
  id: string;
  /** The type of call that created this frame. */
  type: "CALL" | "STATICCALL" | "DELEGATECALL" | "CALLCODE" | "CREATE" | "CREATE2" | "ROOT";
  /** Address of the code being executed. */
  codeAddress: string;
  /** The input data (calldata or initcode). */
  input: string;
  /** The value sent with the call (in wei). */
  value: bigint;
  /** The caller address. */
  caller: string;
  /** Gas provided to this frame. */
  gas: bigint;
  /** Ordered list of execution steps in this frame. */
  steps: Step[];
  /** Child frames created by CALL/CREATE opcodes during execution.
   *  Each child also stores the index into `steps` where it was spawned. */
  children: ChildFrame[];
  /** The result of this frame. */
  result: FrameResult;
}

interface ChildFrame {
  /** The child frame. */
  frame: Frame;
  /** The index in the parent's `steps` array where this child was created. */
  stepIndex: number;
}

interface FrameResult {
  /** How the frame exited. */
  exitReason: FrameExitReason;
  returnData: string;
  gasUsed: bigint;
  /** For CREATE/CREATE2, the address of the deployed contract (if successful). */
  deployedAddress?: string;
}

/** How a frame's execution ended. */
type FrameExitReason =
  | "success"       // STOP or RETURN
  | "revert"        // REVERT opcode (normal revert, returns data)
  | "invalid"       // INVALID opcode
  | "outOfGas"      // Out of gas
  | "stackUnderflow" // Not enough stack items
  | "stackOverflow"  // Stack exceeded 1024
  | "invalidJump"   // JUMP/JUMPI to non-JUMPDEST
  | "writeProtection" // Write operation in STATICCALL context;

/** A single execution step within a frame. */
interface Step {
  /** Program counter. */
  pc: number;
  /** The opcode number (0x00–0xFF). */
  opcode: number;
  /** The opcode mnemonic (e.g., "PUSH1", "MSTORE", "CALL"). */
  mnemonic: string;
  /** Gas remaining before this step. */
  gasRemaining: bigint;
  /** Gas cost of this opcode. */
  gasCost: bigint;
  /** The full stack BEFORE this opcode executes. Top of stack is index 0. */
  stack: string[];
  /** Memory state. See MemoryState below. */
  memory: MemoryState;
  /** Storage changes caused by this step (if any). */
  storageChanges: StorageChange[];
  /** Transient storage changes caused by this step (if any). */
  transientStorageChanges: StorageChange[];
  /** The depth of this step (for indentation in the UI, starts at 0 for root). */
  depth: number;
}

interface MemoryState {
  /** Memory contents BEFORE expansion (the "real" current memory). */
  current: string;
  /** If the opcode triggers memory expansion, the new total size in bytes
   *  AFTER expansion. The UI can use this to render the zero-filled expanded
   *  region (from current.length/2 to this value) in a different style.
   *  Null if no expansion occurs. */
  expandedSize: number | null;
}

interface StorageChange {
  /** The storage slot. */
  slot: string;
  /** Value before this step. */
  before: string;
  /** Value after this step. */
  after: string;
}
```

All hex strings are `0x`-prefixed and lowercase.

### 3.2 Opcode metadata

A static data structure mapping each EVM opcode to its metadata:

```typescript
interface OpcodeInfo {
  /** Opcode number. */
  code: number;
  /** Mnemonic name. */
  mnemonic: string;
  /** Names of the stack inputs, top of stack first.
   *  e.g., for CALL: ["gas", "address", "value", "argsOffset", "argsLength", "retOffset", "retLength"]
   *  Length of this array is the number of items popped from the stack. */
  inputNames: string[];
  /** Names of the outputs pushed to the stack.
   *  e.g., for CALL: ["success"]
   *  Length of this array is the number of items pushed to the stack. */
  outputNames: string[];
  /** Number of immediate bytes following the opcode (0 for most, 1 for PUSH1, 2 for PUSH2, etc.). */
  immediateBytes: number;
}
```

This must be manually maintained (or generated from a known source) and is the source of truth for stack annotations in the UI.

### 3.3 Assembler and disassembler

Two functions:

```typescript
/** Assemble mnemonic source into bytecode (hex string).
 *
 *  Input format (one instruction per line):
 *    PUSH1 0x60
 *    PUSH1 0x80
 *    MSTORE
 *    STOP
 *
 *  Immediate values for PUSH opcodes can be given as:
 *    - Hex: 0x60, 0xFF
 *    - Decimal: 96, 255
 *
 *  Empty lines and lines starting with // are ignored.
 */
function assemble(source: string): string;

/** Disassemble bytecode (hex string) into mnemonic source. */
function disassemble(bytecode: string): string;
```

These must handle all valid opcodes including all PUSH variants (PUSH0 through PUSH32), DUP1-DUP16, SWAP1-SWAP16, LOG0-LOG4, and invalid/unknown opcodes (output as `INVALID(0xNN)`).

### 3.4 Debug session

The `DebugSession` is the main API the UI interacts with. It wraps a `Trace` and provides navigation:

```typescript
interface DebugSession {
  /** The underlying trace. */
  readonly trace: Trace;

  /** Current position in the trace. */
  readonly currentFrame: Frame;
  readonly currentStepIndex: number;
  readonly currentStep: Step;

  /** Flattened list of all steps across all frames, in execution order.
   *  This is useful for "step over" behavior and for global step indexing. */
  readonly flatSteps: FlatStep[];
  readonly globalStepIndex: number;

  /** Navigation */
  stepForward(): void;
  stepBackward(): void;
  /** Step over a CALL — jump to the step after the child frame returns. */
  stepOver(): void;
  /** If inside a child frame, jump to the parent frame at the step that created this call. */
  stepOut(): void;
  /** Jump to an arbitrary global step index. */
  jumpTo(globalIndex: number): void;
  /** Jump to the start. */
  jumpToStart(): void;
  /** Jump to the end. */
  jumpToEnd(): void;

  /** Breakpoints */
  addBreakpoint(condition: BreakpointCondition): Breakpoint;
  removeBreakpoint(id: string): void;
  getBreakpoints(): Breakpoint[];
  /** Run forward to the next breakpoint hit. Returns false if no breakpoint is hit. */
  continueForward(): boolean;
  /** Run backward to the previous breakpoint hit. */
  continueBackward(): boolean;

  /** Call stack */
  /** Returns the chain of frames from root to current frame. */
  getCallStack(): Frame[];
}

interface FlatStep {
  /** Reference to the frame this step belongs to. */
  frame: Frame;
  /** Index of this step within its frame. */
  stepIndex: number;
}

interface BreakpointCondition {
  /** Break when PC reaches this value (within any frame). */
  pc?: number;
  /** Break when this opcode is about to execute. */
  opcode?: number;
  /** Break when a specific storage slot is written to. */
  storageSlot?: string;
  /** Break at a specific global step index (useful for "run to cursor"). */
  globalStepIndex?: number;
}

interface Breakpoint {
  id: string;
  condition: BreakpointCondition;
}
```

`DebugSession` is a class, not just an interface. It holds the navigation state and operates purely on the `Trace` data. It has no dependency on any EVM engine.

---

## 4. Engine package (`packages/engine`)

This package defines the EVM abstraction and provides the ethereumjs-based implementation.

### 4.1 EVM abstraction

```typescript
interface EvmEngine {
  /** Execute bytecode and return a trace.
   *  In "call" mode: the bytecode is treated as deployed runtime code at `params.to`,
   *  and a transaction is sent to it.
   *  In "deploy" mode: the bytecode is treated as initcode, executed directly,
   *  and the return data is the deployed contract code. */
  execute(params: ExecutionParams): Promise<Trace>;

  /** Get the current world state (for inspection). */
  getState(): Promise<WorldState>;

  /** Reset the world state to its initial (empty) state. */
  resetState(): Promise<void>;

  /** Modify the world state (for setting up pre-conditions). */
  setState(modifications: StateModifications): Promise<void>;
}

interface ExecutionParams {
  /** The bytecode to execute (hex string). */
  bytecode: string;
  /** "call" = treat as runtime code; "deploy" = treat as initcode. */
  mode: "call" | "deploy";
  /** Calldata (hex string). Only relevant in "call" mode. */
  calldata?: string;
  /** Value sent with the transaction (in wei). Defaults to 0. */
  value?: bigint;
  /** Sender address. Defaults to a well-known default address. */
  from?: string;
  /** Target address (where the runtime code lives). Only relevant in "call" mode.
   *  Defaults to a well-known default address. */
  to?: string;
  /** Gas limit. Defaults to a generous default (e.g., 30_000_000). */
  gasLimit?: bigint;
  /** Block-level overrides. */
  block?: BlockOverrides;
}

interface BlockOverrides {
  number?: bigint;
  timestamp?: bigint;
  baseFee?: bigint;
  coinbase?: string;
  gasLimit?: bigint;
  difficulty?: bigint;
  prevRandao?: string;
}

interface WorldState {
  accounts: Map<string, AccountState>;
}

interface AccountState {
  balance: bigint;
  nonce: bigint;
  code: string; // hex
  storage: Map<string, string>; // slot → value, both hex
}

interface StateModifications {
  accounts?: Map<string, Partial<AccountState>>;
}
```

### 4.2 ethereumjs implementation

The `EthereumjsEngine` class implements `EvmEngine` using `@ethereumjs/evm`, `@ethereumjs/vm`, `@ethereumjs/common`, `@ethereumjs/tx`, and related packages.

Key implementation details:

- Use the `evm.events` or step hooks provided by ethereumjs to capture each step during execution.
- Build the `Trace` tree by tracking call depth changes. When a CALL/CREATE opcode is encountered, a new child `Frame` is pushed. When the call returns, the frame is popped and attached to its parent.
- Capture full stack snapshots at each step (converting `Buffer`/`Uint8Array` to hex strings).
- Capture memory contents at each step. Detect memory expansion by comparing memory size before and after the step, and populate `MemoryState.expanded` accordingly.
- Track storage and transient storage changes using the appropriate hooks/events.
- The engine must persist state across `execute()` calls. Internally, it holds a `StateManager` (or equivalent) that retains account balances, storage, deployed code, nonces, etc.
- `resetState()` replaces the state manager with a fresh one.
- The `from` address should be pre-funded with a large ETH balance by default so that transactions don't fail due to insufficient funds.

### 4.3 Hardfork and chain configuration

Use the latest stable hardfork supported by ethereumjs. The configuration should be reasonable defaults (e.g., chain ID 1, latest block parameters). Do not overengineer configurability — just pick sensible defaults. If specific EVM features need a particular hardfork (e.g., transient storage requires Cancun), make sure that hardfork is active.

---

## 5. UI common package (`packages/ui-common`)

Shared logic between the two UIs. This package should NOT import React or Ink — it should be framework-agnostic hooks and utilities.

### 5.1 Core hook / controller

```typescript
/** State and actions for a debugger UI. */
interface DebuggerController {
  /** The debug session (null before first execution). */
  session: DebugSession | null;

  /** Execute bytecode and create a new debug session. */
  execute(params: ExecutionParams): Promise<void>;

  /** Navigation actions (delegate to session). */
  stepForward(): void;
  stepBackward(): void;
  stepOver(): void;
  stepOut(): void;
  jumpTo(index: number): void;
  jumpToStart(): void;
  jumpToEnd(): void;
  continueForward(): void;
  continueBackward(): void;

  /** Breakpoint management. */
  addBreakpoint(condition: BreakpointCondition): void;
  removeBreakpoint(id: string): void;
  breakpoints: Breakpoint[];

  /** World state management. */
  resetState(): Promise<void>;

  /** Visibility toggles for UI panels. */
  visiblePanels: PanelVisibility;
  togglePanel(panel: PanelName): void;

  /** Input mode. */
  inputMode: "hex" | "mnemonic";
  setInputMode(mode: "hex" | "mnemonic"): void;

  /** The current bytecode source (in whatever inputMode is active). */
  source: string;
  setSource(source: string): void;
}

type PanelName = "stack" | "memory" | "storage" | "transientStorage" | "callStack" | "bytecode";

interface PanelVisibility {
  stack: boolean;
  memory: boolean;
  storage: boolean;
  transientStorage: boolean;
  callStack: boolean;
  bytecode: boolean;
}
```

For the React/Ink UIs, provide a React hook `useDebugger(engine: EvmEngine): DebuggerController` that wraps this in React state. But the logic itself should be extractable for testing.

### 5.2 Display utilities

Functions for formatting EVM data for display:

- `formatStack(step: Step, opcodeInfo: OpcodeInfo): AnnotatedStackItem[]` — Returns the stack with parameter name annotations for the items that are inputs to the current opcode.
- `formatMemory(memory: MemoryState): MemoryDisplayRegion[]` — Segments memory into 32-byte rows, marking expanded regions.
- `formatStorage(changes: StorageChange[]): ...` — Formats storage changes for display.
- `formatBytecode(bytecode: string, currentPc: number, breakpoints: Breakpoint[]): AnnotatedBytecodeItem[]` — Disassembles the bytecode and marks the current instruction and breakpoints.

These are pure functions, easily testable, and shared between UIs.

---

## 6. UI packages

### 6.1 Web UI (`packages/ui-web`)

A React application. The debugger should be usable as an embeddable component (for the EVM tutorial site) as well as a standalone page.

Key components:

- **`<EvmDebugger />`** — The top-level component. Takes an `EvmEngine` as a prop.
- **`<BytecodeInput />`** — Text area for hex or mnemonic input, with a mode toggle.
- **`<ExecutionControls />`** — Buttons for step forward/back, step over, step out, continue, and a mode selector (call/deploy).
- **`<StackView />`** — Displays the stack with opcode parameter annotations.
- **`<MemoryView />`** — Displays memory in 32-byte rows with expansion highlighting.
- **`<StorageView />`** — Displays storage slots and their changes.
- **`<TransientStorageView />`** — Same as StorageView but for transient storage.
- **`<CallStackView />`** — Shows the chain of frames from root to current.
- **`<BytecodeView />`** — Shows the disassembled bytecode with the current PC highlighted and breakpoints marked. Clicking a line sets a breakpoint.
- **`<PanelToggles />`** — Checkboxes/buttons to show/hide each panel.

For styling, use a minimal approach. Tailwind or plain CSS modules are both fine. The look should be functional and clean — think developer tools, not flashy.

### 6.2 Terminal UI (`packages/ui-terminal`)

An Ink application with equivalent functionality.

Key considerations:

- Ink components mirror the web components but adapted for terminal rendering (box drawing, colored text, etc.).
- The terminal has limited space. Panels should be arranged efficiently — probably a horizontal split with bytecode on the left and stack/memory/storage on the right, with the controls at the bottom.
- Use keyboard shortcuts for navigation (e.g., `n` = step forward, `p` = step backward, `s` = step over, `o` = step out, `c` = continue, `b` = toggle breakpoint at current line).
- The terminal UI must work well in typical terminal sizes (80×24 minimum, but should take advantage of larger terminals).

---

## 7. Testing strategy

### 7.1 Core tests

Test the `DebugSession` class with hand-crafted `Trace` objects. This tests navigation, breakpoints, step over/out, call stack, etc. without needing any EVM engine. Examples:

- Create a trace with 10 steps, step forward 5 times, assert position.
- Step backward past the beginning, assert it stays at 0.
- Create a trace with a child frame, step over it, assert position.
- Set a breakpoint at PC=5, continue forward, assert position.

### 7.2 Assembler/disassembler tests

- Assemble known mnemonics and assert the hex output.
- Disassemble known hex and assert the mnemonic output.
- Round-trip: `disassemble(assemble(source))` should produce equivalent output.
- Edge cases: PUSH0, PUSH32, invalid opcodes, empty input.

### 7.3 Engine integration tests

These test the `EthereumjsEngine` by executing real bytecode and asserting trace properties. These are the most important tests for correctness. Examples:

```typescript
// Test: simple PUSH and STOP
test("PUSH1 0x42 STOP produces correct trace", async () => {
  const engine = new EthereumjsEngine();
  const trace = await engine.execute({
    bytecode: "0x604200", // PUSH1 0x42, STOP
    mode: "call",
  });

  expect(trace.root.steps).toHaveLength(2);

  // Step 0: PUSH1
  expect(trace.root.steps[0].mnemonic).toBe("PUSH1");
  expect(trace.root.steps[0].pc).toBe(0);
  expect(trace.root.steps[0].stack).toEqual([]);

  // Step 1: STOP
  expect(trace.root.steps[1].mnemonic).toBe("STOP");
  expect(trace.root.steps[1].pc).toBe(2);
  expect(trace.root.steps[1].stack).toEqual(["0x42"]);
});

// Test: SSTORE and persistent state
test("storage persists across executions", async () => {
  const engine = new EthereumjsEngine();

  // First execution: SSTORE(0, 0x42)
  await engine.execute({
    bytecode: "0x604260005500", // PUSH1 0x42, PUSH1 0x00, SSTORE, STOP
    mode: "call",
  });

  // Second execution: SLOAD(0) should return 0x42
  const trace = await engine.execute({
    bytecode: "0x60005460005260206000F3", // PUSH1 0, SLOAD, ..., RETURN
    mode: "call",
  });

  // Assert return data is 0x42 (left-padded to 32 bytes)
  expect(trace.metadata.returnData).toBe("0x" + "00".repeat(31) + "42");
});

// Test: deployment mode
test("deploy mode returns deployed address", async () => {
  const engine = new EthereumjsEngine();

  // Initcode that returns 0xFE as the runtime code
  // PUSH1 0xFE PUSH1 0x00 MSTORE8 PUSH1 0x01 PUSH1 0x00 RETURN
  const trace = await engine.execute({
    bytecode: "0x60FE60005360016000F3",
    mode: "deploy",
  });

  expect(trace.metadata.mode).toBe("deploy");
  expect(trace.metadata.success).toBe(true);
  expect(trace.metadata.deployedAddress).toBeDefined();
});

// Test: CALL creates child frame
test("CALL creates a child frame in the trace", async () => {
  // Set up: deploy a contract that returns 0x42, then call it
  const engine = new EthereumjsEngine();

  // ... setup code deploying a contract, then calling it ...

  // Assert the trace has a root frame with one child frame
  expect(trace.root.children).toHaveLength(1);
  expect(trace.root.children[0].frame.type).toBe("CALL");
});
```

### 7.4 Assembler ↔ Engine round-trip tests

Write tests that:
1. Start from mnemonic source.
2. Assemble it to bytecode.
3. Execute the bytecode.
4. Assert trace properties.

This validates the full pipeline and is the most readable test format. Prefer this style for most tests.

### 7.5 Test organization

```
packages/core/test/
  debug-session.test.ts    # Navigation, breakpoints, call stack
  assembler.test.ts        # Assemble, disassemble, round-trip
  opcode-metadata.test.ts  # Validate opcode table completeness/correctness

packages/engine/test/
  ethereumjs-engine.test.ts   # Integration tests with real execution
  persistent-state.test.ts    # State persistence and reset
  call-frames.test.ts         # CALL, STATICCALL, CREATE, CREATE2 traces
  memory-expansion.test.ts    # Memory expansion tracking
```

---

## 8. Implementation plan

Implement in this order. Each phase should be fully working and tested before moving on.

### Phase 1: Foundation

1. Set up the monorepo (pnpm workspaces, TypeScript, vitest).
2. Implement the opcode metadata table in `core`.
3. Implement the assembler and disassembler in `core`. Write thorough tests.
4. Define all the trace types in `core` (the interfaces from section 3.1).

### Phase 2: Engine

5. Implement `EthereumjsEngine` in `engine`. Start with simple bytecode execution (no calls, no deploys).
6. Write integration tests: basic opcodes, stack operations, memory, storage.
7. Add deployment mode support.
8. Add call frame tracking (CALL, STATICCALL, DELEGATECALL, CREATE, CREATE2).
9. Add persistent state and reset.
10. Add memory expansion tracking.
11. Add transient storage tracking.

### Phase 3: Debug session

12. Implement `DebugSession` in `core`. Start with step forward/backward and basic navigation.
13. Add step over, step out, call stack.
14. Add breakpoints and continue forward/backward.
15. Write thorough unit tests with hand-crafted traces.

### Phase 4: UI common

16. Implement display utilities (stack annotation, memory formatting, bytecode annotation).
17. Implement the `useDebugger` hook / `DebuggerController`.

### Phase 5: Terminal UI

18. Build the Ink-based terminal UI.
19. Wire up keyboard shortcuts.
20. Test manually with evm-puzzles-style bytecodes.

### Phase 6: Web UI

21. Build the React-based web UI.
22. Make it embeddable as a component.
23. Test manually with tutorial-style examples.

---

## 9. Open questions and future work

- **Mid-execution state modification.** Deferred. The trace-first approach makes this complex since modifying state would require re-execution from that point. The engine abstraction should not preclude this, but it's not part of the initial implementation.
- **Yul/Solidity compilation.** Out of scope. Could be added as an input mode later.
- **VS Code extension.** Out of scope. The core and engine packages should be reusable, but the VS Code UI layer would be a separate project.
- **Source maps.** Not needed now, but if Solidity support is added later, source maps would allow mapping steps back to Solidity lines.
- **Gas profiling.** The trace captures gas info. A gas profiling view could be built on top of this data.
- **REVM backend.** The `EvmEngine` interface is designed to make this swap possible. A future `RevmEngine` would compile REVM to WASM and implement the same interface.