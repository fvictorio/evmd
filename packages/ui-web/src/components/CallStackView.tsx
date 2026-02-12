import type { DebugSession } from "@evmd/core";

export function CallStackView({ session }: { session: DebugSession }) {
  const callStack = session.getCallStack();

  return (
    <div className="evmd-panel evmd-callstack">
      <h3>Call Stack</h3>
      <div className="evmd-callstack-list">
        {callStack
          .slice()
          .reverse()
          .map((frame, index) => (
            <div
              key={frame.id}
              className={`evmd-callstack-frame${index === 0 ? " evmd-callstack-current" : ""}`}
            >
              <span className="evmd-callstack-type">{frame.type}</span>
              <span className="evmd-callstack-address">
                {formatAddress(frame.codeAddress)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
