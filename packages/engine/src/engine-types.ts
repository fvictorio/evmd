import type { Trace } from "@evmd/core";

export interface EvmEngine {
  /** Execute bytecode and return a trace. */
  execute(params: ExecutionParams): Promise<Trace>;
  /** Get the current world state. */
  getState(): Promise<WorldState>;
  /** Reset the world state to its initial (empty) state. */
  resetState(): Promise<void>;
  /** Modify the world state. */
  setState(modifications: StateModifications): Promise<void>;
}

export interface ExecutionParams {
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
  /** Target address (where the runtime code lives). Only relevant in "call" mode. */
  to?: string;
  /** Gas limit. Defaults to 30_000_000. */
  gasLimit?: bigint;
  /** Block-level overrides. */
  block?: BlockOverrides;
}

export interface BlockOverrides {
  number?: bigint;
  timestamp?: bigint;
  baseFee?: bigint;
  coinbase?: string;
  gasLimit?: bigint;
  difficulty?: bigint;
  prevRandao?: string;
}

export interface WorldState {
  accounts: Map<string, AccountState>;
}

export interface AccountState {
  balance: bigint;
  nonce: bigint;
  code: string;
  storage: Map<string, string>;
}

export interface StateModifications {
  accounts?: Map<string, Partial<AccountState>>;
}
