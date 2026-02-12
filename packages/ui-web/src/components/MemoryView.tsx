import { useState } from "react";
import type { DebugSession } from "@evmd/core";

// Header showing byte offsets 00-1f
const BYTE_OFFSETS = Array.from({ length: 32 }, (_, i) =>
  i.toString(16).padStart(2, "0")
);

export function MemoryView({ session }: { session: DebugSession }) {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const step = session.currentStep;

  // At frame end, show the last step's memory state
  const frame = session.currentFrame;
  const displayStep = step ?? (frame.steps.length > 0 ? frame.steps[frame.steps.length - 1] : null);

  if (!displayStep) {
    return (
      <div className="evmd-panel evmd-memory">
        <h3>Memory</h3>
        <div className="evmd-empty">empty</div>
      </div>
    );
  }

  const memory = displayStep.memory;
  const hex = memory.current.startsWith("0x")
    ? memory.current.slice(2)
    : memory.current;

  // Split into 32-byte (64 hex char) rows, then split each row into bytes
  const rows: string[][] = [];
  for (let i = 0; i < hex.length; i += 64) {
    const rowHex = hex.slice(i, i + 64);
    const bytes: string[] = [];
    for (let j = 0; j < rowHex.length; j += 2) {
      bytes.push(rowHex.slice(j, j + 2));
    }
    // Pad to 32 bytes if needed
    while (bytes.length < 32) {
      bytes.push("00");
    }
    rows.push(bytes);
  }

  return (
    <div className="evmd-panel evmd-memory">
      <h3>Memory</h3>
      {rows.length === 0 ? (
        <div className="evmd-empty">empty</div>
      ) : (
        <div className="evmd-memory-grid">
          <div className="evmd-memory-row evmd-memory-header-row">
            <span className="evmd-memory-offset"></span>
            {BYTE_OFFSETS.map((offset, i) => (
              <span
                key={i}
                className={`evmd-memory-header${hoveredCol === i ? " evmd-memory-col-hover" : ""}`}
                onMouseEnter={() => setHoveredCol(i)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {offset}
              </span>
            ))}
          </div>
          {rows.map((bytes, rowIndex) => (
            <div key={rowIndex} className="evmd-memory-row">
              <span className="evmd-memory-offset">
                0x{(rowIndex * 32).toString(16).padStart(4, "0")}
              </span>
              {bytes.map((byte, colIndex) => (
                <span
                  key={colIndex}
                  className={`evmd-memory-byte${hoveredCol === colIndex ? " evmd-memory-col-hover" : ""}`}
                  onMouseEnter={() => setHoveredCol(colIndex)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  {byte}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
