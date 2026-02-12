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

  stepOver(): void {
    // TODO: implement properly with child frame skipping
    this.stepForward();
  }

  stepOut(): void {
    // TODO: implement properly with parent frame return
    this.stepForward();
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
