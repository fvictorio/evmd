import type {
  Trace,
  Frame,
  Step,
  FlatStep,
  Breakpoint,
  BreakpointCondition,
} from "./types.js";

// Opcodes that create child frames
const FRAME_CREATING_OPCODES = new Set([
  0xf0, // CREATE
  0xf1, // CALL
  0xf2, // CALLCODE
  0xf4, // DELEGATECALL
  0xf5, // CREATE2
  0xfa, // STATICCALL
]);

export class DebugSession {
  readonly trace: Trace;
  readonly flatSteps: FlatStep[];

  private _globalStepIndex: number = 0;

  constructor(trace: Trace) {
    this.trace = trace;
    this.flatSteps = flattenSteps(trace.root);
  }

  get globalStepIndex(): number {
    return this._globalStepIndex;
  }

  get currentFrame(): Frame {
    return this.flatSteps[this._globalStepIndex].frame;
  }

  get currentStepIndex(): number {
    return this.flatSteps[this._globalStepIndex].stepIndex;
  }

  get currentStep(): Step | null {
    const flatStep = this.flatSteps[this._globalStepIndex];
    if (flatStep.isFrameEnd) {
      return null;
    }
    return flatStep.frame.steps[flatStep.stepIndex];
  }

  get isAtFrameEnd(): boolean {
    return this.flatSteps[this._globalStepIndex].isFrameEnd === true;
  }

  // --- Navigation ---

  stepForward(): void {
    if (this._globalStepIndex < this.flatSteps.length - 1) {
      this._globalStepIndex++;
    }
  }

  stepBackward(): void {
    if (this._globalStepIndex > 0) {
      this._globalStepIndex--;
    }
  }

  /**
   * Check if step over would skip a child frame (i.e., current opcode creates a frame).
   */
  canStepOver(): boolean {
    const currentStep = this.currentStep;
    return currentStep !== null && FRAME_CREATING_OPCODES.has(currentStep.opcode);
  }

  /**
   * Check if step out is available (i.e., not at root frame).
   */
  canStepOut(): boolean {
    return this.getCallStack().length > 1;
  }

  /**
   * Step over: if the current opcode creates a child frame, skip over it.
   * Otherwise, just step forward.
   */
  stepOver(): void {
    const currentStep = this.currentStep;
    if (!currentStep || !FRAME_CREATING_OPCODES.has(currentStep.opcode)) {
      // Not a frame-creating opcode, just step forward
      this.stepForward();
      return;
    }

    // Skip over the child frame by advancing until we're back in the same frame
    // at a later step index (or at frame end)
    const currentFrame = this.currentFrame;
    const currentStepIdx = this.currentStepIndex;

    while (this._globalStepIndex < this.flatSteps.length - 1) {
      this._globalStepIndex++;
      const flat = this.flatSteps[this._globalStepIndex];
      // Stop when we're back in the same frame at a different step (or frame end)
      if (flat.frame === currentFrame && flat.stepIndex !== currentStepIdx) {
        break;
      }
    }
  }

  /**
   * Step out: continue until we exit the current frame (return to parent).
   * Only works if not in the root frame.
   */
  stepOut(): void {
    const currentCallStack = this.getCallStack();
    if (currentCallStack.length <= 1) {
      // Already at root frame, can't step out - just go to end
      this.jumpToEnd();
      return;
    }

    const currentDepth = currentCallStack.length;

    // Advance until we're at a shallower depth (exited current frame)
    while (this._globalStepIndex < this.flatSteps.length - 1) {
      this._globalStepIndex++;
      const flat = this.flatSteps[this._globalStepIndex];
      if (flat.callStack.length < currentDepth) {
        break;
      }
    }
  }

  jumpTo(globalIndex: number): void {
    this._globalStepIndex = Math.max(
      0,
      Math.min(globalIndex, this.flatSteps.length - 1)
    );
  }

  jumpToStart(): void {
    this._globalStepIndex = 0;
  }

  jumpToEnd(): void {
    this._globalStepIndex = this.flatSteps.length - 1;
  }

  // --- Breakpoints (stubs) ---

  addBreakpoint(_condition: BreakpointCondition): Breakpoint {
    throw new Error("addBreakpoint() not yet implemented");
  }

  removeBreakpoint(_id: string): void {
    // no-op for now
  }

  getBreakpoints(): Breakpoint[] {
    return [];
  }

  continueForward(): boolean {
    // TODO: implement with breakpoint matching
    return false;
  }

  continueBackward(): boolean {
    // TODO: implement with breakpoint matching
    return false;
  }

  // --- Call stack ---

  getCallStack(): Frame[] {
    return this.flatSteps[this._globalStepIndex].callStack;
  }
}

/** Flatten all steps in execution order across all frames. */
function flattenSteps(root: Frame): FlatStep[] {
  const result: FlatStep[] = [];

  function visit(frame: Frame, parentStack: Frame[]): void {
    const callStack = [...parentStack, frame];
    let childIdx = 0;
    for (let i = 0; i < frame.steps.length; i++) {
      result.push({ frame, stepIndex: i, callStack });
      // If a child frame was spawned at this step, recurse into it
      while (
        childIdx < frame.children.length &&
        frame.children[childIdx].stepIndex === i
      ) {
        visit(frame.children[childIdx].frame, callStack);
        childIdx++;
      }
    }
    // Add a virtual "frame end" step to show return data
    result.push({ frame, stepIndex: -1, callStack, isFrameEnd: true });
  }

  visit(root, []);
  return result;
}
