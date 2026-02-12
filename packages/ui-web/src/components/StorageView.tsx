import type { DebugSession } from "@evmd/core";

export function StorageView({ session }: { session: DebugSession }) {
  const step = session.currentStep;

  if (!step) {
    return (
      <div className="evmd-panel evmd-storage">
        <h3>Storage</h3>
        <div className="evmd-empty">frame ended</div>
      </div>
    );
  }

  const changes = step.storageChanges;

  return (
    <div className="evmd-panel evmd-storage">
      <h3>Storage</h3>
      {changes.length === 0 ? (
        <div className="evmd-empty">no changes at this step</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Slot</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c, i) => (
              <tr key={i}>
                <td>{c.slot}</td>
                <td>{c.before}</td>
                <td>{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
