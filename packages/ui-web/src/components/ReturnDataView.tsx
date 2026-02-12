import type { DebugSession } from "@evmd/core";

export function ReturnDataView({ session }: { session: DebugSession }) {
  const frame = session.currentFrame;
  const { result } = frame;

  return (
    <div className="evmd-panel evmd-return-data">
      <h3>Return Data</h3>
      <div className="evmd-return-status">
        <span className={`evmd-exit-reason evmd-exit-${result.exitReason}`}>
          {result.exitReason}
        </span>
        {result.deployedAddress && (
          <span className="evmd-deployed-address">
            deployed: {result.deployedAddress}
          </span>
        )}
      </div>
      <div className="evmd-return-data-content">
        {result.returnData === "0x" ? (
          <span className="evmd-empty">empty</span>
        ) : (
          <code className="evmd-hex-data">{result.returnData}</code>
        )}
      </div>
      <div className="evmd-gas-used">
        Gas used: {result.gasUsed.toString()}
      </div>
    </div>
  );
}
