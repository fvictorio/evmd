import { describe, it, expect } from "vitest";
import { EthereumjsEngine } from "../src/ethereumjs-engine.js";
import { DebugSession, Frame } from "@evmd/core";

describe("EthereumjsEngine.execute", () => {
  it("executes PUSH1 0x42 STOP and captures stack", async () => {
    const engine = new EthereumjsEngine();
    const bytecode = "0x604200"; // PUSH1 0x42, STOP
    const trace = await engine.execute({
      bytecode,
      mode: "call",
    });

    expect(trace.root.steps).toHaveLength(2);

    // Step 0: PUSH1 — stack empty before execution
    expect(trace.root.steps[0].mnemonic).toBe("PUSH1");
    expect(trace.root.steps[0].pc).toBe(0);
    expect(trace.root.steps[0].stack).toEqual([]);

    // Step 1: STOP — 0x42 on stack
    expect(trace.root.steps[1].mnemonic).toBe("STOP");
    expect(trace.root.steps[1].pc).toBe(2);
    expect(trace.root.steps[1].stack).toEqual(["0x42"]);

    expect(trace.metadata.success).toBe(true);

    // Verify code field is set correctly for call mode
    expect(trace.root.code).toBe(bytecode);
    expect(trace.root.input).toBe("0x"); // calldata is empty
  });

  it("captures ADD result on stack", async () => {
    const engine = new EthereumjsEngine();
    // PUSH1 3, PUSH1 5, ADD, STOP
    const trace = await engine.execute({
      bytecode: "0x600360050100",
      mode: "call",
    });

    expect(trace.root.steps).toHaveLength(4);

    // Before ADD: stack is [0x5, 0x3] (top first)
    const addStep = trace.root.steps[2];
    expect(addStep.mnemonic).toBe("ADD");
    expect(addStep.stack).toEqual(["0x5", "0x3"]);

    // Before STOP: stack is [0x8]
    const stopStep = trace.root.steps[3];
    expect(stopStep.mnemonic).toBe("STOP");
    expect(stopStep.stack).toEqual(["0x8"]);
  });

  it("executes deploy mode (initcode)", async () => {
    const engine = new EthereumjsEngine();
    // Initcode that returns 0xFE as runtime code:
    // PUSH1 0xFE, PUSH1 0x00, MSTORE8, PUSH1 0x01, PUSH1 0x00, RETURN
    const bytecode = "0x60fe60005360016000f3";
    const trace = await engine.execute({
      bytecode,
      mode: "deploy",
    });

    expect(trace.metadata.mode).toBe("deploy");
    expect(trace.metadata.success).toBe(true);
    expect(trace.root.steps.length).toBeGreaterThan(0);
    expect(trace.metadata.deployedAddress).toBeDefined();

    // Verify code field is set correctly for deploy mode
    expect(trace.root.code).toBe(bytecode);
    expect(trace.root.input).toBe(bytecode); // for deploy, input = initcode
  });

  it("reports REVERT as non-success", async () => {
    const engine = new EthereumjsEngine();
    // PUSH1 0x00, PUSH1 0x00, REVERT
    const trace = await engine.execute({
      bytecode: "0x60006000fd",
      mode: "call",
    });

    expect(trace.metadata.success).toBe(false);
    expect(trace.root.result.exitReason).toBe("revert");
  });

  it("captures memory contents", async () => {
    const engine = new EthereumjsEngine();
    // PUSH1 0x42, PUSH1 0x00, MSTORE, STOP
    const trace = await engine.execute({
      bytecode: "0x6042600052" + "00",
      mode: "call",
    });

    // After MSTORE executes, the STOP step should show memory with 0x42
    const stopStep = trace.root.steps[trace.root.steps.length - 1];
    expect(stopStep.memory.current).toContain("42");
  });

  it("resetState creates a fresh EVM", async () => {
    const engine = new EthereumjsEngine();

    // Execute something
    await engine.execute({ bytecode: "0x00", mode: "call" });

    // Reset and execute again — should work without errors
    await engine.resetState();
    const trace = await engine.execute({
      bytecode: "0x604200",
      mode: "call",
    });

    expect(trace.root.steps).toHaveLength(2);
  });
});

