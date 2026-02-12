import { describe, it, expect } from "vitest";
import { DebugSession } from "../src/debug-session.js";
import type { Trace } from "../src/types.js";

function makeTrace(stepCount: number): Trace {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    pc: i,
    opcode: 0x00,
    mnemonic: "STOP",
    gasRemaining: 1000n,
    gasCost: 0n,
    stack: [] as string[],
    memory: { current: "0x", expandedSize: null },
    storageChanges: [],
    transientStorageChanges: [],
    depth: 0,
  }));

  return {
    root: {
      id: "root",
      type: "ROOT",
      codeAddress: "0x00",
      code: "0x",
      input: "0x",
      value: 0n,
      caller: "0x00",
      gas: 1000n,
      steps,
      children: [],
      result: { exitReason: "success", returnData: "0x", gasUsed: 0n },
    },
    metadata: {
      mode: "call",
      success: true,
      returnData: "0x",
      gasUsed: 0n,
    },
  };
}

describe("DebugSession navigation", () => {
  it("starts at step 0", () => {
    const session = new DebugSession(makeTrace(5));
    expect(session.globalStepIndex).toBe(0);
  });

  it("stepForward advances by 1", () => {
    const session = new DebugSession(makeTrace(5));
    session.stepForward();
    expect(session.globalStepIndex).toBe(1);
  });

  it("stepBackward goes back by 1", () => {
    const session = new DebugSession(makeTrace(5));
    session.stepForward();
    session.stepForward();
    session.stepBackward();
    expect(session.globalStepIndex).toBe(1);
  });

  it("stepForward no-ops at the last step", () => {
    const session = new DebugSession(makeTrace(3));
    // 3 real steps + 1 frame-end = 4 total (indices 0,1,2,3)
    session.stepForward();
    session.stepForward();
    session.stepForward(); // goes to frame-end
    session.stepForward(); // should no-op at frame-end
    expect(session.globalStepIndex).toBe(3); // frame-end is at index 3
  });

  it("stepBackward no-ops at step 0", () => {
    const session = new DebugSession(makeTrace(3));
    session.stepBackward(); // should no-op
    expect(session.globalStepIndex).toBe(0);
  });

  it("jumpTo goes to a specific step", () => {
    const session = new DebugSession(makeTrace(10));
    session.jumpTo(7);
    expect(session.globalStepIndex).toBe(7);
  });

  it("jumpTo clamps to bounds", () => {
    const session = new DebugSession(makeTrace(5));
    // 5 real steps + 1 frame-end = 6 total (indices 0-5)
    session.jumpTo(100);
    expect(session.globalStepIndex).toBe(5); // clamped to frame-end
    session.jumpTo(-5);
    expect(session.globalStepIndex).toBe(0);
  });

  it("jumpToEnd goes to the last step", () => {
    const session = new DebugSession(makeTrace(5));
    // 5 real steps + 1 frame-end = 6 total (indices 0-5)
    session.jumpToEnd();
    expect(session.globalStepIndex).toBe(5); // frame-end
  });

  it("jumpToStart goes back to step 0", () => {
    const session = new DebugSession(makeTrace(5));
    session.jumpToEnd();
    session.jumpToStart();
    expect(session.globalStepIndex).toBe(0);
  });

  it("currentStep returns the correct step", () => {
    const session = new DebugSession(makeTrace(5));
    expect(session.currentStep.pc).toBe(0);
    session.stepForward();
    expect(session.currentStep.pc).toBe(1);
  });

  it("flatSteps has the right length", () => {
    const session = new DebugSession(makeTrace(10));
    // 10 real steps + 1 frame-end = 11 total
    expect(session.flatSteps).toHaveLength(11);
  });
});
