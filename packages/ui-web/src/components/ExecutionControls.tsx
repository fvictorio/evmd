import type { DebuggerController } from "@evmd/ui-common";

export function ExecutionControls({
  controller,
}: {
  controller: DebuggerController;
}) {
  const disabled = !controller.session;

  return (
    <div className="evmd-controls">
      <button onClick={controller.stepBackward} disabled={disabled}>
        Step Back
      </button>
      <button onClick={controller.stepForward} disabled={disabled}>
        Step Forward
      </button>
      <button onClick={controller.stepOver} disabled={disabled}>
        Step Over
      </button>
      <button onClick={controller.stepOut} disabled={disabled}>
        Step Out
      </button>
      <button onClick={controller.continueBackward} disabled={disabled}>
        Continue Back
      </button>
      <button onClick={controller.continueForward} disabled={disabled}>
        Continue
      </button>
      <button onClick={controller.jumpToStart} disabled={disabled}>
        Start
      </button>
      <button onClick={controller.jumpToEnd} disabled={disabled}>
        End
      </button>
      {controller.session && (
        <span className="evmd-step-counter">
          Step {controller.session.globalStepIndex + 1} /{" "}
          {controller.session.flatSteps.length}
        </span>
      )}
    </div>
  );
}
