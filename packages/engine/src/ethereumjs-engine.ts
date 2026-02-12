import { createEVM } from "@ethereumjs/evm";
import type { EVM, InterpreterStep, EVMResult, Message } from "@ethereumjs/evm";
import {
  hexToBytes,
  bytesToHex,
  createAddressFromString,
} from "@ethereumjs/util";
import type { Trace, Frame, Step, FrameExitReason, ChildFrame } from "@evmd/core";
import type {
  EvmEngine,
  ExecutionParams,
  WorldState,
  StateModifications,
} from "./engine-types.js";

const DEFAULT_CALLER = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
const DEFAULT_TO = "0x1000000000000000000000000000000000000001";
const DEFAULT_GAS_LIMIT = 30_000_000n;

function mapExceptionToReason(error: unknown): FrameExitReason {
  const msg = String(
    (error as { error?: string })?.error ??
      (error as { message?: string })?.message ??
      error
  ).toLowerCase();
  if (msg.includes("revert")) return "revert";
  if (msg.includes("out of gas")) return "outOfGas";
  if (msg.includes("stack underflow")) return "stackUnderflow";
  if (msg.includes("stack overflow")) return "stackOverflow";
  if (msg.includes("invalid jump")) return "invalidJump";
  if (msg.includes("static")) return "writeProtection";
  return "invalid";
}

export class EthereumjsEngine implements EvmEngine {
  private evmPromise: Promise<EVM> | null = null;

  private getEvm(): Promise<EVM> {
    if (!this.evmPromise) {
      this.evmPromise = createEVM({ allowUnlimitedContractSize: true });
    }
    return this.evmPromise;
  }

