import type { DebugSession } from "@evmd/core";

export function CallStackView({ session }: { session: DebugSession }) {
  // Stub: just show current frame
  const frame = session.currentFrame;

  return (
    <div className="evmd-panel evmd-callstack">
      <h3>Call Stack</h3>
      <div>
        {frame.type} @ {frame.codeAddress}
      </div>
    </div>
  );
}
