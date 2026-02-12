import type { DebugSession } from "@evmd/core";

export function StackView({ session }: { session: DebugSession }) {
  const step = session.currentStep;

  return (
    <div className="evmd-panel evmd-stack">
      <h3>Stack</h3>
      {step.stack.length === 0 ? (
        <div className="evmd-empty">empty</div>
      ) : (
        <table>
          <tbody>
            {step.stack.map((item, i) => (
              <tr key={i}>
                <td className="evmd-stack-index">{i}</td>
                <td className="evmd-stack-value">{item}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
