import type { DebugSession } from "@evmd/core";
import { getOpcodeByCode } from "@evmd/core";

/**
 * Get the annotation for a stack position based on the current opcode.
 * Returns the input name if this position is an input to the opcode.
 */
function getStackAnnotation(
  mnemonic: string,
  stackIndex: number,
  inputNames: string[]
): string | null {
  // Handle DUP opcodes: DUP{n} reads from stack position n-1
  const dupMatch = mnemonic.match(/^DUP(\d+)$/);
  if (dupMatch) {
    const n = parseInt(dupMatch[1], 10);
    if (stackIndex === n - 1) {
      return "value";
    }
    return null;
  }

  // Handle SWAP opcodes: SWAP{n} swaps position 0 with position n
  const swapMatch = mnemonic.match(/^SWAP(\d+)$/);
  if (swapMatch) {
    const n = parseInt(swapMatch[1], 10);
    if (stackIndex === 0) return "a";
    if (stackIndex === n) return "b";
    return null;
  }

  // For all other opcodes, inputs are at positions 0, 1, 2, ... in order
  if (stackIndex < inputNames.length) {
    return inputNames[stackIndex];
  }

  return null;
}

export function StackView({ session }: { session: DebugSession }) {
  const step = session.currentStep;
  const isFrameEnd = session.isAtFrameEnd;

  // At frame end, show the last step's post-execution stack state
  const frame = session.currentFrame;
  const displayStep = step ?? (frame.steps.length > 0 ? frame.steps[frame.steps.length - 1] : null);

  if (!displayStep) {
    return (
      <div className="evmd-panel evmd-stack">
        <h3>Stack</h3>
        <div className="evmd-empty">empty</div>
      </div>
    );
  }

  // At frame end, use post-execution stack; otherwise use pre-execution stack
  const displayStack = isFrameEnd && displayStep.stackAfter
    ? displayStep.stackAfter
    : displayStep.stack;

  // Get input names for the current opcode (only if not at frame end)
  const opcodeInfo = !isFrameEnd ? getOpcodeByCode(displayStep.opcode) : null;
  const inputNames = opcodeInfo?.inputNames ?? [];
  const mnemonic = displayStep.mnemonic;

  return (
    <div className="evmd-panel evmd-stack">
      <h3>Stack</h3>
      {displayStack.length === 0 ? (
        <div className="evmd-empty">empty</div>
      ) : (
        <table>
          <tbody>
            {displayStack.map((item, i) => {
              const annotation = !isFrameEnd ? getStackAnnotation(mnemonic, i, inputNames) : null;
              return (
                <tr key={i}>
                  <td className="evmd-stack-index">{i}</td>
                  <td className="evmd-stack-value" title={item}>{item}</td>
                  {annotation && (
                    <td className="evmd-stack-input-name">{annotation}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
