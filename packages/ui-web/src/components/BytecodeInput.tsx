import { useState, useCallback } from "react";
import { assemble } from "@evmd/core";
import type { DebuggerController } from "@evmd/ui-common";

export function BytecodeInput({
  controller,
}: {
  controller: DebuggerController;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    let bytecode: string;
    try {
      bytecode = controller.inputMode === "mnemonic"
        ? assemble(controller.source)
        : controller.source;
    } catch {
      return; // Assembly error — Run will surface it anyway
    }

    const params = new URLSearchParams();
    params.set("bytecode", bytecode);
    params.set("mode", controller.executionMode);
    if (controller.calldata) params.set("calldata", controller.calldata);

    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [controller]);

  return (
    <div className="evmd-bytecode-input">
      <div className="evmd-input-header">
        <label>
          <select
            value={controller.inputMode}
            onChange={(e) =>
              controller.setInputMode(
                e.target.value as "bytecode" | "mnemonic"
              )
            }
          >
            <option value="mnemonic">Mnemonic</option>
            <option value="bytecode">Bytecode</option>
          </select>
        </label>
        <label>
          <select
            value={controller.executionMode}
            onChange={(e) =>
              controller.setExecutionMode(e.target.value as "call" | "deploy")
            }
          >
            <option value="deploy">Deploy</option>
            <option value="call">Call</option>
          </select>
        </label>
        <button onClick={() => controller.execute()}>Run</button>
        <button onClick={handleShare}>{copied ? "Copied!" : "Share"}</button>
      </div>
      <textarea
        value={controller.source}
        onChange={(e) => controller.setSource(e.target.value)}
        placeholder={
          controller.inputMode === "mnemonic"
            ? "PUSH1 0x42\nPUSH1 0x00\nMSTORE\nSTOP"
            : "0x604260005260206000f3"
        }
        rows={10}
        spellCheck={false}
      />
      {controller.executionMode === "call" && (
        <div className="evmd-calldata-input">
          <label>Calldata</label>
          <input
            type="text"
            value={controller.calldata}
            onChange={(e) => controller.setCalldata(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
