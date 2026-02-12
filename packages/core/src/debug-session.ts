import type {
  Trace,
  Frame,
  Step,
  FlatStep,
  Breakpoint,
  BreakpointCondition,
} from "./types.js";

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

  get currentStep(): Step {
    const { frame, stepIndex } = this.flatSteps[this._globalStepIndex];
    return frame.steps[stepIndex];
  }

  // --- Navigation (stubs) ---

  stepForward(): void {
    // Stub
    throw new Error("stepForward() not yet implemented");
  }

  stepBackward(): void {
    // Stub
    throw new Error("stepBackward() not yet implemented");
  }

  stepOver(): void {
    // Stub
    throw new Error("stepOver() not yet implemented");
  }

  stepOut(): void {
    // Stub
    throw new Error("stepOut() not yet implemented");
  }

  jumpTo(_globalIndex: number): void {
    // Stub
    throw new Error("jumpTo() not yet implemented");
  }

  jumpToStart(): void {
    // Stub
    throw new Error("jumpToStart() not yet implemented");
  }

  jumpToEnd(): void {
    // Stub
    throw new Error("jumpToEnd() not yet implemented");
  }

  // --- Breakpoints (stubs) ---

  addBreakpoint(_condition: BreakpointCondition): Breakpoint {
    // Stub
    throw new Error("addBreakpoint() not yet implemented");
  }

  removeBreakpoint(_id: string): void {
    // Stub
    throw new Error("removeBreakpoint() not yet implemented");
  }

  getBreakpoints(): Breakpoint[] {
    // Stub
    return [];
  }

  continueForward(): boolean {
    // Stub
    throw new Error("continueForward() not yet implemented");
  }

  continueBackward(): boolean {
    // Stub
    throw new Error("continueBackward() not yet implemented");
  }

  // --- Call stack ---

  getCallStack(): Frame[] {
    // Stub
    throw new Error("getCallStack() not yet implemented");
  }
}

/** Flatten all steps in execution order across all frames. */
function flattenSteps(root: Frame): FlatStep[] {
  const result: FlatStep[] = [];

  function visit(frame: Frame): void {
    let childIdx = 0;
    for (let i = 0; i < frame.steps.length; i++) {
      result.push({ frame, stepIndex: i });
      // If a child frame was spawned at this step, recurse into it
      while (
        childIdx < frame.children.length &&
        frame.children[childIdx].stepIndex === i
      ) {
        visit(frame.children[childIdx].frame);
        childIdx++;
      }
    }
  }

  visit(root);
  return result;
}
