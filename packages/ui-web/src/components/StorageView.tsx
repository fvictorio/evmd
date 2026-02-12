import type { DebugSession } from "@evmd/core";

export function StorageView({ session }: { session: DebugSession }) {
  const step = session.currentStep;
  const isFrameEnd = session.isAtFrameEnd;

  // At frame end, show the last step's storage state plus any changes from that step
  const frame = session.currentFrame;
  const displayStep = step ?? (frame.steps.length > 0 ? frame.steps[frame.steps.length - 1] : null);

  // Build the storage state
  let storage: Record<string, string> = { ...(displayStep?.storage ?? {}) };

  // At frame end, apply the last step's storage changes (since storage shows state BEFORE execution)
  if (isFrameEnd && displayStep?.storageChanges) {
    for (const change of displayStep.storageChanges) {
      storage[change.slot] = change.after;
    }
  }

  const slots = Object.keys(storage).sort((a, b) => {
    // Sort by numeric value of slot
    const aVal = BigInt(a);
    const bVal = BigInt(b);
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  return (
    <div className="evmd-panel evmd-storage">
      <h3>Storage</h3>
      {slots.length === 0 ? (
        <div className="evmd-empty">no storage touched</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Slot</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot}>
                <td>{slot}</td>
                <td>{storage[slot]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