describe("Engine → DebugSession integration", () => {
  it("captures code for CALL child frames", async () => {
    const engine = new EthereumjsEngine();

    // Bytecode that:
    // 1. CREATEs a contract with runtime code 0x5f5ff3 (PUSH0, PUSH0, RETURN)
    // 2. CALLs that contract
    //
    // The initcode 0x625f5ff35f526003601df3 does:
    //   PUSH3 0x5f5ff3, PUSH0, MSTORE, PUSH1 0x03, PUSH1 0x1d, RETURN
    //   This deploys 0x5f5ff3 as runtime code
    //
    // The main code stores initcode, CREATEs, then CALLs the created address
    const bytecode =
      "0x6a625f5ff35f526003601df35f52600b60155ff0600160205f5f5f855af160205100";

    const trace = await engine.execute({
      bytecode,
      mode: "deploy",
    });

    // Collect all unique frames
    const frames: Frame[] = [trace.root];
    function collectFrames(frame: Frame) {
      for (const child of frame.children) {
        frames.push(child.frame);
        collectFrames(child.frame);
      }
    }
    collectFrames(trace.root);

    // We expect 3 frames: root, CREATE child, CALL child
    expect(frames).toHaveLength(3);

    // Frame 0: root (the deploy transaction)
    expect(frames[0].type).toBe("ROOT");
    expect(frames[0].code).toBe(bytecode);

    // Frame 1: CREATE child
    // Note: type is "CALL" because data.isCreate is unreliable in ethereumjs
    // The code is correctly set to the initcode via data.data fallback
    expect(frames[1].code).toBe("0x625f5ff35f526003601df3"); // initcode ✓

    // Frame 2: CALL child - THIS IS THE FAILING CASE
    // Currently code is "0x" (empty) because:
    // - data.code is not provided by ethereumjs for internal CALLs
    // - data.data is empty (it's calldata, not code)
    // The fix should capture code from InterpreterStep.code on first step
    expect(frames[2].code).toBe("0x5f5ff3"); // deployed runtime code, not empty!
  });

  it("session.currentFrame.code contains bytecode for call mode", async () => {
    const engine = new EthereumjsEngine();
    const bytecode = "0x604200"; // PUSH1 0x42, STOP

    const trace = await engine.execute({
      bytecode,
      mode: "call",
    });

    const session = new DebugSession(trace);

    // This is exactly what BytecodeView does
    const frame = session.currentFrame;
    expect(frame.code).toBe(bytecode);
    expect(frame.code).not.toBe("");
    expect(frame.code).not.toBeUndefined();
  });

  it("session.currentFrame.code contains bytecode for deploy mode", async () => {
    const engine = new EthereumjsEngine();
    // Initcode that returns 0xFE as runtime code
    const bytecode = "0x60fe60005360016000f3";

    const trace = await engine.execute({
      bytecode,
      mode: "deploy",
    });

    const session = new DebugSession(trace);

    // This is exactly what BytecodeView does
    const frame = session.currentFrame;
    expect(frame.code).toBe(bytecode);
    expect(frame.code).not.toBe("");
    expect(frame.code).not.toBeUndefined();
  });

  it("frame.code is accessible at every step", async () => {
    const engine = new EthereumjsEngine();
    const bytecode = "0x60016002016003600401600500"; // Multiple PUSH/ADD ops

    const trace = await engine.execute({
      bytecode,
      mode: "call",
    });

    const session = new DebugSession(trace);

    // Walk through every step and verify code is accessible
    for (let i = 0; i < session.flatSteps.length; i++) {
      session.jumpTo(i);
      const frame = session.currentFrame;
      expect(frame.code).toBe(bytecode);
    }
  });
});