  async execute(params: ExecutionParams): Promise<Trace> {
    const evm = await this.getEvm();

    // Frame stack for building the call tree
    let frameIdCounter = 0;
    const frameStack: Frame[] = [];
    let rootFrame: Frame | null = null;
    // Track accumulated storage state per frame (keyed by frame id)
    const frameStorageMap = new Map<string, Record<string, string>>();

    const stepHandler = async (data: InterpreterStep, resolve?: () => void) => {
      const currentFrame = frameStack[frameStack.length - 1];
      if (!currentFrame) {
        resolve?.();
        return;
      }

      // data.stack is a live reference — must copy
      const stack = [...data.stack]
        .reverse()
        .map((v) => "0x" + v.toString(16));

      const memHex =
        data.memory.length > 0 ? bytesToHex(data.memory) : "0x";

      // Get or create accumulated storage for this frame
      let frameStorage = frameStorageMap.get(currentFrame.id);
      if (!frameStorage) {
        frameStorage = {};
        frameStorageMap.set(currentFrame.id, frameStorage);
      }

      // Copy current accumulated storage state for this step (BEFORE this opcode executes)
      const storage = Object.keys(frameStorage).length > 0
        ? { ...frameStorage }
        : undefined;

      // Capture storage changes for SSTORE opcode (0x55)
      const storageChanges: Step["storageChanges"] = [];
      if (data.opcode.code === 0x55 && stack.length >= 2) {
        const slot = stack[0]; // slot is at top of stack
        const newValue = stack[1]; // value is second from top
        try {
          const address = createAddressFromString(currentFrame.codeAddress);
          const slotBytes = hexToBytes(
            ("0x" + BigInt(slot).toString(16).padStart(64, "0")) as `0x${string}`
          );
          const currentValue = await evm.stateManager.getStorage(address, slotBytes);
          const before =
            currentValue.length > 0 ? bytesToHex(currentValue) : "0x0";
          storageChanges.push({
            slot,
            before,
            after: newValue,
          });
          // Update accumulated storage state AFTER snapshotting for this step
          // so the next step will see the updated value
          frameStorage[slot] = newValue;
        } catch {
          // Ignore errors reading storage
        }
      }

      currentFrame.steps.push({
        pc: data.pc,
        opcode: data.opcode.code,
        mnemonic: data.opcode.name,
        gasRemaining: data.gasLeft,
        gasCost:
          BigInt(data.opcode.fee) + (data.opcode.dynamicFee ?? 0n),
        stack,
        memory: { current: memHex, expandedSize: null },
        storageChanges,
        transientStorageChanges: [],
        depth: data.depth,
        storage,
      });

      resolve?.();
    };

    const beforeMessageHandler = (data: Message, resolve?: (result?: unknown) => void) => {
      const isRoot = frameStack.length === 0;
      const parentFrame = frameStack[frameStack.length - 1];

      // Determine the code being executed in this frame.
      // Priority:
      // 1. data.code (if it's a Uint8Array) - this is the code for CALL operations
      // 2. data.data (if it has content) - this is the initcode for CREATE or the code for deploy mode
      let code = "0x";
      if (data.code && data.code instanceof Uint8Array) {
        code = bytesToHex(data.code);
      } else if (data.data && data.data.length > 0) {
        code = bytesToHex(data.data);
      }

      // Determine frame type by looking at the parent's opcode that spawned this frame
      // This is more reliable than data.isCreate which is often incorrect
      let frameType: Frame["type"] = "CALL";
      if (isRoot) {
        frameType = "ROOT";
      } else if (parentFrame && parentFrame.steps.length > 0) {
        const parentStep = parentFrame.steps[parentFrame.steps.length - 1];
        const opcode = parentStep.mnemonic;
        if (opcode === "CREATE") frameType = "CREATE";
        else if (opcode === "CREATE2") frameType = "CREATE2";
        else if (opcode === "STATICCALL") frameType = "STATICCALL";
        else if (opcode === "DELEGATECALL") frameType = "DELEGATECALL";
        else if (opcode === "CALLCODE") frameType = "CALLCODE";
        else frameType = "CALL";
      }

      const newFrame: Frame = {
        id: isRoot ? "root" : `frame-${frameIdCounter++}`,
        type: frameType,
        codeAddress: data.to?.toString() ?? "0x0000000000000000000000000000000000000000",
        code,
        input: data.data ? bytesToHex(data.data) : "0x",
        value: data.value ?? 0n,
        caller: data.caller?.toString() ?? DEFAULT_CALLER,
        gas: data.gasLimit,
        steps: [],
        children: [],
        result: {
          exitReason: "success",
          returnData: "0x",
          gasUsed: 0n,
        },
      };

      if (isRoot) {
        // Override root frame's code/input to use original bytecode for better display
        newFrame.code = params.bytecode;
        newFrame.input = params.bytecode;
        rootFrame = newFrame;
      } else if (parentFrame) {
        // Add as child of parent frame
        const childFrame: ChildFrame = {
          frame: newFrame,
          stepIndex: Math.max(0, parentFrame.steps.length - 1),
        };
        parentFrame.children.push(childFrame);
      }

      frameStack.push(newFrame);
      resolve?.();
    };

    const afterMessageHandler = (result: EVMResult, resolve?: (result?: unknown) => void) => {
      const finishedFrame = frameStack.pop();
      if (finishedFrame) {
        finishedFrame.result = {
          exitReason: result.execResult.exceptionError
            ? mapExceptionToReason(result.execResult.exceptionError)
            : "success",
          returnData: bytesToHex(result.execResult.returnValue),
          gasUsed: result.execResult.executionGasUsed,
          deployedAddress: result.createdAddress?.toString(),
        };
      }
      resolve?.();
    };

    evm.events!.on("step", stepHandler);
    evm.events!.on("beforeMessage", beforeMessageHandler);
    evm.events!.on("afterMessage", afterMessageHandler);

    try {
      const gasLimit = params.gasLimit ?? DEFAULT_GAS_LIMIT;
      const caller = createAddressFromString(
        params.from ?? DEFAULT_CALLER
      );

      let execResult;
      let createdAddress: string | undefined;

      if (params.mode === "deploy") {
        // Deploy: runCall with no `to` triggers CREATE semantics
        const result = await evm.runCall({
          data: hexToBytes(params.bytecode as `0x${string}`),
          gasLimit,
          value: params.value ?? 0n,
          caller,
          origin: caller,
          skipBalance: true,
        });
        execResult = result.execResult;
        createdAddress = result.createdAddress?.toString();
      } else {
        // Call: runCode doesn't fire beforeMessage, so create root frame manually
        rootFrame = {
          id: "root",
          type: "ROOT",
          codeAddress: params.to ?? DEFAULT_TO,
          code: params.bytecode,
          input: params.calldata ?? "0x",
          value: params.value ?? 0n,
          caller: params.from ?? DEFAULT_CALLER,
          gas: gasLimit,
          steps: [],
          children: [],
          result: {
            exitReason: "success",
            returnData: "0x",
            gasUsed: 0n,
          },
        };
        frameStack.push(rootFrame);

        execResult = await evm.runCode({
          code: hexToBytes(params.bytecode as `0x${string}`),
          data: params.calldata
            ? hexToBytes(params.calldata as `0x${string}`)
            : undefined,
          gasLimit,
          value: params.value ?? 0n,
          caller,
          to: createAddressFromString(params.to ?? DEFAULT_TO),
        });

        // Update root frame result
        rootFrame.result = {
          exitReason: execResult.exceptionError
            ? mapExceptionToReason(execResult.exceptionError)
            : "success",
          returnData: bytesToHex(execResult.returnValue),
          gasUsed: execResult.executionGasUsed,
        };
      }

      // Sanity check: rootFrame should be set by now
      if (!rootFrame) {
        throw new Error("Internal error: rootFrame not initialized");
      }

      if (rootFrame.steps.length === 0) {
        throw new Error(
          "Execution produced no steps. The bytecode may be empty or invalid."
        );
      }

      // Post-process: fetch code for frames that don't have it (e.g., CALL frames)
      // The code lives in the EVM state, so we need to fetch it from the stateManager
      async function populateMissingCode(frame: Frame): Promise<void> {
        if (frame.code === "0x" && frame.codeAddress) {
          try {
            const address = createAddressFromString(frame.codeAddress);
            const code = await evm.stateManager.getCode(address);
            if (code && code.length > 0) {
              frame.code = bytesToHex(code);
            }
          } catch {
            // Ignore errors - code might not exist
          }
        }
        // Recurse into children
        for (const child of frame.children) {
          await populateMissingCode(child.frame);
        }
      }
      await populateMissingCode(rootFrame);

      return {
        root: rootFrame,
        metadata: {
          mode: params.mode === "deploy" ? "deploy" : "call",
          success: !execResult.exceptionError,
          returnData: bytesToHex(execResult.returnValue),
          gasUsed: execResult.executionGasUsed,
          deployedAddress: createdAddress,
        },
      };
    } finally {
      evm.events!.removeListener("step", stepHandler);
      evm.events!.removeListener("beforeMessage", beforeMessageHandler);
      evm.events!.removeListener("afterMessage", afterMessageHandler);
    }
  }

  async getState(): Promise<WorldState> {
    throw new Error("EthereumjsEngine.getState() not yet implemented");
  }

  async resetState(): Promise<void> {
    this.evmPromise = null;
  }

  async setState(_modifications: StateModifications): Promise<void> {
    throw new Error("EthereumjsEngine.setState() not yet implemented");
  }
}
