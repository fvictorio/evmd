import type { DebugSession } from "@evmd/core";

export function MemoryView({ session }: { session: DebugSession }) {
  const memory = session.currentStep.memory;
  const hex = memory.current.startsWith("0x")
    ? memory.current.slice(2)
    : memory.current;

  // Split into 32-byte (64 hex char) rows
  const rows: string[] = [];
  for (let i = 0; i < hex.length; i += 64) {
    rows.push(hex.slice(i, i + 64));
  }

  return (
    <div className="evmd-panel evmd-memory">
      <h3>Memory</h3>
      {rows.length === 0 ? (
        <div className="evmd-empty">empty</div>
      ) : (
        <table>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="evmd-memory-offset">
                  0x{(i * 32).toString(16).padStart(4, "0")}
                </td>
                <td className="evmd-memory-value">{row}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
