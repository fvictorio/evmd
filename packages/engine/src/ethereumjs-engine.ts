import type { Trace } from "@evmd/core";
import type {
  EvmEngine,
  ExecutionParams,
  WorldState,
  StateModifications,
} from "./engine-types.js";

/** Stub EthereumJS-based EVM engine. Will be implemented using @ethereumjs/evm later. */
export class EthereumjsEngine implements EvmEngine {
  async execute(_params: ExecutionParams): Promise<Trace> {
    // Stub: return a minimal trace
    throw new Error("EthereumjsEngine.execute() not yet implemented");
  }

  async getState(): Promise<WorldState> {
    throw new Error("EthereumjsEngine.getState() not yet implemented");
  }

  async resetState(): Promise<void> {
    throw new Error("EthereumjsEngine.resetState() not yet implemented");
  }

  async setState(_modifications: StateModifications): Promise<void> {
    throw new Error("EthereumjsEngine.setState() not yet implemented");
  }
}
