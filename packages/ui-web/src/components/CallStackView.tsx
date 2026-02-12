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
              <span className="evmd-callstack-address">{frame.codeAddress}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
